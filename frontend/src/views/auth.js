import { api } from '../api.js';
import { $ } from '../lib/util.js';

const MARK = `<svg class="auth-mark mb-3.5 size-[54px] text-brass" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="transform-origin:12px 3px;animation:sway 3s ease-in-out infinite alternate"><circle cx="12" cy="4.5" r="2"/><path d="M12 6.5V21M8 10h8M4.5 14.5c.5 3.8 3.6 6.5 7.5 6.5s7-2.7 7.5-6.5"/></g></svg>`;

const LINKS = [
  ['GitHub', 'https://github.com/Car-XY'],
  ['LinkedIn', 'https://www.linkedin.com/in/cary-li-4815642b1/'],
  ['Instagram', 'https://www.instagram.com/hugh_jass6090/'],
];

export function renderAuth(root, { onSignedIn }) {
  let mode = 'login';
  root.innerHTML = `
    <div class="w-full max-w-[400px]">
      <form class="panel px-7.5 pt-8.5 pb-6.5 shadow-[0_30px_60px_-30px_var(--shadow)]" novalidate>
        ${MARK}
        <h1 class="text-[40px] leading-none tracking-[-0.01em]" data-title></h1>
        <p class="mt-2 mb-6 text-muted" data-lede></p>
        <div class="field"><label for="u">Username</label><input class="input" type="text" id="u" autocomplete="username" required></div>
        <div class="field"><label for="p">Password</label><input class="input" type="password" id="p" required></div>
        <div class="field" data-confirm hidden><label for="p2">Confirm password</label><input class="input" type="password" id="p2" autocomplete="new-password"></div>
        <p class="err" role="alert"></p>
        <button class="btn btn-primary w-full py-3" type="submit" data-submit></button>
        <p class="mt-4.5 text-center text-sm text-muted"><span data-switch-text></span> <button type="button" class="linkish" data-switch></button></p>
      </form>
      <p class="mt-5 flex justify-center gap-4 text-sm text-faint">
        ${LINKS.map(([label, href]) => `<a class="hover:text-ink" href="${href}" target="_blank" rel="noopener">${label}</a>`).join('')}
      </p>
    </div>`;

  const form = root.querySelector('form');
  const err = form.querySelector('.err');

  function setMode(m) {
    mode = m;
    const reg = m === 'register';
    form.querySelector('[data-title]').textContent = reg ? 'Set sail' : 'Welcome back';
    form.querySelector('[data-lede]').textContent = reg
      ? 'Create an account to start tracking your habits.'
      : 'Log in to see how your habits are holding.';
    form.querySelector('[data-confirm]').hidden = !reg;
    form.querySelector('[data-submit]').textContent = reg ? 'Create account' : 'Log in';
    $('#p', form).autocomplete = reg ? 'new-password' : 'current-password';
    form.querySelector('[data-switch-text]').textContent = reg ? 'Already have an account?' : 'Don’t have an account?';
    form.querySelector('[data-switch]').textContent = reg ? 'Log in' : 'Register';
    err.textContent = '';
  }

  form.querySelector('[data-switch]').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = $('#u', form).value.trim();
    const p = $('#p', form).value;
    const p2 = $('#p2', form).value;
    if (!u) return ((err.textContent = 'Enter your username.'), $('#u', form).focus());
    if (!p) return ((err.textContent = 'Enter your password.'), $('#p', form).focus());
    if (mode === 'register' && p !== p2) return ((err.textContent = 'The passwords don’t match.'), $('#p2', form).focus());
    const submit = form.querySelector('[data-submit]');
    submit.disabled = true;
    try {
      const res = mode === 'register' ? await api.register(u, p, p2) : await api.login(u, p);
      $('#p', form).value = '';
      $('#p2', form).value = '';
      onSignedIn(res.user, mode);
    } catch (ex) {
      err.textContent = ex.message;
      if (ex.field) $(`#${{ username: 'u', password: 'p', confirmation: 'p2' }[ex.field]}`, form)?.focus();
    } finally {
      submit.disabled = false;
    }
  });

  setMode('login');
  $('#u', form).focus();
}
