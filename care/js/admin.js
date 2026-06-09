import { showNotice } from './config.js';
import { getSession, getSupabase } from './supabaseClient.js';

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
  const session = await getSession();
  if (session?.user?.email === adminEmail) {
    authPanel.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    signOutButton.classList.remove('hidden');
    await loadAdminData(session.access_token);
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(authForm).get('email');
  if (email !== adminEmail) {
    showNotice(authStatus, 'This admin panel is restricted to paul@sentinelprime.org.', true);
    return;
  }
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/care/admin` } });
  showNotice(authStatus, error ? error.message : 'Magic link sent. Check your email.', Boolean(error));
});

signOutButton.addEventListener('click', async () => {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  window.location.reload();
});

refreshButton.addEventListener('click', async () => {
  const session = await getSession();
  if (session) await loadAdminData(session.access_token);
});

async function loadAdminData(token) {
  ticketsList.innerHTML = '<div class="notice">Loading tickets...</div>';
  const response = await fetch('/care/api/admin-data', { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) {
    ticketsList.innerHTML = `<div class="notice">${data.error || 'Unable to load admin data.'}</div>`;
    return;
  }
  renderStats(data.stats);
  renderTickets(data.tickets, token);
}

function renderStats(stats) {
  statsGrid.innerHTML = `
    <article class="stat-card"><p class="eyebrow">Open tickets</p><h2>${stats.openTickets}</h2></article>
    <article class="stat-card"><p class="eyebrow">Interactions this month</p><h2>${stats.monthlyInteractions}</h2></article>
    <article class="stat-card"><p class="eyebrow">Customers</p><h2>${stats.customers}</h2></article>
  `;
}

function renderTickets(tickets, token) {
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticketId: ticket.id })
      });
      await loadAdminData(token);
    });
    ticketsList.append(card);
  });
}

init();
