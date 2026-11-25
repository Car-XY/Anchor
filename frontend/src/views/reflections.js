import { api } from '../api.js';
import { $, esc, fmt } from '../lib/util.js';
import { setState, state } from '../state.js';
import { attempt, confirmDialog, toast } from '../ui/feedback.js';

let root;
let editingId = null;

export const reflections = {
  title: () => 'Reflections',
  sub: () => "Notes on your progress and how you're feeling.",

  mount(el) {
    root = el;
    editingId = null;
    root.innerHTML = `
      <div class="grid items-start gap-6 min-[1101px]:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <form class="panel px-4.5 pt-5 pb-4.5 min-[1101px]:sticky min-[1101px]:top-6" novalidate>
          <h2 class="mb-4 text-[22px]" data-form-title>New reflection</h2>
          <div class="field"><label for="rTitle">Title</label><input class="input" type="text" id="rTitle" maxlength="160" required></div>
          <div class="field"><label for="rDate">Date</label><input class="input" type="date" id="rDate" required></div>
          <div class="field"><label for="rBody">How did it go?</label><textarea class="input" id="rBody" required placeholder="What went well, what slipped, how you're feeling..."></textarea></div>
          <p class="err" role="alert"></p>
          <div class="flex gap-2">
            <button class="btn btn-primary" type="submit" data-save>Save reflection</button>
            <button class="btn" type="button" data-cancel hidden>Cancel</button>
          </div>
        </form>
        <div class="grid gap-3" data-entries></div>
      </div>`;
    const form = $('form', root);
    $('#rDate', form).value = state.overview?.today ?? '';
    form.addEventListener('submit', save);
    form.querySelector('[data-cancel]').addEventListener('click', resetForm);
    $('[data-entries]', root).addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) return startEdit(Number(edit.dataset.edit));
      const del = e.target.closest('[data-del]');
      if (del) return remove(Number(del.dataset.del));
    });
  },

  update() {
    const ov = state.overview;
    if (!root || !ov) return;
    if (!$('#rDate', root).value) $('#rDate', root).value = ov.today;
    $('[data-entries]', root).innerHTML = ov.reflections.length
      ? ov.reflections.map(entry).join('')
      : '<div class="panel empty"><p>No reflections yet. Write your first one: a few lines about how the week went is plenty.</p></div>';
  },
};

function entry(r) {
  return `<article class="panel px-5 py-4.5">
    <div class="flex items-start justify-between gap-3">
      <time class="text-[13px] font-semibold text-brass" datetime="${r.date}">${fmt(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
      <div class="-mt-1.5 -mr-2 flex">
        <button class="icon-btn" data-edit="${r.id}" aria-label="Edit ${esc(r.title)}" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>
        <button class="icon-btn" data-del="${r.id}" aria-label="Delete ${esc(r.title)}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/></svg></button>
      </div>
    </div>
    <h3 class="mt-0.5 mb-1.5 text-[21px]">${esc(r.title)}</h3>
    <p class="m-0 max-w-[68ch] whitespace-pre-wrap text-muted">${esc(r.content)}</p>
  </article>`;
}

function resetForm() {
  editingId = null;
  const form = $('form', root);
  form.reset();
  $('#rDate', form).value = state.overview.today;
  form.querySelector('[data-form-title]').textContent = 'New reflection';
  form.querySelector('[data-save]').textContent = 'Save reflection';
  form.querySelector('[data-cancel]').hidden = true;
  form.querySelector('.err').textContent = '';
}

function startEdit(id) {
  const r = state.overview.reflections.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  const form = $('form', root);
  $('#rTitle', form).value = r.title;
  $('#rDate', form).value = r.date;
  $('#rBody', form).value = r.content;
  form.querySelector('[data-form-title]').textContent = 'Edit reflection';
  form.querySelector('[data-save]').textContent = 'Save changes';
  form.querySelector('[data-cancel]').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('#rTitle', form).focus();
}

async function save(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const err = form.querySelector('.err');
  const data = {
    title: $('#rTitle', form).value.trim(),
    date: $('#rDate', form).value,
    content: $('#rBody', form).value.trim(),
  };
  if (!data.title) return ((err.textContent = 'Add a title.'), $('#rTitle', form).focus());
  if (!data.date) return ((err.textContent = 'Pick a date.'), $('#rDate', form).focus());
  if (!data.content) return ((err.textContent = 'Write a few words about how it went.'), $('#rBody', form).focus());
  const wasEditing = editingId;
  const ov = await attempt(() => (wasEditing ? api.updateReflection(wasEditing, data) : api.createReflection(data)), { errorEl: err });
  if (!ov) return;
  resetForm();
  setState({ overview: ov });
  toast(wasEditing ? 'Reflection updated' : 'Reflection saved', 'ok');
}

async function remove(id) {
  const r = state.overview.reflections.find((x) => x.id === id);
  if (!r) return;
  const ok = await confirmDialog({ title: `Delete "${r.title}"?`, body: 'This reflection will be gone for good.', confirm: 'Delete reflection' });
  if (!ok) return;
  const ov = await attempt(() => api.deleteReflection(id));
  if (ov) {
    if (editingId === id) resetForm();
    setState({ overview: ov });
    toast('Reflection deleted', 'danger');
  }
}
