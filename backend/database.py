"""
TaskFinance - Database PostgreSQL
Conexão via DATABASE_URL (Railway injeta automaticamente).
Fallback para SQLite em desenvolvimento local.
"""
import os
import sqlite3

# Detecta se tem PostgreSQL disponível
DATABASE_URL = os.environ.get('DATABASE_URL', '')

# Railway às vezes entrega "postgres://" mas psycopg2 precisa de "postgresql://"
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

USE_POSTGRES = bool(DATABASE_URL)

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras  # para RealDictCursor (retorna dicts como sqlite3.Row)

# Caminho do SQLite (só usado localmente)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'taskfinance.db')


def get_conn():
    """Retorna conexão com o banco correto."""
    if USE_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn


def placeholder():
    """Retorna o placeholder de parâmetro correto para cada banco."""
    return '%s' if USE_POSTGRES else '?'


def adapt_sql(sql):
    """
    Converte SQL com '?' (SQLite) para '%s' (PostgreSQL) e
    ajusta funções de data específicas de cada banco.
    """
    if not USE_POSTGRES:
        return sql

    # Troca placeholders
    sql = sql.replace('?', '%s')

    # Funções de data SQLite → PostgreSQL
    sql = sql.replace("datetime('now')", "NOW()")
    sql = sql.replace("date('now')", "CURRENT_DATE")
    sql = sql.replace("strftime('%Y-%m', t.date)", "TO_CHAR(t.date, 'YYYY-MM')")
    sql = sql.replace("strftime('%Y-%m', date)", "TO_CHAR(date, 'YYYY-MM')")
    sql = sql.replace("strftime('%Y-%m',t.date)", "TO_CHAR(t.date, 'YYYY-MM')")
    sql = sql.replace("strftime('%Y-%m',date)", "TO_CHAR(date, 'YYYY-MM')")
    sql = sql.replace("date(updated_at)", "updated_at::date")
    sql = sql.replace("date(t.updated_at)", "t.updated_at::date")

    # AUTOINCREMENT → SERIAL (já tratado no CREATE TABLE)
    return sql


def last_insert_id(cursor, table):
    """Pega o ID do último registro inserido."""
    if USE_POSTGRES:
        return cursor.fetchone()['id']
    else:
        return cursor.lastrowid


def init_db():
    """Cria as tabelas e popula categorias padrão."""
    conn = get_conn()
    c = conn.cursor()

    if USE_POSTGRES:
        # PostgreSQL usa SERIAL para auto-increment
        c.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#8B5CF6',
                icon TEXT DEFAULT 'tag',
                type TEXT DEFAULT 'both',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'pending',
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                due_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                amount NUMERIC(12,2) NOT NULL,
                type TEXT NOT NULL,
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                description TEXT DEFAULT '',
                date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS goals (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                target_amount NUMERIC(12,2) NOT NULL,
                current_amount NUMERIC(12,2) DEFAULT 0,
                deadline DATE,
                color TEXT DEFAULT '#F59E0B',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
    else:
        # SQLite
        c.executescript("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL, color TEXT DEFAULT '#8B5CF6',
                icon TEXT DEFAULT 'tag', type TEXT DEFAULT 'both',
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL, description TEXT DEFAULT '',
                priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'pending',
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                due_date TEXT, created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL,
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                description TEXT DEFAULT '', date TEXT DEFAULT (date('now')),
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL, description TEXT DEFAULT '',
                target_amount REAL NOT NULL, current_amount REAL DEFAULT 0,
                deadline TEXT, color TEXT DEFAULT '#F59E0B',
                status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now'))
            );
        """)

    conn.commit()

    # Seed categorias padrão
    c.execute("SELECT COUNT(*) FROM categories")
    result = c.fetchone()
    count = result[0] if not USE_POSTGRES else result['count']

    if count == 0:
        defaults = [
            ('Alimentação', '#EF4444', 'utensils', 'finance'),
            ('Transporte',  '#3B82F6', 'car',      'finance'),
            ('Lazer',       '#8B5CF6', 'gamepad',  'finance'),
            ('Contas',      '#F59E0B', 'file-text','finance'),
            ('Saúde',       '#10B981', 'heart',    'finance'),
            ('Educação',    '#6366F1', 'book',     'finance'),
            ('Trabalho',    '#14B8A6', 'briefcase','task'),
            ('Pessoal',     '#EC4899', 'user',     'task'),
            ('Compras',     '#F97316', 'shopping-bag','both'),
            ('Outros',      '#6B7280', 'more-horizontal','both'),
        ]
        if USE_POSTGRES:
            for d in defaults:
                c.execute("INSERT INTO categories (name,color,icon,type) VALUES (%s,%s,%s,%s)", d)
        else:
            c.executemany("INSERT INTO categories (name,color,icon,type) VALUES (?,?,?,?)", defaults)
        conn.commit()
        print("✅ Categorias padrão criadas")

    conn.close()
    print(f"✅ Banco iniciado ({'PostgreSQL' if USE_POSTGRES else 'SQLite'})")
