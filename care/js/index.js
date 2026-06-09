import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
import { getSession } from './supabaseClient.js';

const modelStatus = document.querySelector('#modelStatus');
const chatMessages = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const escalateButton = document.querySelector('#escalateButton');
const subscribePrompt = document.querySelector('#subscribePrompt');
const authPrompt = document.querySelector('#authPrompt');

// Persistent AI system prompt - do NOT escalate easily
const supportPrompt = `You are Sentinel, a capable and persistent tech support agent for Sentinel Care. You help with: slow computers, viruses/malware, printer issues, email problems, browser issues, software installs, password resets, Wi-Fi connectivity, virtual machines, and general troubleshooting.

Guidelines:
- Be thorough and methodical. Walk users through detailed troubleshooting steps.
- Ask clarifying questions to diagnose properly.
- Try at least 3-4 different approaches before suggesting escalation.
- For virtual machines: check settings, resources, hypervisor status, guest additions, network config.
- Never say "contact a technician" or escalate on the first few messages.
- Only escalate if: (1) user explicitly says "I tried everything" or "nothing works", OR (2) hardware failure is confirmed, OR (3) after 5+ back-and-forth exchanges.
- Always provide specific numbered steps, not generic advice.
- If unsure, ask more diagnostic questions rather than giving up.`;

let generator;
let session = null;
let messageCount = 0;
let lastUserIssue = '';

async function init() {
  // Check authentication first
  session = await getSession();
  
  if (!session) {
    showAuthPrompt();
    return;
  }
  
  // User is authenticated - show chat
  authPrompt.classList.add('hidden');
  chatForm.classList.remove('hidden');
  chatInput.disabled = false;
  
  await loadModel();
  addMessage('assistant', "Hi, I'm Sentinel. I'm here to help with your tech issues. What problem are you experiencing?");
}

function showAuthPrompt() {
  // Hide chat UI, show auth prompt
  chatForm.classList.add('hidden');
  chatInput.disabled = true;
  authPrompt.classList.remove('hidden');
  modelStatus.textContent = 'Sign in required';
  
  // Add a message explaining auth is required
  chatMessages.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'notice';
  msg.style.cssText = 'text-align:center;padding:2rem;';
  msg.innerHTML = `
    <p style="font-size:1.1rem;margin-bottom:1rem;">Sign in or subscribe to chat with Sentinel Care AI</p>
    <div style="display:flex;gap:1rem;justify-content:center;">
      <a class="button" href="/care/portal">Sign in</a>
      <a class="button button-secondary" href="/care/checkout">Subscribe</a>
    </div>
  `;
  chatMessages.append(msg);
}

async function loadModel() {
  try {
    modelStatus.textContent = 'Loading AI...';
    generator = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0', {
      quantized: true,
      revision: 'main'
    });
    modelStatus.textContent = 'Ready';
  } catch (error) {
    console.error('Model load error:', error);
    modelStatus.textContent = 'Using fallback';
  }
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  // Double-check auth
  if (!session) {
    showAuthPrompt();
    return;
  }
  
  const text = chatInput.value.trim();
  if (!text) return;
  
  lastUserIssue = text;
  chatInput.value = '';
  addMessage('user', text);
  messageCount++;
  
  const answer = await askSentinel(text);
  addMessage('assistant', answer);
  
  // Only show escalation after 4+ messages AND AI suggests it
  if (messageCount >= 4 && shouldEscalate(answer, text)) {
    escalateButton.classList.remove('hidden');
  }
});

function shouldEscalate(aiResponse, userText) {
  const lowerResponse = aiResponse.toLowerCase();
  const lowerUser = userText.toLowerCase();
  
  // User explicitly says they tried everything
  const triedEverything = /tried everything|nothing works|still broken|still not working|gave up|doesn't work at all/i.test(lowerUser);
  
  // AI indicates it cannot solve
  const aiCannotSolve = /i want to make sure this gets fixed properly|let me connect you|unable to resolve|beyond what i can fix/i.test(lowerResponse);
  
  // Hardware failure indicators
  const hardwareFailure = /hardware failure|physical damage|broken component|dead hard drive/i.test(lowerResponse + ' ' + lowerUser);
  
  return triedEverything || aiCannotSolve || hardwareFailure;
}

escalateButton.addEventListener('click', () => {
  if (!session) {
    showAuthPrompt();
    return;
  }
  subscribePrompt.classList.remove('hidden');
  escalateButton.classList.add('hidden');
});

