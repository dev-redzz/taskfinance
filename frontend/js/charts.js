/**
 * TaskFinance - Charts Module
 * Gráficos interativos com Chart.js
 */

const Charts = {
  instances: {},

  chartDefaults: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1c28',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#f1f0ff',
        bodyColor: '#9490b5',
        padding: 12,
        cornerRadius: 8
      }
    }
  },

  destroy(key) {
    if (this.instances[key]) {
      this.instances[key].destroy();
      delete this.instances[key];
    }
  },

  async loadAll() {
    await Promise.all([
      this.loadPie(),
      this.loadLine(),
      this.loadBar()
    ]);
  },

  async loadPie() {
    try {
      const data = await Api.finances.byCategory();
      const canvas = document.getElementById('chartPie');
      if (!canvas) return;
      
      this.destroy('pie');
      
      if (!data.length) {
        canvas.parentElement.querySelector('.pie-legend').innerHTML = 
          '<p style="color:var(--text-muted);font-size:13px;text-align:center">Sem dados este mês</p>';
        return;
      }
      
      this.instances.pie = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.category),
          datasets: [{
            data: data.map(d => d.total),
            backgroundColor: data.map(d => d.color + 'cc'),
            borderColor: data.map(d => d.color),
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          ...this.chartDefaults,
          cutout: '65%',
          plugins: {
            ...this.chartDefaults.plugins,
            tooltip: {
              ...this.chartDefaults.plugins.tooltip,
              callbacks: {
                label: ctx => ` ${ctx.label}: R$ ${ctx.parsed.toFixed(2)}`
              }
            }
          }
        }
      });
      
      // Render legend
      const total = data.reduce((s, d) => s + d.total, 0);
      const legend = document.getElementById('pieLegend');
      legend.innerHTML = data.slice(0, 6).map(d => `
        <div class="pie-legend-item">
          <div class="pie-legend-left">
            <div class="pie-legend-dot" style="background:${d.color}"></div>
            <span style="color:var(--text-secondary);font-size:12px">${escapeHtml(d.category)}</span>
          </div>
          <span class="pie-legend-val">R$ ${d.total.toFixed(0)}</span>
        </div>`).join('');
    } catch(e) { console.error('Pie chart error', e); }
  },

  async loadLine() {
    try {
      const data = await Api.finances.evolution();
      const canvas = document.getElementById('chartLine');
      if (!canvas) return;

      this.destroy('line');

      // Garante altura fixa no container para evitar crescimento infinito
      const wrap = canvas.parentElement;
      wrap.style.position = 'relative';
      wrap.style.height = '200px';

      // Com só 1 ponto, duplica para o gráfico não quebrar
      const chartData = data.length === 1 ? [data[0], data[0]] : data;

      const labels = chartData.map(d => {
        const [y, m] = d.month.split('-');
        return new Date(+y, +m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      });

      // Calcula o maior valor para definir teto do eixo Y
      const allValues = chartData.flatMap(d => [d.income, d.expenses]);
      const maxVal = Math.max(...allValues, 100);

      this.instances.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Receitas',
              data: chartData.map(d => d.income),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.1)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#10b981',
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Despesas',
              data: chartData.map(d => d.expenses),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.1)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#ef4444',
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: { color: '#9490b5', usePointStyle: true, pointStyleWidth: 10 }
            },
            tooltip: {
              ...this.chartDefaults.plugins.tooltip,
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: R$ ${ctx.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#5c5880', font: { size: 11 } }
            },
            y: {
              min: 0,
              max: Math.ceil(maxVal * 1.2),  // 20% de margem acima
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#5c5880',
                font: { size: 11 },
                callback: v => 'R$' + v
              }
            }
          }
        }
      });
    } catch(e) { console.error('Line chart error', e); }
  },

  async loadBar() {
    try {
      const data = await Api.finances.evolution();
      const canvas = document.getElementById('chartBar');
      if (!canvas) return;

      this.destroy('bar');

      // Garante altura fixa
      const wrap = canvas.parentElement;
      wrap.style.position = 'relative';
      wrap.style.height = '180px';

      const labels = data.map(d => {
        const [y, m] = d.month.split('-');
        return new Date(+y, +m - 1).toLocaleDateString('pt-BR', { month: 'short' });
      });

      const maxVal = Math.max(...data.map(d => d.expenses), 100);

      this.instances.bar = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Despesas',
            data: data.map(d => d.expenses),
            backgroundColor: 'rgba(124,58,237,0.7)',
            borderColor: '#7c3aed',
            borderWidth: 1,
            borderRadius: 6,
            hoverBackgroundColor: 'rgba(139,92,246,0.9)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...this.chartDefaults.plugins.tooltip,
              callbacks: {
                label: ctx => ` Gastos: R$ ${ctx.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#5c5880', font: { size: 11 } }
            },
            y: {
              min: 0,
              max: Math.ceil(maxVal * 1.2),
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#5c5880',
                font: { size: 11 },
                callback: v => 'R$' + v
              }
            }
          }
        }
      });
    } catch(e) { console.error('Bar chart error', e); }
  }
};
