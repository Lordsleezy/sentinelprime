import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const modelStatus = document.querySelector('#modelStatus');
const chatMessages = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const subscribePrompt = document.querySelector('#subscribePrompt');

// Tech support keywords that trigger subscription prompt
const techSupportKeywords = [
  'fix', 'broken', 'error', 'not working', 'won't', 'wont', 'issue', 'problem',
  'troubleshoot', 'virus', 'malware', 'printer', 'password', 'forgot password',
  'slow computer', 'freeze', 'crash', 'blue screen', 'wifi', 'internet',
  'connection', 'software', 'install', 'update', 'driver', 'email', 'outlook',
  'gmail', 'windows', 'mac', 'backup', 'recovery', 'data', 'hard drive',
  'disk', 'storage', 'printer not', 'can't print', 'cant print', 'virus removal',
  'hacked', 'compromised', 'security', 'popup', 'ads', 'browser', 'chrome',
  'firefox', 'safari', 'edge', 'zoom', 'teams', 'slack', 'excel', 'word',
  'powerpoint', 'spreadsheets', 'documents', 'files', 'sync', 'cloud',
  'onedrive', 'google drive', 'dropbox', 'icloud', 'backup', 'restore',
  'antivirus', 'firewall', 'network', 'router', 'modem', 'ethernet',
  'bluetooth', 'mouse', 'keyboard', 'monitor', 'screen', 'display',
  'battery', 'charging', 'power', 'boot', 'startup', 'login', 'sign in',
  'account locked', 'two factor', '2fa', 'authentication', 'certificate',
  'ssl', 'vpn', 'remote desktop', 'rdp', 'ssh', 'terminal', 'command line',
  'bash', 'powershell', 'registry', 'system32', 'dll', 'exe', 'application',
  'app', 'program', 'uninstall', 'remove', 'delete', 'cleanup', 'disk cleanup',
  'defrag', 'fragmented', 'corrupted', 'damaged', 'failing', 'hardware',
  'cpu', 'ram', 'memory', 'graphics', 'gpu', 'motherboard', 'cpu fan',
  'overheating', 'temperature', 'bsod', 'kernel', 'panic', 'exception',
  'fault', 'timeout', 'unreachable', 'dns', 'ip address', 'ping', 'packet loss',
  'bandwidth', 'speed test', 'latency', 'lag', 'stutter', 'frame rate', 'fps'
];

let generator;
let isTechSupportMode = false;
let gaveTechTip = false;

async function init() {
  await loadModel();
  addMessage('assistant', "Hi there! I'm Sentinel. I can chat about anything — news, weather, general questions, or just shoot the breeze. If you need tech support help, just ask!");
}

async function loadModel() {
  try {
    modelStatus.textContent = 'Loading...';
    generator = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0', {
      quantized: true,
      revision: 'main'
    });
    modelStatus.textContent = 'Online';
  } catch (error) {
    console.error('Model load error:', error);
    modelStatus.textContent = 'Ready';
  }
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  
  chatInput.value = '';
  addMessage('user', text);
  
  // Check if this is a tech support request
  const isTechRequest = isTechSupportRequest(text);
  
  if (isTechRequest && !isTechSupportMode) {
    // First tech support request - enter tech mode and give one tip
    isTechSupportMode = true;
    gaveTechTip = false;
  }
  
  const answer = await generateResponse(text, isTechRequest);
  addMessage('assistant', answer);
  
  // If we just gave a tech tip for the first time, show subscription prompt
  if (isTechSupportMode && isTechRequest && !gaveTechTip) {
    gaveTechTip = true;
    subscribePrompt.classList.remove('hidden');
  }
});

function isTechSupportRequest(text) {
  const lower = text.toLowerCase();
  return techSupportKeywords.some(keyword => lower.includes(keyword.toLowerCase()));
}

