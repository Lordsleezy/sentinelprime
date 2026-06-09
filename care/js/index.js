import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const modelStatus = document.querySelector('#modelStatus');
const chatMessages = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const subscribePrompt = document.querySelector('#subscribePrompt');

// Tech support keywords - if any match, block and show subscription
const techSupportKeywords = [
  'fix', 'broken', 'error', 'not working', "won't", 'wont', 'does not work', 'doesnt work', 'isnt working', "isn't working",
  'issue', 'problem', 'troubleshoot', 'virus', 'malware', 'printer', 'password', 'forgot password',
  'slow computer', 'freeze', 'crash', 'blue screen', 'wifi', 'internet', 'connection', 
  'software', 'install', 'update', 'driver', 'email', 'outlook', 'gmail', 'windows', 'mac',
  'backup', 'recovery', 'data', 'hard drive', 'disk', 'storage', 'printer not', "can't print", 
  'cant print', 'virus removal', 'hacked', 'compromised', 'security', 'popup', 'ads', 'browser',
  'chrome', 'firefox', 'safari', 'edge', 'zoom', 'teams', 'slack', 'excel', 'word', 'powerpoint',
  'spreadsheets', 'documents', 'files', 'sync', 'cloud', 'onedrive', 'google drive', 'dropbox',
  'icloud', 'antivirus', 'firewall', 'network', 'router', 'modem', 'ethernet', 'bluetooth',
  'mouse', 'keyboard', 'monitor', 'screen', 'display', 'battery', 'charging', 'power', 'boot',
  'startup', 'login', 'sign in', 'account locked', 'two factor', '2fa', 'authentication',
  'certificate', 'ssl', 'vpn', 'remote desktop', 'rdp', 'ssh', 'terminal', 'command line',
  'bash', 'powershell', 'registry', 'system32', 'dll', 'exe', 'application', 'app', 'program',
  'uninstall', 'remove', 'delete', 'cleanup', 'disk cleanup', 'defrag', 'fragmented', 
  'corrupted', 'damaged', 'failing', 'hardware', 'cpu', 'ram', 'memory', 'graphics', 'gpu',
  'motherboard', 'cpu fan', 'overheating', 'temperature', 'bsod', 'kernel', 'panic',
  'exception', 'fault', 'timeout', 'unreachable', 'dns', 'ip address', 'ping', 'packet loss',
  'bandwidth', 'speed test', 'latency', 'lag', 'stutter', 'frame rate', 'fps', 'my computer',
  'my laptop', 'my phone', 'my device', 'virus scan', 'malware scan', 'clean install',
  'reinstall', 'factory reset', 'system restore', 'safe mode', 'bios', 'uefi', 'firmware'
];

let generator;
let hasGreeted = false;
let conversationHistory = [];

async function init() {
  await loadModel();
  showGreeting();
}

function showGreeting() {
  if (hasGreeted) return;
  hasGreeted = true;
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
  if (isTechSupportRequest(text)) {
    // HARD BLOCK - no tech help, show subscription immediately
    const blockMsg = "I'd love to help with that! Technical support is available to Sentinel Care subscribers. Plans start at \$14.99/month — cancel anytime.";
    addMessage('assistant', blockMsg);
    conversationHistory.push({ role: 'assistant', content: blockMsg });
    subscribePrompt.classList.remove('hidden');
    return false;
  }
  
  // Not tech support - generate conversational response
  const answer = await generateResponse(text);
  addMessage('assistant', answer);
  conversationHistory.push({ role: 'assistant', content: answer });
  
  return false;
});

function isTechSupportRequest(text) {
  const lower = text.toLowerCase();
  return techSupportKeywords.some(keyword => lower.includes(keyword.toLowerCase()));
}

