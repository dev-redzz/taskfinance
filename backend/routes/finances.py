"""
TaskFinance - Rotas Financeiras (PostgreSQL + SQLite)
"""
from flask import Blueprint, request, jsonify
from database import get_conn, USE_POSTGRES, last_insert_id

finances_bp = Blueprint('finances', __name__)

PH = '%s' if USE_POSTGRES else '?'

def month_filter_expr(alias=''):
    """Expressão para filtrar por YYYY-MM conforme o banco."""
    col = f"{alias}.date" if alias else "date"
    if USE_POSTGRES:
        return f"TO_CHAR({col}, 'YYYY-MM')"
    return f"strftime('%Y-%m', {col})"


@finances_bp.route('/', methods=['GET'])
def get_transactions():
    month  = request.args.get('month')
    type_  = request.args.get('type')
    search = request.args.get('search', '')
    limit  = request.args.get('limit', 100, type=int)

    sql = """SELECT t.*, c.name as category_name, c.color as category_color
             FROM transactions t LEFT JOIN categories c ON t.category_id=c.id WHERE 1=1"""
    params = []

    if month:
        sql += f" AND {month_filter_expr('t')}={PH}"; params.append(month)
    if type_ and type_ != 'all':
        sql += f" AND t.type={PH}"; params.append(type_)
    if search:
        op = 'ILIKE' if USE_POSTGRES else 'LIKE'
        sql += f" AND t.title {op} {PH}"; params.append(f'%{search}%')
    sql += f" ORDER BY t.date DESC LIMIT {limit}"

    conn = get_conn()
    c = conn.cursor()
    c.execute(sql, params)
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@finances_bp.route('/', methods=['POST'])
def create_transaction():
    data = request.get_json()
    if not data or not data.get('title') or not data.get('amount'):
        return jsonify({'error': 'Título e valor são obrigatórios'}), 400
    if data.get('type') not in ('income', 'expense'):
        return jsonify({'error': 'Tipo inválido'}), 400

    returning = "RETURNING id" if USE_POSTGRES else ""
    sql = f"""INSERT INTO transactions (title, amount, type, category_id, description, date)
              VALUES ({PH},{PH},{PH},{PH},{PH},{PH}) {returning}"""

    conn = get_conn()
    c = conn.cursor()
    c.execute(sql, (
        data['title'], float(data['amount']), data['type'],
        data.get('category_id'), data.get('description', ''),
        data.get('date') or None
    ))
    new_id = last_insert_id(c, 'transactions')
    conn.commit()

    c.execute(f"""SELECT t.*, c.name as category_name, c.color as category_color
                  FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
                  WHERE t.id={PH}""", (new_id,))
    row = c.fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@finances_bp.route('/<int:tid>', methods=['PUT'])
def update_transaction(tid):
    data = request.get_json()
    fields, params = [], []
    for f in ('title', 'amount', 'type', 'category_id', 'description', 'date'):
        if f in data:
            fields.append(f"{f}={PH}")
            params.append(float(data[f]) if f == 'amount' else data[f])

    conn = get_conn()
    c = conn.cursor()
    if fields:
        c.execute(f"UPDATE transactions SET {','.join(fields)} WHERE id={PH}", params + [tid])
        conn.commit()

    c.execute(f"""SELECT t.*, c.name as category_name, c.color as category_color
                  FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
                  WHERE t.id={PH}""", (tid,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@finances_bp.route('/<int:tid>', methods=['DELETE'])
def delete_transaction(tid):
    conn = get_conn()
    c = conn.cursor()
    c.execute(f"DELETE FROM transactions WHERE id={PH}", (tid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'Deletado'})


@finances_bp.route('/summary', methods=['GET'])
def get_summary():
    month = request.args.get('month')
    conn = get_conn()
    c = conn.cursor()

    if month:
        where = f"WHERE {month_filter_expr()}={PH}"; p = (month,)
    else:
        if USE_POSTGRES:
            where = "WHERE TO_CHAR(date,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')"; p = ()
        else:
            where = "WHERE strftime('%Y-%m',date)=strftime('%Y-%m','now')"; p = ()

    c.execute(f"SELECT COALESCE(SUM(amount),0) as s FROM transactions {where} AND type='income'", p)
    income = float(c.fetchone()['s'])
    c.execute(f"SELECT COALESCE(SUM(amount),0) as s FROM transactions {where} AND type='expense'", p)
    expenses = float(c.fetchone()['s'])
    conn.close()
    return jsonify({'income': round(income, 2), 'expenses': round(expenses, 2),
                    'balance': round(income - expenses, 2), 'month': month or ''})


@finances_bp.route('/by-category', methods=['GET'])
def by_category():
    month = request.args.get('month')
    conn = get_conn()
    c = conn.cursor()

    if month:
        date_cond = f"AND {month_filter_expr('t')}={PH}"; p = (month,)
    else:
        if USE_POSTGRES:
            date_cond = "AND TO_CHAR(t.date,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')"; p = ()
        else:
            date_cond = "AND strftime('%Y-%m',t.date)=strftime('%Y-%m','now')"; p = ()

    c.execute(f"""SELECT c.name as category, c.color, SUM(t.amount) as total
                  FROM transactions t JOIN categories c ON t.category_id=c.id
                  WHERE t.type='expense' {date_cond}
                  GROUP BY c.id, c.name, c.color ORDER BY total DESC""", p)
    rows = c.fetchall()
    conn.close()
    return jsonify([{'category': r['category'], 'color': r['color'],
                     'total': round(float(r['total']), 2)} for r in rows])


@finances_bp.route('/monthly-evolution', methods=['GET'])
def monthly_evolution():
    conn = get_conn()
    c = conn.cursor()

    if USE_POSTGRES:
        c.execute("""SELECT TO_CHAR(date,'YYYY-MM') as month, type, SUM(amount) as total
                     FROM transactions GROUP BY month, type ORDER BY month""")
    else:
        c.execute("""SELECT strftime('%Y-%m',date) as month, type, SUM(amount) as total
                     FROM transactions GROUP BY month, type ORDER BY month""")

    rows = c.fetchall()
    conn.close()

    data = {}
    for r in rows:
        k = r['month']
        if k not in data:
            data[k] = {'month': k, 'income': 0, 'expenses': 0}
        if r['type'] == 'income':
            data[k]['income'] = round(float(r['total']), 2)
        else:
            data[k]['expenses'] = round(float(r['total']), 2)
    return jsonify(sorted(data.values(), key=lambda x: x['month'])[-6:])
