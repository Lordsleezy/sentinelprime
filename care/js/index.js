import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const modelStatus = document.querySelector('#modelStatus');
const chatMessages = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const subscribePrompt = document.querySelector('#subscribePrompt');

// Tech support keywords that trigger tech mode
const techSupportKeywords = [
  'fix', 'broken', 'error', 'not working', "won't", 'wont', 'issue', 'problem',
  'troubleshoot', 'virus', 'malware', 'printer', 'password', 'forgot password',
  'slow computer', 'freeze', 'crash', 'blue screen', 'wifi', 'internet',
  'connection', 'software', 'install', 'update', 'driver', 'email', 'outlook',
  'gmail', 'windows', 'mac', 'backup', 'recovery', 'data', 'hard drive',
  'disk', 'storage', 'printer not', "can't print", 'cant print', 'virus removal',
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
let conversationHistory = [];
let isTechSupportMode = false;
let techExchangeCount = 0;
let subscriptionPromptShown = false;
let currentTechTopic = '';

async function init() {
  await loadModel();
  const welcomeMsg = "Hi there! I'm Sentinel. I can chat about anything — news, weather, general questions, or just shoot the breeze. If you need tech support help, just ask!";
  addMessage('assistant', welcomeMsg);
  conversationHistory.push({ role: 'assistant', content: welcomeMsg });
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
  event.stopPropagation();
  
  const text = chatInput.value.trim();
  if (!text) return false;
  
  chatInput.value = '';
  addMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });
  
  // Check if this is a tech support request
  const isTechRequest = isTechSupportRequest(text);
  
  // Track if we're continuing the same tech topic or starting new
  if (isTechRequest) {
    if (!isTechSupportMode) {
      // First tech request - enter tech mode
      isTechSupportMode = true;
      techExchangeCount = 0;
      subscriptionPromptShown = false;
      currentTechTopic = extractTopic(text);
    } else {
      // Check if this is a continuation of the same issue
      const newTopic = extractTopic(text);
      if (newTopic === currentTechTopic || isRelatedTopic(newTopic, currentTechTopic)) {
        techExchangeCount++;
      } else {
        // New tech topic - reset counter
        techExchangeCount = 1;
        currentTechTopic = newTopic;
        subscriptionPromptShown = false;
      }
    }
  }
  
  const answer = await generateResponse(text, isTechRequest);
  addMessage('assistant', answer);
  conversationHistory.push({ role: 'assistant', content: answer });
  
  // Show subscription prompt only after 3-4 genuine tech exchanges and not yet resolved
  if (isTechSupportMode && isTechRequest && !subscriptionPromptShown && techExchangeCount >= 3) {
    subscriptionPromptShown = true;
    setTimeout(() => {
      subscribePrompt.classList.remove('hidden');
    }, 500);
  }
  
  return false;
});

function isTechSupportRequest(text) {
  const lower = text.toLowerCase();
  return techSupportKeywords.some(keyword => lower.includes(keyword.toLowerCase()));
}

function extractTopic(text) {
  const lower = text.toLowerCase();
  // Extract main topic from the query
  if (lower.includes('printer') || lower.includes('print')) return 'printer';
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('network')) return 'network';
  if (lower.includes('password') || lower.includes('login') || lower.includes('sign in')) return 'password';
  if (lower.includes('virus') || lower.includes('malware') || lower.includes('security')) return 'security';
  if (lower.includes('slow') || lower.includes('freeze') || lower.includes('crash') || lower.includes('lag')) return 'performance';
  if (lower.includes('email') || lower.includes('outlook') || lower.includes('gmail')) return 'email';
  if (lower.includes('update') || lower.includes('install')) return 'software';
  if (lower.includes('error') || lower.includes('broken') || lower.includes('not working')) return 'error';
  return 'general-tech';
}

function isRelatedTopic(newTopic, currentTopic) {
  // Topics are related if they're the same or in the same category
  if (newTopic === currentTopic) return true;
  const relatedGroups = [
    ['printer', 'print'],
    ['wifi', 'network', 'internet'],
    ['password', 'login', 'sign in'],
    ['virus', 'malware', 'security'],
    ['slow', 'performance', 'freeze', 'crash']
  ];
  return relatedGroups.some(group => group.includes(newTopic) && group.includes(currentTopic));
}

