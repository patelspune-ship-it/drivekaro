// Tiny document store for the booking desk, backed by one Supabase table.
// Mirrors the shape the desk code uses: collection(name).onSnapshot(),
// doc("collection/id").get() / .set() / .delete() / .onSnapshot().
//
// Table: public.desk_docs (collection text, id text, data jsonb, updated_at timestamptz)
// Access is limited to emails in public.owners by row-level security (see supabase/desk_setup.sql).

const TABLE = 'desk_docs';

function mapError(error) {
  const msg = error?.message || 'Unknown error';
  const denied = error?.code === '42501' || /row-level security|permission denied/i.test(msg);
  return { code: denied ? 'invalid_argument' : 'unavailable', message: msg };
}

function snapshotOf(rows) {
  const docs = rows.map(r => ({ id: r.id, exists: true, data: () => r.data }));
  return { docs, size: docs.length, empty: docs.length === 0 };
}

export function createStore(sb) {
  // collection name -> { listeners:Set, rows:Array, loading:Promise|null }
  const cols = new Map();
  let channel = null;

  function col(name) {
    if (!cols.has(name)) cols.set(name, { listeners: new Set(), rows: [], loading: null, timer: null });
    return cols.get(name);
  }

  async function load(name) {
    const c = col(name);
    if (c.loading) return c.loading;
    c.loading = (async () => {
      const { data, error } = await sb.from(TABLE).select('id, data').eq('collection', name);
      c.loading = null;
      if (error) { c.listeners.forEach(l => l.err && l.err(mapError(error))); return; }
      c.rows = data || [];
      c.listeners.forEach(l => l.next());
    })();
    return c.loading;
  }

  // Debounced reload after a change notification.
  function refresh(name) {
    const c = col(name);
    clearTimeout(c.timer);
    c.timer = setTimeout(() => load(name), 150);
  }

  function ensureRealtime() {
    if (channel) return;
    channel = sb.channel('desk_docs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, payload => {
        const name = payload.new?.collection || payload.old?.collection;
        if (name && cols.has(name)) refresh(name);
        else cols.forEach((_, n) => refresh(n)); // deletes may not carry the collection
      })
      .subscribe();
    // Fallback when realtime is off or the phone was asleep.
    const reloadAll = () => cols.forEach((c, n) => { if (c.listeners.size) refresh(n); });
    window.addEventListener('focus', reloadAll);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadAll(); });
    setInterval(reloadAll, 60000);
  }

  function subscribe(name, listener) {
    const c = col(name);
    c.listeners.add(listener);
    ensureRealtime();
    if (c.rows.length) listener.next(); else load(name);
    return () => c.listeners.delete(listener);
  }

  function collection(name) {
    return {
      onSnapshot(next, err) {
        return subscribe(name, { next: () => next(snapshotOf(col(name).rows)), err });
      },
    };
  }

  function doc(path) {
    const [name, id] = path.split('/');
    return {
      id,
      async get() {
        const { data, error } = await sb.from(TABLE).select('data').eq('collection', name).eq('id', id).maybeSingle();
        if (error) throw mapError(error);
        return { id, exists: !!data, data: () => data?.data };
      },
      async set(obj) {
        const { error } = await sb.from(TABLE).upsert({ collection: name, id, data: obj, updated_at: new Date().toISOString() });
        if (error) throw mapError(error);
        refresh(name);
      },
      async delete() {
        const { error } = await sb.from(TABLE).delete().eq('collection', name).eq('id', id);
        if (error) throw mapError(error);
        refresh(name);
      },
      onSnapshot(next, err) {
        return subscribe(name, {
          next: () => {
            const row = col(name).rows.find(r => r.id === id);
            next({ id, exists: !!row, data: () => row?.data });
          },
          err,
        });
      },
    };
  }

  // Atomic, gap-free invoice numbers per financial year (see desk_next_invoice in the SQL).
  async function nextInvoiceSeq(fy) {
    const { data, error } = await sb.rpc('desk_next_invoice', { p_fy: fy });
    if (error) throw mapError(error);
    return Number(data);
  }

  return { collection, doc, nextInvoiceSeq };
}
