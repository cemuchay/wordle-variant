import { MockChannel } from './realtime';

export interface MockTableData {
  [table: string]: any[];
}

type FilterFn = (row: any) => boolean;

class MockQueryBuilder {
  private table: string;
  private tables: MockTableData;
  private _selectFields = '*';
  private filters: FilterFn[] = [];
  private _single = false;
  private _maybeSingle = false;
  private _limitVal: number | null = null;
  private _orderCol: string | null = null;
  private _orderAsc = true;
  private _countOption: { count: 'exact'; head: boolean } | null = null;
  private _insertData: any = null;
  private _updateData: any = null;
  private _deleteMode = false;
  private _upsertMode = false;

  constructor(table: string, tables: MockTableData) {
    this.table = table;
    this.tables = tables;
  }

  select(columns?: string) {
    if (columns) this._selectFields = columns;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r: any) => {
      const keys = col.split(',');
      return keys.some(k => r[k.trim()] === val);
    });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((r: any) => r[col] !== val);
    return this;
  }

  gt(col: string, val: any) {
    this.filters.push((r: any) => r[col] > val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((r: any) => vals.includes(r[col]));
    return this;
  }

  or(filtersStr: string) {
    const conditions = filtersStr.split(',');
    this.filters.push((r: any) =>
      conditions.some(cond => {
        const trimmed = cond.trim();
        const eqMatch = trimmed.match(/(\w+)\.eq\.(.+)/);
        if (eqMatch) return r[eqMatch[1]] === eqMatch[2];
        return false;
      })
    );
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this._limitVal = n;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  insert(data: any) {
    this._insertData = data;
    return this;
  }

  update(data: any) {
    this._updateData = data;
    return this;
  }

  delete() {
    this._deleteMode = true;
    return this;
  }

  upsert(data: any) {
    this._upsertMode = true;
    this._insertData = data;
    return this;
  }

  match(filter: Record<string, any>) {
    for (const [col, val] of Object.entries(filter)) {
      this.filters.push((r: any) => r[col] === val);
    }
    return this;
  }

  private getTableData(): any[] {
    if (!this.tables[this.table]) {
      this.tables[this.table] = [];
    }
    return this.tables[this.table];
  }

  private applyFilters(data: any[]): any[] {
    let result = [...data];
    for (const f of this.filters) {
      result = result.filter(f);
    }
    return result;
  }

  private resolveJoins(row: any): any {
    const joinMatch = this._selectFields.match(/(\w+):(\w+)\(([^)]+)\)/);
    if (joinMatch) {
      const [_, alias, foreignTable, foreignCols] = joinMatch;
      const foreignData = this.tables[foreignTable]?.find(
        (f: any) => f.id === row[`${alias}_id`] || f.id === row[alias]
      );
      if (foreignData) {
        const cols = foreignCols.split(',').map((c: string) => c.trim());
        const joined: any = {};
        for (const col of cols) {
          joined[col] = foreignData[col];
        }
        row[alias] = joined;
      }
    }
    return row;
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute() {
    if (this._insertData) {
      return this._executeInsert();
    }
    if (this._updateData) {
      return this._executeUpdate();
    }
    if (this._deleteMode) {
      return this._executeDelete();
    }
    return this._executeSelect();
  }

  private async _executeInsert() {
    const data = this.getTableData();
    const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData];
    for (const row of rows) {
      const newRow = { ...row, id: row.id || crypto.randomUUID() };
      data.push(newRow);
    }
    const result = { data: rows, error: null, count: null };
    return result;
  }

  private async _executeUpdate() {
    const data = this.getTableData();
    const matching = this.applyFilters(data);
    for (const row of matching) {
      Object.assign(row, this._updateData);
    }
    return { data: matching, error: null, count: null };
  }

  private async _executeDelete() {
    const data = this.getTableData();
    const matching = this.applyFilters(data);
    const idsToRemove = new Set(matching.map((r: any) => r.id));
    this.tables[this.table] = data.filter((r: any) => !idsToRemove.has(r.id));
    return { data: matching, error: null, count: null };
  }

  private async _executeSelect() {
    let data = this.getTableData();
    data = this.applyFilters(data);

    if (this._orderCol) {
      data.sort((a: any, b: any) => {
        const va = a[this._orderCol!];
        const vb = b[this._orderCol!];
        if (va < vb) return this._orderAsc ? -1 : 1;
        if (va > vb) return this._orderAsc ? 1 : -1;
        return 0;
      });
    }

    if (this._limitVal != null) {
      data = data.slice(0, this._limitVal);
    }

    // Resolve joins
    data = data.map((r: any) => this.resolveJoins(r));

    if (this._countOption) {
      return { data: data.map((r: any) => ({ id: r.id })), count: data.length, error: null };
    }

    if (this._single) {
      return { data: data[0] ?? null, error: data.length === 0 ? new Error('not found') : null };
    }

    if (this._maybeSingle) {
      return { data: data[0] ?? null, error: null };
    }

    return { data, error: null, count: null };
  }
}

export interface SupabaseMock {
  client: any;
  channels: Map<string, MockChannel>;
  tables: MockTableData;
  setTableData(table: string, data: any[]): void;
  getChannel(name: string): MockChannel | undefined;
}

export function createMockSupabase(): SupabaseMock {
  const channels = new Map<string, MockChannel>();
  const tables: MockTableData = {};

  const mockClient = {
    channel: (name: string, _opts?: any) => {
      const existing = channels.get(name);
      if (existing) return existing;
      const ch = new MockChannel(name);
      channels.set(name, ch);
      return ch;
    },
    removeChannel: (ch: any) => {
      for (const [name, c] of channels) {
        if (c === ch) {
          channels.delete(name);
          break;
        }
      }
    },
    getChannels: () => Array.from(channels.values()),
    from: (table: string) => new MockQueryBuilder(table, tables),
    rpc: (fn: string, params?: any) => {
      switch (fn) {
        case 'join_wordup_queue':
          return Promise.resolve({
            data: JSON.stringify({ status: 'queued', match_id: null }),
            error: null,
          });
        case 'get_server_time':
          return Promise.resolve({ data: new Date().toISOString(), error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    },
    functions: {
      invoke: (fn: string, _opts?: any) => {
        if (fn === 'generate-match-questions') {
          return Promise.resolve({
            data: { questions: [], encrypted_questions: '', encryption_key: '' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };

  return {
    client: mockClient,
    channels,
    tables,
    setTableData: (table, data) => { tables[table] = data; },
    getChannel: (name) => channels.get(name),
  };
}
