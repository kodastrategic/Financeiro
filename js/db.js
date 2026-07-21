(function() {
  'use strict';

  if (!window.SUPABASE_CONFIG) {
    console.error('Supabase config not found. Create supabase-config.js from supabase-config.example.js');
    return;
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  const supabase = window.supabase.createClient(url, anonKey);

  const PK_MAP = {
    commands: 'keyword',
    categories: 'name',
    budgets: 'category'
  };
  const PK_STR_TABLES = new Set(['commands', 'categories', 'budgets']);

  function pk(table) {
    return PK_MAP[table] || 'id';
  }

  class TableQuery {
    constructor(supabaseClient, tableName) {
      this._supabase = supabaseClient;
      this._table = tableName;
      this._filters = [];
      this._orderField = null;
      this._orderAsc = true;
    }

    _clone() {
      const q = new TableQuery(this._supabase, this._table);
      q._filters = [...this._filters];
      q._orderField = this._orderField;
      q._orderAsc = this._orderAsc;
      return q;
    }

    _build(selectStr) {
      let query = this._supabase.from(this._table).select(selectStr || '*');
      for (const f of this._filters) {
        if (f.type === 'eq') query = query.eq(f.field, f.value);
        else if (f.type === 'gte') query = query.gte(f.field, f.value);
        else if (f.type === 'lt') query = query.lt(f.field, f.value);
        else if (f.type === 'like') query = query.like(f.field, f.value);
        else if (f.type === 'in') query = query.in(f.field, f.value);
      }
      if (this._orderField) {
        query = query.order(this._orderField, { ascending: this._orderAsc });
      }
      return query;
    }

    equals(value) {
      const q = this._clone();
      const last = q._filters[q._filters.length - 1];
      if (last && last.type === 'pending') {
        last.type = 'eq';
        last.value = value;
      } else {
        q._filters.push({ type: 'eq', field: value, value: undefined });
      }
      return q;
    }

    startsWith(value) {
      const q = this._clone();
      q._filters.push({ type: 'like', field: this._filters.pop()?.field, value: value + '%' });
      return q;
    }

    gte(value) {
      const q = this._clone();
      const last = q._filters[q._filters.length - 1];
      if (last && last.type === 'pending') { last.type = 'gte'; last.value = value; }
      else { q._filters.push({ type: 'gte', field: value }); }
      return q;
    }

    lt(value) {
      const q = this._clone();
      const last = q._filters[q._filters.length - 1];
      if (last && last.type === 'pending') { last.type = 'lt'; last.value = value; }
      else { q._filters.push({ type: 'lt', field: value }); }
      return q;
    }

    in(arr) {
      const q = this._clone();
      const last = q._filters[q._filters.length - 1];
      if (last && last.type === 'pending') { last.type = 'in'; last.value = arr; }
      return q;
    }

    async toArray() {
      const { data, error } = await this._build();
      if (error) throw error;
      return data || [];
    }

    async first() {
      const { data, error } = await this._build().limit(1).maybeSingle();
      if (error) return undefined;
      return data || undefined;
    }

    async delete() {
      const items = await this.toArray();
      const pkey = pk(this._table);
      for (const item of items) {
        const val = item[pkey];
        if (PK_STR_TABLES.has(this._table)) {
          await this._supabase.from(this._table).delete().eq(pkey, val);
        } else {
          await this._supabase.from(this._table).delete().eq('id', item.id);
        }
      }
    }
  }

  class TableWrapper {
    constructor(supabaseClient, tableName) {
      this._supabase = supabaseClient;
      this._name = tableName;
      this._pkey = pk(tableName);
    }

    async add(item) {
      if (!PK_STR_TABLES.has(this._name) && item.id) delete item.id;
      if (!item.createdAt) item.createdAt = new Date().toISOString();
      const { data, error } = await this._supabase.from(this._name).insert(item).select().single();
      if (error) throw error;
      return PK_STR_TABLES.has(this._name) ? data[this._pkey] : data.id;
    }

    async get(id) {
      const pkey = this._pkey;
      if (PK_STR_TABLES.has(this._name)) {
        const { data, error } = await this._supabase.from(this._name).select('*').eq(pkey, id).maybeSingle();
        if (error) return undefined;
        return data || undefined;
      }
      const { data, error } = await this._supabase.from(this._name).select('*').eq('id', id).maybeSingle();
      if (error) return undefined;
      return data || undefined;
    }

    async put(item) {
      const pkey = this._pkey;
      if (PK_STR_TABLES.has(this._name)) {
        const { data, error } = await this._supabase.from(this._name).upsert(item).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await this._supabase.from(this._name).upsert(item).select().single();
      if (error) throw error;
      return data;
    }

    async delete(id) {
      const pkey = this._pkey;
      if (PK_STR_TABLES.has(this._name)) {
        const { error } = await this._supabase.from(this._name).delete().eq(pkey, id);
        if (error) throw error;
      } else {
        const { error } = await this._supabase.from(this._name).delete().eq('id', id);
        if (error) throw error;
      }
    }

    async toArray() {
      const { data, error } = await this._supabase.from(this._name).select('*').order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    async clear() {
      const { error } = await this._supabase.from(this._name).delete().neq('id', 0);
      if (error && error.code !== 'PGRST116') throw error;
    }

    async count() {
      const { count, error } = await this._supabase.from(this._name).select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }

    async bulkAdd(items) {
      const valid = items.map(item => {
        const copy = { ...item };
        if (!PK_STR_TABLES.has(this._name) && copy.id) delete copy.id;
        if (!copy.createdAt) copy.createdAt = new Date().toISOString();
        return copy;
      });
      const { data, error } = await this._supabase.from(this._name).insert(valid).select();
      if (error) throw error;
      return data;
    }

    where(fieldOrObj, value) {
      const q = new TableQuery(this._supabase, this._name);
      if (typeof fieldOrObj === 'object' && fieldOrObj !== null) {
        for (const [k, v] of Object.entries(fieldOrObj)) {
          q._filters.push({ type: 'eq', field: k, value: v });
        }
      } else {
        q._filters.push({ type: 'pending', field: fieldOrObj, value: value });
      }
      return q;
    }

    orderBy(field, dir) {
      const q = new TableQuery(this._supabase, this._name);
      q._orderField = field;
      q._orderAsc = dir !== 'desc';
      return q;
    }

    filter(fn) {
      const q = new TableQuery(this._supabase, this._name);
      q._filterFn = fn;
      return q;
    }
  }

  // Patch filter().toArray()
  const origToArray = TableQuery.prototype.toArray;
  TableQuery.prototype.toArray = async function() {
    if (this._filterFn) {
      const { data, error } = await this._supabase.from(this._table).select('*');
      if (error) throw error;
      return (data || []).filter(this._filterFn);
    }
    return origToArray.call(this);
  };

  window.db = {};
  const TABLES = ['transactions', 'commands', 'categories', 'cards', 'installments',
    'debts', 'debtPayments', 'invoicePayments', 'recurrings', 'fixedExpenses',
    'fixedPayments', 'budgets'];

  TABLES.forEach(name => {
    window.db[name] = new TableWrapper(supabase, name);
  });

  console.log('✅ FinanceApp v2 — Supabase conectado');
})();
