/**
 * TaskFinance - Tasks Module
 * Gerenciamento completo de tarefas
 */

const Tasks = {
  filters: { status: 'all', priority: 'all' },
  items: [],

  async load() {
    const list = document.getElementById('tasksList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      this.items = await Api.tasks.list(
        Object.fromEntries(Object.entries(this.filters).filter(([,v]) => v !== 'all'))
      );
      this.render();
      this.updateStats();
    } catch (e) {
      list.innerHTML = '<div class="empty-state"><p>Erro ao carregar tarefas.</p></div>';
    }
  },

  render() {
    const list = document.getElementById('tasksList');
    
    if (!this.items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✓</div>
          <h3>Nenhuma tarefa encontrada</h3>
          <p>Crie sua primeira tarefa clicando em "Nova Tarefa"</p>
        </div>`;
      return;
    }
    
    list.innerHTML = this.items.map(t => this.renderItem(t)).join('');
  },

  renderItem(t) {
    const isCompleted = t.status === 'completed';
    const isOverdue = t.due_date && !isCompleted && new Date(t.due_date) < new Date();
    const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '';
    
    const priorityLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' };
    const statusLabel = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída' };
    
    return `
      <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${t.id}">
        <div class="task-check ${isCompleted ? 'checked' : ''}" onclick="Tasks.toggle(${t.id})"></div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span class="task-badge badge-${t.priority}">${priorityLabel[t.priority]}</span>
            <span class="task-badge badge-${t.status}">${statusLabel[t.status]}</span>
            ${t.category_name ? `<span class="task-due"><span class="task-cat-dot" style="background:${t.category_color}"></span>${escapeHtml(t.category_name)}</span>` : ''}
            ${dueStr ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">📅 ${dueStr}${isOverdue ? ' • Atrasada' : ''}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" onclick="Tasks.openModal(${t.id})" title="Editar">✏️</button>
          <button class="icon-btn danger" onclick="Tasks.delete(${t.id})" title="Excluir">🗑️</button>
        </div>
      </div>`;
  },

  async updateStats() {
    try {
      const stats = await Api.tasks.stats();
      const total = stats.total || 0;
      const completed = stats.completed_today || 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      document.getElementById('tasksProgressBar').style.width = pct + '%';
      document.getElementById('tasksProgressText').textContent = pct + '%';
      document.getElementById('stat-pending').textContent = stats.pending;
      document.getElementById('stat-completed').textContent = stats.completed_today;
      document.getElementById('stat-overdue').textContent = stats.overdue;
      document.getElementById('tasks-badge').textContent = stats.pending;
    } catch(e) {}
  },

  setFilter(btn, type, value) {
    // Remove active from group
    btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.filters[type] = value;
    this.load();
  },

  async toggle(id) {
    try {
      await Api.tasks.toggle(id);
      await this.load();
      App.refreshDashboard();
      App.toast('Tarefa atualizada!', 'success');
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  async delete(id) {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await Api.tasks.delete(id);
      await this.load();
      App.toast('Tarefa excluída.', 'success');
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  async openModal(id = null) {
    const modal = document.getElementById('taskModal');
    document.getElementById('taskModalTitle').textContent = id ? 'Editar Tarefa' : 'Nova Tarefa';
    document.getElementById('taskId').value = id || '';
    
    // Load categories
    await this.loadCategoryOptions();
    
    if (id) {
      const t = this.items.find(x => x.id === id);
      if (t) {
        document.getElementById('taskTitle').value = t.title;
        document.getElementById('taskDesc').value = t.description;
        document.getElementById('taskPriority').value = t.priority;
        document.getElementById('taskStatus').value = t.status;
        document.getElementById('taskCategory').value = t.category_id || '';
        document.getElementById('taskDueDate').value = t.due_date ? t.due_date.substring(0, 10) : '';
      }
    } else {
      document.getElementById('taskTitle').value = '';
      document.getElementById('taskDesc').value = '';
      document.getElementById('taskPriority').value = 'medium';
      document.getElementById('taskStatus').value = 'pending';
      document.getElementById('taskCategory').value = '';
      document.getElementById('taskDueDate').value = '';
    }
    
    modal.classList.add('open');
    setTimeout(() => document.getElementById('taskTitle').focus(), 100);
  },

  closeModal() {
    document.getElementById('taskModal').classList.remove('open');
  },

  async loadCategoryOptions() {
    try {
      const cats = await Api.categories.list('task');
      const sel = document.getElementById('taskCategory');
      sel.innerHTML = '<option value="">Sem categoria</option>' +
        cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch(e) {}
  },

  async saveTask() {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    
    if (!title) { App.toast('Título é obrigatório', 'error'); return; }
    
    const data = {
      title,
      description: document.getElementById('taskDesc').value,
      priority: document.getElementById('taskPriority').value,
      status: document.getElementById('taskStatus').value,
      category_id: document.getElementById('taskCategory').value || null,
      due_date: document.getElementById('taskDueDate').value || null
    };
    
    try {
      if (id) {
        await Api.tasks.update(id, data);
        App.toast('Tarefa atualizada!', 'success');
      } else {
        await Api.tasks.create(data);
        App.toast('Tarefa criada!', 'success');
      }
      this.closeModal();
      await this.load();
      App.refreshDashboard();
    } catch(e) {
      App.toast(e.message, 'error');
    }
  }
};
