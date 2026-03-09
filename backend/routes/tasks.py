"""
TaskFinance - Rotas de Tarefas (PostgreSQL + SQLite)
"""
from flask import Blueprint, request, jsonify
from database import get_conn, adapt_sql, last_insert_id, USE_POSTGRES
from datetime import datetime

tasks_bp = Blueprint('tasks', __name__)

PH = '%s' if USE_POSTGRES else '?'  # placeholder dinâmico

@tasks_bp.route('/', methods=['GET'])
def get_tasks():
    status     = request.args.get('status')
    priority   = request.args.get('priority')
    category_id = request.args.get('category_id')
    search     = request.args.get('search', '')

    sql = """SELECT t.*, c.name as category_name, c.color as category_color
             FROM tasks t LEFT JOIN categories c ON t.category_id=c.id WHERE 1=1"""
    params = []

    if status and status != 'all':
        sql += f" AND t.status={PH}"; params.append(status)
    if priority and priority != 'all':
        sql += f" AND t.priority={PH}"; params.append(priority)
    if category_id:
        sql += f" AND t.category_id={PH}"; params.append(int(category_id))
    if search:
        op = 'ILIKE' if USE_POSTGRES else 'LIKE'
        sql += f" AND t.title {op} {PH}"; params.append(f'%{search}%')
    sql += " ORDER BY t.created_at DESC"

    conn = get_conn()
    c = conn.cursor()
    c.execute(sql, params)
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@tasks_bp.route('/', methods=['POST'])
def create_task():
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'error': 'Título é obrigatório'}), 400

    returning = "RETURNING id" if USE_POSTGRES else ""
    sql = f"""INSERT INTO tasks (title, description, priority, status, category_id, due_date)
              VALUES ({PH},{PH},{PH},{PH},{PH},{PH}) {returning}"""

    conn = get_conn()
    c = conn.cursor()
    c.execute(sql, (
        data['title'], data.get('description', ''),
        data.get('priority', 'medium'), data.get('status', 'pending'),
        data.get('category_id'), data.get('due_date')
    ))
    new_id = last_insert_id(c, 'tasks')
    conn.commit()

    c.execute(f"""SELECT t.*, c.name as category_name, c.color as category_color
                  FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
                  WHERE t.id={PH}""", (new_id,))
    row = c.fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@tasks_bp.route('/<int:tid>', methods=['PUT'])
def update_task(tid):
    data = request.get_json()
    fields, params = [], []

    for f in ('title', 'description', 'priority', 'status', 'category_id', 'due_date'):
        if f in data:
            fields.append(f"{f}={PH}")
            params.append(data[f])

    now_expr = "NOW()" if USE_POSTGRES else "datetime('now')"
    fields.append(f"updated_at={now_expr}")

    conn = get_conn()
    c = conn.cursor()
    if fields:
        c.execute(f"UPDATE tasks SET {','.join(fields)} WHERE id={PH}", params + [tid])
        conn.commit()

    c.execute(f"""SELECT t.*, c.name as category_name, c.color as category_color
                  FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
                  WHERE t.id={PH}""", (tid,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@tasks_bp.route('/<int:tid>', methods=['DELETE'])
def delete_task(tid):
    conn = get_conn()
    c = conn.cursor()
    c.execute(f"DELETE FROM tasks WHERE id={PH}", (tid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'Tarefa deletada'})


@tasks_bp.route('/<int:tid>/toggle', methods=['PATCH'])
def toggle_task(tid):
    conn = get_conn()
    c = conn.cursor()
    c.execute(f"SELECT status FROM tasks WHERE id={PH}", (tid,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Not found'}), 404

    new_status = 'pending' if row['status'] == 'completed' else 'completed'
    now_expr = "NOW()" if USE_POSTGRES else "datetime('now')"
    c.execute(f"UPDATE tasks SET status={PH}, updated_at={now_expr} WHERE id={PH}", (new_status, tid))
    conn.commit()

    c.execute(f"""SELECT t.*, c.name as category_name, c.color as category_color
                  FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
                  WHERE t.id={PH}""", (tid,))
    row = c.fetchone()
    conn.close()
    return jsonify(dict(row))


@tasks_bp.route('/stats/today', methods=['GET'])
def today_stats():
    conn = get_conn()
    c = conn.cursor()
    today = datetime.utcnow().strftime('%Y-%m-%d')

    c.execute("SELECT COUNT(*) as n FROM tasks"); total = c.fetchone()['n']

    if USE_POSTGRES:
        c.execute(f"SELECT COUNT(*) as n FROM tasks WHERE status='completed' AND updated_at::date={PH}", (today,))
    else:
        c.execute(f"SELECT COUNT(*) as n FROM tasks WHERE status='completed' AND date(updated_at)={PH}", (today,))
    completed_today = c.fetchone()['n']

    c.execute("SELECT COUNT(*) as n FROM tasks WHERE status='pending'"); pending = c.fetchone()['n']

    if USE_POSTGRES:
        c.execute("SELECT COUNT(*) as n FROM tasks WHERE status!='completed' AND due_date IS NOT NULL AND due_date < NOW()")
    else:
        c.execute("SELECT COUNT(*) as n FROM tasks WHERE status!='completed' AND due_date IS NOT NULL AND due_date < datetime('now')")
    overdue = c.fetchone()['n']

    conn.close()
    return jsonify({
        'total': total, 'completed_today': completed_today,
        'pending': pending, 'overdue': overdue,
        'productivity': round((completed_today / max(total, 1)) * 100, 1)
    })
