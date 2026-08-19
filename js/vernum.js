/*
 * Everything both pages of the kiosk need: the session, the calls to the API and the
 * "Entrar com o VernumCloud" flow.
 *
 * The kiosk is a page with no server of its own, so it keeps no secret. It proves itself
 * with PKCE instead: before sending the person to the VernumCloud it draws a random
 * verifier, keeps it here and sends only its SHA-256. The code that comes back on the
 * address bar is worth nothing without that verifier, so somebody reading the code out of
 * a browser history cannot turn it into a token.
 */

const SESSION_KEY = 'vernum.session';
const VERIFIER_KEY = 'vernum.pkce';

/* --------------------------------------------------------------------- session */

const VernumSession = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (error) {
      return null;
    }
  },

  write(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  clear() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(VERIFIER_KEY);
  },

  token() {
    const session = VernumSession.read();
    return session ? session.accessToken : null;
  },

  /** Sends the person back to the login when there is no session, or it aged out. */
  require() {
    const session = VernumSession.read();
    if (!session || !session.accessToken) {
      window.location.href = 'index.html';
      return null;
    }
    return session;
  },
};

/* ------------------------------------------------------------------------- api */

/** One call to the Vernum Server. Throws an Error carrying the message the server sent. */
async function vernumCall(method, path, body, options) {
  const settings = options || {};
  const headers = { Accept: 'application/json' };
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
  }
  const token = settings.anonymous ? null : VernumSession.token();
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(VernumConfig.api + path, {
    method: method,
    headers: headers,
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    //A token that is gone is not an error to show: it is a login to redo
    if (response.status === 401 && !settings.anonymous) {
      VernumSession.clear();
      window.location.href = 'index.html';
    }
    const error = new Error((payload && payload.message) || 'Não foi possível concluir a ação.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

/* ------------------------------------------------------------- login by Vernum */

function base64Url(bytes) {
  let text = '';
  new Uint8Array(bytes).forEach((byte) => { text += String.fromCharCode(byte); });
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeOf(verifier) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(digest);
}

/** Sends the browser to the consent screen of the VernumCloud. */
async function startVernumLogin() {
  const verifier = randomVerifier();
  const state = randomVerifier().slice(0, 16);
  localStorage.setItem(VERIFIER_KEY, JSON.stringify({ verifier: verifier, state: state }));

  const query = new URLSearchParams({
    client_id: VernumConfig.clientId,
    redirect_uri: VernumConfig.redirectUri,
    state: state,
    code_challenge: await challengeOf(verifier),
    code_challenge_method: 'S256',
  });
  window.location.href = VernumConfig.cloud + '/entrar-com-vernum?' + query.toString();
}

/**
 * Finishes the login when the VernumCloud sent the browser back with a code.
 * Returns the session, or null when this load is not a return from the login.
 */
async function finishVernumLogin() {
  const query = new URLSearchParams(window.location.search);
  const code = query.get('code');
  if (!code) {
    return null;
  }

  let pending = null;
  try {
    pending = JSON.parse(localStorage.getItem(VERIFIER_KEY));
  } catch (error) {
    pending = null;
  }
  if (!pending) {
    throw new Error('O login começou em outro navegador. Tente de novo.');
  }
  if (pending.state && query.get('state') !== pending.state) {
    throw new Error('A resposta do login não confere com o pedido. Tente de novo.');
  }

  const answer = await vernumCall('POST', '/public/sso/token', {
    clientId: VernumConfig.clientId,
    code: code,
    redirectUri: VernumConfig.redirectUri,
    codeVerifier: pending.verifier,
  }, { anonymous: true });

  localStorage.removeItem(VERIFIER_KEY);
  const session = {
    accessToken: answer.accessToken,
    expiresIn: answer.expiresIn,
    user: answer.me.user,
    memberships: answer.me.memberships,
  };
  VernumSession.write(session);

  //Takes the code off the address bar, so a reload does not try to spend it again
  window.history.replaceState({}, document.title, window.location.pathname);
  return session;
}

/* ----------------------------------------------------------------- login by hand */

/** The old way in: username and password typed on the kiosk itself. */
async function loginWithPassword(username, password) {
  const answer = await vernumCall('POST', '/login', { username: username, password: password },
    { anonymous: true });
  const session = {
    accessToken: answer.accessToken,
    expiresIn: answer.expiresIn,
    user: answer.me.user,
    memberships: answer.me.memberships,
  };
  VernumSession.write(session);
  return session;
}

/* --------------------------------------------------------------------- helpers */

function secondsToDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const units = [
    { label: 'd', value: 86400 },
    { label: 'h', value: 3600 },
    { label: 'min', value: 60 },
    { label: 's', value: 1 },
  ];

  let remaining = Math.floor(seconds);
  const parts = [];
  units.forEach((unit) => {
    const count = Math.floor(remaining / unit.value);
    if (count > 0) {
      parts.push(count + unit.label);
      remaining %= unit.value;
    }
  });
  return parts.slice(0, 3).join(' ');
}

function formatClock(value) {
  return value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
}
