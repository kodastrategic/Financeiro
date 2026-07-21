(function() {
  'use strict';

  if (!window.SUPABASE_CONFIG) { console.error('Supabase config not found.'); return; }

  const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey
  );

  const PK_MAP = { commands: 'keyword', categories: 'name', budgets: 'category' };
  const PK_STR = new Set(['commands', 'categories', 'budgets']);
  function pk(table) { return PK_MAP[table] || 'id'; }

  // lowercase → camelCase mapping (DB → JS)
  const KC = {
    createdat:'createdAt', txdate:'date', cardlimit:'limit', budgetlimit:'limit',
    availablelimit:'availableLimit', closingday:'closingDay', dueday:'dueDay',
    invoicepaymentid:'invoicePaymentId', fixedexpenseid:'fixedExpenseId',
    fixedmonthkey:'fixedMonthKey', totalamount:'totalAmount',
    installmentcount:'installmentCount', installmentvalue:'installmentValue',
    purchasedate:'purchaseDate', firstinstallmentdate:'firstInstallmentDate',
    paidinstallments:'paidInstallments', debtid:'debtId', monthkey:'monthKey',
    startdate:'startDate', expenseid:'expenseId', cardid:'cardId',
    originalamount:'originalAmount', currentamount:'currentAmount'
  };

  // Reverse: JS camelCase → DB lowercase column
  const CK = {};
  for (const [db, js] of Object.entries(KC)) CK[js] = db;

  function dbKey(key) { return CK[key] || key.toLowerCase(); }

  function lowerKeys(obj, table) {
    if (Array.isArray(obj)) return obj.map(item => lowerKeys(item, table));
    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
      const r = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'limit') {
          if (table === 'cards') r['cardlimit'] = v;
          else if (table === 'budgets') r['budgetlimit'] = v;
          else r[k.toLowerCase()] = v;
        } else {
          r[CK[k] || k.toLowerCase()] = v;
        }
      }
      return r;
    }
    return obj;
  }

  function camelKeys(obj) {
    if (Array.isArray(obj)) return obj.map(camelKeys);
    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
      const r = {};
      for (const [k, v] of Object.entries(obj)) r[KC[k] || k] = v;
      return r;
    }
    return obj;
  }

  class TableQuery {
    constructor(client, table) {
      this._client = client; this._table = table;
      this._filters = []; this._orderField = null; this._orderAsc = true; this._filterFn = null;
    }
    clone() {
      const q = new TableQuery(this._client, this._table);
      q._filters = this._filters.map(f => ({ ...f }));
      q._orderField = this._orderField; q._orderAsc = this._orderAsc; q._filterFn = this._filterFn;
      return q;
    }
    equals(v) { const q = this.clone(); const l = q._filters[q._filters.length - 1]; if (l && l.type === 'pending') { l.type = 'eq'; l.value = v; } return q; }
    startsWith(v) { const q = this.clone(); const l = q._filters.pop(); if (l) q._filters.push({ type: 'like', field: l.field, value: v + '%' }); return q; }
    async toArray() {
      if (this._filterFn) {
        const { data, error } = await this._client.from(this._table).select('*');
        if (error) throw error; return camelKeys((data || []).filter(this._filterFn));
      }
      let query = this._client.from(this._table).select('*');
      for (const f of this._filters) {
        const field = dbKey(f.field);
        if (f.type === 'eq') query = query.eq(field, f.value);
        else if (f.type === 'like') query = query.like(field, f.value);
      }
      if (this._orderField) query = query.order(dbKey(this._orderField), { ascending: this._orderAsc });
      const { data, error } = await query;
      if (error) throw error; return camelKeys(data || []);
    }
    async first() { const items = await this.toArray(); return items[0]; }
    async delete() {
      const items = await this.toArray();
      const pkey = pk(this._table);
      for (const item of items) await this._client.from(this._table).delete().eq(pkey, item[pkey]);
    }
  }

  class TableWrapper {
    constructor(client, name) { this._client = client; this._name = name; }

    async add(item) {
      const copy = lowerKeys({ ...item }, this._name);
      if (copy.id && !PK_STR.has(this._name)) delete copy.id;
      // Tenta via supabase client
      const { error } = await this._client.from(this._name).insert(copy);
      if (error) {
        // Se falhar, tenta via fetch direto como fallback
        console.warn('Supabase client insert failed, trying fetch:', error);
        const url = window.SUPABASE_CONFIG.url.replace(/\/$/, '') + '/rest/v1/' + this._name;
        const headers = {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': 'Bearer ' + window.SUPABASE_CONFIG.anonKey,
          'Prefer': 'return=minimal'
        };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(copy) });
        const text = await res.text();
        if (!res.ok) throw new Error(`insert ${this._name}: HTTP ${res.status} ${res.statusText} — ${text}`);
        console.log('Fetch insert OK:', text);
      }
      return PK_STR.has(this._name) ? copy[pk(this._name)] : (copy.id||Date.now());
    }

    async get(id) {
      const pkey = pk(this._name);
      const { data, error } = await this._client.from(this._name).select('*').eq(pkey, id).maybeSingle();
      if (error) return undefined; return data ? camelKeys(data) : undefined;
    }

    async put(item) {
      const { error } = await this._client.from(this._name).upsert(lowerKeys(item, this._name));
      if (error) throw error; return item;
    }

    async delete(id) {
      const pkey = pk(this._name);
      const { error } = await this._client.from(this._name).delete().eq(pkey, id);
      if (error) throw error;
    }

    async toArray() {
      const pkey = pk(this._name);
      const { data, error } = await this._client.from(this._name).select('*').order(pkey, { ascending: true });
      if (error) throw error; return camelKeys(data || []);
    }

    async clear() {
      if (PK_STR.has(this._name)) {
        const items = await this.toArray();
        for (const item of items) await this.delete(item[pk(this._name)]);
      } else {
        const { error } = await this._client.from(this._name).delete().neq('id', 0);
        if (error && error.code !== 'PGRST116') throw error;
      }
    }

    async count() {
      const { count, error } = await this._client.from(this._name).select('*', { count: 'exact', head: true });
      if (error) throw error; return count || 0;
    }

    async bulkAdd(items) {
      const valid = items.map(item => {
        const copy = lowerKeys({ ...item }, this._name);
        if (copy.id && !PK_STR.has(this._name)) delete copy.id;
        return copy;
      });
      const { error } = await this._client.from(this._name).insert(valid);
      if (error) throw error;
    }

    where(fieldOrObj) {
      const q = new TableQuery(this._client, this._name);
      if (typeof fieldOrObj === 'object' && fieldOrObj !== null) {
        for (const [k, v] of Object.entries(fieldOrObj)) q._filters.push({ type: 'eq', field: dbKey(k), value: v });
      } else {
        q._filters.push({ type: 'pending', field: dbKey(fieldOrObj) });
      }
      return q;
    }

    orderBy(field, dir) {
      const q = new TableQuery(this._client, this._name);
      q._orderField = field; q._orderAsc = dir !== 'desc';
      return q;
    }

    filter(fn) {
      const q = new TableQuery(this._client, this._name);
      q._filterFn = fn; return q;
    }
  }

  // Table names em lowercase para corresponder ao PostgreSQL
  window.db = {};
  const TABLES = ['transactions', 'commands', 'categories', 'cards', 'installments',
    'debts', 'debtpayments', 'invoicepayments', 'recurrings', 'fixedexpenses',
    'fixedpayments', 'budgets'];
  TABLES.forEach(name => { window.db[name] = new TableWrapper(supabase, name); });
  // Função de debug: testa insert via fetch direto
  window.debugInsert = async function(table, data) {
    const url = SUPABASE_CONFIG.url.replace(/\/$/, '') + '/rest/v1/' + table;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_CONFIG.anonKey,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey,
      'Prefer': 'return=minimal'
    };
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      console.log('Status:', res.status, res.statusText);
      const text = await res.text();
      console.log('Response:', text);
      if (!res.ok) {
        const errBody = JSON.parse(text);
        console.error('Error code:', errBody.code, 'message:', errBody.message);
      }
    } catch(e) { console.error('Fetch error:', e); }
  };
  console.log('FinanceApp v2 — Supabase conectado (debugInsert disponível no console)');
})();
