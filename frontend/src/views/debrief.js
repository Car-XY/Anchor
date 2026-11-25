import { api } from '../api.js';
import { animalSvg } from '../companion/animals.js';
import { $, esc, renderMarkdown } from '../lib/util.js';
import { SEA, seaState, setState, state } from '../state.js';
import { confirmDialog, toast } from '../ui/feedback.js';

const PROMPTS = [
  'Debrief my day',
  'Why do I keep missing a habit?',
  'Help me plan tomorrow',
  'I’m feeling unmotivated',
];

let root;
let messages = [];
let sending = false;

export const debrief = {
  title: () => 'Debrief',
  sub: () => `Talk through your day with ${state.user?.companion.name ?? 'your companion'}.`,

  mount(el) {
    root = el;
    messages = [];
    root.innerHTML = `
      <div class="panel mx-auto flex max-w-[860px] flex-col overflow-hidden" style="min-height:min(720px, calc(100dvh - 210px))">
        <div class="flex items-center gap-3.5 border-b border-line px-4.5 py-3.5">
          <div class="h-[46px] w-[60px] flex-none" data-portrait></div>
          <div class="min-w-0 flex-1">
            <div class="font-serif text-xl leading-tight" data-name></div>
            <div class="truncate text-[13px] text-muted" data-status></div>
          </div>
          <button class="btn" data-clear hidden>Clear chat</button>
        </div>
        <div class="flex-1 overflow-y-auto px-4.5 py-5" data-scroll>
          <div class="msgs" data-msgs></div>
        </div>
        <div class="border-t border-line px-4.5 pt-3 pb-4">
          <div class="mb-3 flex flex-wrap gap-2" data-prompts>
            ${PROMPTS.map((p) => `<button type="button" class="prompt-chip">${esc(p)}</button>`).join('')}
          </div>
          <form class="flex items-end gap-2" novalidate>
            <label for="say" class="sr-only">Message</label>
            <textarea id="say" class="input max-h-[180px] min-h-[46px] flex-1 resize-none" rows="1" placeholder="How did today go?"></textarea>
            <button class="btn btn-primary h-[46px]" type="submit">Send</button>
          </form>
          <p class="err mt-2 mb-0" role="alert"></p>
        </div>
      </div>`;

    const form = $('form', root);
    const input = $('#say', root);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      send(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send(input.value);
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    });
    $('[data-prompts]', root).addEventListener('click', (e) => {
      const chip = e.target.closest('.prompt-chip');
      if (chip) send(chip.textContent);
    });
    $('[data-clear]', root).addEventListener('click', clear);
    load();
  },

  update() {
    if (!root) return;
    const c = state.user.companion;
    $('[data-portrait]', root).innerHTML = animalSvg(c.animal, seaState());
    $('[data-name]', root).textContent = c.name;
    const configured = state.companion.configured;
    $('[data-status]', root).textContent = configured
      ? `Your companion. Sea state: ${SEA[seaState()].name.toLowerCase()}.`
      : 'Not connected yet';
    $('#say', root).disabled = !configured;
    $('form [type=submit]', root).disabled = !configured || sending;
    $$chips().forEach((b) => (b.disabled = !configured || sending));
  },
};

const $$chips = () => [...root.querySelectorAll('.prompt-chip')];

async function load() {
  try {
    const res = await api.messages();
    setState({ companion: { ...state.companion, configured: res.configured } });
    messages = res.messages;
  } catch (err) {
    toast(err.message, 'danger');
  }
  draw();
  if (state.companion.configured) $('#say', root)?.focus();
}

function bubble(m) {
  return `<div class="msg ${m.role}">${m.role === 'assistant' ? renderMarkdown(m.content) : `<p>${esc(m.content).replace(/\n/g, '<br>')}</p>`}</div>`;
}

function draw({ typing = false } = {}) {
  if (!root) return;
  const c = state.user.companion;
  const box = $('[data-msgs]', root);
  let html = messages.map(bubble).join('');
  if (!messages.length) {
    html = state.companion.configured
      ? `<div class="msg assistant"><p>Hi, I’m ${esc(c.name)}. I can see your habits, streaks and reflections. Tell me how today went, or pick one of the prompts below.</p></div>`
      : `<div class="empty mx-auto max-w-[52ch]">
           <p class="font-serif text-xl text-ink">${esc(c.name)} isn’t connected yet</p>
           <p>The debrief chat uses OpenRouter. Add your key as <code>OPENROUTER_API_KEY</code> in the <code>.env</code> file at the project root, then restart Anchor. Until then, ${esc(c.name)} still gives tips from your data while swimming around.</p>
         </div>`;
  }
  if (typing) html += '<div class="msg assistant typing" aria-label="Typing"><span></span><span></span><span></span></div>';
  box.innerHTML = html;
  $('[data-clear]', root).hidden = !messages.length;
  const sc = $('[data-scroll]', root);
  sc.scrollTop = sc.scrollHeight;
  debrief.update();
}

async function send(raw) {
  const content = raw.trim();
  if (!content || sending || !state.companion.configured) return;
  const input = $('#say', root);
  const err = $('.err', root);
  err.textContent = '';
  sending = true;
  const pending = { role: 'user', content, id: 'pending' };
  messages = [...messages, pending];
  input.value = '';
  input.style.height = 'auto';
  draw({ typing: true });
  try {
    const res = await api.sendMessage(content);
    messages = [...messages.filter((m) => m !== pending), ...res.messages];
  } catch (ex) {
    messages = messages.filter((m) => m !== pending);
    input.value = content;
    err.textContent = ex.message;
  } finally {
    sending = false;
    draw();
    input.focus();
  }
}

async function clear() {
  const ok = await confirmDialog({
    title: 'Clear this conversation?',
    body: `${state.user.companion.name} will forget the chat history. Your habits and reflections stay as they are.`,
    confirm: 'Clear chat',
  });
  if (!ok) return;
  try {
    await api.clearMessages();
    messages = [];
    draw();
  } catch (ex) {
    toast(ex.message, 'danger');
  }
}
