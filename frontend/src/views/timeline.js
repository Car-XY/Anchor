import { api } from '../api.js';
import { $, addDays, esc, fmt, parse } from '../lib/util.js';
import { setState, state } from '../state.js';
import { toast } from '../ui/feedback.js';

let root;
let scrolled = false;
const isDue = (h, d) => d >= h.start && (!h.end || d <= h.end);

export const timeline = {
  title: () => 'Timeline',
  sub: () => 'Every habit and reflection, day by day.',

  mount(el) {
    root = el;
    scrolled = false;
    root.innerHTML = `
      <div class="panel overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-4 px-4.5 py-3.5">
          <div class="flex flex-wrap gap-4 text-[13px] text-muted">
            <span class="inline-flex items-center gap-1.5"><i class="inline-block size-[11px] rounded-full bg-brass"></i>Held</span>
            <span class="inline-flex items-center gap-1.5"><i class="inline-block size-[11px] rounded-full border-[1.5px] border-brass opacity-60"></i>Missed</span>
            <span class="inline-flex items-center gap-1.5"><i class="inline-block h-[3px] w-[22px] rounded bg-brass opacity-60"></i>Streak</span>
            <span class="inline-flex items-center gap-1.5"><i class="inline-block size-[9px] rotate-45 rounded-[2px] bg-brass"></i>Reflection</span>
          </div>
          <span class="count">Click any past day to correct it.</span>
        </div>
        <div class="overflow-x-auto border-t border-line" data-scroll></div>
      </div>`;
    $('[data-scroll]', root).addEventListener('click', onClick);
  },

  update() {
    const ov = state.overview;
    if (!root || !ov) return;
    const today = ov.today;
    const starts = [...ov.habits.map((h) => h.start), ...ov.reflections.map((r) => r.date), addDays(today, -13)].sort();
    const ends = ov.habits.map((h) => h.end).filter(Boolean).sort();
    let first = starts[0];
    let last = addDays(today, 4);
    if (ends.length && ends.at(-1) > last) last = ends.at(-1);
    if (last > addDays(today, 45)) last = addDays(today, 45);
    if (first < addDays(last, -365)) first = addDays(last, -365);

    const days = [];
    for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
    const todayIdx = days.indexOf(today);

    let o = `<div class="tl" style="--n:${days.length}"><div class="lab" style="background:transparent;border:0"></div>`;
    days.forEach((d, i) => {
      const date = parse(d);
      o += `<div class="mh">${i === 0 || date.getDate() === 1 ? date.toLocaleDateString(undefined, { month: 'short' }) : ''}</div>`;
    });
    o += '<div class="lab" style="color:var(--faint);font-weight:500">Habit</div>';
    days.forEach((d) => {
      const wd = parse(d).getDay();
      o += `<div class="dh${d === today ? ' now' : ''}${wd % 6 === 0 ? ' we' : ''}">${parse(d).getDate()}</div>`;
    });

    for (const h of ov.habits) {
      const done = new Set(h.done);
      o += `<div class="lab" style="--c:${h.color}"><span class="dot"></span><span>${esc(h.title)}</span></div>`;
      days.forEach((d, i) => {
        let cls = `c${d === today ? ' now' : ''}`;
        if (!isDue(h, d)) return (o += `<div class="${cls}"></div>`);
        const held = done.has(d);
        let label = '';
        if (d > today) cls += ' future';
        else {
          cls += ` can ${held ? 'done' : d === today ? 'open' : 'miss'}`;
          const prev = days[i - 1];
          if (held && prev && done.has(prev) && isDue(h, prev)) cls += ' join';
          label = `${h.title}, ${fmt(d)}: ${held ? 'held' : d === today ? 'not yet' : 'missed'}`;
        }
        o += `<div class="${cls}" style="--c:${h.color}" data-h="${h.id}" data-d="${d}"${label ? ` title="${esc(label)}" role="button" tabindex="-1"` : ''}><i></i></div>`;
      });
    }

    const byDate = {};
    ov.reflections.forEach((r) => (byDate[r.date] ||= []).push(r.title));
    o += '<div class="lab"><span class="dot" style="--c:var(--brass);border-radius:2px;transform:rotate(45deg) scale(.85)"></span><span>Reflections</span></div>';
    days.forEach((d) => {
      const r = byDate[d];
      o += `<div class="c${d === today ? ' now' : ''}${r ? ' ref' : ''}"${r ? ` title="${esc(r.join(', '))}"` : ''}>${r ? '<i></i>' : ''}</div>`;
    });
    o += '</div>';

    const sc = $('[data-scroll]', root);
    const keep = sc.scrollLeft;
    sc.innerHTML = o;
    const labelW = innerWidth <= 820 ? 128 : 180;
    sc.scrollLeft = scrolled ? keep : Math.max(0, labelW + todayIdx * 28 - sc.clientWidth * 0.7);
    scrolled = true;
  },
};

async function onClick(e) {
  const cell = e.target.closest('.c.can');
  if (!cell) return;
  const id = Number(cell.dataset.h);
  const day = cell.dataset.d;
  const h = state.overview.habits.find((x) => x.id === id);
  const on = !h.done.includes(day);
  try {
    const ov = await api.setLog(id, day, on);
    setState({ overview: ov, justLogged: on ? `${id}|${day}` : null });
    toast(on ? `Logged "${h.title}" for ${fmt(day)}` : `Cleared "${h.title}" for ${fmt(day)}`, on ? 'ok' : 'info');
  } catch (err) {
    toast(err.message, 'danger');
  }
}
