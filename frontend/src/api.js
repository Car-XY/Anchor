// Thin JSON client for the Flask API. Writes carry the CSRF token.
let csrf = '';

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request(method, path, data) {
  const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (data !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }
  if (method !== 'GET') opts.headers['X-CSRFToken'] = csrf;
  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch {
    throw new ApiError('Can’t reach Anchor. Check your connection and try again.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (body.csrf) csrf = body.csrf;
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new CustomEvent('anchor:signed-out'));
    throw new ApiError(body.error || `Something went wrong (${res.status}).`, res.status, body.field);
  }
  return body;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const api = {
  session: () => request('GET', '/session'),
  login: (username, password) => request('POST', '/auth/login', { username, password, timezone: tz() }),
  register: (username, password, confirmation) =>
    request('POST', '/auth/register', { username, password, confirmation, timezone: tz() }),
  logout: () => request('POST', '/auth/logout', {}),

  overview: () => request('GET', '/overview'),
  createHabit: (habit) => request('POST', '/habits', habit),
  updateHabit: (id, habit) => request('PATCH', `/habits/${id}`, habit),
  deleteHabit: (id) => request('DELETE', `/habits/${id}`),
  setLog: (id, day, done) => request('PUT', `/habits/${id}/logs/${day}`, { done }),

  createReflection: (r) => request('POST', '/reflections', r),
  updateReflection: (id, r) => request('PATCH', `/reflections/${id}`, r),
  deleteReflection: (id) => request('DELETE', `/reflections/${id}`),

  updateAccount: (data) => request('PATCH', '/account', data),

  companion: () => request('GET', '/companion'),
  nudge: () => request('GET', '/companion/nudge'),
  messages: () => request('GET', '/companion/messages'),
  sendMessage: (content) => request('POST', '/companion/messages', { content }),
  clearMessages: () => request('DELETE', '/companion/messages'),
};
