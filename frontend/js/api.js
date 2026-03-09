/**
 * TaskFinance - API Client
 * Comunicação com o backend Flask
 */

const API_BASE = '/api';

const Api = {
  
  async request(method, path, data = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) opts.body = JSON.stringify(data);
    
    try {
      const res = await fetch(API_BASE + path, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      // Exportações retornam blob
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('csv')) return res.blob();
      return await res.json();
    } catch (e) {
      console.error('[API Error]', e.message);
      throw e;
    }
  },

  get: (path) => Api.request('GET', path),
  post: (path, data) => Api.request('POST', path, data),
  put: (path, data) => Api.request('PUT', path, data),
  patch: (path, data) => Api.request('PATCH', path, data),
  delete: (path) => Api.request('DELETE', path),

  // ── Tasks ──
  tasks: {
    list: (params = {}) => Api.get('/tasks/?' + new URLSearchParams(params)),
    get: (id) => Api.get(`/tasks/${id}`),
    create: (data) => Api.post('/tasks/', data),
    update: (id, data) => Api.put(`/tasks/${id}`, data),
    delete: (id) => Api.delete(`/tasks/${id}`),
    toggle: (id) => Api.patch(`/tasks/${id}/toggle`),
    stats: () => Api.get('/tasks/stats/today')
  },

  // ── Finances ──
  finances: {
    list: (params = {}) => Api.get('/finances/?' + new URLSearchParams(params)),
    create: (data) => Api.post('/finances/', data),
    update: (id, data) => Api.put(`/finances/${id}`, data),
    delete: (id) => Api.delete(`/finances/${id}`),
    summary: (month) => Api.get('/finances/summary' + (month ? `?month=${month}` : '')),
    byCategory: (month) => Api.get('/finances/by-category' + (month ? `?month=${month}` : '')),
    evolution: () => Api.get('/finances/monthly-evolution')
  },

  // ── Categories ──
  categories: {
    list: (type) => Api.get('/categories/' + (type ? `?type=${type}` : '')),
    create: (data) => Api.post('/categories/', data),
    update: (id, data) => Api.put(`/categories/${id}`, data),
    delete: (id) => Api.delete(`/categories/${id}`)
  },

  // ── Goals ──
  goals: {
    list: () => Api.get('/goals/'),
    create: (data) => Api.post('/goals/', data),
    update: (id, data) => Api.put(`/goals/${id}`, data),
    delete: (id) => Api.delete(`/goals/${id}`),
    deposit: (id, amount) => Api.post(`/goals/${id}/deposit`, { amount })
  },

  // ── Dashboard ──
  dashboard: {
    get: () => Api.get('/dashboard/')
  },

  // ── Export ──
  export: {
    tasks: () => Api.get('/export/tasks'),
    finances: () => Api.get('/export/finances')
  }
};
