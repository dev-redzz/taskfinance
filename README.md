# TaskFinance 🚀

**Organizador de Tarefas e Finanças Pessoal**  
Um app moderno tipo Notion/Todoist/Mobills — dark UI, glassmorphism, gráficos interativos.

---

## 🗂 Estrutura de Arquivos

```
taskfinance/
├── backend/
│   ├── app.py              # Flask app factory
│   ├── database.py         # SQLite3 (sem ORM externo)
│   ├── taskfinance.db      # Banco de dados (gerado automaticamente)
│   └── routes/
│       ├── tasks.py        # CRUD de tarefas
│       ├── finances.py     # CRUD financeiro
│       ├── categories.py   # CRUD de categorias
│       ├── goals.py        # CRUD de metas
│       └── dashboard.py    # Dashboard + exportação CSV
│
├── frontend/
│   ├── index.html          # SPA principal
│   ├── css/
│   │   └── style.css       # Design system completo (dark mode)
│   └── js/
│       ├── api.js          # Cliente REST
│       ├── app.js          # Controlador principal + navegação
│       ├── tasks.js        # Módulo de tarefas
│       ├── finances.js     # Módulo financeiro
│       ├── goals.js        # Módulo de metas
│       ├── categories.js   # Módulo de categorias
│       └── charts.js       # Gráficos Chart.js
│
├── requirements.txt
├── run.sh                  # Script de inicialização
└── README.md
```

---

## ⚙️ Instalação e Execução

### Requisitos
- Python 3.8+
- pip

### 1. Instalar dependências
```bash
pip install -r requirements.txt
```

### 2. Iniciar o servidor
```bash
# Opção 1: Script automático
chmod +x run.sh && ./run.sh

# Opção 2: Manual
cd backend
python3 app.py
```

### 3. Abrir no navegador
```
http://localhost:5000
```

---

## ✨ Funcionalidades

### 📊 Dashboard
- Resumo financeiro do mês (receitas, despesas, saldo)
- Progresso de produtividade (tarefas)
- Gráfico de linha: evolução financeira
- Gráfico de barras: gastos mensais
- Gráfico de pizza: gastos por categoria
- Tarefas próximas do vencimento
- Metas ativas com progresso
- Últimas transações

### ✅ Tarefas
- CRUD completo
- Prioridade (Alta/Média/Baixa)
- Status (Pendente/Em andamento/Concluída)
- Data de vencimento
- Categorias com cor
- Filtro por status e prioridade
- Barra de progresso diária
- Toggle rápido de conclusão

### 💰 Finanças
- Registrar receitas e despesas
- Filtro por mês e tipo
- Resumo automático (receita, despesa, saldo)
- Exportar para CSV

### 🎯 Metas Financeiras
- Criar metas de economia
- Barra de progresso visual
- Adicionar valor incremental
- Status automático (ativa/concluída)

### 🏷️ Categorias
- Categorias personalizadas com cores
- Tipo: Tarefas, Finanças, Ambos
- 10 categorias padrão incluídas

### 🔔 Extras
- Notificações de tarefas atrasadas
- Busca global
- Exportação CSV (tarefas e finanças)
- Design responsivo (desktop/tablet/mobile)
- Dark mode como padrão

---

## 🎨 Design System

- **Cores**: Roxo escuro (#7c3aed) + Amarelo (#f59e0b)
- **Fonte display**: Syne (títulos)
- **Fonte corpo**: DM Sans
- **Estilo**: Modern Dark UI com glassmorphism sutil
- **Animações**: Suaves e performáticas (CSS transitions)

---

## 🔌 API REST

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/dashboard/ | Dados do dashboard |
| GET/POST | /api/tasks/ | Listar/Criar tarefas |
| PUT/DELETE | /api/tasks/:id | Editar/Deletar tarefa |
| PATCH | /api/tasks/:id/toggle | Alternar status |
| GET/POST | /api/finances/ | Listar/Criar transações |
| GET | /api/finances/summary | Resumo financeiro |
| GET | /api/finances/by-category | Gastos por categoria |
| GET | /api/finances/monthly-evolution | Evolução mensal |
| GET/POST | /api/categories/ | Categorias |
| GET/POST | /api/goals/ | Metas |
| POST | /api/goals/:id/deposit | Adicionar valor à meta |
| GET | /api/export/tasks | Exportar tarefas CSV |
| GET | /api/export/finances | Exportar finanças CSV |
