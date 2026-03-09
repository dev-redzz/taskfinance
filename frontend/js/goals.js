/**
 * TaskFinance - Goals Module
 */

const Goals = {
  items: [],

  async load() {
    const list = document.getElementById('goalsList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      this.items = await Api.goals.list();
      this.render();
    } catch(e) {
      list.innerHTML = '<div class="empty-state"><p>Erro ao carregar.</p></div>';
    }
  },

  render() {
    const list = document.getElementById('goalsList');
    
    if (!this.items.length) {
      list.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🎯</div>
          <h3>Nenhuma meta criada</h3>
          <p>Defina suas metas financeiras</p>
        </div>`;
      return;
    }
    
    list.innerHTML = this.items.map(g => this.renderCard(g)).join('');
  },

  renderCard(g) {
    const isCompleted = g.status === 'completed';
    const deadline = g.deadline ? new Date(g.deadline).toLocaleDateString('pt-BR') : 'Sem prazo';
    
    return `
      <div class="goal-card ${isCompleted ? 'goal-completed' : ''}" style="border-top-color:${g.color}">
        <div class="goal-header">
          <div>
            <div class="goal-title" style="color:${g.color}">${escapeHtml(g.title)}</div>
            ${g.description ? `<div class="goal-desc">${escapeHtml(g.description)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${isCompleted ? '<span class="goal-badge-done">✓ Concluída</span>' : ''}
            <button class="icon-btn" onclick="Goals.openModal(${g.id})" title="Editar">✏️</button>
            <button class="icon-btn danger" onclick="Goals.delete(${g.id})" title="Excluir">🗑️</button>
          </div>
        </div>
        
        <div class="goal-amounts">
          <div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px">Economizado</div>
            <div class="goal-current" style="color:${g.color}">${formatCurrency(g.current_amount)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px">Meta</div>
            <div class="goal-target">${formatCurrency(g.target_amount)}</div>
          </div>
        </div>
        
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${g.progress}%;background:${g.color}"></div>
        </div>
        
        <div class="goal-footer">
          <span class="goal-pct" style="color:${g.color}">${g.progress}%</span>
          <span class="goal-deadline">📅 ${deadline}</span>
        </div>
        
        ${!isCompleted ? `
          <div class="goal-actions">
            <button class="btn-deposit" onclick="Goals.openDeposit(${g.id})">+ Adicionar valor</button>
          </div>` : ''}
      </div>`;
  },

  async delete(id) {
    if (!confirm('Excluir esta meta?')) return;
    try {
      await Api.goals.delete(id);
      await this.load();
      App.toast('Meta excluída.', 'success');
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  openModal(id = null) {
    const modal = document.getElementById('goalModal');
    document.getElementById('goalModalTitle').textContent = id ? 'Editar Meta' : 'Nova Meta';
    document.getElementById('goalId').value = id || '';
    
    if (id) {
      const g = this.items.find(x => x.id === id);
      if (g) {
        document.getElementById('goalTitle').value = g.title;
        document.getElementById('goalDesc').value = g.description;
        document.getElementById('goalTarget').value = g.target_amount;
        document.getElementById('goalCurrent').value = g.current_amount;
        document.getElementById('goalDeadline').value = g.deadline ? g.deadline.substring(0, 10) : '';
        document.getElementById('goalColor').value = g.color;
      }
    } else {
      document.getElementById('goalTitle').value = '';
      document.getElementById('goalDesc').value = '';
      document.getElementById('goalTarget').value = '';
      document.getElementById('goalCurrent').value = '0';
      document.getElementById('goalDeadline').value = '';
      document.getElementById('goalColor').value = '#F59E0B';
    }
    
    modal.classList.add('open');
  },

  closeModal() {
    document.getElementById('goalModal').classList.remove('open');
  },

  async saveGoal() {
    const id = document.getElementById('goalId').value;
    const title = document.getElementById('goalTitle').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    
    if (!title) { App.toast('Título é obrigatório', 'error'); return; }
    if (!target || target <= 0) { App.toast('Valor alvo deve ser positivo', 'error'); return; }
    
    const data = {
      title,
      description: document.getElementById('goalDesc').value,
      target_amount: target,
      current_amount: parseFloat(document.getElementById('goalCurrent').value) || 0,
      deadline: document.getElementById('goalDeadline').value || null,
      color: document.getElementById('goalColor').value
    };
    
    try {
      if (id) {
        await Api.goals.update(id, data);
        App.toast('Meta atualizada!', 'success');
      } else {
        await Api.goals.create(data);
        App.toast('Meta criada!', 'success');
      }
      this.closeModal();
      await this.load();
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  openDeposit(id) {
    document.getElementById('depositGoalId').value = id;
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositModal').classList.add('open');
    setTimeout(() => document.getElementById('depositAmount').focus(), 100);
  },

  closeDeposit() {
    document.getElementById('depositModal').classList.remove('open');
  },

  async deposit() {
    const id = document.getElementById('depositGoalId').value;
    const amount = parseFloat(document.getElementById('depositAmount').value);
    
    if (!amount || amount <= 0) { App.toast('Valor inválido', 'error'); return; }
    
    try {
      await Api.goals.deposit(id, amount);
      this.closeDeposit();
      await this.load();
      App.toast('Valor adicionado!', 'success');
    } catch(e) {
      App.toast(e.message, 'error');
    }
  }
};
