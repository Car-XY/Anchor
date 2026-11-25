// The habit compass: one ring per habit, one segment per day for the last
// 14 days, running clockwise up to today at the top.
import { addDays, esc, fmt, parse } from '../lib/util.js';

const N = 14;
const SEG = 360 / N;
const CX = 300;
const CY = 300;
export const MAX_RINGS = 8;

const pt = (r, a) => {
  const t = (a * Math.PI) / 180;
  return [CX + r * Math.sin(t), CY - r * Math.cos(t)];
};
const arc = (r, a0, a1) => {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const rose = () => {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const [x, y] = pt(i % 2 ? 26 : i % 4 ? 70 : 96, i * 22.5);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
};
const ROSE = rose();

const isDue = (h, day) => day >= h.start && (!h.end || day <= h.end);

export function renderCompass(svg, ov, { justLogged = null } = {}) {
  const today = ov.today;
  const days = Array.from({ length: N }, (_, k) => addDays(today, -k));
  const shown = ov.habits.filter((h) => days.some((d) => isDue(h, d))).slice(0, MAX_RINGS);
  const s = ov.summary;

  let o = `<title>Habit compass: ${s.done_today} of ${s.due_today} habits held today</title>`;
  o += `<path class="rose" d="${ROSE}"/><circle class="bezel" cx="300" cy="300" r="266"/>`;
  for (let j = 0; j < N; j++) {
    const a = (j + 0.5) * SEG;
    const [x0, y0] = pt(258, a);
    const [x1, y1] = pt(268, a);
    o += `<line class="tick" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
  }
  days.forEach((d, k) => {
    const [x, y] = pt(284, -k * SEG);
    const label = k === 0 ? parse(d).getDate() : 'SMTWTFS'[parse(d).getDay()];
    o += `<text class="day-lbl${k === 0 ? ' today' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${label}</text>`;
  });
  o += '<path class="north" d="M300 0l-7-12h14z"/>';

  const outer = 246;
  const inner = 106;
  const step = shown.length ? (outer - inner) / shown.length : 0;
  const w = Math.min(20, step * 0.66);
  shown.forEach((h, i) => {
    const r = outer - w / 2 - i * step;
    const done = new Set(h.done);
    let segs = '';
    days.forEach((d, k) => {
      if (!isDue(h, d)) return;
      const held = done.has(d);
      const a = -k * SEG;
      let cls = k === 0 ? (held ? 'done today' : 'open today') : held ? 'done' : 'miss';
      if (held && justLogged === `${h.id}|${d}`) cls += ' just';
      const when = k === 0 ? 'today' : fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
      const status = held ? 'held' : k === 0 ? 'not yet' : 'missed';
      segs += `<path class="seg ${cls}" d="${arc(r, a - SEG / 2 + 1.7, a + SEG / 2 - 1.7)}" stroke-width="${w.toFixed(1)}" data-h="${h.id}"><title>${esc(h.title)}, ${when}: ${status}</title></path>`;
    });
    o += `<g class="ring" data-h="${h.id}" style="--c:${h.color};--i:${i}"><circle class="track" cx="300" cy="300" r="${r.toFixed(1)}" stroke-width="${w.toFixed(1)}"/>${segs}</g>`;
  });

  o += `<g class="anchor"><circle cx="300" cy="238" r="12"/><line x1="300" y1="250" x2="300" y2="362"/><line x1="272" y1="270" x2="328" y2="270"/><path d="M250 320C252 348 274 364 300 364S348 348 350 320"/><path d="M240 332l10-14 12 8M360 332l-10-14-12 8"/></g>`;
  o += '<circle class="ripple" cx="300" cy="300" r="42"/>';
  svg.innerHTML = o;
}

export function ripple(svg) {
  const el = svg.querySelector('.ripple');
  if (!el) return;
  el.classList.remove('go');
  void el.getBoundingClientRect();
  el.classList.add('go');
}
