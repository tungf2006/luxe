/**
 * @file BarChart — data-driven SVG bar chart for cash flow / monthly comparisons.
 */

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 200;
const PADDING = { top: 10, right: 10, bottom: 30, left: 40 };
const BAR_WIDTH = 22;
const BAR_GAP = 5;

/**
 * Render a grouped bar chart (income + expense per period).
 * @param {Object} params
 * @param {Array<{label:string, income:number, expenses:number}>} params.data
 * @param {number} [params.width=360]
 * @param {number} [params.height=200]
 * @returns {string}  SVG markup string
 */
export function BarChart({ data, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }) {
  if (!data || data.length === 0) return '<div class="chart-empty">Không có dữ liệu</div>';

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1) * 1.15;

  const barGroupWidth = BAR_WIDTH * 2 + BAR_GAP;
  const groupWidth = innerW / data.length;

  const barIncomePath = (data, innerW, innerH, groupWidth) => ''; // placeholder
  // Generate bars
  let barsSvg = '';
  let labelsSvg = '';

  data.forEach((d, i) => {
    const groupX = PADDING.left + i * groupWidth;
    const incomeH = (d.income / maxVal) * innerH;
    const expenseH = (d.expenses / maxVal) * innerH;
    const incomeY = PADDING.top + innerH - incomeH;
    const expenseY = PADDING.top + innerH - expenseH;

    // Income bar
    barsSvg += `
      <rect x="${groupX}" y="${incomeY}" width="${BAR_WIDTH}" height="${incomeH}" rx="4" fill="url(#barIncome)" opacity="${i === data.length - 1 ? 1 : 0.9}"/>
    `;
    // Expense bar (offset by BAR_WIDTH + BAR_GAP)
    barsSvg += `
      <rect x="${groupX + BAR_WIDTH + BAR_GAP}" y="${expenseY}" width="${BAR_WIDTH}" height="${expenseH}" rx="4" fill="url(#barExpense)" opacity="${i === data.length - 1 ? 0.8 : 0.75}"/>
    `;

    // X-axis label
    labelsSvg += `<text x="${groupX + barGroupWidth / 2}" y="${height}" text-anchor="middle" fill="rgba(148,163,184,0.4)" font-size="11" font-family="Inter">${d.label}</text>`;
    if (i === data.length - 1) {
      labelsSvg += `<text x="${groupX + barGroupWidth / 2}" y="${height}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="11" font-family="Inter" font-weight="600">${d.label}</text>`;
    }
  });

  // Gridlines
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const y = PADDING.top + (innerH / 5) * i;
    const val = Math.round(maxVal * (1 - i / 5));
    gridLines.push(`<line x1="${PADDING.left}" y1="${y}" x2="${width - PADDING.right}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`);
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" aria-label="Biểu đồ dòng tiền">
      <defs>
        <linearGradient id="barIncome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6366F1"/>
          <stop offset="100%" stop-color="#4F46E5"/>
        </linearGradient>
        <linearGradient id="barExpense" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#0EA5E9"/>
        </linearGradient>
      </defs>
      ${gridLines.join('')}
      <line x1="${PADDING.left}" y1="${PADDING.top}" x2="${PADDING.left}" y2="${PADDING.top + innerH}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <line x1="${PADDING.left}" y1="${PADDING.top + innerH}" x2="${width - PADDING.right}" y2="${PADDING.top + innerH}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      ${barsSvg}
      <g class="chart-axis-labels" style="margin-top:0.5rem">
        ${labelsSvg}
      </g>
    </svg>
    <div style="display:flex;gap:1.5rem;margin-top:0.5rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;color:var(--text-secondary);">
        <span style="width:10px;height:10px;border-radius:2px;background:#6366F1;display:inline-block;"></span>
        Thu nhập
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;color:var(--text-secondary);">
        <span style="width:10px;height:10px;border-radius:2px;background:#38BDF8;display:inline-block;"></span>
        Chi phí
      </div>
    </div>
  `;
}
