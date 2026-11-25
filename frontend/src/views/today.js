import { api } from '../api.js';
import { renderCompass, ripple } from '../components/compass.js';
import { $, $$, esc, fmt, greeting, pct, plural } from '../lib/util.js';
import { SEA, seaState, setState, state } from '../state.js';
import { openHabitDialog } from './habits.js';
import { toast } from '../ui/feedback.js';

const CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let root;
let prevAllDone = null;
let introPlayed = false;
let busy = new Set();

export const today = {
  title: () => greeting(state.user?.username),
  sub: () => (state.overview ? fmt(state.overview.today, { weekday: 'long', day: 'numeric', month: 'long' }) : ''),

  mount(el) {
    root = el;
    prevAllDone = null;
    root.innerHTML = `
      <div class="grid items-start gap-[clamp(20px,3vw,40px)] min-[1101px]:grid-cols-[minmax(300px,540px)_minmax(0,1fr)]">
        <div class="min-[1101px]:sticky min-[1101px]:top-6">
          <div class="porthole mx-auto max-w-[540px] max-[1100px]:max-w-[460px] max-[820px]:max-w-[330px]">
            <svg class="compass${introPlayed ? '' : ' intro'}" viewBox="-24 -24 648 648" role="img"></svg>
          </div>
          <div class="panel mx-auto mt-2 max-w-[440px] px-4 py-3 text-center">
            <div class="font-serif text-xl" data-state></div>
            <p class="mt-0.5 text-sm text-muted" data-line></p>
            <p class="mt-2 text-[12.5px] text-faint max-[820px]:hidden">Each ring is a habit and each segment a day. The last 14 days run clockwise up to today, at the top. Tap today’s segment to log it.</p>
          </div>
        </div>
        <div class="grid gap-4">
          <div class="panel watch overflow-hidden">
            <div class="flex items-baseline justify-between gap-3 px-4.5 pt-4 pb-3">
              <h2 class="text-[22px]">Today’s habits</h2><span class="count" data-count></span>
            </div>
            <ul class="m-0 list-none p-0" data-list></ul>
            <div class="readouts" data-readouts></div>
          </div>
          <div class="panel px-4.5 py-4" data-latest></div>
        </div>
      </div>`;
    if (!introPlayed) setTimeout(() => $('.compass', root)?.classList.remove('intro'), 2300);
    introPlayed = true;

    root.addEventListener('click', onClick);
    const svg = $('.compass', root);
    const list = $('[data-list]', root);
    svg.addEventListener('mouseover', (e) => highlight(e.target.closest('.ring')?.dataset.h));
    svg.addEventListener('mouseleave', () => highlight(null));
    list.addEventListener('mouseover', (e) => highlight(e.target.closest('.row')?.dataset.h));
    list.addEventListener('mouseleave', () => highlight(null));
  },

  update() {
    const ov = state.overview;
    if (!root || !ov) return;
    const s = ov.summary;
    const sea = seaState();
    renderCompass($('.compass', root), ov, { justLogged: state.justLogged });

    $('[data-state]', root).textContent = SEA[sea].name;
    $('[data-line]', root).textContent =
      s.hold_rate_7 == null ? SEA[sea].line : `${pct(s.hold_rate_7)} held over the last 7 days. ${SEA[sea].line}`;
    $('[data-count]', root).textContent = s.due_today ? `${s.done_today} of ${s.due_today} held` : '';

    const due = ov.habits.filter((h) => h.due_today);
    $('[data-list]', root).innerHTML = due.length
      ? due.map(row).join('')
      : `<li class="empty border-t border-line"><p>${ov.habits.length ? 'No habits are due today.' : 'Add your first habit. It’ll show up as a ring on your compass.'}</p><button class="btn btn-primary" data-new>Add a habit</button></li>`;

    $('[data-readouts]', root).innerHTML = `
      <div class="readout"><b>${pct(s.hold_rate_7)}</b><span>Held this week</span></div>
      <div class="readout"><b>${s.best ? s.best.days : 0}</b><span>Longest current streak</span><em>${s.best ? esc(s.best.title) : 'No streak yet'}</em></div>
      <div class="readout"><b>${s.reflections_30}</b><span>Reflections, last 30 days</span></div>
      <div class="readout"><b>${s.days_aboard}</b><span>Days since you set sail</span></div>`;

    const latest = ov.reflections[0];
    $('[data-latest]', root).innerHTML = latest
      ? `<div class="mb-1.5 flex items-baseline justify-between gap-3"><h2 class="text-lg">${esc(latest.title)}</h2><a class="text-sm font-semibold text-brass underline-offset-3" href="#reflections">All reflections</a></div>
         <time class="text-[13px] text-faint">${fmt(latest.date, { weekday: 'long', day: 'numeric', month: 'long' })}</time>
         <p class="m-0 line-clamp-3 text-muted">${esc(latest.content)}</p>`
      : `<div class="mb-1.5 flex items-baseline justify-between gap-3"><h2 class="text-lg">No reflections yet</h2><a class="text-sm font-semibold text-brass" href="#reflections">Write one</a></div>
         <p class="m-0 text-muted">A few lines each week about what held and what slipped is plenty.</p>`;

    if (prevAllDone === false && s.all_done) {
      ripple($('.compass', root));
      toast('Every habit held today. Anchor’s set.', 'ok');
    }
    prevAllDone = s.all_done;
  },
};

function row(h) {
  const n = h.streak;
  return `<li class="row${h.done_today ? ' done' : ''}" data-h="${h.id}" style="--c:${h.color}">
    <button class="check" data-toggle="${h.id}" aria-pressed="${h.done_today}" aria-label="${esc(h.title)}: ${h.done_today ? 'held today, select to undo' : 'mark as held today'}">${CHECK}</button>
    <div class="min-w-0"><div class="title font-semibold">${esc(h.title)}</div>${h.notes ? `<div class="truncate text-[13px] text-faint">${esc(h.notes)}</div>` : ''}</div>
    <div class="text-right text-sm font-semibold whitespace-nowrap tabular-nums">${n ? plural(n, 'day') : '–'}<small class="block text-xs font-normal text-faint">${h.done_today ? 'Held today' : n ? 'Keep it going' : 'Start a streak'}</small></div>
  </li>`;
}

function highlight(id) {
  $$('.compass .ring', root).forEach((r) => r.classList.toggle('dim', !!id && r.dataset.h !== id));
  $$('.row', root).forEach((r) => r.classList.toggle('hi', r.dataset.h === id));
}

async function onClick(e) {
  if (e.target.closest('[data-new]')) return openHabitDialog();
  const target = e.target.closest('[data-toggle], .seg.today');
  if (!target) return;
  const id = Number(target.dataset.toggle || target.dataset.h);
  await toggleToday(id);
  $(`[data-toggle="${id}"]`, root)?.focus();
}

export async function toggleToday(id) {
  if (busy.has(id)) return;
  const ov = state.overview;
  const habit = ov.habits.find((h) => h.id === id);
  if (!habit) return;
  busy.add(id);
  const on = !habit.done_today;
  try {
    const next = await api.setLog(id, ov.today, on);
    setState({ overview: next, justLogged: on ? `${id}|${ov.today}` : null });
  } catch (err) {
    toast(err.message, 'danger');
  } finally {
    busy.delete(id);
  }
}
