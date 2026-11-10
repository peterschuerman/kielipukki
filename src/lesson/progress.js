// Learner progress, kept in this browser's localStorage.
//
// Understands: forms the learner has responded to correctly by action, on
// the first try, in stage 2 or 3, on two separate days.
// Produces: forms the learner has said in stage 5.
// A module is complete when stage 4 was finished with few mismatches on two
// separate days.

const KEY = 'kielipukki-progress';
export const DAYS_NEEDED = 2;

/** Today as YYYY-MM-DD in local time. Tests can set window.KIELIPUKKI_TODAY. */
export function today() {
  if (globalThis.KIELIPUKKI_TODAY) return globalThis.KIELIPUKKI_TODAY;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class Progress {
  constructor({ storage, initial = {} } = {}) {
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    this.initial = initial;
    this.data = this._load();
    this._applyInitial();
  }

  // Starting values (from the diagnostic) apply only to forms with no record yet.
  _applyInitial() {
    for (const [form, status] of Object.entries(this.initial)) {
      this.data.forms[form] ??= { correctDays: [], produced: [], start: status };
    }
    this._save();
  }

  _load() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        d.forms ??= {};
        d.modules ??= {};
        return d;
      }
    } catch { /* storage blocked or corrupt: start empty */ }
    return { forms: {}, modules: {} };
  }

  _save() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* not saved */ }
  }

  _form(id) {
    return (this.data.forms[id] ??= { correctDays: [], produced: [], start: null });
  }

  /** A first-try correct action in stage 2 or 3. */
  recordCorrect(forms) {
    const day = today();
    for (const f of forms) {
      const r = this._form(f);
      if (!r.correctDays.includes(day)) r.correctDays.push(day);
    }
    this._save();
  }

  /** A sentence said correctly in stage 5. */
  recordProduced(forms) {
    const day = today();
    for (const f of forms) {
      const r = this._form(f);
      if (!r.produced.includes(day)) r.produced.push(day);
    }
    this._save();
  }

  /** Record a finished stage. For stage 4, also whether it counts towards completion. */
  recordStage(moduleId, stage, { tasks = 0, mismatches = 0 } = {}) {
    const m = (this.data.modules[moduleId] ??= { stages: {}, stage4Days: [] });
    const day = today();
    (m.stages[stage] ??= []).includes(day) || m.stages[stage].push(day);
    let counted = false;
    if (stage === 4 && tasks > 0 && mismatches <= Math.floor(tasks * 0.2)) {
      if (!m.stage4Days.includes(day)) m.stage4Days.push(day);
      counted = true;
    }
    this._save();
    return counted;
  }

  understands(form) {
    return (this.data.forms[form]?.correctDays.length || 0) >= DAYS_NEEDED;
  }

  produces(form) {
    return (this.data.forms[form]?.produced.length || 0) > 0;
  }

  /** 'produces' | 'understands' | 'progress' (some correct days) | 'recognized' (from the diagnostic) | 'new' */
  status(form) {
    const r = this.data.forms[form];
    if (!r) return 'new';
    if (r.produced.length) return 'produces';
    if (r.correctDays.length >= DAYS_NEEDED) return 'understands';
    if (r.correctDays.length) return 'progress';
    return r.start || 'new';
  }

  correctDays(form) {
    return this.data.forms[form]?.correctDays.length || 0;
  }

  stageDone(moduleId, stage) {
    return (this.data.modules[moduleId]?.stages[stage]?.length || 0) > 0;
  }

  moduleDays(moduleId) {
    return this.data.modules[moduleId]?.stage4Days.length || 0;
  }

  moduleComplete(moduleId) {
    return this.moduleDays(moduleId) >= DAYS_NEEDED;
  }

  reset() {
    this.data = { forms: {}, modules: {} };
    this._applyInitial();
  }
}
