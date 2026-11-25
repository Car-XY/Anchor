import '@fontsource-variable/fraunces';
import '@fontsource-variable/hanken-grotesk';
import './styles/main.css';

import { api } from './api.js';
import { mountBuddy } from './companion/buddy.js';
import { $, $$, pct, prefersReducedMotion, timeOfDay } from './lib/util.js';
import { createOcean } from './ocean/ocean.js';
import { SEA, seaState, setState, state, subscribe } from './state.js';
import { toast } from './ui/feedback.js';
import { renderAuth } from './views/auth.js';
import { debrief } from './views/debrief.js';
import { habits } from './views/habits.js';
import { reflections } from './views/reflections.js';
import { settings } from './views/settings.js';
import { timeline } from './views/timeline.js';
import { today } from './views/today.js';

const VIEWS = { today, habits, reflections, timeline, debrief, settings };

const ICONS = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5l2.4 5.5-2.4 5.5-2.4-5.5z"/>',
  habits: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><circle cx="5" cy="6.5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="5" cy="17.5" r="1.6"/>',
  reflections: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 8.5h6"/>',
  timeline: '<path d="M3.5 17.5c3 0 3.5-6 6.5-6s3.5 6 6.5 6 3-7 4-11"/><circle cx="3.5" cy="17.5" r="1.3"/><circle cx="20.5" cy="6.5" r="1.3"/>',
  debrief: '<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const LABELS = { today: 'Today', habits: 'Habits', reflections: 'Reflections', timeline: 'Timeline', debrief: 'Debrief', settings: 'Settings' };
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------------------------------------------------------------- ocean
let ocean = null;
try {
  ocean = createOcean($('#ocean'), { reducedMotion: prefersReducedMotion() });
} catch (err) {
  console.warn('Ocean shader unavailable, using the simple waves.', err);
}
if (!ocean) {
  $('#ocean').hidden = true;
  $('#seaFallback').hidden = false;
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = () => (state.theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : state.theme);

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.theme;
  ocean?.setPalette(resolvedTheme(), timeOfDay());
}
darkQuery.addEventListener('change', applyTheme);
setInterval(applyTheme, 5 * 60 * 1000); // the sky follows the clock

function applySea({ instant = false } = {}) {
  const sea = seaState();
  document.documentElement.dataset.sea = sea;
  ocean?.setSea(sea, { instant });
}

// ---------------------------------------------------------------- shell
const buddy = mountBuddy();
let current = null;

function renderNav() {
  $('#nav').innerHTML = Object.keys(VIEWS)
    .map(
      (key) => `<a href="#${key}" data-view="${key}" class="flex items-center gap-3 rounded-lg px-2.5 py-2.25 font-medium no-underline max-[820px]:flex-col max-[820px]:gap-0.5 max-[820px]:px-2 max-[820px]:py-1.5 max-[820px]:text-[11px]${key === 'settings' ? ' max-[820px]:hidden' : ''}">${icon(key)}${LABELS[key]}</a>`,
    )
    .join('');
}

function renderTools() {
  const sea = seaState();
  const s = state.overview?.summary;
  const why =
    s?.hold_rate_7 == null
      ? 'Once you have a few days logged, the sea follows how well your habits held over the last 7 days.'
      : `You held ${pct(s.hold_rate_7)} of due habits over the last 7 days. 75% or more keeps the harbour calm; under 45% brings a storm.`;
  const preview = state.seaPreview !== 'auto' ? ' You’re previewing a sea state, so your own isn’t shown right now.' : '';
  const open = $('#seaCtl')?.open;
  $('#tools').innerHTML = `
    <details class="relative" id="seaCtl"${open ? ' open' : ''}>
      <summary class="chip" aria-label="Sea state: ${SEA[sea].name}"><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 7c2-3 4-3 5.3 0S10 10 12 7s3.5-3 5 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${SEA[sea].name}</summary>
      <div class="popover">
        <h3 class="mb-1 text-[22px]">${SEA[sea].name}</h3>
        <p>${SEA[sea].line}</p>
        <p>${why}${preview}</p>
        <div class="seg-pick" role="radiogroup" aria-label="Show sea state">
          ${[['auto', 'From my habits'], ...Object.entries(SEA).map(([k, v]) => [k, v.name])]
            .map(([v, l]) => `<label><input type="radio" name="seaPick" value="${v}"${state.seaPreview === v ? ' checked' : ''}> ${l}</label>`)
            .join('')}
        </div>
      </div>
    </details>
    <a class="icon-btn min-[821px]:hidden" href="#settings" aria-label="Settings">${icon('settings', 19)}</a>`;
}

