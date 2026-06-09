import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
import { hideNotice, showNotice } from './config.js';
import { getSession, getSupabase } from './supabaseClient.js';

const authPanel = document.querySelector('#authPanel');
const portalPanel = document.querySelector('#portalPanel');
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
const modelStatus = document.querySelector('#modelStatus');
const chatMessages = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const escalateButton = document.querySelector('#escalateButton');
const upgradePrompt = document.querySelector('#upgradePrompt');

const supportPrompt = `You are Sentinel, a friendly, patient tech support agent for Sentinel Care. Speak in plain English. Never use jargon unless you explain it simply. Help with slow computers, virus concerns, printer setup, email problems, browser issues, software installs, password help, and vague computer problems. Walk users through fixes step by step with numbered instructions. If you cannot solve the issue, say exactly: "I want to make sure this gets fixed properly. Let me connect you with a real technician."`;

let generator;
let session;
let profile;
let lastUserIssue = '';

async function init() {
  session = await getSession();
  if (!session) return;
  authPanel.classList.add('hidden');
  portalPanel.classList.remove('hidden');
  signOutButton.classList.remove('hidden');
  await loadProfile();
  await loadModel();
  addMessage('assistant', 'Hi, I’m Sentinel. Tell me what is happening with your computer, printer, email, browser, or account, and I’ll walk you through it one step at a time.');
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(authForm).get('email');
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/care/portal` } });
  showNotice(authStatus, error ? error.message : 'Magic link sent. Check your email.', Boolean(error));
});

signOutButton.addEventListener('click', async () => {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  window.location.reload();
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  lastUserIssue = text;
  chatInput.value = '';
  addMessage('user', text);
  await trackInteraction('ai_chat', text);
  const answer = await askSentinel(text);
  addMessage('assistant', answer);
  if (answer.includes('Let me connect you with a real technician.')) {
    escalateButton.classList.remove('hidden');
  }
});

remoteButton.addEventListener('click', async () => requestHumanHelp('remote_session', 'Remote desktop session requested'));
callbackButton.addEventListener('click', async () => requestHumanHelp('phone_callback', 'Phone callback requested'));
escalateButton.addEventListener('click', async () => requestHumanHelp('ai_escalation', lastUserIssue || 'AI chat escalation requested'));

async function loadProfile() {
  const response = await fetch('/care/api/customer-profile', { headers: { Authorization: `Bearer ${session.access_token}` } });
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
    upgradePrompt.classList.remove('hidden');
  }
}

async function loadModel() {
  try {
    modelStatus.textContent = 'Sentinel Care AI is warming up...';
    generator = await pipeline('text-generation', 'Xenova/Phi-3-mini-4k-instruct');
    modelStatus.textContent = 'Ready';
  } catch (error) {
    modelStatus.textContent = 'Fallback mode';
  }
}

async function askSentinel(userText) {
  if (!generator) return fallbackAnswer(userText);
  try {
    const prompt = `<|system|>\n${supportPrompt}<|end|>\n<|user|>\n${userText}<|end|>\n<|assistant|>\n`;
    const output = await generator(prompt, { max_new_tokens: 260, temperature: 0.35, do_sample: true });
    const generated = output?.[0]?.generated_text || '';
    return cleanAnswer(generated.replace(prompt, '')) || fallbackAnswer(userText);
  } catch (error) {
    return fallbackAnswer(userText);
  }
}

function fallbackAnswer(text) {
  const lower = text.toLowerCase();
  if (lower.includes('virus') || lower.includes('popup') || lower.includes('scam')) {
    return 'Let’s handle this carefully.\n\n1. Do not click the popup or call any number shown on it.\n2. Close your browser completely.\n3. Restart your computer.\n4. Open your security app and run a full scan.\n5. If the warning comes back, I want to make sure this gets fixed properly. Let me connect you with a real technician.';
  }
  if (lower.includes('printer')) {
    return 'Let’s check the printer step by step.\n\n1. Make sure the printer is turned on.\n2. Confirm it is connected to the same Wi-Fi as your computer.\n3. Restart the printer and your computer.\n4. Try printing a simple test page.\n5. If it still does not print, remove and re-add the printer in your computer settings.';
  }
  if (lower.includes('password')) {
    return 'Let’s work through the password issue safely.\n\n1. Go directly to the official website or app.\n2. Choose “Forgot password.”\n3. Check your email or phone for the reset code.\n4. Create a new password you do not use anywhere else.\n5. If you think someone else accessed the account, tell me and we can secure it next.';
  }
  return 'Let’s start with the safest basic checks.\n\n1. Save anything you are working on.\n2. Restart the computer.\n3. After it turns back on, try the same task again.\n4. Tell me exactly what message you see, or what happens right before the problem starts.\n5. If this affects your work right now, I want to make sure this gets fixed properly. Let me connect you with a real technician.';
}

function cleanAnswer(answer) {
  return answer.replace(/<\|.*?\|>/g, '').trim();
}

function addMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function trackInteraction(type, summary) {
  await fetch('/care/api/track-interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ type, summary })
  });
}

async function requestHumanHelp(type, summary) {
  hideNotice(portalStatus);
  const humanLimitReached = profile.usage.humanInteractions >= profile.limits.humanInteractions;
  if (humanLimitReached && type !== 'ai_chat') {
    showNotice(portalStatus, 'Your included human support for this billing cycle has been used. Extra human interactions or remote sessions are $25 each.', true);
  }
  if (type === 'phone_callback' && profile.subscription?.plan !== 'plus') {
    showNotice(portalStatus, 'Phone callback support is included with Plus. Upgrade to request callbacks.', true);
    return;
  }
  const response = await fetch('/care/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ type, summary, details: lastUserIssue })
  });
  const data = await response.json();
  showNotice(portalStatus, response.ok ? 'Request sent. A Sentinel Prime technician has been notified.' : data.error || 'Unable to send request.', !response.ok);
  if (response.ok) await loadProfile();
}

function formatPlan(plan) {
  if (plan === 'plus') return 'Plus';
  if (plan === 'basic') return 'Basic';
  return 'No active subscription';
}

init();