async function generateResponse(userText) {
  if (!generator) {
    return fallbackResponse(userText);
  }
  
  try {
    // Build prompt with conversation history for context
    let prompt = '<|system|>\nYou are Sentinel, a friendly and conversational AI assistant. You chat about casual topics like weather, news, hobbies, entertainment, jokes, general knowledge, advice, etc. You do NOT provide tech support. Keep responses natural, warm, and engaging.</s>\n';
    
    // Add recent conversation history (last 8 messages)
    const recentHistory = conversationHistory.slice(-8);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}</s>\n`;
      } else {
        prompt += `<|assistant|>\n${msg.content}</s>\n`;
      }
    }
    
    // Add current user message
    prompt += `<|user|>\n${userText}</s>\n<|assistant|>\n`;
    
    const output = await generator(prompt, { 
      max_new_tokens: 180, 
      temperature: 0.75, 
      do_sample: true,
      top_k: 50,
      top_p: 0.9,
      repetition_penalty: 1.1
    });
    
    const generated = output?.[0]?.generated_text || '';
    const cleaned = cleanAnswer(generated.replace(prompt, ''));
    return cleaned || fallbackResponse(userText);
  } catch (error) {
    console.error('Generation error:', error);
    return fallbackResponse(userText);
  }
}

function fallbackResponse(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('weather')) {
    return "I don't have real-time weather data, but I can chat about climate patterns, seasons, or help you find a good weather app! What's on your mind?";
  }
  if (lower.includes('news') || lower.includes('happening') || lower.includes('current events')) {
    return "I don't have live news feeds, but I'm happy to discuss current topics, explain concepts, or chat about pretty much anything. What are you interested in?";
  }
  if (lower.includes('how are you') || lower.includes('how do you do')) {
    return "I'm doing well, thanks for asking! Ready to chat, answer questions, or help out however I can. How about you?";
  }
  if (lower.includes('joke') || lower.includes('funny')) {
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything! 😄",
      "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
      "Why don't eggs tell jokes? They'd crack each other up! 🥚",
      "What do you call a fake noodle? An impasta! 🍝"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)] + " Got any favorites?";
  }
  if (lower.includes('hello') || lower.includes('hi ') || lower === 'hi' || lower.includes('hey')) {
    return "Hey there! Nice to meet you. What's on your mind today?";
  }
  if (lower.includes('your name') || lower.includes('who are you')) {
    return "I'm Sentinel! I'm here to chat about anything — general questions, hobbies, entertainment, or just casual conversation. What would you like to talk about?";
  }
  if (lower.includes('hobby') || lower.includes('hobbies')) {
    return "I enjoy learning about all sorts of topics! What about you? Any hobbies or interests you'd like to share or discuss?";
  }
  if (lower.includes('movie') || lower.includes('film') || lower.includes('show') || lower.includes('tv')) {
    return "I love talking about movies and shows! What genres do you enjoy? Any recent favorites or recommendations?";
  }
  if (lower.includes('book') || lower.includes('read')) {
    return "Books are great! What do you like to read? Fiction, non-fiction, sci-fi, mystery? Any recent reads you'd recommend?";
  }
  if (lower.includes('music') || lower.includes('song') || lower.includes('band')) {
    return "Music is wonderful! What kind of music do you enjoy? Any favorite artists or genres?";
  }
  if (lower.includes('food') || lower.includes('cook') || lower.includes('eat') || lower.includes('recipe')) {
    return "Food is always a good topic! What kind of cuisine do you enjoy? Do you like to cook or prefer dining out?";
  }
  if (lower.includes('travel') || lower.includes('vacation') || lower.includes('trip')) {
    return "Travel is exciting! Any favorite destinations or places you'd love to visit someday?";
  }
  if (lower.includes('sport') || lower.includes('game') || lower.includes('team')) {
    return "Sports can be really engaging! Do you follow any particular teams or play any sports yourself?";
  }
  if (lower.includes('help') || lower.includes('what can you do')) {
    return "I can chat about general topics — hobbies, entertainment, answer questions, discuss ideas, or just have a casual conversation. What would you like to talk about?";
  }
  
  return "That's interesting! Tell me more, or ask me anything — I'm here to chat about whatever you'd like.";
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
