import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const modelStatus = document.querySelector("#modelStatus");
const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");

let engine = null;
let hasGreeted = false;
let conversationHistory = [];
let isWebGPUSupported = false;

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f32_1-MLC";

// System prompt for free users - friendly chat, tech support blocked
const SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant. You can chat about anything - hobbies, entertainment, news, weather, jokes, general questions, advice. Be warm, engaging, and conversational. However, if the user asks for technical support help with computers, software, phones, networks, printers, or devices, you must NOT provide technical help. Instead respond exactly with: "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at \$14.99/month." Never provide technical troubleshooting, fixes, or step-by-step tech instructions to non-subscribers.`;

// Check WebGPU support
function checkWebGPU() {
  if (!navigator.gpu) {
    return false;
  }
  try {
    // Try to request an adapter
    return true;
  } catch {
    return false;
  }
}

async function init() {
  isWebGPUSupported = checkWebGPU();
  
  if (!isWebGPUSupported) {
    showWebGPUFallback();
    return;
  }
  
  await loadModel();
  showGreeting();
}

function showWebGPUFallback() {
  modelStatus.textContent = "Limited";
  modelStatus.classList.add("limited");
  
  const fallbackMsg = "Your browser doesn't support our AI — try Chrome or Edge for the full experience. I can still chat with you using basic responses!";
  addMessage("assistant", fallbackMsg);
  
  // Use rule-based responses instead
  engine = null;
}

async function loadModel() {
  // Show loading message on first visit
  const hasLoadedBefore = localStorage.getItem("sentinel-ai-loaded");
  
  if (!hasLoadedBefore) {
    showLoadingScreen();
  }
  
  modelStatus.textContent = "Loading...";
  
  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        console.log("Loading progress:", progress);
        if (!hasLoadedBefore) {
          updateLoadingProgress(progress);
        }
      }
    });
    
    // Mark as loaded
    localStorage.setItem("sentinel-ai-loaded", "true");
    hideLoadingScreen();
    
    modelStatus.textContent = "Online";
  } catch (error) {
    console.error("Model load error:", error);
    modelStatus.textContent = "Error";
    hideLoadingScreen();
    
    // Fall back to rule-based
    showWebGPUFallback();
  }
}

function showLoadingScreen() {
  // Create loading overlay
  const overlay = document.createElement("div");
  overlay.id = "ai-loading-overlay";
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <h3>Loading Sentinel AI</h3>
      <p>This takes about 30 seconds the first time, then it's instant.</p>
      <div class="loading-progress">
        <div class="loading-bar"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateLoadingProgress(progress) {
  const bar = document.querySelector("#ai-loading-overlay .loading-bar");
  if (bar && progress.progress) {
    bar.style.width = `${progress.progress * 100}%`;
  }
}

function hideLoadingScreen() {
  const overlay = document.querySelector("#ai-loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}

function showGreeting() {
  if (hasGreeted) return;
  hasGreeted = true;
  const welcomeMsg = "Hi there! I'm Sentinel. I can chat about anything — news, weather, hobbies, general questions, or just shoot the breeze. What would you like to talk about?";
  addMessage("assistant", welcomeMsg);
  conversationHistory.push({ role: "assistant", content: welcomeMsg });
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  
  const text = chatInput.value.trim();
  if (!text) return false;
  
  chatInput.value = "";
  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  
  if (!isWebGPUSupported || !engine) {
    // Use rule-based fallback
    const response = getRuleBasedResponse(text);
    addMessage("assistant", response);
    conversationHistory.push({ role: "assistant", content: response });
  } else {
    // Use WebLLM
    await generateResponse(text);
  }
  
  return false;
});

async function generateResponse(userText) {
  try {
    // Build messages with system prompt
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      { role: "user", content: userText }
    ];
    
    const reply = await engine.chat.completions.create({
      messages: messages,
      temperature: 0.7,
      max_tokens: 200
    });
    
    const response = reply.choices[0].message.content;
    
    // Check if response contains tech block message
    if (response.includes("I'd love to help with that!") && response.includes("subscribers")) {
      showTechBlockMessage(response);
    } else {
      addMessage("assistant", response);
    }
    
    conversationHistory.push({ role: "assistant", content: response });
  } catch (error) {
    console.error("Generation error:", error);
    addMessage("assistant", "I'm having trouble thinking right now. Could you try again?");
  }
}

function showTechBlockMessage(message) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message assistant";
  msgDiv.innerHTML = `
    ${message}
    <div style="margin-top:12px;">
      <a class="button" href="/care/checkout">Subscribe</a>
    </div>
  `;
  chatMessages.append(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getRuleBasedResponse(text) {
  const lower = text.toLowerCase();
  
  // Check if it's a tech support question
  const techKeywords = [
    "fix", "broken", "error", "not working", "won't", "wont", "issue", "problem",
    "troubleshoot", "virus", "malware", "printer", "password", "forgot",
    "slow", "freeze", "crash", "blue screen", "wifi", "internet", "connection",
    "software", "install", "update", "driver", "email", "outlook", "windows",
    "backup", "recovery", "hard drive", "disk", "storage", "can't print",
    "hacked", "security", "popup", "browser", "network", "router", "monitor",
    "mouse", "keyboard", "battery", "charging", "reinstall", "uninstall"
  ];
  
  const isTechQuestion = techKeywords.some(kw => lower.includes(kw));
  
  if (isTechQuestion) {
    const blockMsg = "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at $14.99/month.";
    setTimeout(() => showTechBlockMessage(blockMsg), 100);
    return blockMsg;
  }
  
  // Casual conversation fallbacks
  if (lower.includes("how are you") || lower.includes("how do you do")) {
    return "I'm doing well, thanks for asking! Ready to chat about whatever's on your mind. How about you?";
  }
  if (lower.includes("hows your day") || lower.includes("how's your day")) {
    return "My day's going great! Thanks for asking. How's yours been?";
  }
  if (lower.includes("hello") || lower.includes("hi ") || lower === "hi" || lower.includes("hey")) {
    return "Hey there! Nice to meet you. What would you like to chat about?";
  }
  if (lower.includes("weather")) {
    return "I can't check the live weather, but I'd love to hear how it is where you are! Or we can chat about climate, seasons, or travel destinations. What's on your mind?";
  }
  if (lower.includes("joke") || lower.includes("funny")) {
    return "Here's one: Why don't scientists trust atoms? Because they make up everything! 😄 Got any favorites?";
  }
  if (lower.includes("movie") || lower.includes("film") || lower.includes("tv")) {
    return "I love discussing movies! What genres do you enjoy? Any recent favorites or recommendations?";
  }
  if (lower.includes("music") || lower.includes("song")) {
    return "Music is great! What kind of music do you enjoy? Any favorite artists?";
  }
  if (lower.includes("book") || lower.includes("read")) {
    return "Books are wonderful! What do you like to read? Fiction, non-fiction, any genres you love?";
  }
  if (lower.includes("hobby") || lower.includes("hobbies")) {
    return "I enjoy learning about different topics! What about you? Any hobbies you'd like to share?";
  }
  if (lower.includes("food") || lower.includes("cook") || lower.includes("eat")) {
    return "Food is always a fun topic! What kind of cuisine do you enjoy? Do you like cooking?";
  }
  if (lower.includes("travel") || lower.includes("vacation")) {
    return "Travel is exciting! Any favorite places you've been or dream destinations?";
  }
  if (lower.includes("news") || lower.includes("current")) {
    return "I don't have live news feeds, but I'd love to discuss current topics or hear your thoughts on what's happening in the world!";
  }
  if (lower.includes("who are you") || lower.includes("your name")) {
    return "I'm Sentinel! I'm here to chat about anything — hobbies, entertainment, general questions, or just casual conversation. What would you like to talk about?";
  }
  
  return "That's interesting! Tell me more, or ask me anything — I'm here to chat about whatever you'd like.";
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

init();
