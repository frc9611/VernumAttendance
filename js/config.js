/*
 * Where this kiosk talks to.
 *
 * The defaults are the production addresses. For a local stack, point the machine somewhere else
 * once from the console — no need to edit this file:
 *
 *   localStorage.setItem("vernum.api", "http://localhost:8099")
 *   localStorage.setItem("vernum.cloud", "http://localhost:8081")
 *
 * The redirect address has to be one of the addresses registered on the app inside the
 * VernumCloud (Painel admin > Apps da equipe). The login only comes back to a registered one,
 * which is what stops somebody from pointing this client id at a page of their own — so when the
 * kiosk moves to a new address, that address has to be added there first.
 */
const VernumConfig = {
  api: localStorage.getItem('vernum.api') || 'https://vernumserver-prod.onrender.com',
  cloud: localStorage.getItem('vernum.cloud') || 'https://cloud.frc9611.com',

  /** client_id of the kiosk, registered by the server on the boot. */
  clientId: 'vernum-attendance',

  /** Where the VernumCloud sends the browser back to, with the one-time code. */
  redirectUri: window.location.origin + '/index.html',
};