document.addEventListener('change', (e) => {
  if (e.target.name === 'seaPick') setState({ seaPreview: e.target.value });
});
document.addEventListener('click', (e) => {
  const ctl = $('#seaCtl');
  if (ctl?.open && !ctl.contains(e.target)) ctl.open = false;
});
document.addEventListener('keydown', (e) => {
  const ctl = $('#seaCtl');
  if (e.key === 'Escape' && ctl?.open) {
    ctl.open = false;
    ctl.querySelector('summary').focus();
  }
});

function route() {
  if (!state.user) return;
  const key = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'today';
  const view = VIEWS[key];
  $$('#nav a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (current !== view) {
    current = view;
    const section = document.createElement('section');
    section.className = 'view';
    $('#view').replaceChildren(section);
    view.mount(section);
    scrollTo({ top: 0 });
  }
  $('#viewTitle').textContent = view.title();
  $('#viewSub').textContent = view.sub();
  document.title = key === 'today' ? 'Anchor' : `${LABELS[key]} · Anchor`;
  buddy.show(key !== 'debrief');
  view.update();
}
addEventListener('hashchange', route);

subscribe((s, patch) => {
  if ('theme' in patch) applyTheme();
  if ('overview' in patch || 'seaPreview' in patch) {
    applySea();
    if (s.user) renderTools();
  }
  if (s.user && current) {
    current.update();
    $('#viewTitle').textContent = current.title();
    $('#viewSub').textContent = current.sub();
  }
});

// ---------------------------------------------------------------- session
async function enterApp(user, { welcome } = {}) {
  setState({ user });
  $('#auth').hidden = true;
  $('#app').hidden = false;
  renderNav();
  try {
    const [overview, companion] = await Promise.all([api.overview(), api.companion()]);
    setState({ overview, companion });
  } catch (err) {
    toast(err.message, 'danger');
  }
  applySea({ instant: true });
  renderTools();
  current = null;
  route();
  buddy.start();
  if (welcome) toast(welcome, 'ok');
}

function showAuth() {
  buddy.stop();
  current = null;
  setState({ user: null, overview: null });
  $('#app').hidden = true;
  $('#auth').hidden = false;
  applySea({ instant: true });
  renderAuth($('#auth'), {
    onSignedIn: (user, mode) =>
      enterApp(user, { welcome: mode === 'register' ? `Welcome aboard, ${user.username}` : null }),
  });
}

window.addEventListener('anchor:signed-out', () => state.user && showAuth());
window.addEventListener('anchor:logout', async () => {
  try {
    await api.logout();
  } catch {
    /* already logged out */
  }
  showAuth();
  toast('Logged out');
});

// Refresh when the window comes back after a while (e.g. the next morning).
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) return void (hiddenAt = Date.now());
  if (state.user && Date.now() - hiddenAt > 10 * 60 * 1000) {
    try {
      setState({ overview: await api.overview() });
    } catch {
      /* handled by the 401 listener */
    }
  }
  applyTheme();
});

applyTheme();
(async () => {
  try {
    const { user } = await api.session();
    if (user) await enterApp(user);
    else showAuth();
  } catch (err) {
    showAuth();
    toast(err.message, 'danger');
  }
})();
