/*
 * Login page of the kiosk.
 *
 * Two ways in. The button sends the person to the VernumCloud, which is where the password
 * is typed — the kiosk never sees it — and brings back a one-time code this page trades for
 * a token. The form below is the old way, kept for when the kiosk is the only screen around.
 *
 * This same page is the return address of the login, so it starts by checking whether the
 * current load is a code coming back.
 */

function setStatus(message, kind) {
  const status = document.getElementById('login-status');
  status.innerText = message || '';
  status.className = kind === 'error' ? 'text-danger fw-bold' : 'text-secondary fw-bold';
}

async function onVernumLogin(event) {
  event.preventDefault();
  setStatus('Abrindo o VernumCloud...');
  try {
    await startVernumLogin();
  } catch (error) {
    setStatus('Não foi possível abrir o login: ' + error.message, 'error');
  }
}

async function onPasswordLogin(event) {
  event.preventDefault();
  const username = document.getElementById('user').value;
  const password = document.getElementById('password').value;
  if (!username || !password) {
    setStatus('Preencha usuário e senha.', 'error');
    return;
  }
  setStatus('Conectando...');
  try {
    await loginWithPassword(username, password);
    window.location.href = 'dashboard.html';
  } catch (error) {
    setStatus(error.status === 401 || error.status === 403
      ? 'Dados de acesso incorretos' : error.message, 'error');
  }
}

window.addEventListener('load', async () => {
  document.getElementById('vernum-login-btn').addEventListener('click', onVernumLogin);
  document.getElementById('login-btn').addEventListener('click', onPasswordLogin);
  document.getElementById('password').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') onPasswordLogin(event);
  });

  //Coming back from the VernumCloud with a code
  try {
    const session = await finishVernumLogin();
    if (session) {
      setStatus('Bem-vindo, ' + session.user.name + '!');
      window.location.href = 'dashboard.html';
      return;
    }
  } catch (error) {
    setStatus(error.message, 'error');
  }

  //Already logged in on this machine
  if (VernumSession.token()) {
    document.getElementById('already-logged').classList.remove('d-none');
    document.getElementById('already-name').innerText = VernumSession.read().user.name;
    document.getElementById('continue-btn').addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
    document.getElementById('forget-btn').addEventListener('click', () => {
      VernumSession.clear();
      window.location.reload();
    });
  }
});
