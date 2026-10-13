/**
 * @file spendingChart.js — Chart.js Income vs Expenses visualization widget.
 * Features:
 * - Grouped bar chart for sparse data (< 10 non-zero points), line chart for dense.
 * - Semantic colors: Income #10B981, Expenses #F87171.
 * - Y-axis formatted with formatCompact and subtle grid lines.
 * - X-axis formatted as 'Th 4 · 30/9' (or 'CN · 30/9').
 * - Custom interactive tooltip (Full date, Income, Expenses, Net).
 * - Interactive legend toggling datasets.
 * - Clean instance lifecycle with destroy() before re-render.
 */

import { formatCurrency, formatCompact, parseNumber, getTransactionType } from '../../utils/format.js';
import { formatDateShort, formatDateLong, daysAgoDateString, getLocalDateString } from '../../utils/dateFormat.js';

let _chartInstance = null;

/**
 * Format a YYYY-MM-DD date string into the X-axis label format: 'Th {thứ} · {dd}/{mm}' or 'CN · {dd}/{mm}'.
 * E.g., '2026-09-30' (Wednesday) -> 'Th 4 · 30/9'
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string}
 */
export function formatChartXAxis(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 is Sunday
  const dow = day === 0 ? 'CN' : `Th ${day + 1}`;
  return `${dow} · ${d}/${m}`;
}

/**
 * Get human-readable subtitle label under spending chart title.
 * @param {'7d'|'30d'|'period'} period
 * @param {{ from?: string, to?: string }} [periodState={}]
 * @param {Array<{ date: string }>} [data=[]]
 * @returns {string}
 */
export function getSpendingChartSubtitle(period, periodState = {}, data = []) {
  if (period === '7d') {
    const from = data.length > 0 ? data[0].date : daysAgoDateString(6);
    const to = data.length > 0 ? data[data.length - 1].date : getLocalDateString();
    return `7 ngày gần nhất (${formatDateShort(from)} – ${formatDateShort(to)})`;
  }
  if (period === '30d') {
    const from = data.length > 0 ? data[0].date : daysAgoDateString(29);
    const to = data.length > 0 ? data[data.length - 1].date : getLocalDateString();
    return `30 ngày gần nhất (${formatDateShort(from)} – ${formatDateShort(to)})`;
  }
  // 'period'
  const from = periodState.from || (data.length > 0 ? data[0].date : '');
  const to = periodState.to || (data.length > 0 ? data[data.length - 1].date : '');
  if (from && to) {
    return `Theo kỳ đã chọn (${formatDateShort(from)} – ${formatDateShort(to)})`;
  }
  return 'Theo kỳ đã chọn';
}

/**
 * Safely destroy active Chart.js instance.
 */
export function destroySpendingChart() {
  if (_chartInstance) {
    try {
      _chartInstance.destroy();
    } catch (e) {
      console.warn('[spendingChart] Error destroying chart instance:', e);
    }
    _chartInstance = null;
  }
}

/**
 * Get active chart instance (useful for testing and inspections).
 * @returns {Object|null}
 */
export function getActiveChartInstance() {
  return _chartInstance;
}

/**
 * Aggregate transactions into a continuous daily series for the given period.
 * @param {Array<Object>} transactions
 * @param {'7d'|'30d'|'period'} periodType
 * @param {{ from?: string, to?: string }} periodState
 * @returns {Array<{ date: string, income: number, expense: number }>}
 */
export function computeDailySeries(transactions = [], periodType = '7d', periodState = {}) {
  let fromStr = '';
  let toStr = '';

  if (periodType === '7d') {
    toStr = getLocalDateString();
    fromStr = daysAgoDateString(6);
  } else if (periodType === '30d') {
    toStr = getLocalDateString();
    fromStr = daysAgoDateString(29);
  } else {
    fromStr = periodState.from || daysAgoDateString(29);
    toStr = periodState.to || getLocalDateString();
  }

  const dailyMap = new Map();
  const txList = Array.isArray(transactions) ? transactions : [];

  for (const tx of txList) {
    const status = tx.status || 'completed';
    if (status === 'failed' || status === 'cancelled') continue;

    const rawDate = typeof tx.date === 'string' ? tx.date.slice(0, 10) : '';
    if (!rawDate || (fromStr && rawDate < fromStr) || (toStr && rawDate > toStr)) {
      continue;
    }

    const type = getTransactionType(tx);
    if (type === 'transfer') continue;

    const amt = parseNumber(tx.amount);
    if (amt <= 0) continue;

    const current = dailyMap.get(rawDate) || { income: 0, expense: 0 };
    if (type === 'income') {
      current.income += amt;
    } else if (type === 'refund') {
      current.expense = Math.max(0, current.expense - amt);
    } else {
      current.expense += amt;
    }
    dailyMap.set(rawDate, current);
  }

  // Generate continuous date array between fromStr and toStr
  const result = [];
  const [y1, m1, d1] = fromStr.split('-').map(Number);
  const [y2, m2, d2] = toStr.split('-').map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const daySpan = Math.max(1, Math.min(90, Math.round((end - start) / 86400000) + 1));

  for (let i = 0; i < daySpan; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const curKey = getLocalDateString(cur);
    if (curKey > toStr) break;
    const dayEntry = dailyMap.get(curKey) || { income: 0, expense: 0 };
    result.push({
      date: curKey,
      income: dayEntry.income,
      expense: dayEntry.expense,
      expenses: dayEntry.expense, // alias
    });
  }

  return result;
}