async function askSentinel(userText) {
  if (!generator) return fallbackAnswer(userText);
  try {
    const prompt = `<|system|>\n${supportPrompt}</s>\n<|user|>\n${userText}</s>\n<|assistant|>\n`;
    const output = await generator(prompt, { 
      max_new_tokens: 250, 
      temperature: 0.35, 
      do_sample: true,
      top_k: 50,
      top_p: 0.9
    });
    const generated = output?.[0]?.generated_text || '';
    return cleanAnswer(generated.replace(prompt, '')) || fallbackAnswer(userText);
  } catch (error) {
    console.error('Generation error:', error);
    return fallbackAnswer(userText);
  }
}

function fallbackAnswer(text) {
  const lower = text.toLowerCase();
  
  // VM-specific detailed troubleshooting
  if (lower.includes('virtual machine') || lower.includes('vm ') || lower.includes('hyper-v') || lower.includes('vmware') || lower.includes('virtualbox')) {
    return "Let's troubleshoot your virtual machine systematically:\n\n1. Check VM settings - is it allocated enough RAM and CPU cores?\n2. Verify the virtual disk isn't full (check within the VM and host)\n3. Check if the VM tools/additions are installed and up to date\n4. Try restarting the VM service/hypervisor on your host\n5. Check if other VMs work - is it just this one or all VMs?\n6. Review any error messages in the VM logs\n\nWhat specific error are you seeing, and which hypervisor are you using (VMware, VirtualBox, Hyper-V)?";
  }
  
  if (lower.includes('virus') || lower.includes('popup') || lower.includes('scam') || lower.includes('malware')) {
    return "Let's handle this security issue carefully:\n\n1. Do NOT click any suspicious popups or call numbers shown\n2. Disconnect from the internet temporarily\n3. Open Task Manager and end suspicious browser processes\n4. Run a full antivirus scan with Windows Security or your antivirus\n5. Check browser extensions and remove unknown ones\n6. Clear browser cache and cookies\n7. Restart in Safe Mode if issues persist\n\nWhat specific warning or popup are you seeing? Is it in your browser or appearing on your desktop?";
  }
  
  if (lower.includes('printer')) {
    return "Let's check your printer connection step by step:\n\n1. Verify the printer is powered on and showing a ready status\n2. Check cable connections (USB) or Wi-Fi signal strength\n3. Restart both the printer and your computer\n4. On your computer, go to Settings > Printers and check if it's listed as online\n5. Try removing and re-adding the printer in Settings\n6. Check if there are pending print jobs stuck in the queue\n7. Update printer drivers from the manufacturer's website\n\nIs this a USB or wireless printer, and what error message do you see when trying to print?";
  }
  
  if (lower.includes('password') || lower.includes('forgot') || lower.includes('locked out')) {
    return "Let's work through the password issue safely:\n\n1. Go directly to the official website (not through email links)\n2. Click 'Forgot password' or 'Reset password'\n3. Check your email (including spam/junk) for the reset link\n4. If using a work/school account, contact your IT admin\n5. For local Windows accounts, try password hint or reset via Microsoft account\n6. If you have backup codes or recovery email, use those\n\nWhat type of account is this - email, work, bank, or something else?";
  }
  
  if (lower.includes('slow') || lower.includes('freeze') || lower.includes('crash') || lower.includes('lag')) {
    return "Let's speed up your system:\n\n1. Save your work and close unnecessary browser tabs\n2. Check Task Manager (Ctrl+Shift+Esc) for high CPU/memory usage\n3. Close unused applications running in the background\n4. Restart your computer to clear memory\n5. Run Disk Cleanup to free up space\n6. Check for Windows/macOS updates\n7. Scan for malware that might be consuming resources\n8. Consider uninstalling programs you don't use\n\nWhen did the slowness start - suddenly or gradually over time?";
  }
  
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('network') || lower.includes('connection')) {
    return "Let's diagnose your connection:\n\n1. Check if other devices can connect to the same Wi-Fi\n2. Toggle Wi-Fi off and on, or unplug/replug ethernet cable\n3. Restart your router/modem (unplug for 30 seconds)\n4. Run Windows Network Troubleshooter or macOS Wireless Diagnostics\n5. Forget the network and reconnect with the password\n6. Update network adapter drivers\n7. Check if airplane mode is accidentally on\n8. Test at a different location to rule out ISP issues\n\nIs this affecting just one device or multiple? Are you on Wi-Fi or wired connection?";
  }
  
  return "I understand you're having an issue. Let me help you troubleshoot this properly:\n\n1. First, can you describe exactly what you were doing when the problem started?\n2. What error messages (if any) are you seeing - please quote them exactly\n3. Have you restarted your computer since this began?\n4. Is this affecting just one application or multiple things?\n5. When did this start - today, or has it been ongoing?\n\nThe more details you provide, the more specific I can be with solutions.";
}

function cleanAnswer(answer) {
  return answer.replace(/<\|.*?>\n?/g, '').replace(/<\|.*?\|>/g, '').replace(/<\/s>/g, '').trim();
}

function addMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

init();