async function generateResponse(userText, isTechRequest) {
  if (!generator) {
    return fallbackResponse(userText, isTechRequest);
  }
  
  try {
    let prompt;
    
    if (isTechRequest && isTechSupportMode && gaveTechTip) {
      // After first tech tip, be brief and point to subscription
      return "I've shared the first step above. For complete step-by-step troubleshooting with detailed guidance, a Sentinel Care subscription gives you full access to our tech support system.";
    } else if (isTechRequest) {
      // First tech request - give one helpful tip
      prompt = `<|system|>
You are Sentinel, a friendly tech support assistant. The user has a tech problem. Give ONE specific, helpful first step or tip to address their issue. Be concise but useful. Do not give a full troubleshooting guide — just the first most important step.</s>
<|user|>
${userText}</s>
<|assistant|>
`;
    } else {
      // General conversation - be friendly and casual
      prompt = `<|system|>
You are Sentinel, a friendly and conversational AI assistant. You can chat about anything — general knowledge, current topics, casual conversation, advice, opinions (clearly stated as such), weather, news, hobbies, entertainment, etc. Be warm, engaging, and helpful. Keep responses natural and conversational.</s>
<|user|>
${userText}</s>
<|assistant|>
`;
    }
    
    const output = await generator(prompt, { 
      max_new_tokens: isTechRequest ? 150 : 200, 
      temperature: 0.7, 
      do_sample: true,
      top_k: 50,
      top_p: 0.9
    });
    
    const generated = output?.[0]?.generated_text || '';
    const cleaned = cleanAnswer(generated.replace(prompt, ''));
    return cleaned || fallbackResponse(userText, isTechRequest);
  } catch (error) {
    console.error('Generation error:', error);
    return fallbackResponse(userText, isTechRequest);
  }
}

function fallbackResponse(text, isTechRequest) {
  const lower = text.toLowerCase();
  
  if (!isTechRequest) {
    // General conversation fallbacks
    if (lower.includes('weather')) {
      return "I don't have real-time weather data, but I can chat about climate patterns, seasons, or help you find a good weather app! What's on your mind?";
    }
    if (lower.includes('news') || lower.includes('happening')) {
      return "I don't have live news feeds, but I'm happy to discuss current topics, explain concepts, or chat about pretty much anything. What are you interested in?";
    }
    if (lower.includes('how are you') || lower.includes('how do you do')) {
      return "I'm doing well, thanks for asking! Ready to chat, answer questions, or help out however I can. How about you?";
    }
    if (lower.includes('joke')) {
      return "Why don't scientists trust atoms? Because they make up everything! 😄 Got any favorites?";
    }
    if (lower.includes('hello') || lower.includes('hi ') || lower === 'hi') {
      return "Hey there! Nice to meet you. What's on your mind today?";
    }
    return "That's interesting! Tell me more, or ask me anything — I'm here to chat about whatever you'd like.";
  }
  
  // Tech support fallbacks - give one tip then done
  if (lower.includes('printer') || lower.includes('print')) {
    return "First, check that your printer is turned on and has paper loaded. Then verify the USB cable or Wi-Fi connection is active.";
  }
  if (lower.includes('slow') || lower.includes('freeze') || lower.includes('lag')) {
    return "Start by closing unused browser tabs and applications, then restart your computer to free up memory.";
  }
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('connection')) {
    return "Try unplugging your router for 30 seconds, then plug it back in and wait for it to fully reconnect.";
  }
  if (lower.includes('password') || lower.includes('forgot') || lower.includes('login')) {
    return "Go directly to the service's website and use the 'Forgot Password' link — avoid clicking reset links from emails for security.";
  }
  if (lower.includes('virus') || lower.includes('malware') || lower.includes('popup') || lower.includes('scam')) {
    return "Don't click any suspicious popups. Disconnect from the internet temporarily and run a full antivirus scan.";
  }
  if (lower.includes('update') || lower.includes('install')) {
    return "Make sure you have enough free disk space (at least 10GB), then restart and try the update again.";
  }
  if (lower.includes('email') || lower.includes('outlook') || lower.includes('gmail')) {
    return "Check your internet connection first, then verify your account settings and password haven't changed.";
  }
  if (lower.includes('error') || lower.includes('not working') || lower.includes('broken')) {
    return "Note the exact error message you're seeing, then try closing and reopening the application or restarting your device.";
  }
  
  return "Start by restarting the affected device or application — this resolves about 80% of tech issues.";
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
