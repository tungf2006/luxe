const THRESHOLDS = [
  { max: 59, class: 'progress-fill--ok', color: '#22C55E' },
  { max: 74, class: 'progress-fill--low-warning', color: '#84CC16' },
  { max: 89, class: 'progress-fill--warning', color: '#F59E0B' },
  { max: 100, class: 'progress-fill--danger', color: '#EF4444' },
];

const OVER = { class: 'progress-fill--over', color: '#DC2626' };

export function getBudgetProgressClass(rawPct) {
  if (rawPct > 100) return OVER.class;
  for (const t of THRESHOLDS) {
    if (rawPct <= t.max) return t.class;
  }
  return THRESHOLDS[0].class;
}

export function getBudgetProgressColor(rawPct) {
  if (rawPct > 100) return OVER.color;
  for (const t of THRESHOLDS) {
    if (rawPct <= t.max) return t.color;
  }
  return THRESHOLDS[0].color;
}