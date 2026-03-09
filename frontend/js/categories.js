/**
 * TaskFinance - Categories Module
 */

const CategoriesPage = {
  items: [],

  async load() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      this.items = await Api.categories.list();
      this.render();
    } catch(e) {
      grid.innerHTML = '<div class="empty-state"><p>Erro ao carregar.</p></div>';
    }
  },

  render() {
    const grid = document.getElementById('categoriesGrid');
    
    if (!this.items.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🏷️</div>
        <h3>Nenhuma categoria</h3></div>`;
      return;
    }
    
    const typeLabel = { task: 'Tarefas', finance: 'Finanças', both: 'Ambos' };
    
    grid.innerHTML = this.items.map(c => `
      <div class="category-card">
        <div class="cat-color-dot" style="background:${c.color}"></div>
        <div style="flex:1">
          <div class="cat-name">${escapeHtml(c.name)}</div>
          <div class="cat-type">${typeLabel[c.type] || c.type}</div>
        </div>
        <div class="cat-actions">
          <button class="icon-btn" onclick="CategoriesPage.openModal(${c.id})" title="Editar">✏️</button>
          <button class="icon-btn danger" onclick="CategoriesPage.delete(${c.id})" title="Excluir">🗑️</button>
        </div>
      </div>`).join('');
  },

  async delete(id) {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await Api.categories.delete(id);
      await this.load();
      App.toast('Categoria excluída.', 'success');
    } catch(e) {
      App.toast(e.message, 'error');
    }
  },

  openModal(id = null) {
    document.getElementById('catModalTitle').textContent = id ? 'Editar Categoria' : 'Nova Categoria';
    document.getElementById('catId').value = id || '';
    
    if (id) {
      const c = this.items.find(x => x.id === id);
      if (c) {
        document.getElementById('catName').value = c.name;
        document.getElementById('catColor').value = c.color;
        document.getElementById('catType').value = c.type;
      }
    } else {
      document.getElementById('catName').value = '';
      document.getElementById('catColor').value = '#8B5CF6';
      document.getElementById('catType').value = 'both';
    }
    
    document.getElementById('categoryModal').classList.add('open');
    setTimeout(() => document.getElementById('catName').focus(), 100);
  },

  closeModal() {
    document.getElementById('categoryModal').classList.remove('open');
  },

  async saveCategory() {
    const id = document.getElementById('catId').value;
    const name = document.getElementById('catName').value.trim();
    
    if (!name) { App.toast('Nome é obrigatório', 'error'); return; }
    
    const data = {
      name,
      color: document.getElementById('catColor').value,
      type: document.getElementById('catType').value
    };
    
    try {
      if (id) {
        await Api.categories.update(id, data);
        App.toast('Categoria atualizada!', 'success');
      } else {
        await Api.categories.create(data);
        App.toast('Categoria criada!', 'success');
      }
      this.closeModal();
      await this.load();
    } catch(e) {
      App.toast(e.message, 'error');
    }
  }
};
