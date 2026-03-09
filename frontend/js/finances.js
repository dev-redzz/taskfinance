/**
 * TaskFinance - Finances Module
 */

const Finances = {
  items: [],
  filters: { type: 'all', month: '' },
  currentType: 'expense',

  async load() {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    const params = {};
    if (this.filters.type !== 'all') params.type = this.filters.type;
    if (this.filters.month) params.month = this.filters.month;
    
    try {
      this.items = await Api.finances.list(params);
      this.render();
      await this.loadSummary();
    } catch(e) {
      list.innerHTML = '<div class="empty-state"><p>Erro ao carregar.</p></div>';
    }
  },

  render() {
    const list = document.getElementById('transactionsList');
    
    if (!this.items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💸</div>
          <h3>Nenhuma transação</h3>
          <p>Registre sua primeira transação</p>
        </div>`;
      return;
    }
    
    list.innerHTML = this.items.map(t => `
      <div class="transaction-item trans-${t.type}">
        <div class="trans-icon">${t.type === 'income' ? '↑' : '↓'}</div>
        <div class="trans-info">
          <div class="trans-title">${escapeHtml(t.title)}</div>
          <div class="trans-meta">${escapeHtml(t.category_name || 'Sem categoria')}${t.description ? ' · ' + escapeHtml(t.description) : ''}</div>
        </div>
        <div class="trans-amount ${t.type === 'income' ? 'income-amount' : 'expense-amount'}">
          ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
        </div>
        <div class="trans-date">${formatDate(t.date)}</div>
        <div class="task-actions" style="margin-left:8px">
          <button class="icon-btn" onclick="Finances.openModal(${t.id})" title="Editar">✏️</button>
          <button class="icon-btn danger" onclick="Finances.delete(${t.id})" title="Excluir">🗑️</button>
        </div>
      </div>`).join('');
  },

  async loadSummary() {
    try {
      const s = await Api.finances.summary(this.filters.month);
      document.getElementById('fin-income').textContent = formatCurrency(s.income);
      document.getElementById('fin-expenses').textContent = formatCurrency(s.expenses);
      const balEl = document.getElementById('fin-balance');
      balEl.textContent = formatCurrency(s.balance);
      balEl.style.color = s.balance >= 0 ? 'var(--green)' : 'var(--red)';
    } catch(e) {}
  },

  setTypeFilter(btn, type) {
    btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.filters.type = type;
    this.load();
  },

  setMonth(val) {
    this.filters.month = val;
    this.load();
  },

  async delete(id) {
    if (!confirm('Excluir esta transação?')) return;
    try {
      await Api.finances.delete(id);
      await this.load();
      App.refreshDashboard();
      App.toast('Transação excluída.', 'success');
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  setType(type) {
    this.currentType = type;
    document.getElementById('btnIncome').classList.toggle('active', type === 'income');
    document.getElementById('btnExpense').classList.toggle('active', type === 'expense');
  },

  async openModal(id = null) {
    const modal = document.getElementById('financeModal');
    document.getElementById('financeModalTitle').textContent = id ? 'Editar Transação' : 'Nova Transação';
    document.getElementById('financeId').value = id || '';
    
    await this.loadCategoryOptions();
    
    if (id) {
      const t = this.items.find(x => x.id === id);
      if (t) {
        this.setType(t.type);
        document.getElementById('financeTitle').value = t.title;
        document.getElementById('financeAmount').value = t.amount;
        document.getElementById('financeDate').value = t.date.substring(0, 10);
        document.getElementById('financeCategory').value = t.category_id || '';
        document.getElementById('financeDesc').value = t.description;
      }
    } else {
      this.setType('expense');
      document.getElementById('financeTitle').value = '';
      document.getElementById('financeAmount').value = '';
      document.getElementById('financeDate').value = new Date().toISOString().substring(0, 10);
      document.getElementById('financeCategory').value = '';
      document.getElementById('financeDesc').value = '';
    }
    
    modal.classList.add('open');
    setTimeout(() => document.getElementById('financeTitle').focus(), 100);
  },

  closeModal() {
    document.getElementById('financeModal').classList.remove('open');
  },

  async loadCategoryOptions() {
    try {
      const cats = await Api.categories.list('finance');
      const sel = document.getElementById('financeCategory');
      sel.innerHTML = '<option value="">Sem categoria</option>' +
        cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch(e) {}
  },

  async saveTransaction() {
    const id = document.getElementById('financeId').value;
    const title = document.getElementById('financeTitle').value.trim();
    const amount = parseFloat(document.getElementById('financeAmount').value);
    
    if (!title) { App.toast('Título é obrigatório', 'error'); return; }
    if (!amount || amount <= 0) { App.toast('Valor deve ser positivo', 'error'); return; }
    
    const data = {
      title,
      amount,
      type: this.currentType,
      category_id: document.getElementById('financeCategory').value || null,
      description: document.getElementById('financeDesc').value,
      date: document.getElementById('financeDate').value
    };
    
    try {
      if (id) {
        await Api.finances.update(id, data);
        App.toast('Transação atualizada!', 'success');
      } else {
        await Api.finances.create(data);
        App.toast('Transação criada!', 'success');
      }
      this.closeModal();
      await this.load();
      App.refreshDashboard();
      Charts.loadAll();
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  exportCSV() {
    window.open('/api/export/finances', '_blank');
  }
};
