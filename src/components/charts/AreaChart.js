/**
 * @file AreaChart — data-driven SVG area chart for spending overview.
 * Generates income area + expense line from an array of data points.
 */

const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 200;
const PADDING = { top: 10, right: 0, bottom: 30, left: 0 };

/**
 * Convert an array of points to an SVG area path string.
 * @param {Array<{x:number,y:number}>} pts
 * @param {number} baselineY
 * @returns {string}
 */
function areaPath(pts, baselineY) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${baselineY}`;
  d += ` L ${pts[0].x} ${baselineY} Z`;
  return d;
}

/**
 * Convert an array of points to an SVG line path string.
 * @param {Array<{x:number,y:number}>} pts
 * @returns {string}
 */
function linePath(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

/**
 * Render a dual-series area/line chart.
 * @param {Object} params
 * @param {Array<{label:string, income:number, expenses:number}>} params.data
 * @param {number} [params.width=700]
 * @param {number} [params.height=200]
 * @param {string} [params.incomeColor='#6366F1']
 * @param {string} [params.expenseColor='#38BDF8']
 * @returns {string}  SVG markup string
 */
export function AreaChart({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  incomeColor = '#6366F1',
  expenseColor = '#38BDF8',
}) {
  if (!data || data.length === 0) return '<div class="chart-empty">Không có dữ liệu</div>';

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1) * 1.15;

  // Distribute points across width
  const points = data.map((d, i) => ({
    x: PADDING.left + (i === data.length - 1 ? innerW : (i / (data.length - 1)) * innerW),
    incomeY: PADDING.top + innerH - (d.income / maxVal) * innerH,
    expenseY: PADDING.top + innerH - (d.expenses / maxVal) * innerH,
  }));

  const baselineY = PADDING.top + innerH;
  const incomePts = points.map(p => ({ x: p.x, y: p.incomeY }));
  const expensePts = points.map(p => ({ x: p.x, y: p.expenseY }));

  // Gridlines at 0%, 25%, 50%, 75%, 100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const gridSvg = gridLines.map(g => {
    const y = PADDING.top + innerH * (1 - g);
    return `<line x1="${PADDING.left}" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
  }).join('');

  // Axis labels
  const labelSvg = data.map((d, i) => {
    const x = PADDING.left + (i === data.length - 1 ? innerW : (i / (data.length - 1)) * innerW);
    const isLast = i === data.length - 1;
    return `<text x="${x}" y="${height}" text-anchor="${isLast ? 'end' : 'middle'}" fill="rgba(148,163,184,0.6)" font-size="11" font-family="Inter" style="padding-right:${isLast ? '8px' : '0'}">${d.label}</text>`;
  }).join('');

  // Dots on income line
  const dotsSvg = incomePts.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${incomeColor}" stroke="var(--bg-surface)" stroke-width="2"/>`
  ).join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" aria-label="Biểu đồ chi tiêu">
      <defs>
        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${incomeColor}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${incomeColor}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${expenseColor}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${expenseColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridSvg}
      <path d="${areaPath(incomePts, baselineY)}" fill="url(#incomeGrad)"/>
      <path d="${linePath(incomePts)}" fill="none" stroke="${incomeColor}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="${linePath(expensePts)}" fill="none" stroke="${expenseColor}" stroke-width="2" stroke-linecap="round"/>
      ${dotsSvg}
    </svg>
    <div class="chart-axis-labels" aria-hidden="true">
      ${data.map(d => `<span>${d.label}</span>`).join('')}
    </div>
  `;
}
