// toasts + a confirm dialog that matches the theme (finally replacing the browser confirm() popup)
import { $ } from '../lib/util.js';

export function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.setProperty('--k', kind === 'ok' ? 'var(--ok)' : kind === 'danger' ? 'var(--danger)' : 'var(--brass)');
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

export function confirmDialog({ title, body, confirm, danger = true }) {
  const dlg = $('#confirmDlg');
  $('#confirmTitle').textContent = title;
  $('#confirmBody').textContent = body;
  const yes = $('#confirmYes');
  yes.textContent = confirm;
  yes.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  return new Promise((resolve) => {
    const done = (value) => {
      dlg.close();
      resolve(value);
    };
    yes.onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    dlg.oncancel = () => resolve(false);
    dlg.showModal();
    $('#confirmNo').focus();
  });
}

// runs an api call and shows the error (toast, or inline if errorEl is given). null if it failed
export async function attempt(fn, { errorEl } = {}) {
  try {
    if (errorEl) errorEl.textContent = '';
    return await fn();
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    else toast(err.message, 'danger');
    return null;
  }
}
