"""
TaskFinance - Flask App (sem SQLAlchemy)
"""
from flask import Flask, send_from_directory, jsonify
try:
    from flask_cors import CORS
    HAS_CORS = True
except ImportError:
    HAS_CORS = False
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db
from routes.tasks import tasks_bp
from routes.finances import finances_bp
from routes.categories import categories_bp
from routes.goals import goals_bp
from routes.dashboard import dashboard_bp, export_bp

def create_app():
    frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend')
    app = Flask(__name__, static_folder=frontend_path, static_url_path='')
    app.config['SECRET_KEY'] = 'taskfinance-2024'
    app.config['JSON_SORT_KEYS'] = False

    if HAS_CORS: CORS(app, origins="*")
    
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(finances_bp, url_prefix='/api/finances')
    app.register_blueprint(categories_bp, url_prefix='/api/categories')
    app.register_blueprint(goals_bp, url_prefix='/api/goals')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(export_bp, url_prefix='/api/export')

    @app.route('/')
    def index():
        return send_from_directory(frontend_path, 'index.html')

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    init_db()
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    print(f"TaskFinance rodando na porta {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
