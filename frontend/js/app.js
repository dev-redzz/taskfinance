/**
 * TaskFinance - Main App
 * Navegação, dashboard, utilitários globais
 */

// ── Utilities ──────────────────────────────

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('pt-BR');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── App Controller ─────────────────────────

const App = {
  currentPage: 'dashboard',
  currentMonth: new Date(),
  searchTimeout: null,

  async init() {
    this.updateDate();
    this.updateMonthLabel();
    this.setInitialMonth();
    
    // Navigate to dashboard
    await this.navigate('dashboard');
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) el.classList.remove('open');
      });
    });

    // ESC closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
        this.hideNotifications();
      }
    });
    
    // Check overdue notifications
    setTimeout(() => this.checkNotifications(), 2000);
  },

  updateDate() {
    const el = document.getElementById('topbarDate');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    
    // Greeting
    const greet = document.getElementById('dashGreeting');
    if (greet) {
      const h = new Date().getHours();
      const msg = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
      greet.textContent = `${msg}! Aqui está seu resumo de hoje.`;
    }
  },

  setInitialMonth() {
    const now = new Date();
    const monthStr = now.toISOString().substring(0, 7);
    const finMonthInput = document.getElementById('finMonth');
    if (finMonthInput) finMonthInput.value = monthStr;
  },

  updateMonthLabel() {
    const el = document.getElementById('currentMonthLabel');
    if (el) {
      el.textContent = this.currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
  },

  prevMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.updateMonthLabel();
    this.refreshDashboard();
  },

  nextMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.updateMonthLabel();
    this.refreshDashboard();
  },

  getMonthStr() {
    return this.currentMonth.toISOString().substring(0, 7);
  },

  async navigate(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    
    // Show page
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    
    this.currentPage = page;
    
    // Load page data
    switch(page) {
      case 'dashboard': await this.loadDashboard(); break;
      case 'tasks': await Tasks.load(); break;
      case 'finances': await Finances.load(); break;
      case 'goals': await Goals.load(); break;
      case 'categories': await CategoriesPage.load(); break;
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) this.closeSidebar();
  },

  async loadDashboard() {
    try {
      const month = this.getMonthStr();
      const [dash, summary] = await Promise.all([
        Api.dashboard.get(),
        Api.finances.summary(month)
      ]);
      
      // Financial cards
      document.getElementById('dash-income').textContent = formatCurrency(summary.income);
      document.getElementById('dash-expenses').textContent = formatCurrency(summary.expenses);
      const balEl = document.getElementById('dash-balance');
      balEl.textContent = formatCurrency(summary.balance);
      balEl.style.color = summary.balance >= 0 ? 'var(--green)' : 'var(--red)';
      
      // Tasks
      document.getElementById('dash-productivity').textContent = dash.tasks.productivity + '%';
      document.getElementById('dash-tasks-sub').textContent = 
        `${dash.tasks.completed} de ${dash.tasks.total} tarefas`;
      
      // Upcoming tasks
      this.renderUpcomingTasks(dash.upcoming_tasks);
      
      // Goals
      this.renderDashGoals(dash.active_goals);
      
      // Recent transactions
      this.renderRecentTransactions(dash.recent_transactions);
      
      // Load charts
      await Charts.loadAll();
    } catch(e) {
      console.error('Dashboard error', e);
    }
  },

  async refreshDashboard() {
    if (this.currentPage === 'dashboard') {
      await this.loadDashboard();
    }
  },

  renderUpcomingTasks(tasks) {
    const el = document.getElementById('upcomingTasks');
    if (!el) return;
    
    if (!tasks.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma tarefa próxima 🎉</p>';
      return;
    }
    
    const priorityColors = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--green)' };
    
    el.innerHTML = tasks.map(t => `
      <div class="upcoming-item">
        <div class="priority-dot" style="background:${priorityColors[t.priority]}"></div>
        <span class="title">${escapeHtml(t.title)}</span>
        <span class="date">${t.due_date ? formatDate(t.due_date) : ''}</span>
      </div>`).join('');
  },

  renderDashGoals(goals) {
    const el = document.getElementById('dashGoals');
    if (!el) return;
    
    if (!goals.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma meta ativa</p>';
      return;
    }
    
    el.innerHTML = goals.map(g => `
      <div class="dash-goal-item">
        <div class="dash-goal-header">
          <span class="dash-goal-title">${escapeHtml(g.title)}</span>
          <span class="dash-goal-pct" style="color:${g.color}">${g.progress}%</span>
        </div>
        <div class="progress-slim">
          <div class="progress-slim-fill" style="width:${g.progress}%;background:${g.color}"></div>
        </div>
      </div>`).join('');
  },

  renderRecentTransactions(transactions) {
    const el = document.getElementById('recentTransactions');
    if (!el) return;
    
    if (!transactions.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Nenhuma transação ainda</p>';
      return;
    }
    
    el.innerHTML = transactions.map(t => `
      <div class="recent-item recent-${t.type}">
        <div class="recent-icon">${t.type === 'income' ? '↑' : '↓'}</div>
        <div class="recent-info">
          <div class="recent-title">${escapeHtml(t.title)}</div>
          <div class="recent-cat">${escapeHtml(t.category_name || 'Sem categoria')}</div>
        </div>
        <div>
          <div class="recent-amount ${t.type === 'income' ? 'income-amount' : 'expense-amount'}">
            ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
          </div>
          <div class="recent-date">${formatDate(t.date)}</div>
        </div>
      </div>`).join('');
  },

  // ── Notifications ──

  async checkNotifications() {
    try {
      const stats = await Api.tasks.stats();
      if (stats.overdue > 0) {
        document.getElementById('notifDot').style.display = 'block';
      }
    } catch(e) {}
  },

  async showNotifications() {
    const panel = document.getElementById('notifPanel');
    const isVisible = panel.style.display !== 'none';
    
    if (isVisible) { this.hideNotifications(); return; }
    
    panel.style.display = 'block';
    document.getElementById('notifDot').style.display = 'none';
    
    try {
      const stats = await Api.tasks.stats();
      const list = document.getElementById('notifList');
      
      const items = [];
      if (stats.overdue > 0) {
        items.push(`<div class="notif-item">
          <div class="notif-icon">⚠️</div>
          <div class="notif-text">
            <strong>${stats.overdue} tarefa(s) atrasada(s)</strong>
            <span>Verifique suas tarefas pendentes</span>
          </div></div>`);
      }
      if (stats.pending > 0) {
        items.push(`<div class="notif-item">
          <div class="notif-icon">📋</div>
          <div class="notif-text">
            <strong>${stats.pending} tarefa(s) pendente(s)</strong>
            <span>Continue produtivo hoje!</span>
          </div></div>`);
      }
      
      list.innerHTML = items.length 
        ? items.join('') 
        : '<div class="notif-empty">Tudo em dia! ✨</div>';
    } catch(e) {}
  },

  hideNotifications() {
    document.getElementById('notifPanel').style.display = 'none';
  },

  // ── Search ──

  globalSearch(query) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(async () => {
      if (!query) return;
      
      const [tasks, finances] = await Promise.all([
        Api.tasks.list({ search: query }).catch(() => []),
        Api.finances.list({ search: query }).catch(() => [])
      ]);
      
      this.toast(`${tasks.length + finances.length} resultado(s) para "${query}"`, 'success');
    }, 500);
  },

  // ── Sidebar ──

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  },

  // ── Export ──

  exportData(type) {
    window.open(`/api/export/${type}`, '_blank');
  },

  // ── Toast ──

  toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    el.innerHTML = `<span>${icons[type] || '💬'}</span> ${escapeHtml(msg)}`;
    el.className = `toast show ${type}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }
};

// ── Navigation event delegation ──

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    App.navigate(el.dataset.page);
  });
});

// ── Start ──

document.addEventListener('DOMContentLoaded', () => App.init());
