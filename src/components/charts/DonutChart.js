/**
 * @file DonutChart — data-driven SVG donut chart for category breakdown.
 * Renders colored arc segments with a center total and legend.
 */

const DEFAULT_SIZE = 160;
const DEFAULT_INNER_RADIUS = 46;
const DEFAULT_OUTER_RADIUS = 68;

/**
 * Convert polar coordinates to cartesian.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} angleDeg
 * @returns {{x:number,y:number}}
 */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Generate an SVG arc path for a circle segment.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} startAngle  degrees
 * @param {number} endAngle    degrees
 * @returns {string}
 */
function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/**
 * Render a donut chart.
 * @param {Object} params
 * @param {Array<{label:string, value:number, color:string}>} params.data
 * @param {string} [params.totalLabel]  e.g. "$3.28k"
 * @param {string} [params.totalSub]    e.g. "TOTAL SPENT"
 * @param {number} [params.size=160]
 * @returns {string}  SVG + legend markup string
 */
export function DonutChart({ data, totalLabel, totalSub, size = DEFAULT_SIZE }) {
  if (!data || data.length === 0) return '<div class="chart-empty">Không có dữ liệu</div>';

  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Build segments
  let startAngle = 0;
  const segments = data.map(d => {
    const pct = d.value / total;
    const endAngle = startAngle + pct * 360;
    const path = arcPath(cx, cy, DEFAULT_OUTER_RADIUS, startAngle, endAngle);
    startAngle = endAngle;
    return { path, color: d.color, pct: pct * 100, label: d.label };
  });

  // Inner circle to create the donut hole
  const holePath = `M ${cx} ${cy} m 0 -${DEFAULT_INNER_RADIUS} A ${DEFAULT_INNER_RADIUS} ${DEFAULT_INNER_RADIUS} 0 1 1 0.001 0 Z`;

  // Segments SVG (with clipping via the hole)
  const segmentsSvg = segments.map(s => `
    <path d="${s.path}" fill="${s.color}" stroke="var(--bg-surface)" stroke-width="2"/>
  `).join('');

  const holeSvg = `<path d="${holePath}" fill="var(--bg-surface)"/>`;

  // Legend
  const legendSvg = data.map((d, i) => {
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    return `
      <div class="legend-item">
        <span class="legend-color" style="background:${d.color};"></span>
        ${d.label} — ${pct}%
      </div>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Biểu đồ tròn chi tiêu theo danh mục">
      ${segmentsSvg}
      ${holeSvg}
      <text x="${cx}" y="${cx - 8}" text-anchor="middle" fill="white" font-size="16" font-weight="700" font-family="Outfit,sans-serif">${totalLabel || ''}</text>
       <text x="${cx}" y="${cx + 10}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="9" font-family="Inter,sans-serif">${totalSub || 'TỔNG'}</text>
    </svg>
    <div class="donut-legend">
      ${legendSvg}
    </div>
  `;
}
