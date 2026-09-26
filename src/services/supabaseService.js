/**
 * @file SupabaseDataService - Supabase-backed data-access layer.
 *
 * Implements the same async method signatures as `dataService.js` so that
 * feature modules require zero changes when switching between mock and
 * Supabase backends.
 *
 * Architecture:
 *   UI ? Feature ? (dataService | supabaseService) ? Supabase ? PostgreSQL
 *
 * The service transparently handles the mapping between:
 *   - DB rows (UUID foreign keys: category_id, account_id)
 *   - UI objects (string keys: 'Food', 'Income', etc.)
 *
 * Category mapping is cached per session and refreshed on `data:changed`.
 */

import { getSupabase } from './supabaseClient.js';
import { emit } from '../utils/eventBus.js';
import {
  generateId,
  formatCurrency,
} from '../utils/format.js';
import { CATEGORIES, CATEGORY_MAP, getCategoryLabelVi, getCategoryColor, getCategoryIcon } from '../constants/categories.js';

import dataService, {
  computeTotals,
  getTotalBalance,
  computeSavingsRate,
  getSpendingByCategory,
  getMonthlyCashFlow,
  getWeeklySeries,
  generateInsight,
} from './dataService.js';

export {
  computeTotals,
  getTotalBalance,
  computeSavingsRate,
  getSpendingByCategory,
  getMonthlyCashFlow,
  getWeeklySeries,
  generateInsight,
};

/* ---------------------------------------------------------------- *
 * Category cache - maps between UUID and UI id (slug)
 * ---------------------------------------------------------------- */
let _categoryMap = null;

/** Map UI id (slug) → DB UUID. Matches DB rows to CATEGORIES constant by key. */
function _buildCategoryMap(data) {
  _categoryMap = {};
  for (const row of data || []) {
    const cat = CATEGORIES.find(c => c.labelEn === row.key || c.id === row.key);
    const uiId = cat ? cat.id : row.key;
    _categoryMap[uiId] = row.id;
  }
}

/**
 * Load and cache all categories for the current user.
 * @param {string} userId
 */
async function _loadCategories(userId) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from('categories')
    .select('id, key, name, icon, color, type, is_default')
    .eq('is_default', false)
    .or(`user_id.eq.${userId},is_default.eq.true`);

  if (error) {
    console.warn('[supabaseService] Failed to load categories:', error.message);
    return;
  }

  _buildCategoryMap(data);
}

/**
 * Resolve a DB UUID to its UI id (slug).
 * @param {string} id
 * @returns {string|null}
 */
function _resolveCategoryName(id) {
  if (!_categoryMap) return null;
  const inv = {};
  for (const [uiId, catId] of Object.entries(_categoryMap)) {
    inv[catId] = uiId;
  }
  return inv[id] || null;
}

/**
 * Resolve a UI id (slug) to its DB UUID.
 * @param {string} categoryId
 * @returns {string|null}
 */
function _resolveCategoryId(categoryId) {
  if (!_categoryMap) return null;
  return _categoryMap[categoryId] || null;
}

/**
 * Fetch a single page of results from Supabase.
 * @param {object} supabase
 * @param {string} table
 * @param {object} [opts]
 * @returns {Promise<{data: any[], error: any }>}
 */
async function _select(supabase, table, opts = {}) {
  const { columns = '*', filters = {}, orderBy = null, limit = null } = opts;
  let query = supabase.from(table).select(columns);

  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
  }
  if (limit) {
    query = query.limit(limit);
  }

  return await query;
}

/**
 * Transform a DB transaction row into the UI Transaction shape.
 * @param {object} row
 * @returns {object}
 */
function _dbTxToUi(row) {
  return {
    id: row.id,
    merchant: row.merchant,
    category: _resolveCategoryName(row.category_id) || row.category_id,
    type: row.type,
    date: row.date,
    amount: Number(row.amount),
    status: row.status,
    payment_method: row.payment_method || null,
  };
}

