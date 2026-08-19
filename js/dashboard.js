/*
 * Dashboard of the kiosk.
 *
 * The person never says which team they are in: the login already answered every team of
 * theirs, and entering the room counts for all of them at once. So the top of the screen is
 * one button for the room, and below it one card per team, each with the time accumulated
 * there, who is inside right now and the ranking of that team.
 */

let session = null;
let status = null;
let selectedTenantId = null;
let ticking = null;

/* ---------------------------------------------------------------------- loading */

async function loadStatus() {
  status = await vernumCall('GET', '/attendance/me');
  if (!selectedTenantId && status.tenants.length) {
    selectedTenantId = status.tenants[0].tenantId;
  }
}

async function loadTenantPanel() {
  if (!selectedTenantId) return;
  const [inRoom, ranking] = await Promise.all([
    vernumCall('GET', '/tenants/' + selectedTenantId + '/attendance/now'),
    vernumCall('GET', '/tenants/' + selectedTenantId + '/attendance/ranking'),
  ]);
  drawInRoom(inRoom);
  drawRanking(ranking);
}

/* ---------------------------------------------------------------------- drawing */

function drawHeader() {
  document.getElementById('welcome-msg').innerText = 'Olá, ' + session.user.name + '!';

  const label = document.getElementById('isInRoom');
  const button = document.getElementById('room-btn');
  button.classList.remove('disabled');

  if (status.inRoom) {
    label.innerText = 'Na sala desde ' + formatClock(status.since);
    button.innerText = 'Sair da sala';
    button.className = 'btn btn-danger btn-lg px-5';
  } else {
    label.innerText = 'Você não está na sala.';
    button.innerText = 'Entrar na sala';
    button.className = 'btn btn-success btn-lg px-5';
  }
  drawElapsed();
}

/** The counter of the current stay, ticking while the person is inside. */
function drawElapsed() {
  const elapsed = document.getElementById('elapsed');
  if (!status.inRoom || !status.since) {
    elapsed.innerText = '';
    return;
  }
  const seconds = Math.floor((Date.now() - new Date(status.since).getTime()) / 1000);
  elapsed.innerText = secondsToDuration(seconds) + ' nesta visita';
}

function drawTeams() {
  const holder = document.getElementById('teams');
  holder.innerHTML = '';

  if (!status.tenants.length) {
    holder.innerHTML = '<p class="text-muted mb-0">Nenhuma equipe sua registra presença.</p>';
    return;
  }

  status.tenants.forEach((tenant) => {
    const column = document.createElement('div');
    column.className = 'col-12 col-md-6 col-lg-4';

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'team-card w-100 text-start'
      + (tenant.tenantId === selectedTenantId ? ' team-card--active' : '');
    card.style.borderColor = tenant.tenantColor || '#8864AE';
    card.addEventListener('click', () => {
      selectedTenantId = tenant.tenantId;
      drawTeams();
      loadTenantPanel().catch(showError);
    });

    const stripe = document.createElement('span');
    stripe.className = 'team-card__stripe';
    stripe.style.background = tenant.tenantColor || '#8864AE';

    const name = document.createElement('strong');
    name.innerText = tenant.tenantName + (tenant.teamNumber ? ' #' + tenant.teamNumber : '');

    const total = document.createElement('span');
    total.className = 'd-block text-muted';
    total.innerText = 'Total: ' + secondsToDuration(tenant.totalSeconds);

    const badge = document.createElement('span');
    badge.className = 'badge ' + (tenant.inRoom ? 'text-bg-success' : 'text-bg-light');
    badge.innerText = tenant.inRoom ? 'contando agora' : 'fora da sala';

    card.appendChild(stripe);
    card.appendChild(name);
    card.appendChild(total);
    card.appendChild(badge);
    column.appendChild(card);
    holder.appendChild(column);
  });

  const chosen = status.tenants.find((tenant) => tenant.tenantId === selectedTenantId);
  document.getElementById('panel-team').innerText = chosen ? chosen.tenantName : '';
}

function drawInRoom(entries) {
  const body = document.getElementById('in-room-body');
  body.innerHTML = '';
  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="2" class="text-muted">Ninguém na sala.</td></tr>';
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = '<td>' + escapeHtml(entry.userName) + '</td>'
      + '<td>desde ' + formatClock(entry.startTime) + '</td>';
    body.appendChild(row);
  });
}

function drawRanking(ranking) {
  const body = document.getElementById('ranking-body');
  body.innerHTML = '';
  if (!ranking.length) {
    body.innerHTML = '<tr><td colspan="3" class="text-muted">Sem registros ainda.</td></tr>';
    return;
  }
  ranking.forEach((line) => {
    const row = document.createElement('tr');
    row.innerHTML = '<th scope="row">' + line.position + '</th>'
      + '<td>' + escapeHtml(line.userName) + (line.inRoom ? ' <span class="badge text-bg-success">na sala</span>' : '') + '</td>'
      + '<td>' + secondsToDuration(line.totalSeconds) + '</td>';
    body.appendChild(row);
  });
}

function escapeHtml(value) {
  const holder = document.createElement('span');
  holder.innerText = value == null ? '' : value;
  return holder.innerHTML;
}

function showError(error) {
  const banner = document.getElementById('error-banner');
  banner.innerText = error.message;
  banner.classList.remove('d-none');
}

/* ----------------------------------------------------------------------- actions */

async function toggleRoom() {
  const button = document.getElementById('room-btn');
  button.classList.add('disabled');
  try {
    status = await vernumCall('POST', status.inRoom ? '/attendance/leave' : '/attendance/enter');
    drawHeader();
    drawTeams();
    await loadTenantPanel();
  } catch (error) {
    showError(error);
  } finally {
    button.classList.remove('disabled');
  }
}

/* -------------------------------------------------------------------------- boot */

window.addEventListener('load', async () => {
  session = VernumSession.require();
  if (!session) return;

  document.getElementById('logout-btn').addEventListener('click', () => {
    VernumSession.clear();
    window.location.href = 'index.html';
  });
  document.getElementById('room-btn').addEventListener('click', toggleRoom);

  try {
    await loadStatus();
    drawHeader();
    drawTeams();
    await loadTenantPanel();
  } catch (error) {
    showError(error);
  }

  //The counter of the current stay ticks locally; the rest is refreshed once a minute
  ticking = setInterval(drawElapsed, 1000);
  setInterval(() => {
    loadStatus().then(() => {
      drawHeader();
      drawTeams();
      return loadTenantPanel();
    }).catch(() => {});
  }, 60000);
});

window.addEventListener('unload', () => clearInterval(ticking));