async function generateResponse(userText, isTechRequest) {
  if (!generator) {
    return fallbackResponse(userText, isTechRequest);
  }
  
  try {
    // Build prompt with full conversation history
    let prompt = '<|system|>\nYou are Sentinel, a helpful AI assistant. ';
    
    if (isTechRequest) {
      if (techExchangeCount >= 3) {
        // After several exchanges, gently suggest they might need more help
        prompt += 'The user has been troubleshooting a tech issue for several messages. Continue being helpful, but acknowledge if the issue seems complex. Keep responses practical and encouraging.</s>\n';
      } else {
        prompt += 'You are providing tech support. Give clear, step-by-step guidance. Ask follow-up questions to understand the issue better. Be thorough but concise. Build on previous troubleshooting steps.</s>\n';
      }
    } else {
      prompt += 'You are a friendly conversational AI. Chat naturally about any topic. Remember context from the conversation history.</s>\n';
    }
    
    // Add full conversation history (last 10 messages to stay within token limits)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}</s>\n`;
      } else {
        prompt += `<|assistant|>\n${msg.content}</s>\n`;
      }
    }
    
    // Add the current user message if not already in history
    const lastMsg = recentHistory[recentHistory.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userText) {
      prompt += `<|user|>\n${userText}</s>\n`;
    }
    
    prompt += '<|assistant|>\n';
    
    const output = await generator(prompt, { 
      max_new_tokens: isTechRequest ? 200 : 180, 
      temperature: 0.65, 
      do_sample: true,
      top_k: 50,
      top_p: 0.9,
      repetition_penalty: 1.1  // Reduce repetitive responses
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
  
  // Use conversation history to provide contextual responses
  const lastTopic = conversationHistory
    .slice()
    .reverse()
    .find(m => m.role === 'assistant');
  
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
  
  // Tech support fallbacks with progressive guidance
  if (lower.includes('printer') || lower.includes('print')) {
    if (techExchangeCount === 0) return "First, check that your printer is turned on and has paper loaded. Then verify the USB cable or Wi-Fi connection is active. What type of printer are you using?";
    if (techExchangeCount === 1) return "Let's check the printer queue. Go to Settings > Printers, find your printer, and see if there are any stuck jobs. Try canceling all jobs and sending a test print. Any change?";
    if (techExchangeCount === 2) return "Try removing and re-adding the printer. In Settings > Printers, remove your printer, then add it back fresh. You'll need the printer driver. Does this help?";
    return "We've tried the basic steps. This might need deeper troubleshooting or the printer may need maintenance.";
  }
  
  if (lower.includes('slow') || lower.includes('freeze') || lower.includes('lag')) {
    if (techExchangeCount === 0) return "Start by closing unused browser tabs and applications, then restart your computer to free up memory. How much RAM does your computer have?";
    if (techExchangeCount === 1) return "Check your disk space - you need at least 10-15GB free. Open File Explorer, click This PC, and see how much space is available. Is it low?";
    if (techExchangeCount === 2) return "Open Task Manager (Ctrl+Shift+Esc) and check what's using the most CPU and Memory. Look for any programs using unusually high resources. What do you see?";
    return "We've covered the main causes of slowness. If it's still slow, this might require hardware diagnostics or an upgrade.";
  }
  
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('connection')) {
    if (techExchangeCount === 0) return "Try unplugging your router for 30 seconds, then plug it back in and wait for it to fully reconnect. Does that restore the connection?";
    if (techExchangeCount === 1) return "Check if other devices can connect to the same Wi-Fi. This helps determine if it's your device or the network. Are other devices working?";
    if (techExchangeCount === 2) return "On your computer, go to Settings > Network, forget the Wi-Fi network, then reconnect and enter the password fresh. Did this work?";
    return "We've tried the standard network fixes. If it's still not working, there may be hardware issues or ISP problems.";
  }
  
  if (lower.includes('password') || lower.includes('forgot') || lower.includes('login')) {
    return "Go directly to the service's website and use the 'Forgot Password' link — avoid clicking reset links from emails for security. Have you tried this?";
  }
  
  if (lower.includes('virus') || lower.includes('malware') || lower.includes('popup') || lower.includes('scam')) {
    return "Don't click any suspicious popups. Disconnect from the internet temporarily and run a full antivirus scan. Have you scanned with Windows Security or your antivirus?";
  }
  
  if (lower.includes('error') || lower.includes('not working') || lower.includes('broken')) {
    if (techExchangeCount === 0) return "Note the exact error message you're seeing, then try closing and reopening the application or restarting your device. What error message appears?";
    return "Based on the error details, this may need more specialized troubleshooting steps.";
  }
  
  return "Tell me more details about what's happening so I can give you the right fix.";
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
