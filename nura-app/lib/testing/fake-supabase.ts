/**
 * Test-only stand-in for the Supabase client: records every query and write, and answers selects
 * through a handler. Only the chain methods Nura's server code uses are implemented.
 */
export type FakeQuery = {
  table: string;
  op: "select" | "update" | "insert" | "delete";
  values?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
  selected?: string;
};

export type FakeHandler = (q: FakeQuery) => { data?: unknown; error?: unknown; count?: number } | undefined;

export function fakeSupabase(handler: FakeHandler = () => undefined, authUser: Record<string, unknown> | null = null) {
  const queries: FakeQuery[] = [];

  function builder(table: string) {
    const q: FakeQuery = { table, op: "select", filters: [] };
    let single = false;
    const result = () => {
      queries.push(q);
      const out = handler(q) ?? {};
      const data = out.data ?? (single ? null : q.op === "select" ? [] : null);
      return { data: single && Array.isArray(data) ? (data[0] ?? null) : data, error: out.error ?? null, count: out.count ?? 0 };
    };
    const chain: Record<string, unknown> = {};
    const filter = (name: string) => (col: string, val?: unknown) => {
      q.filters.push([name, col, val]);
      return chain;
    };
    for (const name of ["eq", "neq", "is", "lte", "gte", "lt", "gt", "in", "like", "not", "contains"]) chain[name] = filter(name);
    chain.select = (cols?: string) => {
      if (q.op === "select") q.selected = cols;
      else q.selected = cols ?? "*";
      return chain;
    };
    chain.update = (values: Record<string, unknown>) => {
      q.op = "update";
      q.values = values;
      return chain;
    };
    chain.insert = (values: Record<string, unknown>) => {
      q.op = "insert";
      q.values = values;
      return chain;
    };
    chain.delete = () => {
      q.op = "delete";
      return chain;
    };
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = () => {
      single = true;
      return Promise.resolve(result());
    };
    chain.single = chain.maybeSingle;
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return chain;
  }

  const client = {
    from: (table: string) => builder(table),
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: authUser }, error: null }),
      },
    },
  };

  return { client, queries, updates: (table: string) => queries.filter((q) => q.table === table && q.op === "update") };
}
