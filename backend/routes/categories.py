"""
TaskFinance - Rotas de Categorias (PostgreSQL + SQLite)
"""
from flask import Blueprint, request, jsonify
from database import get_conn, USE_POSTGRES, last_insert_id

categories_bp = Blueprint('categories', __name__)
PH = '%s' if USE_POSTGRES else '?'

@categories_bp.route('/', methods=['GET'])
def get_categories():
    type_ = request.args.get('type')
    conn = get_conn(); c = conn.cursor()
    if type_:
        c.execute(f"SELECT * FROM categories WHERE type={PH} OR type='both' ORDER BY name", (type_,))
    else:
        c.execute("SELECT * FROM categories ORDER BY name")
    rows = c.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])

@categories_bp.route('/', methods=['POST'])
def create_category():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Nome obrigatório'}), 400
    returning = "RETURNING id" if USE_POSTGRES else ""
    conn = get_conn(); c = conn.cursor()
    c.execute(f"INSERT INTO categories (name,color,icon,type) VALUES ({PH},{PH},{PH},{PH}) {returning}",
              (data['name'], data.get('color','#8B5CF6'), data.get('icon','tag'), data.get('type','both')))
    new_id = last_insert_id(c, 'categories')
    conn.commit()
    c.execute(f"SELECT * FROM categories WHERE id={PH}", (new_id,))
    row = c.fetchone(); conn.close()
    return jsonify(dict(row)), 201

@categories_bp.route('/<int:cid>', methods=['PUT'])
def update_category(cid):
    data = request.get_json()
    fields, params = [], []
    for f in ('name','color','icon','type'):
        if f in data: fields.append(f"{f}={PH}"); params.append(data[f])
    conn = get_conn(); c = conn.cursor()
    if fields:
        c.execute(f"UPDATE categories SET {','.join(fields)} WHERE id={PH}", params+[cid])
        conn.commit()
    c.execute(f"SELECT * FROM categories WHERE id={PH}", (cid,))
    row = c.fetchone(); conn.close()
    return jsonify(dict(row))

@categories_bp.route('/<int:cid>', methods=['DELETE'])
def delete_category(cid):
    conn = get_conn(); c = conn.cursor()
    c.execute(f"DELETE FROM categories WHERE id={PH}", (cid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'Deletado'})
