// Compact act summaries only. Retry timers run only while an upload is pending.
const PREFIX = 'jellyrun.log:';
const MAX_PENDING = 32, MAX_AGE = 7 * 86400000, MAX_BYTES = 48000;
export const finalOutcome = outcome => ['died', 'won', 'ended', 'next-act'].includes(outcome);

export class RunLog {
  constructor(id) {
    this.id = id;
    this.pending = new Map();
    this.retry = null;
    this.busy = false;
    this.delay = 5000;
    try {
      for (const key of Object.keys(localStorage).filter(k => k.startsWith(PREFIX + id + ':'))) {
        try { this.pending.set(key, JSON.parse(localStorage.getItem(key))); } catch { localStorage.removeItem(key); }
      }
    } catch {} // Storage can be unavailable; keep the queue in memory instead.
    this.trim();
  }

  remove(key) {
    this.pending.delete(key);
    try { localStorage.removeItem(key); } catch {}
  }

  trim() {
    const rows = [...this.pending].sort((a, b) => a[1]?.revision - b[1]?.revision);
    for (const [key, row] of rows) if (!row || !Number.isSafeInteger(row.revision) || row.revision < Date.now() - MAX_AGE) this.remove(key);
    // shortcut: retain at most 32 pending acts for seven days; longer offline histories are dropped.
    while (this.pending.size > MAX_PENDING) this.remove([...this.pending].sort((a, b) => a[1].revision - b[1].revision)[0][0]);
  }

  save(row) {
    const key = `${PREFIX}${this.id}:${row.run}:${row.act}`;
    let old = this.pending.get(key);
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (stored && (!old || finalOutcome(stored.outcome) && !finalOutcome(old.outcome)
        || finalOutcome(stored.outcome) === finalOutcome(old.outcome) && stored.revision > old.revision)) old = stored;
    } catch {}
    if (old && (finalOutcome(old.outcome) && !finalOutcome(row.outcome)
      || finalOutcome(old.outcome) === finalOutcome(row.outcome) && old.revision >= row.revision)) {
      this.pending.set(key, old);
      void this.flush();
      return;
    }
    if (new TextEncoder().encode(JSON.stringify(row)).length > 12000) return;
    this.pending.set(key, row);
    try { localStorage.setItem(key, JSON.stringify(row)); } catch {}
    this.trim();
    void this.flush();
  }

  async flush() {
    if (this.busy || this.retry || !this.pending.size) return;
    this.trim();
    const entries = [];
    for (const entry of this.pending) {
      const rows = [...entries.map(([, row]) => row), entry[1]];
      if (rows.length > 8 || new TextEncoder().encode(JSON.stringify({ id: this.id, rows })).length > MAX_BYTES) break;
      entries.push(entry);
    }
    if (!entries.length) return;
    this.busy = true;
    try {
      const response = await fetch('api/runs', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: this.id, rows: entries.map(([, row]) => row) }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || !data.saved) throw new Error('Run log unavailable');
      for (const [key, row] of entries) {
        if (this.pending.get(key) === row) this.pending.delete(key);
        // Another checkpoint or tab may have saved a newer revision while this request was in flight.
        try { if (localStorage.getItem(key) === JSON.stringify(row)) localStorage.removeItem(key); } catch {}
      }
      this.delay = 5000;
    } catch {
      this.delay = Math.min(this.delay * 2, 300000);
    } finally {
      this.busy = false;
      if (this.pending.size) this.retry = setTimeout(() => { this.retry = null; void this.flush(); }, this.delay + Math.random() * 1000);
    }
  }
}
