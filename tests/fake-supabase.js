/* 테스트용 가짜 Supabase — 네트워크에 접속하지 않고 메모리 데이터만 읽어요.
   실제 서버처럼 한 번에 최대 maxRows(기본 1000)행까지만 돌려줘요. */
'use strict';
function createFake(tables, { maxRows = 1000 } = {}) {
  const calls = [];
  function Q(name) { this.name = name; this.filters = []; this.orders = []; this.rg = null; }
  Q.prototype = {
    select() { return this; },
    eq(k, v) { this.filters.push(r => r[k] === v); return this; },
    in(k, a) { this.filters.push(r => a.includes(r[k])); return this; },
    order(k, o) { this.orders.push([k, !(o && o.ascending === false)]); return this; },
    range(a, b) { this.rg = [a, b]; return this; },
    maybeSingle() { this.one = true; return this; },
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); },
    run() {
      calls.push({ table: this.name, range: this.rg, orders: this.orders.map(o => o[0]) });
      let rows = (tables[this.name] || []).filter(r => this.filters.every(f => f(r))).map(r => ({ ...r }));
      for (const [k, asc] of this.orders.slice().reverse()) rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1));
      const [a, b] = this.rg || [0, maxRows - 1];
      rows = rows.slice(a, Math.min(b, a + maxRows - 1) + 1);
      if (this.one) return { data: rows[0] || null, error: null };
      return { data: rows, error: null };
    }
  };
  return { calls, from: name => new Q(name) };
}
module.exports = { createFake };
