import { api } from '../api.js';
import { $, esc, fmt, pct, plural } from '../lib/util.js';
import { PALETTE, setState, state } from '../state.js';
import { attempt, confirmDialog, toast } from '../ui/feedback.js';

let root;

export const habits = {
  title: () => 'Habits',
  sub: () => "Add, edit and retire the habits you're tracking.",

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="panel overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-4.5 py-3.5">
          <span class="count text-[15px]" data-count></span>
          <button class="btn btn-primary" data-new><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>New habit</button>
        </div>
        <div class="overflow-x-auto" data-table></div>
      </div>`;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-new]')) return openHabitDialog();
      const edit = e.target.closest('[data-edit]');
      if (edit) return openHabitDialog(Number(edit.dataset.edit));
      const del = e.target.closest('[data-del]');
      if (del) return deleteHabit(Number(del.dataset.del));
    });
  },

  update() {
    const ov = state.overview;
    if (!root || !ov) return;
    $('[data-count]', root).textContent = plural(ov.habits.length, 'habit');
    if (!ov.habits.length) {
      $('[data-table]', root).innerHTML = `<div class="empty border-t border-line"><p>Add your first habit. It'll show up as a ring on your compass.</p><button class="btn btn-primary" data-new>Add a habit</button></div>`;
      return;
    }
    $('[data-table]', root).innerHTML = `
      <table class="tbl">
        <thead><tr><th>Habit</th><th class="max-sm:hidden">Dates</th><th class="num">Last 30 days</th><th class="num">Streak</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${ov.habits.map((h) => tableRow(h, ov.today)).join('')}</tbody>
      </table>`;
  },
};

function tableRow(h, today) {
  const tag = h.end && h.end < today ? '<span class="tag">Ended</span>' : h.start > today ? '<span class="tag">Upcoming</span>' : '';
  const dates = h.end
    ? `${fmt(h.start)} to ${fmt(h.end)}`
    : `From ${fmt(h.start, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `<tr style="--c:${h.color}">
    <td><div class="flex min-w-[180px] items-center gap-3"><span class="dot"></span><div><b>${esc(h.title)}</b>${h.notes ? `<small class="block text-[13px] text-faint">${esc(h.notes)}</small>` : ''}</div></div></td>
    <td class="text-sm whitespace-nowrap text-muted max-sm:hidden">${dates}${tag}</td>
    <td class="num"><span class="bar"><i style="width:${h.rate30 == null ? 0 : Math.round(h.rate30 * 100)}%"></i></span>${pct(h.rate30)}</td>
    <td class="num">${h.streak ? plural(h.streak, 'day') : '-'}</td>
    <td class="text-right whitespace-nowrap">
      <button class="icon-btn" data-edit="${h.id}" aria-label="Edit ${esc(h.title)}" title="Edit"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>
      <button class="icon-btn" data-del="${h.id}" aria-label="Delete ${esc(h.title)}" title="Delete"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/></svg></button>
    </td></tr>`;
}

async function deleteHabit(id) {
  const h = state.overview.habits.find((x) => x.id === id);
  if (!h) return;
  const ok = await confirmDialog({
    title: `Delete "${h.title}"?`,
    body: `This removes the habit and its ${plural(h.done.length, 'logged day')}. It can't be undone.`,
    confirm: 'Delete habit',
  });
  if (!ok) return;
  const ov = await attempt(() => api.deleteHabit(id));
  if (ov) {
    setState({ overview: ov });
    toast(`Deleted "${h.title}"`, 'danger');
  }
}

export function openHabitDialog(id) {
  const dlg = $('#habitDlg');
  const ov = state.overview;
  const editing = id ? ov.habits.find((h) => h.id === id) : null;
  const used = new Set(ov.habits.map((h) => h.color));
  const colour = editing ? editing.color : PALETTE.find((c) => !used.has(c)) || PALETTE[0];

  dlg.innerHTML = `
    <form novalidate>
      <h2 id="habitDlgTitle" class="mb-4 text-2xl">${editing ? 'Edit habit' : 'New habit'}</h2>
      <div class="field"><label for="hTitle">Title</label><input class="input" type="text" id="hTitle" maxlength="120" required></div>
      <div class="field"><label for="hNotes">Notes <span class="opt">(optional)</span></label><input class="input" type="text" id="hNotes" maxlength="500"></div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field"><label for="hStart">Start date</label><input class="input" type="date" id="hStart" required></div>
        <div class="field"><label for="hEnd">End date <span class="opt">(optional)</span></label><input class="input" type="date" id="hEnd"></div>
      </div>
      <div class="field"><span class="lbl" id="colourLbl">Colour</span>
        <div class="swatches" role="radiogroup" aria-labelledby="colourLbl">
          ${PALETTE.map((c, i) => `<input type="radio" name="hcolor" id="sw${i}" value="${c}"${c === colour ? ' checked' : ''}><label for="sw${i}" style="--c:${c}"><span class="sr-only">Colour ${i + 1}</span></label>`).join('')}
        </div>
      </div>
      <p class="err" role="alert"></p>
      <div class="mt-1.5 flex justify-end gap-2">
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add habit'}</button>
      </div>
    </form>`;

  const form = dlg.querySelector('form');
  $('#hTitle', form).value = editing?.title ?? '';
  $('#hNotes', form).value = editing?.notes ?? '';
  $('#hStart', form).value = editing?.start ?? ov.today;
  $('#hEnd', form).value = editing?.end ?? '';
  form.querySelector('[data-cancel]').onclick = () => dlg.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = form.querySelector('.err');
    const data = {
      title: $('#hTitle', form).value.trim(),
      notes: $('#hNotes', form).value.trim(),
      start: $('#hStart', form).value,
      end: $('#hEnd', form).value || null,
      color: form.querySelector('input[name=hcolor]:checked')?.value ?? PALETTE[0],
    };
    if (!data.title) return ((err.textContent = 'Give the habit a title.'), $('#hTitle', form).focus());
    if (!data.start) return ((err.textContent = 'Pick a start date.'), $('#hStart', form).focus());
    if (data.end && data.end < data.start) {
      err.textContent = 'The end date needs to be on or after the start date.';
      return $('#hEnd', form).focus();
    }
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    const next = await attempt(() => (editing ? api.updateHabit(editing.id, data) : api.createHabit(data)), { errorEl: err });
    submit.disabled = false;
    if (!next) return;
    dlg.close();
    setState({ overview: next });
    toast(editing ? `Saved changes to "${data.title}"` : `Added "${data.title}"`, 'ok');
  };

  dlg.showModal();
  $('#hTitle', form).focus();
}
