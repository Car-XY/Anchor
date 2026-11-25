// app state + a basic subscribe so views can re-render when it changes
import { store } from './lib/util.js';

const listeners = new Set();

export const state = {
  user: null,
  overview: null, // server-computed habits, streaks, reflections and sea state
  companion: { configured: false },
  seaPreview: store.get('anchor.seaPreview', 'auto'), // 'auto' | 'calm' | 'open' | 'storm'
  theme: store.get('anchor.theme', 'system'), // 'system' | 'light' | 'dark'
  justLogged: null, // "habitId|date" of the last tick, for the fill-in animation
};

export function setState(patch) {
  Object.assign(state, patch);
  if ('seaPreview' in patch) store.set('anchor.seaPreview', state.seaPreview);
  if ('theme' in patch) store.set('anchor.theme', state.theme);
  listeners.forEach((fn) => fn(state, patch));
}

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export const seaState = () =>
  state.seaPreview !== 'auto' ? state.seaPreview : state.overview?.summary.sea_state ?? 'calm';

export const SEA = {
  calm: { name: 'Calm harbour', line: 'Steady hands. Keep the rhythm going.' },
  open: { name: 'Open water', line: 'A few habits are drifting. Pick one to bring back today.' },
  storm: { name: 'Storm', line: 'A rough week. Start with your smallest habit and build from there.' },
};

export const PALETTE = ['#F08A6C', '#F2C46D', '#5EC8E5', '#9C8CF0', '#6FD3A8', '#F28DB2', '#7FB3FF', '#D6E36B'];
