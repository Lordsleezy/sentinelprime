import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const modelStatus = document.querySelector("#modelStatus");
const webgpuWarning = document.querySelector("#webgpuWarning");
const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");

let engine = null;
let hasGreeted = false;
let conversationHistory = [];
let isWebGPUSupported = false;
let useGroqAPI = false;

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f32_1-MLC";

// System prompt for free users - friendly chat, tech support blocked
const SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant. You can chat about anything - hobbies, entertainment, news, weather, jokes, general questions, advice. Be warm, engaging, and conversational. However, if the user asks for technical support help with computers, software, phones, networks, printers, or devices, you must NOT provide technical help. Instead respond exactly with: "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at \$14.99/month." Never provide technical troubleshooting, fixes, or step-by-step tech instructions to non-subscribers.`;

// Check WebGPU support
function checkWebGPU() {
  if (!navigator.gpu) {
    return false;
  }
  return true;
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
  useGroqAPI = true;
  // Show subtle warning banner instead of chat message
  if (webgpuWarning) {
    webgpuWarning.classList.remove("hidden");
  }
  modelStatus.textContent = "Online (API)";
  showGreeting();
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
    hideLoadingScreen();
    
    // Fall back to Groq API
    useGroqAPI = true;
    modelStatus.textContent = "Online (API)";
    showGreeting();
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

// Enter key to send, Shift+Enter for new line
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.dispatchEvent(new Event("submit"));
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  
  const text = chatInput.value.trim();
  if (!text) return false;
  
  chatInput.value = "";
  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  
  if (useGroqAPI) {
    // Use Groq API via Netlify Function
    await generateGroqResponse(text);
  } else if (!engine) {
    // Fallback to Groq if engine not available
    useGroqAPI = true;
    await generateGroqResponse(text);
  } else {
    // Use WebLLM
    await generateWebLLMResponse(text);
  }
  
  return false;
});

async function generateWebLLMResponse(userText) {
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
    // Fall back to Groq
    useGroqAPI = true;
    await generateGroqResponse(userText);
  }
}

async function generateGroqResponse(userText) {
  try {
    const response = await fetch("/.netlify/functions/care-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        history: conversationHistory
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.response) {
      if (data.isTechBlocked) {
        showTechBlockMessage(data.response);
      } else {
        addMessage("assistant", data.response);
      }
      conversationHistory.push({ role: "assistant", content: data.response });
    } else {
      addMessage("assistant", "I'm having trouble connecting right now. Please try again!");
    }
  } catch (error) {
    console.error("Groq API error:", error);
    addMessage("assistant", "I'm having trouble connecting right now. Please try again!");
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

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

init();
