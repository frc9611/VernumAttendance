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

  let response;
  try {
    response = await fetch(VernumConfig.api + path, {
      method: method,
      headers: headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    /*
     * fetch only throws like this when the browser never got an answer the page is allowed to read:
     * the server is down, the address is wrong, or it answered the preflight without the CORS
     * headers. The browser reports all three the same way — "Failed to fetch" — and showing that on
     * the kiosk says nothing to whoever is standing in front of it. Naming the address turns it into
     * something checkable, which is the whole difference when the kiosk is pointed at an old deploy.
     */
    const failure = new Error('Não foi possível falar com o servidor do Vernum em ' + VernumConfig.api
      + '. Confira se esse é o endereço certo, se ele está no ar e se ele libera esta origem ('
      + window.location.origin + ').');
    failure.status = 0;
    failure.cause = error;
    throw failure;
  }

  const text = await response.text();
  //A proxy or an old deploy can answer HTML where the API would answer JSON, and that must not
  //surface as a parse error on top of the real one
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    //A token that is gone is not an error to show: it is a login to redo
    if (response.status === 401 && !settings.anonymous) {
      VernumSession.clear();
      window.location.href = 'index.html';
    }
    const error = new Error((payload && payload.message)
      || 'O servidor respondeu ' + response.status + ' em ' + path + '.');
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
  return base64Url(randomBytes(32));
}

/*
 * SHA-256 of the verifier.
 *
 * `crypto.subtle` only exists in a secure context, which means HTTPS or localhost. A kiosk served
 * over plain http from a machine on the network — which is how a kiosk usually gets served — has
 * `window.crypto.subtle` undefined, and the login used to die right here. So the digest falls back
 * to the implementation below instead of downgrading PKCE to `plain`, which would put the verifier
 * itself on the address bar and protect nothing.
 */
async function challengeOf(verifier) {
  const bytes = new TextEncoder().encode(verifier);
  if (window.crypto && window.crypto.subtle) {
    return base64Url(await window.crypto.subtle.digest('SHA-256', bytes));
  }
  return base64Url(sha256(bytes));
}

/** Random bytes. Available outside a secure context, unlike crypto.subtle. */
function randomBytes(count) {
  const bytes = new Uint8Array(count);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
    return bytes;
  }
  //Nothing else to use: better a weaker verifier than no login at all
  for (let index = 0; index < count; index++) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/* ------------------------------------------------------------------- sha-256 */

/*
 * SHA-256 (FIPS 180-4) for when crypto.subtle is not there. Checked against the digests of
 * node's crypto for the empty string, the padding edges (55, 56, 63, 64, 119, 120 bytes) and
 * a couple hundred random buffers.
 */
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(value, bits) {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function sha256(bytes) {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  //The message, a 0x80 byte, zeros, and the bit length on the last 8 bytes of the last block
  const length = bytes.length;
  const total = Math.ceil((length + 9) / 64) * 64;
  const block = new Uint8Array(total);
  block.set(bytes);
  block[length] = 0x80;

  const view = new DataView(block.buffer);
  const bits = length * 8;
  view.setUint32(total - 8, Math.floor(bits / 0x100000000), false);
  view.setUint32(total - 4, bits >>> 0, false);

  const w = new Uint32Array(64);
  for (let start = 0; start < total; start += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(start + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = state[0]; let b = state[1]; let c = state[2]; let d = state[3];
    let e = state[4]; let f = state[5]; let g = state[6]; let h = state[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + choose + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  for (let index = 0; index < 8; index++) {
    out.setUint32(index * 4, state[index], false);
  }
  return digest;
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
