import { api } from '../api.js';
import { ANIMALS, animalSvg } from '../companion/animals.js';
import { $, esc } from '../lib/util.js';
import { SEA, seaState, setState, state } from '../state.js';
import { attempt, toast } from '../ui/feedback.js';

let root;

export const settings = {
  title: () => 'Settings',
  sub: () => 'Your companion, how Anchor looks, and your account.',

  mount(el) {
    root = el;
    const c = state.user.companion;
    root.innerHTML = `
      <div class="grid max-w-[760px] gap-4">
        <section class="panel px-5 py-5">
          <h2 class="text-[22px]">Companion</h2>
          <p class="mt-1 mb-4 text-sm text-muted">Your companion swims around the screen with tips from your data and runs your debriefs.</p>
          <div class="pick mb-5" role="radiogroup" aria-label="Character">
            ${Object.entries(ANIMALS).map(([key, a]) => `
              <input type="radio" name="animal" id="an-${key}" value="${key}"${key === c.animal ? ' checked' : ''}>
              <label for="an-${key}">${animalSvg(key, 'calm')}<b class="text-sm">${a.label}</b><span class="text-center text-xs text-faint">${a.blurb}</span></label>`).join('')}
          </div>
          <form class="flex flex-wrap items-end gap-3" data-name-form novalidate>
            <div class="field mb-0 min-w-[200px] flex-1"><label for="cName">Name</label><input class="input" id="cName" maxlength="32" value="${esc(c.name)}"></div>
            <button class="btn" type="submit">Rename</button>
          </form>
          <p class="err mt-2" data-name-err role="alert"></p>
          <label class="flex cursor-pointer items-center justify-between gap-4 border-t border-line pt-4">
            <span><b class="block text-[15px]">Let it swim around</b><span class="text-sm text-muted">Off keeps your companion docked in the corner.</span></span>
            <input type="checkbox" class="switch" data-roam${c.roam ? ' checked' : ''}>
          </label>
        </section>

        <section class="panel px-5 py-5">
          <h2 class="text-[22px]">Appearance</h2>
          <div class="field mt-4"><span class="lbl">Theme</span>
            <div class="seg-pick !mt-0 !border-0 !pt-0 sm:!grid-cols-3" role="radiogroup" aria-label="Theme">
              ${[['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}"${state.theme === v ? ' checked' : ''}> ${l}</label>`).join('')}
            </div>
          </div>
          <div class="field mb-0"><span class="lbl">Sea state</span>
            <p class="m-0 mb-2 text-sm text-muted">Normally the sea follows how well your habits held over the last 7 days. You can preview the others here.</p>
            <div class="seg-pick !mt-0 !border-0 !pt-0" role="radiogroup" aria-label="Sea state">
              ${[['auto', 'From my habits'], ...Object.entries(SEA).map(([k, v]) => [k, v.name])].map(([v, l]) => `<label><input type="radio" name="sea" value="${v}"${state.seaPreview === v ? ' checked' : ''}> ${l}</label>`).join('')}
            </div>
          </div>
        </section>

        <section class="panel px-5 py-5">
          <h2 class="text-[22px]">Account</h2>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt class="text-muted">Username</dt><dd class="m-0 font-semibold">${esc(state.user.username)}</dd>
            <dt class="text-muted">Timezone</dt><dd class="m-0" data-tz>${esc(state.user.timezone)}</dd>
          </dl>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="btn" data-sync-tz>Use this device's timezone</button>
            <button class="btn btn-danger" data-logout>Log out</button>
          </div>
        </section>
      </div>`;

    root.addEventListener('change', async (e) => {
      const t = e.target;
      if (t.name === 'animal') return saveCompanion({ animal: t.value }, `${ANIMALS[t.value].label} it is.`);
      if (t.matches('[data-roam]')) return saveCompanion({ roam: t.checked });
      if (t.name === 'theme') return setState({ theme: t.value });
      if (t.name === 'sea') return setState({ seaPreview: t.value });
    });
    $('[data-name-form]', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#cName', root).value.trim();
      const errEl = $('[data-name-err]', root);
      if (!name) return (errEl.textContent = 'Give your companion a name.');
      await saveCompanion({ name }, `Say hi to ${name}.`, errEl);
    });
    $('[data-sync-tz]', root).addEventListener('click', async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await attempt(() => api.updateAccount({ timezone }));
      if (res) {
        setState({ user: res.user, overview: await api.overview() });
        $('[data-tz]', root).textContent = res.user.timezone;
        toast(`Timezone set to ${res.user.timezone}`, 'ok');
      }
    });
    $('[data-logout]', root).addEventListener('click', () => window.dispatchEvent(new CustomEvent('anchor:logout')));
  },

  update() {
    if (!root) return;
    const sea = $(`input[name=sea][value="${state.seaPreview}"]`, root);
    if (sea) sea.checked = true;
    // keep the picker's characters in the current mood
    root.querySelectorAll('.pick label').forEach((label) => {
      const key = label.htmlFor.slice(3);
      label.querySelector('svg').outerHTML = animalSvg(key, seaState());
    });
  },
};

async function saveCompanion(companion, message, errorEl) {
  const res = await attempt(() => api.updateAccount({ companion }), { errorEl });
  if (!res) return;
  setState({ user: res.user });
  if (message) toast(message, 'ok');
}
