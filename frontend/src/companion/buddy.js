// floating companion. swims around the bottom part of the screen, stops when
// you hover it, and shows tips from /api/companion/nudge
import { api } from '../api.js';
import { esc, prefersReducedMotion } from '../lib/util.js';
import { seaState, state, subscribe } from '../state.js';
import { animalSvg } from './animals.js';

const SPEED = 42; // px per second at calm sea
const NUDGE_EVERY = 6 * 60 * 1000;

export function mountBuddy() {
  const el = document.createElement('div');
  el.className = 'buddy';
  el.innerHTML = `
    <div class="bubble" role="status" hidden>
      <div class="who"></div><div class="say"></div>
      <div class="bubble-acts">
        <a class="btn btn-primary" href="#debrief">Debrief</a>
        <button type="button" class="btn" data-hush>Hide</button>
      </div>
    </div>
    <button type="button" class="buddy-body"><div class="buddy-flip"><div class="buddy-bob"></div></div></button>`;
  document.body.append(el);

  const bubble = el.querySelector('.bubble');
  const bob = el.querySelector('.buddy-bob');
  const btn = el.querySelector('.buddy-body');
  btn.style.position = 'relative';
  let x = 0, y = 0, timer = 0, hideTimer = 0, nudgeTimer = 0, paused = false, lastTip = '', lastAnimal = '', lastMood = '';
  let visible = false;

  const roaming = () => state.user?.companion.roam && !prefersReducedMotion();

  function bounds() {
    const w = el.offsetWidth || 92;
    const h = el.offsetHeight || 70;
    const mobile = innerWidth <= 820;
    const left = mobile ? 12 : 236; // stay clear of the side rail
    const right = innerWidth - w - 16;
    const bottom = innerHeight - h - (mobile ? 92 : 22);
    const top = Math.max(innerHeight * (mobile ? 0.5 : 0.42), 120);
    return { left, right: Math.max(left, right), top: Math.min(top, bottom), bottom };
  }

  function place(nx, ny, seconds) {
    el.style.transitionDuration = `${seconds}s`;
    el.classList.toggle('left', nx < x - 1 || (Math.abs(nx - x) <= 1 && el.classList.contains('left')));
    x = nx;
    y = ny;
    // open the bubble towards the middle so it doesn't go off screen
    el.classList.toggle('bubble-right', x < innerWidth / 2);
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function dock() {
    clearTimeout(timer);
    el.classList.add('docked');
    const b = bounds();
    el.classList.add('left');
    place(b.right, b.bottom, 0);
  }

  function swim() {
    clearTimeout(timer);
    if (!visible || paused) return;
    if (!roaming()) return dock();
    el.classList.remove('docked');
    const b = bounds();
    const nx = b.left + Math.random() * (b.right - b.left);
    const ny = b.top + Math.random() * (b.bottom - b.top);
    const swimFactor = { calm: 1, open: 1.4, storm: 2 }[seaState()];
    const secs = Math.max(2.5, Math.hypot(nx - x, ny - y) / (SPEED * swimFactor));
    place(nx, ny, secs);
    timer = setTimeout(swim, (secs + 2 + Math.random() * 5) * 1000);
  }

  function freeze() {
    // read the position out of the transform so it stops right where it is
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    clearTimeout(timer);
    el.style.transitionDuration = '0s';
    x = m.m41;
    y = m.m42;
    el.classList.toggle('bubble-right', x < innerWidth / 2);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function pause() {
    if (paused) return;
    paused = true;
    if (roaming()) freeze();
  }
  function resume() {
    if (!paused || !bubble.hidden) return;
    paused = false;
    timer = setTimeout(swim, 1200);
  }

  function say(text, { sticky = false } = {}) {
    if (!text) return;
    el.querySelector('.who').textContent = state.user.companion.name;
    el.querySelector('.say').innerHTML = esc(text);
    bubble.hidden = false;
    pause();
    clearTimeout(hideTimer);
    if (!sticky) hideTimer = setTimeout(hush, 11000);
  }
  function hush() {
    bubble.hidden = true;
    paused = true; // let resume() restart the swim
    resume();
  }

  async function fetchNudge({ show = true } = {}) {
    if (!state.user) return;
    try {
      const { text } = await api.nudge();
      if (show && text && text !== lastTip && !document.hidden && visible) {
        // on phones the bubble covers too much, show a dot instead
        if (innerWidth <= 820) el.classList.add('has-tip');
        else say(text);
      }
      lastTip = text;
    } catch {
      /* tips are optional */
    }
  }

  function draw() {
    const animal = state.user?.companion.animal ?? 'seal';
    const mood = seaState();
    if (animal === lastAnimal && mood === lastMood) return;
    lastAnimal = animal;
    lastMood = mood;
    bob.innerHTML = animalSvg(animal, mood);
    btn.setAttribute('aria-label', `${state.user?.companion.name ?? 'Companion'}: show a tip`);
  }

  function setVisible(on) {
    visible = on;
    el.hidden = !on;
    if (on) swim();
    else clearTimeout(timer);
  }

  btn.addEventListener('click', () => {
    el.classList.remove('has-tip');
    if (!bubble.hidden) return hush();
    if (lastTip) say(lastTip, { sticky: true });
    else fetchNudge();
  });
  el.addEventListener('mouseenter', pause);
  el.addEventListener('mouseleave', () => bubble.hidden && resume());
  el.querySelector('[data-hush]').addEventListener('click', hush);
  el.querySelector('a[href="#debrief"]').addEventListener('click', hush);
  addEventListener('resize', () => (roaming() ? swim() : dock()));

  let debounce = 0;
  subscribe((s, patch) => {
    if (!s.user) return setVisible(false);
    draw();
    if ('overview' in patch && patch.overview) {
      clearTimeout(debounce);
      debounce = setTimeout(() => fetchNudge(), s.overview.summary.all_done ? 300 : 2500);
    }
    if ('user' in patch) (roaming() ? swim() : dock());
  });

  return {
    start() {
      draw();
      const b = bounds();
      x = b.right;
      y = b.bottom;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.classList.add('left');
      el.classList.remove('bubble-right');
      setVisible(true);
      setTimeout(() => fetchNudge(), 3500);
      clearInterval(nudgeTimer);
      nudgeTimer = setInterval(() => fetchNudge(), NUDGE_EVERY);
    },
    stop() {
      setVisible(false);
      clearInterval(nudgeTimer);
      lastTip = '';
    },
    show: setVisible,
  };
}
