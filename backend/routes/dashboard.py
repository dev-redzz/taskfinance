"""
TaskFinance - Dashboard e Export (PostgreSQL + SQLite)
"""
from flask import Blueprint, make_response
from database import get_conn, USE_POSTGRES
from datetime import datetime
import csv, io

dashboard_bp = Blueprint('dashboard', __name__)
export_bp    = Blueprint('export', __name__)

PH = '%s' if USE_POSTGRES else '?'

def month_now_filter(col='date'):
    if USE_POSTGRES:
        return f"TO_CHAR({col},'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')"
    return f"strftime('%Y-%m',{col})=strftime('%Y-%m','now')"


@dashboard_bp.route('/', methods=['GET'])
def get_dashboard():
    conn = get_conn(); c = conn.cursor()

    # Receitas e despesas do mês
    c.execute(f"SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE type='income' AND {month_now_filter()}")
    income = float(c.fetchone()['s'])
    c.execute(f"SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE type='expense' AND {month_now_filter()}")
    expenses = float(c.fetchone()['s'])

    # Tarefas
    c.execute("SELECT COUNT(*) as n FROM tasks"); total_tasks = c.fetchone()['n']
    c.execute("SELECT COUNT(*) as n FROM tasks WHERE status='completed'"); completed = c.fetchone()['n']
    c.execute("SELECT COUNT(*) as n FROM tasks WHERE status='pending'"); pending = c.fetchone()['n']
    if USE_POSTGRES:
        c.execute("SELECT COUNT(*) as n FROM tasks WHERE status!='completed' AND due_date IS NOT NULL AND due_date<NOW()")
    else:
        c.execute("SELECT COUNT(*) as n FROM tasks WHERE status!='completed' AND due_date IS NOT NULL AND due_date<datetime('now')")
    overdue = c.fetchone()['n']

    # Últimas transações
    c.execute("""SELECT t.*, c.name as category_name, c.color as category_color
                 FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
                 ORDER BY t.date DESC LIMIT 5""")
    recent = c.fetchall()

    # Tarefas próximas
    if USE_POSTGRES:
        c.execute("""SELECT t.*, c.name as category_name, c.color as category_color
                     FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
                     WHERE t.status!='completed' AND t.due_date IS NOT NULL AND t.due_date>=NOW()
                     ORDER BY t.due_date ASC LIMIT 5""")
    else:
        c.execute("""SELECT t.*, c.name as category_name, c.color as category_color
                     FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
                     WHERE t.status!='completed' AND t.due_date IS NOT NULL AND t.due_date>=datetime('now')
                     ORDER BY t.due_date ASC LIMIT 5""")
    upcoming = c.fetchall()

    # Metas ativas
    c.execute("SELECT * FROM goals WHERE status='active' LIMIT 3")
    goals_rows = c.fetchall()
    conn.close()

    goals_list = []
    for g in goals_rows:
        d = dict(g)
        ta = float(d['target_amount']); ca = float(d['current_amount'])
        d['target_amount'] = ta; d['current_amount'] = ca
        d['progress'] = round(min((ca / ta) * 100, 100), 1) if ta else 0
        goals_list.append(d)

    return {
        'financial': {'income': round(income,2), 'expenses': round(expenses,2),
                      'balance': round(income-expenses,2)},
        'tasks': {'total': total_tasks, 'completed': completed, 'pending': pending,
                  'overdue': overdue,
                  'productivity': round((completed/max(total_tasks,1))*100, 1)},
        'recent_transactions': [dict(r) for r in recent],
        'upcoming_tasks':      [dict(r) for r in upcoming],
        'active_goals':        goals_list
    }


@export_bp.route('/tasks', methods=['GET'])
def export_tasks():
    conn = get_conn(); c = conn.cursor()
    c.execute("""SELECT t.*, cat.name as category_name
                 FROM tasks t LEFT JOIN categories cat ON t.category_id=cat.id
                 ORDER BY t.created_at DESC""")
    rows = c.fetchall(); conn.close()
    out = io.StringIO(); w = csv.writer(out)
    w.writerow(['ID','Título','Prioridade','Status','Categoria','Vencimento','Criado em'])
    for r in rows:
        d = dict(r)
        w.writerow([d['id'],d['title'],d['priority'],d['status'],
                    d.get('category_name',''),d.get('due_date',''),d['created_at']])
    resp = make_response(out.getvalue())
    resp.headers['Content-Disposition'] = 'attachment; filename=tarefas.csv'
    resp.headers['Content-Type'] = 'text/csv; charset=utf-8'
    return resp


@export_bp.route('/finances', methods=['GET'])
def export_finances():
    conn = get_conn(); c = conn.cursor()
    c.execute("""SELECT t.*, cat.name as category_name
                 FROM transactions t LEFT JOIN categories cat ON t.category_id=cat.id
                 ORDER BY t.date DESC""")
    rows = c.fetchall(); conn.close()
    out = io.StringIO(); w = csv.writer(out)
    w.writerow(['ID','Título','Valor','Tipo','Categoria','Data'])
    for r in rows:
        d = dict(r)
        w.writerow([d['id'],d['title'],f"R$ {float(d['amount']):.2f}",
                    'Receita' if d['type']=='income' else 'Despesa',
                    d.get('category_name',''), d.get('date','')])
    resp = make_response(out.getvalue())
    resp.headers['Content-Disposition'] = 'attachment; filename=financeiro.csv'
    resp.headers['Content-Type'] = 'text/csv; charset=utf-8'
    return resp