/**
 * Transform a UI Transaction into a DB row payload.
 * @param {object} tx
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function _uiTxToDb(tx, userId) {
  if (!_categoryMap) await _loadCategories(userId);
  return {
    user_id: userId,
    account_id: tx.account_id || null,
    category_id: _resolveCategoryId(tx.category) || null,
    merchant: tx.merchant,
    amount: Number(tx.amount),
    type: tx.type,
    status: tx.status || 'completed',
    payment_method: tx.payment_method || null,
    date: tx.date,
    notes: tx.notes || null,
    is_recurring: tx.is_recurring || false,
  };
}

function _dbBudgetToUi(row) {
  return {
    id: row.id,
    category: _resolveCategoryName(row.category_id) || row.category_id,
    limit: Number(row.limit_amount),
    spent: Number(row.spent),
    icon: row.categories?.icon || null,
    color: row.color || '#64748B',
  };
}

async function _uiBudgetToDb(b, userId) {
  if (!_categoryMap) await _loadCategories(userId);
  return {
    user_id: userId,
    category_id: _resolveCategoryId(b.category) || null,
    name: b.name || b.category,
    limit_amount: Number(b.limit),
    spent: Number(b.spent || 0),
    month: b.month || new Date().toISOString().slice(0, 7),
    color: b.color || null,
  };
}

/* ---------------------------------------------------------------- *
 * SupabaseDataService - implements dataService interface
 * ---------------------------------------------------------------- */

