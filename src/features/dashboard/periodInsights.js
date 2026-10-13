/**
 * @file Rule-based period highlights and financial insights generator.
 * Single source of truth for the right sidebar "Điểm nhấn kỳ này" block.
 * 100% client-side rule evaluation, zero external API dependencies.
 */

import {
  formatCurrency,
  parseNumber,
  escapeHtml,
  getTransactionType,
  getLocalDateString,
} from '../../utils/format.js';
import { getCategoryLabelVi } from '../../constants/categories.js';
import { t } from '../../utils/i18n.js';

/**
 * Calculate days remaining until pay day with exact (dd/mm) format.
 * Automatically wraps to the following month if pay day in current month has passed.
 *
 * @param {string|number} payDaySetting e.g. '15th', '15', 15
 * @param {Date} [baseDate=new Date()]
 * @returns {{ days: number|null, ddmm: string, text: string }}
 */
export function getPayDayInfo(payDaySetting = '15', baseDate = new Date()) {
  const dayNum = parseInt(String(payDaySetting).replace(/\D/g, ''), 10);
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    return { days: null, ddmm: '', text: '—' };
  }

  const now = new Date(baseDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const currentDay = now.getDate();

  const todayStart = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0);

  // Target pay date in current month (clamped to max days in month)
  const maxDaysThisMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const clampedDayThisMonth = Math.min(dayNum, maxDaysThisMonth);
  let targetDate = new Date(currentYear, currentMonth, clampedDayThisMonth, 0, 0, 0, 0);

  if (targetDate < todayStart) {
    // Already passed in current month -> move to next month
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const maxDaysNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
    const clampedDayNextMonth = Math.min(dayNum, maxDaysNextMonth);
    targetDate = new Date(nextMonthYear, nextMonth, clampedDayNextMonth, 0, 0, 0, 0);
  }

  const diffMs = targetDate.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const pad = (n) => String(n).padStart(2, '0');
  const ddmm = `${pad(targetDate.getDate())}/${pad(targetDate.getMonth() + 1)}`;

  let text = '';
  if (diffDays === 0) {
    text = `Hôm nay (${ddmm})`;
  } else if (diffDays === 1) {
    text = `Còn 1 ngày (${ddmm})`;
  } else {
    text = `Còn ${diffDays} ngày (${ddmm})`;
  }

  return {
    days: diffDays,
    ddmm,
    text,
  };
}

/**
 * Generate at most 2 rule-based suggestions based on current financial data.
 * Rules evaluated in priority order:
 * 1. Budget overrun or critical threshold (>= 80%)
 * 2. Net cash flow deficit (expenses > income)
 * 3. Top expense category share (% of total spending)
 * 4. Average daily spending in the selected period
 * 5. Positive savings rate achievement
 *
 * @param {Object} params
 * @param {Array} params.periodTx Transactions in current period
 * @param {Array} [params.budgets=[]]
 * @param {Object} [params.stats={}] Unified stats
 * @param {number} [params.days=30] Number of days in current period
 * @returns {Array<{ id: string, type: 'danger'|'warning'|'info'|'positive', title: string, detail: string, iconType: string }>} Max 2 items
 */
