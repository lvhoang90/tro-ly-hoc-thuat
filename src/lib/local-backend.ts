// Máy khách cho máy chủ Node + SQLite (VITE_BACKEND=local): cùng giao diện gọi như Supabase
// (.from().select().eq()…, .rpc(), .auth.*) nên các trang không phải sửa. Phiên đăng nhập là cookie HttpOnly do máy chủ cấp.
type Err = { message: string };
interface Result<T = unknown> { data: T; error: Err | null }
interface Filter { col: string; op: "eq" | "neq" | "in"; val: unknown }

async function post(path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, json: { message: "Network error" } }; }
}
const errOf = (j: Record<string, unknown>): Err => {
  const e = j.error as { message?: string } | string | undefined;
  return { message: String(j.message ?? (typeof e === "object" ? e?.message : e) ?? "Request failed") };
};

class Query implements PromiseLike<Result<unknown>> {
  private req: { table: string; op: string; filters: Filter[]; order: { col: string; asc: boolean }[]; limit?: number; values?: unknown; single: "single" | "maybe" | null };
  constructor(table: string) { this.req = { table, op: "select", filters: [], order: [], single: null }; }
  select(_cols?: string) { return this; }
  insert(values: unknown) { this.req.op = "insert"; this.req.values = values; return this; }
  update(values: unknown) { this.req.op = "update"; this.req.values = values; return this; }
  upsert(values: unknown) { this.req.op = "upsert"; this.req.values = values; return this; }
  delete() { this.req.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.req.filters.push({ col, op: "eq", val }); return this; }
  neq(col: string, val: unknown) { this.req.filters.push({ col, op: "neq", val }); return this; }
  in(col: string, val: unknown[]) { this.req.filters.push({ col, op: "in", val }); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.req.order.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.req.limit = n; return this; }
  single() { this.req.single = "single"; return this; }
  maybeSingle() { this.req.single = "maybe"; return this; }

  private async run(): Promise<Result<unknown>> {
    const r = await post("/api/rest", this.req);
    if (!r.ok) return { data: null, error: errOf(r.json) };
    const rows = (r.json.data ?? []) as unknown[];
    if (this.req.single === "maybe") return { data: rows[0] ?? null, error: null };
    if (this.req.single === "single")
      return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
    return { data: rows, error: null };
  }
  then<A = Result<unknown>, B = never>(ok?: ((v: Result<unknown>) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, bad);
  }
}

interface LocalUser { id: string; email: string; email_confirmed_at?: string | null; identities?: unknown[] }
interface LocalSession { access_token: string; user: LocalUser }
type Listener = (event: string, session: LocalSession | null) => void;

let cur: LocalSession | null | undefined;
const listeners = new Set<Listener>();
const emit = (ev: string) => listeners.forEach((l) => l(ev, cur ?? null));
const toSession = (u?: LocalUser | null): LocalSession | null => (u?.id ? { access_token: "", user: u } : null);

async function getSession(): Promise<{ data: { session: LocalSession | null } }> {
  if (cur === undefined) {
    try { cur = toSession(((await (await fetch("/api/auth/session")).json()) as { user?: LocalUser | null }).user); } catch { cur = null; }
  }
  return { data: { session: cur ?? null } };
}

export const localClient = {
  from: (table: string) => new Query(table),
  rpc: async (fn: string, args?: unknown): Promise<Result<unknown>> => {
    const r = await post(`/api/rpc/${fn}`, args);
    return r.ok ? { data: r.json.data ?? null, error: null } : { data: null, error: errOf(r.json) };
  },
  auth: {
    getSession,
    onAuthStateChange(cb: Listener) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => void listeners.delete(cb) } } };
    },
    async signInWithPassword(p: { email: string; password: string }) {
      const r = await post("/api/auth/login", p);
      if (!r.ok) return { data: { session: null, user: null }, error: errOf(r.json) };
      cur = toSession(r.json.user as LocalUser);
      emit("SIGNED_IN");
      return { data: { session: cur, user: cur?.user ?? null }, error: null };
    },
    async signUp(p: { email: string; password: string; options?: { emailRedirectTo?: string; data?: { full_name?: string } } }) {
      const r = await post("/api/auth/signup", { email: p.email, password: p.password, full_name: p.options?.data?.full_name, redirect: p.options?.emailRedirectTo });
      if (!r.ok) return { data: { user: null, session: null }, error: errOf(r.json) };
      return { data: { user: r.json.user as LocalUser, session: null }, error: null };
    },
    async signOut() { await post("/api/auth/logout"); cur = null; emit("SIGNED_OUT"); return { error: null }; },
    async resend(p: { email: string; options?: { emailRedirectTo?: string } }) {
      const r = await post("/api/auth/resend", { email: p.email, redirect: p.options?.emailRedirectTo });
      return { error: r.ok ? null : errOf(r.json) };
    },
    async resetPasswordForEmail(email: string, o?: { redirectTo?: string }) {
      const r = await post("/api/auth/reset", { email, redirect: o?.redirectTo });
      return { error: r.ok ? null : errOf(r.json) };
    },
  },
};