const supabaseDataService = {
  userId: null,

  setUserId(id) {
    this.userId = id;
    _categoryMap = null;
  },

  async _ensureCategories() {
    if (!this.userId) return;
    if (!_categoryMap) await _loadCategories(this.userId);
  },

  /* ---- Transactions ---- */
  async getTransactions() {
    await this._ensureCategories();
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.getTransactions();
    }

    const { data, error } = await _select(supabase, 'transactions', {
      columns: 'id, merchant, amount, type, status, payment_method, date, notes, category_id, categories!inner(name,icon,color)',
      filters: { user_id: this.userId },
      orderBy: { column: 'date', ascending: false },
    });

    if (error) throw new Error(`Không thể tải giao dịch: ${error.message}`);

    return (data || []).map(row => ({
      ..._dbTxToUi(row),
      icon: row.categories?.icon || null,
      color: row.categories?.color || '#64748B',
    }));
  },

  async addTransaction(tx) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.addTransaction(tx);
    }

    const payload = await _uiTxToDb(tx, this.userId);
    const { data, error } = await supabase.from('transactions').insert(payload).select().single();

    if (error) throw new Error(`Không thể thêm giao dịch: ${error.message}`);
    emit('data:changed');
    return _dbTxToUi(data);
  },

  async deleteTransaction(id) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.deleteTransaction(id);
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', this.userId);
    if (error) throw new Error(`Không thể xóa giao dịch: ${error.message}`);
    emit('data:changed');
    return true;
  },

  async updateTransaction(id, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.updateTransaction(id, updates);
    }

    await this._ensureCategories();
    const payload = {};
    if (updates.merchant) payload.merchant = updates.merchant;
    if (updates.amount) payload.amount = Number(updates.amount);
    if (updates.type) payload.type = updates.type;
    if (updates.status) payload.status = updates.status;
    if (updates.payment_method) payload.payment_method = updates.payment_method;
    if (updates.date) payload.date = updates.date;
    if (updates.category) {
      payload.category_id = _resolveCategoryId(updates.category) || null;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Không thể cập nhật giao dịch: ${error.message}`);
    emit('data:changed');
    return _dbTxToUi(data);
  },

  /* ---- Budgets ---- */
  async getBudgets() {
    await this._ensureCategories();
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.getBudgets();
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data, error } = await _select(supabase, 'budgets', {
      columns: 'id, category_id, name, limit_amount, spent, month, color, categories!inner(name,icon,color)',
      filters: { user_id: this.userId, month: currentMonth },
    });

    if (error) throw new Error(`Không thể tải ngân sách: ${error.message}`);
    return (data || []).map(_dbBudgetToUi);
  },

  async addBudget(budget) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.addBudget(budget);
    }

    const payload = await _uiBudgetToDb(budget, this.userId);
    const { data, error } = await supabase.from('budgets').insert(payload).select().single();
    if (error) throw new Error(`Không thể thêm ngân sách: ${error.message}`);
    emit('data:changed');
    return _dbBudgetToUi(data);
  },

  async updateBudget(id, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.updateBudget(id, updates);
    }

    const payload = {};
    if (updates.spent !== undefined) payload.spent = Number(updates.spent);
    if (updates.limit !== undefined) payload.limit_amount = Number(updates.limit);
    if (updates.color) payload.color = updates.color;

    const { data, error } = await supabase
      .from('budgets')
      .update(payload)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Không thể cập nhật ngân sách: ${error.message}`);
    emit('data:changed');
    return _dbBudgetToUi(data);
  },

  /* ---- Settings (stored on profile) ---- */
  async getSettings() {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.getSettings();
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('currency, payday, budget_period')
      .eq('id', this.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('[supabaseService] Profile fetch warning:', error.message);
    }

    const localSettings = JSON.parse(localStorage.getItem('luxe_settings') || '{}');
    return {
      theme: localSettings.theme || 'dark',
      currency: profile?.currency || 'VND',
      payDay: profile?.payday || '1st',
      budgetPeriod: profile?.budget_period || 'monthly',
      compactMode: localSettings.compactMode || false,
      animations: localSettings.animations !== false,
      notifications: localSettings.notifications || {
        budgetWarning: true,
        weeklySummary: true,
        largeTransaction: false,
        aiInsights: true,
      },
    };
  },

  async updateSettings(updates) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.updateSettings(updates);
    }

    const payload = {};
    if (updates.currency) payload.currency = updates.currency;
    if (updates.payDay) payload.payday = updates.payDay;
    if (updates.budgetPeriod) payload.budget_period = updates.budgetPeriod;

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', this.userId);

      if (error) throw new Error(`Không thể cập nhật cài đặt: ${error.message}`);
    }

    const localUpdates = { ...updates };
    delete localUpdates.currency;
    delete localUpdates.payDay;
    delete localUpdates.budgetPeriod;
    if (Object.keys(localUpdates).length > 0) {
      const existing = JSON.parse(localStorage.getItem('luxe_settings') || '{}');
      Object.assign(existing, localUpdates);
      localStorage.setItem('luxe_settings', JSON.stringify(existing));
    }

    emit('data:changed');
    return this.getSettings();
  },

  /* ---- Accounts ---- */
  async getAccounts() {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.getAccounts();
    }

    const { data, error } = await _select(supabase, 'accounts', {
      columns: 'id, name, type, balance, currency, icon',
      filters: { user_id: this.userId },
      orderBy: { column: 'is_default', ascending: false },
    });

    if (error) throw new Error(`Không thể tải tài khoản: ${error.message}`);

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      balance: Number(row.balance),
      currency: row.currency || 'VND',
      icon: row.icon || null,
    }));
  },

  async addAccount(account) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.addAccount(account);
    }

    const { data, error } = await supabase.from('accounts').insert({
      user_id: this.userId,
      name: account.name,
      type: account.type || 'checking',
      balance: Number(account.balance || 0),
      currency: account.currency || 'VND',
      icon: account.icon || null,
      is_default: account.is_default || false,
    }).select().single();

    if (error) throw new Error(`Không thể thêm tài khoản: ${error.message}`);
    emit('data:changed');
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      balance: Number(data.balance),
      currency: data.currency,
      icon: data.icon,
    };
  },

  async updateAccount(id, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.updateAccount(id, updates);
    }

    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.type) payload.type = updates.type;
    if (updates.balance !== undefined) payload.balance = Number(updates.balance);
    if (updates.currency) payload.currency = updates.currency;
    if (updates.icon !== undefined) payload.icon = updates.icon;

    const { data, error } = await supabase
      .from('accounts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Không thể cập nhật tài khoản: ${error.message}`);
    emit('data:changed');
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      balance: Number(data.balance),
      currency: data.currency,
      icon: data.icon,
    };
  },

  async deleteAccount(id) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.deleteAccount(id);
    }

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Không thể xóa tài khoản: ${error.message}`);
    emit('data:changed');
    return true;
  },

  /* ---- Goals ---- */
  async getGoals() {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.getGoals();
    }

    const { data, error } = await _select(supabase, 'goals', {
      columns: 'id, name, target_amount, saved_amount, deadline, is_completed, color',
      filters: { user_id: this.userId },
      orderBy: { column: 'created_at', ascending: false },
    });

    if (error) throw new Error(`Không thể tải mục tiêu: ${error.message}`);

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      target: Number(row.target_amount),
      current: Number(row.saved_amount),
      deadline: row.deadline,
      is_completed: row.is_completed,
      color: row.color || '#22C55E',
      icon: '',
    }));
  },

  async addGoal(goal) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.addGoal(goal);
    }

    const { data, error } = await supabase.from('goals').insert({
      user_id: this.userId,
      name: goal.name,
      target_amount: Number(goal.target),
      saved_amount: Number(goal.current || 0),
      deadline: goal.deadline || null,
      color: goal.color || '#22C55E',
    }).select().single();

    if (error) throw new Error(`Không thể thêm mục tiêu: ${error.message}`);
    emit('data:changed');
    return {
      id: data.id,
      name: data.name,
      target: Number(data.target_amount),
      current: Number(data.saved_amount),
      deadline: data.deadline,
      is_completed: data.is_completed,
      color: data.color || '#22C55E',
      icon: '',
    };
  },

  async updateGoal(id, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.updateGoal(id, updates);
    }

    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.target !== undefined) payload.target_amount = Number(updates.target);
    if (updates.current !== undefined) payload.saved_amount = Number(updates.current);
    if (updates.deadline !== undefined) payload.deadline = updates.deadline;
    if (updates.is_completed !== undefined) payload.is_completed = updates.is_completed;
    if (updates.color) payload.color = updates.color;

    const { data, error } = await supabase
      .from('goals')
      .update(payload)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Không thể cập nhật mục tiêu: ${error.message}`);
    emit('data:changed');
    return {
      id: data.id,
      name: data.name,
      target: Number(data.target_amount),
      current: Number(data.saved_amount),
      deadline: data.deadline,
      is_completed: data.is_completed,
      color: data.color || '#22C55E',
      icon: '',
    };
  },

  async deleteGoal(id) {
    const supabase = getSupabase();
    if (!supabase) {
      return dataService.deleteGoal(id);
    }

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Không thể xóa mục tiêu: ${error.message}`);
    emit('data:changed');
    return true;
  },

  /* ---- Categories ---- */
  async getCategories() {
    const supabase = getSupabase();
    if (!supabase) {
      return CATEGORIES.map(c => ({ ...c }));
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id, key, name, icon, color, type, is_default, sort_order')
      .or(`user_id.eq.${this.userId},is_default.eq.true`)
      .order('is_default', { ascending: false })
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Không thể tải danh mục: ${error.message}`);

    _categoryMap = {};
    for (const row of data || []) {
      const cat = CATEGORIES.find(c => c.labelEn === row.key || c.id === row.key);
      const uiId = cat ? cat.id : row.key;
      _categoryMap[uiId] = row.id;
    }

    return (data || []).map(row => {
      const cat = CATEGORIES.find(c => c.labelEn === row.key || c.id === row.key);
      return {
        id: cat ? cat.id : row.key,
        key: row.key,
        labelVi: cat ? cat.labelVi : row.name,
        labelEn: cat ? cat.labelEn : row.key,
        name: cat ? cat.labelVi : row.name,
        icon: row.icon || (cat ? cat.icon : null),
        color: row.color || (cat ? cat.color : '#64748B'),
        type: row.type,
        is_default: row.is_default,
      };
    });
  },

  /* ---- Notifications ---- */
  async getNotifications(limit = 20) {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await _select(supabase, 'notifications', {
      columns: 'id, type, title, message, is_read, action_label, action_url, created_at',
      filters: { user_id: this.userId },
      orderBy: { column: 'created_at', ascending: false },
      limit,
    });

    if (error) throw new Error(`Không thể tải thông báo: ${error.message}`);

    return (data || []).map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      is_read: row.is_read,
      action_label: row.action_label,
      action_url: row.action_url,
      created_at: row.created_at,
    }));
  },

  async markNotificationRead(id) {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', this.userId);

    return !error;
  },

  /* ---- Profile ---- */
  async getProfile() {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, currency, payday, budget_period, created_at')
      .eq('id', this.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Không thể tải hồ sơ: ${error.message}`);
    }
    return data;
  },

  async updateProfile(updates) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const payload = {};
    if (updates.full_name) payload.full_name = updates.full_name;
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.payday) payload.payday = updates.payday;
    if (updates.budget_period) payload.budget_period = updates.budget_period;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Không thể cập nhật hồ sơ: ${error.message}`);
    emit('data:changed');
    return data;
  },