export function generatePeriodSuggestions({
  periodTx = [],
  budgets = [],
  stats = {},
  days = 30,
} = {}) {
  const candidates = [];
  const safeDays = Math.max(1, days || 1);

  // Compute actual income, expenses, and net from periodTx if stats not provided
  let totalIncome = stats.income != null ? stats.income : 0;
  let totalExpense = stats.expense != null ? stats.expense : 0;

  if (stats.income == null || stats.expense == null) {
    totalIncome = 0;
    totalExpense = 0;
    for (const tx of periodTx || []) {
      if (!tx || tx.status === 'failed' || tx.status === 'cancelled') continue;
      const type = getTransactionType(tx);
      const amt = parseNumber(tx.amount);
      if (type === 'income') totalIncome += amt;
      else if (type === 'expense') totalExpense += amt;
    }
  }

  const net = totalIncome - totalExpense;

  // -------------------------------------------------------------
  // Rule A: Budget threshold (>= 80% or over-budget)
  // -------------------------------------------------------------
  const categorySpending = new Map();
  for (const tx of periodTx || []) {
    if (!tx || tx.status === 'failed' || tx.status === 'cancelled') continue;
    if (getTransactionType(tx) === 'expense') {
      const cat = tx.category || 'other';
      const cur = categorySpending.get(cat) || 0;
      categorySpending.set(cat, cur + parseNumber(tx.amount));
    }
  }

  const budgetAlerts = [];
  for (const b of budgets || []) {
    const limit = parseNumber(b.limit);
    if (limit <= 0) continue;
    const spent = categorySpending.get(b.category) || 0;
    const pct = Math.round((spent / limit) * 100);
    if (pct >= 80) {
      budgetAlerts.push({
        category: b.category,
        limit,
        spent,
        pct,
        remaining: limit - spent,
      });
    }
  }

  // Sort by highest percentage spent
  budgetAlerts.sort((a, b) => b.pct - a.pct);

  if (budgetAlerts.length > 0) {
    const worst = budgetAlerts[0];
    const catLabel = getCategoryLabelVi(worst.category) || worst.category;

    if (worst.pct >= 100) {
      candidates.push({
        id: 'budget-over',
        type: 'danger',
        priority: 10,
        iconType: 'alertTriangle',
        title: `${catLabel} đã vượt ngân sách (${worst.pct}%)`,
        detail: `Đã chi ${formatCurrency(worst.spent)}, vượt hạn mức ${formatCurrency(worst.spent - worst.limit)}. Hãy hạn chế chi tiêu mục này.`,
      });
    } else {
      candidates.push({
        id: 'budget-warning',
        type: 'warning',
        priority: 9,
        iconType: 'alertTriangle',
        title: `${catLabel} đã dùng ${worst.pct}% ngân sách`,
        detail: `Chỉ còn ${formatCurrency(worst.remaining)} cho ${catLabel} trong kỳ này. Cân nhắc điều chỉnh chi tiêu.`,
      });
    }
  }

  // -------------------------------------------------------------
  // Rule B: Net cash flow deficit (when expenses exceed income)
  // -------------------------------------------------------------
  if (totalExpense > 0 && net < 0) {
    const deficit = Math.abs(net);
    candidates.push({
      id: 'net-deficit',
      type: 'warning',
      priority: 8,
      iconType: 'alertTriangle',
      title: `Chi tiêu vượt thu nhập (${formatCurrency(deficit)})`,
      detail: `Tổng chi ${formatCurrency(totalExpense)} đang cao hơn thu nhập ${formatCurrency(totalIncome)} trong kỳ.`,
    });
  }

  // -------------------------------------------------------------
  // Rule C: Top expense category share (% of total expenses)
  // -------------------------------------------------------------
  if (totalExpense > 0 && categorySpending.size > 0) {
    const sortedCats = Array.from(categorySpending.entries())
      .map(([cat, amt]) => ({ category: cat, spent: amt }))
      .sort((a, b) => b.spent - a.spent);

    const topCat = sortedCats[0];
    const topPct = Math.round((topCat.spent / totalExpense) * 100);

    if (topPct >= 20) {
      const topLabel = getCategoryLabelVi(topCat.category) || topCat.category;
      candidates.push({
        id: 'top-category',
        type: 'info',
        priority: 6,
        iconType: 'receipt',
        title: `${topLabel} chiếm ${topPct}% tổng chi tiêu`,
        detail: `Đã chi ${formatCurrency(topCat.spent)} trên tổng ${formatCurrency(totalExpense)} trong kỳ này.`,
      });
    }
  }

  // -------------------------------------------------------------
  // Rule D: Average daily spending
  // -------------------------------------------------------------
  if (totalExpense > 0 && safeDays > 0) {
    const avgDaily = Math.round(totalExpense / safeDays);
    candidates.push({
      id: 'avg-daily',
      type: 'info',
      priority: 5,
      iconType: 'calendar',
      title: `Chi tiêu trung bình ${formatCurrency(avgDaily)}/ngày`,
      detail: `Ghi nhận tổng chi ${formatCurrency(totalExpense)} qua ${safeDays} ngày của kỳ này.`,
    });
  }

  // -------------------------------------------------------------
  // Rule E: Healthy savings rate (when income > expenses)
  // -------------------------------------------------------------
  if (totalIncome > 0 && net > 0) {
    const rate = Number(((net / totalIncome) * 100).toFixed(1));
    candidates.push({
      id: 'savings-rate',
      type: 'positive',
      priority: 4,
      iconType: 'checkCircle',
      title: `Đang tiết kiệm ${rate}% thu nhập`,
      detail: `Thặng dư đạt ${formatCurrency(net)} từ tổng thu nhập ${formatCurrency(totalIncome)} trong kỳ.`,
    });
  }

  // Sort candidates by priority descending and take at most 2
  candidates.sort((a, b) => b.priority - a.priority);

  return candidates.slice(0, 2);
}

/**
 * Compile all highlight metrics and suggestions for the right sidebar.
 *
 * @param {Object} params
 * @param {Array} params.periodTx Current period transactions
 * @param {Array} [params.budgets=[]]
 * @param {Object} [params.settings={}]
 * @param {Object} [params.stats={}]
 * @param {Date} [params.baseDate=new Date()]
 * @returns {Object} Compiled highlights view model
 */
