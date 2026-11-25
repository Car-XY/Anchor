export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const pct = (rate) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);

// dates are YYYY-MM-DD strings everywhere. new Date('2026-01-01') parses as UTC
// and can land on the wrong day, so these build local dates instead
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const fmt = (s, opts = { day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString(undefined, opts);

export function timeOfDay(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or blocked storage: keep going without it */
    }
  },
};

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// small markdown renderer for companion replies (paragraphs, lists, bold, italic)
// escapes everything first so model output can't inject html
export function renderMarkdown(src) {
  const inline = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  const out = [];
  let list = null;
  for (const raw of String(src).split('\n')) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        if (list) out.push(`</${list.tag}>`);
        list = { tag };
        out.push(`<${tag}>`);
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    if (list) {
      out.push(`</${list.tag}>`);
      list = null;
    }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list.tag}>`);
  return out.join('');
}