/* ---- Recurring Transactions ---- */
  async getRecurring() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await _select(supabase, 'recurring_transactions', {
      columns: '*',
      filters: { user_id: this.userId, is_active: true },
    });

    if (error) throw new Error(`Không thể tải giao dịch định kỳ: ${error.message}`);
    return data || [];
  },

  async addRecurring(recurring) {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase.from('recurring_transactions').insert({
      user_id: this.userId,
      account_id: recurring.account_id || null,
      category_id: recurring.category_id || null,
      merchant: recurring.merchant,
      amount: Number(recurring.amount),
      type: recurring.type,
      recurrence: recurring.recurrence,
      day_of_month: recurring.day_of_month || null,
      day_of_week: recurring.day_of_week || null,
      start_date: recurring.start_date,
      end_date: recurring.end_date || null,
      is_active: recurring.is_active !== false,
    }).select().single();

    if (error) throw new Error(`Không thể thêm giao dịch định kỳ: ${error.message}`);
    emit('data:changed');
    return data;
  },

  async updateRecurring(id, updates) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const payload = {};
    if (updates.merchant !== undefined) payload.merchant = updates.merchant;
    if (updates.amount !== undefined) payload.amount = Number(updates.amount);
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.recurrence !== undefined) payload.recurrence = updates.recurrence;
    if (updates.day_of_month !== undefined) payload.day_of_month = updates.day_of_month;
    if (updates.day_of_week !== undefined) payload.day_of_week = updates.day_of_week;
    if (updates.start_date !== undefined) payload.start_date = updates.start_date;
    if (updates.end_date !== undefined) payload.end_date = updates.end_date;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.account_id !== undefined) payload.account_id = updates.account_id;
    if (updates.category_id !== undefined) payload.category_id = updates.category_id;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Không thể cập nhật giao dịch định kỳ: ${error.message}`);
    emit('data:changed');
    return data;
  },

  async deleteRecurring(id) {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Không thể xóa giao dịch định kỳ: ${error.message}`);
    emit('data:changed');
    return true;
  },

  /* ---- Persistence ---- */
  async resetToDefaults() {
    return dataService.resetToDefaults();
  },
};

export default supabaseDataService;

