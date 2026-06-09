import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const modelStatus = document.querySelector('#modelStatus');
const chatMessages = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const escalateButton = document.querySelector('#escalateButton');
const subscribePrompt = document.querySelector('#subscribePrompt');

const supportPrompt = `You are Sentinel, a friendly tech support agent. Help with slow computers, virus concerns, printer setup, email problems, browser issues, and password help. Use simple step-by-step instructions. If you cannot solve the issue, say exactly: "I want to make sure this gets fixed properly. Let me connect you with a real technician."`;

let generator;
let lastUserIssue = '';

async function init() {
  await loadModel();
  addMessage('assistant', "Hi, I'm Sentinel. Tell me what is happening with your computer, printer, email, or browser and I'll help you step by step.");
}

async function loadModel() {
  try {
    modelStatus.textContent = 'Loading AI...';
    // TinyLlama-1.1B-Chat-v1.0 - under 700MB, loads in ~20-30 seconds
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
  const text = chatInput.value.trim();
  if (!text) return;
  lastUserIssue = text;
  chatInput.value = '';
  addMessage('user', text);
  
  const answer = await askSentinel(text);
  addMessage('assistant', answer);
  
  if (answer.includes('Let me connect you with a real technician')) {
    escalateButton.classList.remove('hidden');
  }
});

escalateButton.addEventListener('click', () => {
  subscribePrompt.classList.remove('hidden');
  escalateButton.classList.add('hidden');
});

async function askSentinel(userText) {
  if (!generator) return fallbackAnswer(userText);
  try {
    // TinyLlama uses ChatML format
    const prompt = `<|system|>\n${supportPrompt}</s>\n<|user|>\n${userText}</s>\n<|assistant|>\n`;
    const output = await generator(prompt, { 
      max_new_tokens: 200, 
      temperature: 0.4, 
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
  if (lower.includes('virus') || lower.includes('popup') || lower.includes('scam')) {
    return "Let's handle this carefully.\n\n1. Do not click any popup or call numbers shown.\n2. Close your browser completely.\n3. Restart your computer.\n4. Run a full security scan.\n5. If warnings persist, I want to make sure this gets fixed properly. Let me connect you with a real technician.";
  }
  if (lower.includes('printer')) {
    return "Let's check the printer:\n\n1. Make sure it's turned on.\n2. Confirm it's on the same Wi-Fi as your computer.\n3. Restart both the printer and computer.\n4. Try a test print.\n5. If it still won't print, remove and re-add the printer in settings.";
  }
  if (lower.includes('password')) {
    return "Let's reset your password safely:\n\n1. Go directly to the official website.\n2. Choose 'Forgot password.'\n3. Check your email for the reset link.\n4. Create a new unique password.\n5. If you suspect someone accessed your account, let me know and we can secure it.";
  }
  if (lower.includes('slow') || lower.includes('freeze') || lower.includes('crash')) {
    return "Let's speed things up:\n\n1. Save your work.\n2. Close unused browser tabs and apps.\n3. Restart your computer.\n4. Clear temporary files (Disk Cleanup on Windows).\n5. If still slow, check for software updates or unwanted programs.";
  }
  return "Let's start with basic troubleshooting:\n\n1. Save your work.\n2. Restart the computer.\n3. Try the task again.\n4. Tell me the exact error message you see.\n5. If this is urgent, I want to make sure this gets fixed properly. Let me connect you with a real technician.";
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
