"""
TaskFinance - Rotas de Metas (PostgreSQL + SQLite)
"""
from flask import Blueprint, request, jsonify
from database import get_conn, USE_POSTGRES, last_insert_id

goals_bp = Blueprint('goals', __name__)
PH = '%s' if USE_POSTGRES else '?'

def enrich(row):
    if not row: return None
    d = dict(row)
    d['target_amount'] = float(d['target_amount'])
    d['current_amount'] = float(d['current_amount'])
    d['progress'] = round(min((d['current_amount'] / d['target_amount']) * 100, 100), 1) if d['target_amount'] else 0
    return d

@goals_bp.route('/', methods=['GET'])
def get_goals():
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT * FROM goals ORDER BY created_at DESC")
    rows = c.fetchall(); conn.close()
    return jsonify([enrich(r) for r in rows])

@goals_bp.route('/', methods=['POST'])
def create_goal():
    data = request.get_json()
    if not data or not data.get('title') or not data.get('target_amount'):
        return jsonify({'error': 'Título e valor alvo obrigatórios'}), 400
    returning = "RETURNING id" if USE_POSTGRES else ""
    conn = get_conn(); c = conn.cursor()
    c.execute(f"""INSERT INTO goals (title,description,target_amount,current_amount,deadline,color)
                  VALUES ({PH},{PH},{PH},{PH},{PH},{PH}) {returning}""",
              (data['title'], data.get('description',''), float(data['target_amount']),
               float(data.get('current_amount',0)), data.get('deadline'), data.get('color','#F59E0B')))
    new_id = last_insert_id(c, 'goals')
    conn.commit()
    c.execute(f"SELECT * FROM goals WHERE id={PH}", (new_id,))
    row = c.fetchone(); conn.close()
    return jsonify(enrich(row)), 201

@goals_bp.route('/<int:gid>', methods=['PUT'])
def update_goal(gid):
    data = request.get_json()
    fields, params = [], []
    for f in ('title','description','target_amount','current_amount','deadline','color','status'):
        if f in data:
            fields.append(f"{f}={PH}")
            params.append(float(data[f]) if f in ('target_amount','current_amount') else data[f])
    conn = get_conn(); c = conn.cursor()
    if fields:
        c.execute(f"UPDATE goals SET {','.join(fields)} WHERE id={PH}", params+[gid])
        conn.commit()
    c.execute(f"SELECT * FROM goals WHERE id={PH}", (gid,))
    row = c.fetchone(); conn.close()
    return jsonify(enrich(row))

@goals_bp.route('/<int:gid>', methods=['DELETE'])
def delete_goal(gid):
    conn = get_conn(); c = conn.cursor()
    c.execute(f"DELETE FROM goals WHERE id={PH}", (gid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'Deletado'})

@goals_bp.route('/<int:gid>/deposit', methods=['POST'])
def deposit(gid):
    data = request.get_json()
    amount = float(data.get('amount', 0))
    conn = get_conn(); c = conn.cursor()
    c.execute(f"SELECT * FROM goals WHERE id={PH}", (gid,))
    row = c.fetchone()
    if not row: conn.close(); return jsonify({'error': 'Not found'}), 404
    new_val = min(float(row['current_amount']) + amount, float(row['target_amount']))
    status = 'completed' if new_val >= float(row['target_amount']) else 'active'
    c.execute(f"UPDATE goals SET current_amount={PH}, status={PH} WHERE id={PH}", (new_val, status, gid))
    conn.commit()
    c.execute(f"SELECT * FROM goals WHERE id={PH}", (gid,))
    row = c.fetchone(); conn.close()
    return jsonify(enrich(row))
