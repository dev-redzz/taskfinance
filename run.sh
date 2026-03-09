#!/bin/bash
# TaskFinance - Script de inicialização

echo "🚀 Iniciando TaskFinance..."
echo ""

# Verifica Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado. Instale Python 3.8+"
    exit 1
fi

# Instala dependências se necessário
pip3 install flask flask-cors --quiet 2>/dev/null || true

# Inicia o servidor
cd "$(dirname "$0")/backend"
echo "✅ Servidor rodando em: http://localhost:5000"
echo "   Pressione Ctrl+C para parar"
echo ""
python3 app.py
