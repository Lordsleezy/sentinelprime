const adminEmail = 'paul@sentinelprime.org';
const authPanel = document.querySelector('#adminAuthPanel');
const adminPanel = document.querySelector('#adminPanel');
const authForm = document.querySelector('#adminAuthForm');
const authStatus = document.querySelector('#adminAuthStatus');
const signOutButton = document.querySelector('#adminSignOutButton');
const refreshButton = document.querySelector('#refreshAdmin');
const ticketsList = document.querySelector('#ticketsList');
const statsGrid = document.querySelector('#statsGrid');

async function init() {
  // Check if already logged in via main site (sessionStorage + cookie)
  const savedEmail = sessionStorage.getItem('sentinel_admin_email');
  if (savedEmail) {
    document.querySelector('#adminEmail').value = savedEmail;
    // Try to load admin data - if cookie is valid, it will work
    const success = await tryLoadAdminData();
    if (success) return;
  }
  // Not logged in, show auth panel
  authPanel.classList.remove('hidden');
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#adminEmail').value.trim();
  const password = document.querySelector('#adminPassword').value;
  
  if (!email || !password) {
    showNotice(authStatus, 'Enter email and password.', true);
    return;
  }
  
  // Use same login endpoint as main site
  const loginRes = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  
  if (!loginRes.ok) {
    showNotice(authStatus, loginData.error || 'Admin login failed', true);
    return;
  }
  
  // Save email for cross-page session (same as main site)
  sessionStorage.setItem('sentinel_admin_email', email);
  
  // Hide auth, show admin panel
  authPanel.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  signOutButton.classList.remove('hidden');
  
  await loadAdminData();
});

signOutButton.addEventListener('click', async () => {
  // Clear session storage (same as main site behavior)
  sessionStorage.removeItem('sentinel_admin_email');
  // Reload to show auth panel
  window.location.reload();
});

refreshButton.addEventListener('click', async () => {
  await loadAdminData();
});

async function tryLoadAdminData() {
  try {
    const response = await fetch('/care/api/admin-data', { credentials: 'same-origin' });
    if (!response.ok) return false;
    const data = await response.json();
    authPanel.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    signOutButton.classList.remove('hidden');
    renderStats(data.stats);
    renderTickets(data.tickets);
    return true;
  } catch (e) {
    return false;
  }
}

async function loadAdminData() {
  ticketsList.innerHTML = '<div class="notice">Loading tickets...</div>';
  try {
    const response = await fetch('/care/api/admin-data', { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) {
      ticketsList.innerHTML = `<div class="notice">${data.error || 'Unable to load admin data.'}</div>`;
      return;
    }
    renderStats(data.stats);
    renderTickets(data.tickets);
  } catch (e) {
    ticketsList.innerHTML = '<div class="notice">Error loading data. Please refresh.</div>';
  }
}

function renderStats(stats) {
  statsGrid.innerHTML = `
    <article class="stat-card"><p class="eyebrow">Open tickets</p><h2>${stats.openTickets}</h2></article>
    <article class="stat-card"><p class="eyebrow">Interactions this month</p><h2>${stats.monthlyInteractions}</h2></article>
    <article class="stat-card"><p class="eyebrow">Customers</p><h2>${stats.customers}</h2></article>
  `;
}

function renderTickets(tickets) {
  if (!tickets.length) {
    ticketsList.innerHTML = '<div class="notice">No open escalation tickets.</div>';
    return;
  }
  ticketsList.innerHTML = '';
  tickets.forEach((ticket) => {
    const card = document.createElement('article');
    card.className = 'ticket-card';
    card.innerHTML = `
      <h2>${ticket.issue_summary || 'Support request'}</h2>
      <div class="ticket-meta">${ticket.customer_name || ticket.customer_email || 'Unknown customer'} · ${ticket.plan || 'No plan'} · ${new Date(ticket.created_at).toLocaleString()}</div>
      <p>${ticket.details || ''}</p>
      <button class="button button-secondary">Mark resolved</button>
    `;
    card.querySelector('button').addEventListener('click', async () => {
      await fetch('/care/api/resolve-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ticketId: ticket.id })
      });
      await loadAdminData();
    });
    ticketsList.append(card);
  });
}

function showNotice(element, message, isError = false) {
  element.textContent = message;
  element.classList.remove('hidden');
  element.style.borderColor = isError ? 'rgba(251, 113, 133, 0.5)' : 'rgba(20, 184, 166, 0.22)';
}

init();