/**
 * Render Chart.js onto the provided canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options
 * @param {Array<{ date: string, income: number, expense: number }>} options.data
 * @param {string} [options.currency='VND']
 * @returns {Object|null} Chart.js instance
 */
export function renderSpendingChart(canvas, { data = [], currency = 'VND' } = {}) {
  if (!canvas) return null;

  // 1. Destroy any existing instance before re-creating
  destroySpendingChart();

  const ChartClass = window.Chart;
  if (!ChartClass) {
    console.warn('[spendingChart] Chart.js is not loaded on window.');
    return null;
  }

  // Check sparsity: < 10 points that have actual non-zero value
  const activePoints = data.filter(d => (d.income > 0 || (d.expense ?? d.expenses ?? 0) > 0)).length;
  const isSparse = activePoints < 10;
  const chartType = isSparse ? 'bar' : 'line';

  const labels = data.map(d => formatChartXAxis(d.date));
  const incomes = data.map(d => d.income || 0);
  const expenses = data.map(d => (d.expense ?? d.expenses ?? 0) || 0);

  const datasets = [
    {
      label: 'Thu nhập',
      data: incomes,
      backgroundColor: isSparse ? '#10B981' : 'rgba(16, 185, 129, 0.12)',
      borderColor: '#10B981',
      borderWidth: isSparse ? 0 : 2.5,
      borderRadius: isSparse ? 4 : 0,
      borderSkipped: false,
      fill: !isSparse,
      tension: 0.35,
      pointRadius: isSparse ? 0 : 3,
      pointHoverRadius: isSparse ? 0 : 6,
      pointBackgroundColor: '#10B981',
      pointBorderColor: '#0B0E14',
      pointBorderWidth: 2,
      barPercentage: 0.65,
      categoryPercentage: 0.58,
    },
    {
      label: 'Chi phí',
      data: expenses,
      backgroundColor: isSparse ? '#F87171' : 'rgba(248, 113, 113, 0.12)',
      borderColor: '#F87171',
      borderWidth: isSparse ? 0 : 2.5,
      borderRadius: isSparse ? 4 : 0,
      borderSkipped: false,
      fill: !isSparse,
      tension: 0.35,
      pointRadius: isSparse ? 0 : 3,
      pointHoverRadius: isSparse ? 0 : 6,
      pointBackgroundColor: '#F87171',
      pointBorderColor: '#0B0E14',
      pointBorderWidth: 2,
      barPercentage: 0.65,
      categoryPercentage: 0.58,
    },
  ];

  const config = {
    type: chartType,
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 250,
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: 'rgba(226, 232, 240, 0.85)',
            font: { family: 'Inter', size: 12, weight: '500' },
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
          },
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            const ci = legend.chart;
            if (ci.isDatasetVisible(index)) {
              ci.hide(index);
              legendItem.hidden = true;
            } else {
              ci.show(index);
              legendItem.hidden = false;
            }
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 18, 26, 0.96)',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleColor: '#FFFFFF',
          titleFont: { size: 13, weight: '600', family: 'Inter' },
          bodyColor: '#E2E8F0',
          bodyFont: { size: 12, family: 'Inter' },
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            title: (tooltipItems) => {
              if (!tooltipItems || !tooltipItems.length) return '';
              const idx = tooltipItems[0].dataIndex;
              const pt = data[idx];
              if (!pt || !pt.date) return '';
              return formatDateLong(pt.date);
            },
            label: (context) => {
              const label = context.dataset.label || '';
              const val = context.raw || 0;
              const sign = label.includes('Thu') ? '+' : '-';
              return `  ${label}: ${sign} ${formatCurrency(val, currency)}`;
            },
            afterBody: (tooltipItems) => {
              if (!tooltipItems || !tooltipItems.length) return [];
              const idx = tooltipItems[0].dataIndex;
              const pt = data[idx];
              if (!pt) return [];
              const inc = pt.income || 0;
              const exp = (pt.expense ?? pt.expenses ?? 0);
              const net = inc - exp;
              const sign = net > 0 ? '+' : '';
              return [`  Ròng: ${sign} ${formatCurrency(net, currency)}`];
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            color: 'rgba(148, 163, 184, 0.75)',
            font: { family: 'Inter', size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
          },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false,
          },
          ticks: {
            color: 'rgba(148, 163, 184, 0.75)',
            font: { family: 'Inter', size: 11 },
            callback: (val) => formatCompact(val, currency),
          },
          border: { display: false },
        },
      },
    },
  };

  _chartInstance = new ChartClass(canvas, config);
  return _chartInstance;
}
