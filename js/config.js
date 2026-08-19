/*
 * Where this kiosk talks to.
 *
 * Change the two addresses below when the kiosk points at another server. A machine that
 * needs a different one without editing the file can also set it once from the console:
 *
 *   localStorage.setItem("vernum.api", "http://192.168.0.10:8080")
 *   localStorage.setItem("vernum.cloud", "http://192.168.0.10:8081")
 *
 * The redirect address has to be one of the addresses registered on the app inside the
 * VernumCloud (Painel admin > Apps da equipe). The login only comes back to a registered
 * one, which is what stops somebody from pointing this client id at a page of their own.
 */
const VernumConfig = {
  api: localStorage.getItem('vernum.api') || 'http://localhost:8080',
  cloud: localStorage.getItem('vernum.cloud') || 'http://localhost:8081',

  /** client_id of the kiosk, registered by the server on the boot. */
  clientId: 'vernum-attendance',

  /** Where the VernumCloud sends the browser back to, with the one-time code. */
  redirectUri: window.location.origin + '/index.html',
};