export function getPeriodHighlights({
  periodTx = [],
  budgets = [],
  settings = {},
  stats = {},
  baseDate = new Date(),
} = {}) {
  const txList = Array.isArray(periodTx) ? periodTx : [];
  const isEmpty = txList.length === 0;

  // 1. Dòng tiền ròng (= thu - chi)
  let income = stats.income != null ? stats.income : 0;
  let expense = stats.expense != null ? stats.expense : 0;
  let net = stats.net != null ? stats.net : (income - expense);

  if (stats.income == null || stats.expense == null) {
    income = 0;
    expense = 0;
    for (const tx of txList) {
      if (!tx || tx.status === 'failed' || tx.status === 'cancelled') continue;
      const type = getTransactionType(tx);
      const amt = parseNumber(tx.amount);
      if (type === 'income') income += amt;
      else if (type === 'expense') expense += amt;
    }
    net = income - expense;
  }

  let netSign = '';
  let netClass = 'highlight-val--neutral';
  let netColor = 'var(--text-secondary)';

  if (net > 0) {
    netSign = '+';
    netClass = 'highlight-val--positive';
    netColor = 'var(--positive)';
  } else if (net < 0) {
    netSign = '-';
    netClass = 'highlight-val--negative';
    netColor = 'var(--negative)';
  }

  const netFormatted = `${netSign}${formatCurrency(Math.abs(net), { asHtml: true })}`;
  const netRawText = `${netSign}${formatCurrency(Math.abs(net))}`;

  // 2. Chi lớn nhất (tên rút gọn 1 dòng)
  const expenseTxs = txList
    .filter(tx => {
      if (!tx || tx.status === 'failed' || tx.status === 'cancelled') return false;
      return getTransactionType(tx) === 'expense';
    })
    .sort((a, b) => parseNumber(b.amount) - parseNumber(a.amount));

  const largestTx = expenseTxs[0] || null;
  const largest = largestTx ? {
    merchant: largestTx.merchant || 'Giao dịch',
    amount: parseNumber(largestTx.amount),
    formattedAmount: formatCurrency(parseNumber(largestTx.amount), { asHtml: true }),
    rawAmount: formatCurrency(parseNumber(largestTx.amount)),
  } : null;

  // 3. Còn N ngày đến kỳ lương (dd/mm)
  const payDay = settings?.payDay || '15th';
  const payDayInfo = getPayDayInfo(payDay, baseDate);

  // 4. Gợi ý rule-based (tối đa 2)
  const daysInPeriod = stats?.range?.days || 30;
  const suggestions = isEmpty ? [] : generatePeriodSuggestions({
    periodTx: txList,
    budgets,
    stats: { income, expense, net },
    days: daysInPeriod,
  });

  return {
    isEmpty,
    income,
    expense,
    net,
    netSign,
    netClass,
    netColor,
    netFormatted,
    netRawText,
    largest,
    payDayInfo,
    suggestions,
  };
}

/**
 * Backward compatibility helper replacing dataService.generateInsight().
 * Never leaks the legacy "Theo dõi giao dịch đầu tiên để xem phân tích" string
 * when transactions actually exist.
 *
 * @param {Array} txList
 * @param {Array} budgetList
 * @returns {{ text: string, detail: string, type: 'positive'|'warning'|'info' }}
 */
export function generateRuleBasedInsight(txList = [], budgetList = []) {
  if (!txList || txList.length === 0) {
    return {
      text: 'Chưa có giao dịch trong kỳ',
      detail: 'Thêm giao dịch thu nhập hoặc chi phí để bắt đầu theo dõi.',
      type: 'info',
      action: 'Thêm giao dịch',
      actionPage: 'transactions',
    };
  }

  const suggestions = generatePeriodSuggestions({
    periodTx: txList,
    budgets: budgetList,
    days: 30,
  });

  if (suggestions.length > 0) {
    const top = suggestions[0];
    return {
      text: top.title,
      detail: top.detail,
      type: top.type === 'danger' ? 'warning' : top.type,
      action: 'Xem chi tiết',
      actionPage: top.id.startsWith('budget') ? 'budgets' : 'reports',
    };
  }

  return {
    text: 'Tài chính trong kỳ ổn định',
    detail: 'Các chỉ số chi tiêu và ngân sách đang ở mức cân đối.',
    type: 'positive',
    action: 'Xem báo cáo',
    actionPage: 'reports',
  };
}

export default {
  getPayDayInfo,
  generatePeriodSuggestions,
  getPeriodHighlights,
  generateRuleBasedInsight,
};
