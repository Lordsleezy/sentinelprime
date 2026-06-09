import { hideNotice, showNotice } from './config.js';
import { getSession, getSupabase } from './supabaseClient.js';

const authPanel = document.querySelector('#authPanel');
const accountPanel = document.querySelector('#accountPanel');
const authForm = document.querySelector('#authForm');
const authStatus = document.querySelector('#authStatus');
const signOutButton = document.querySelector('#signOutButton');
const customerName = document.querySelector('#customerName');
const currentPlan = document.querySelector('#currentPlan');
const interactionUsage = document.querySelector('#interactionUsage');
const remoteUsage = document.querySelector('#remoteUsage');
const remoteButton = document.querySelector('#remoteButton');
const callbackButton = document.querySelector('#callbackButton');
const portalStatus = document.querySelector('#portalStatus');

let session;
let profile;
let lastUserIssue = '';

async function init() {
  session = await getSession();
  if (session) {
    authPanel.classList.add('hidden');
    accountPanel.classList.remove('hidden');
    signOutButton.classList.remove('hidden');
    await loadProfile();
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(authForm).get('email');
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({ 
    email, 
    options: { emailRedirectTo: `${window.location.origin}/care/portal` } 
  });
  showNotice(authStatus, error ? error.message : 'Magic link sent. Check your email.', Boolean(error));
});

signOutButton.addEventListener('click', async () => {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  window.location.reload();
});

remoteButton.addEventListener('click', async () => requestHumanHelp('remote_session', 'Remote desktop session requested'));
callbackButton.addEventListener('click', async () => requestHumanHelp('phone_callback', 'Phone callback requested'));

async function loadProfile() {
  const response = await fetch('/care/api/customer-profile', { 
    headers: { Authorization: `Bearer ${session.access_token}` } 
  });
  const data = await response.json();
  if (!response.ok) {
    showNotice(portalStatus, data.error || 'Unable to load your account.', true);
    return;
  }
  profile = data;
  customerName.textContent = `Welcome${profile.customer?.name ? `, ${profile.customer.name}` : ''}`;
  currentPlan.textContent = formatPlan(profile.subscription?.plan);
  interactionUsage.textContent = `${profile.usage.humanInteractions} / ${profile.limits.humanInteractions}`;
  remoteUsage.textContent = `${profile.usage.remoteSessions} / ${profile.limits.remoteSessions}`;
  callbackButton.disabled = profile.subscription?.plan !== 'plus';
  
  if (profile.usage.humanInteractions >= profile.limits.humanInteractions) {
    showNotice(portalStatus, 'You have reached your monthly human support limit.', false);
  }
}

async function requestHumanHelp(type, summary) {
  hideNotice(portalStatus);
  const humanLimitReached = profile.usage.humanInteractions >= profile.limits.humanInteractions;
  
  if (humanLimitReached) {
    showNotice(portalStatus, 'Your included human support for this billing cycle has been used. Extra sessions are $25 each.', true);
    return;
  }
  
  if (type === 'phone_callback' && profile.subscription?.plan !== 'plus') {
    showNotice(portalStatus, 'Phone callback support is included with Plus. Upgrade to request callbacks.', true);
    return;
  }
  
  const response = await fetch('/care/api/notify', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      Authorization: `Bearer ${session.access_token}` 
    },
    body: JSON.stringify({ type, summary, details: lastUserIssue })
  });
  const data = await response.json();
  showNotice(portalStatus, response.ok ? 'Request sent. A Sentinel Prime technician has been notified.' : data.error || 'Unable to send request.', !response.ok);
  if (response.ok) await loadProfile();
}

function formatPlan(plan) {
  if (plan === 'plus') return 'Plus';
  if (plan === 'basic') return 'Basic';
  return 'Free (AI chat only)';
}

init();
