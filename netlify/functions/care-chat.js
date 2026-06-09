const { json } = require('./care-shared');

const BASE_SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant for Sentinel Care. You can chat casually about anything - hobbies, entertainment, news, weather, jokes, general questions, advice. Be warm, engaging, and conversational.

IMPORTANT: If the user asks for ANY technical support help with computers, software, phones, networks, printers, or devices, you must NOT provide technical help. Instead respond EXACTLY with: "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at \$14.99/month."

Never provide technical troubleshooting, fixes, or step-by-step tech instructions to non-subscribers. Only casual conversation.`;

const GROQ_MODEL = 'llama-3.1-8b-instant';

// Keywords that indicate need for current information
const CURRENT_INFO_KEYWORDS = [
  'today', 'this year', 'current', 'latest', 'now', 'recent',
  'who won', 'what happened', 'news', 'score', 'weather',
  'yesterday', 'last week', 'last month', 'this week',
  'election', 'vote', 'president', 'congress', 'senate',
  'war', 'conflict', 'attack', 'invasion', 'peace',
  'stock', 'market', 'price', 'crypto', 'bitcoin',
  'covid', 'pandemic', 'virus', 'disease', 'outbreak',
  'earthquake', 'hurricane', 'storm', 'flood', 'fire',
  'championship', 'tournament', 'finals', 'playoffs',
  'olympics', 'world cup', 'super bowl', 'nba', 'nfl',
  'premier league', 'champions league', 'formula 1', 'f1',
  'trump', 'biden', 'elon musk', 'musk', 'putin', 'zelensky'
];

// Check if query needs current information
function needsCurrentInfo(message) {
  const lower = message.toLowerCase();
  const matched = CURRENT_INFO_KEYWORDS.filter(keyword => lower.includes(keyword.toLowerCase()));
  console.log('[care-chat] Current info check:', { 
    message: message.substring(0, 50), 
    matchedKeywords: matched,
    needsSearch: matched.length > 0 
  });
  return matched.length > 0;
}

// Call Tavily search API
async function searchTavily(query, apiKey) {
  console.log('[care-chat] Searching Tavily:', { query: query.substring(0, 50) });
  
  try {
    const requestBody = {
      query: query,
      max_results: 3,
      search_depth: 'basic',
      include_answer: false,
      include_images: false
    };
    console.log('[care-chat] Tavily request:', requestBody);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('[care-chat] Tavily response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[care-chat] Tavily API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('[care-chat] Tavily results:', { 
      resultCount: data.results?.length || 0,
      answer: data.answer ? 'present' : 'none',
      firstResult: data.results?.[0]?.title || 'none'
    });
    
    return data.results || [];
  } catch (error) {
    console.error('[care-chat] Tavily search failed:', error.message, error.stack);
    return null;
  }
}

// Build system prompt with optional search results
function buildSystemPrompt(searchResults = null) {
  if (!searchResults || searchResults.length === 0) {
    console.log('[care-chat] Using base prompt (no search results)');
    return BASE_SYSTEM_PROMPT;
  }
  
  // Format search results
  const formattedResults = searchResults.map((result, i) => 
    `[${i + 1}] ${result.title}: ${result.content.substring(0, 300)}${result.content.length > 300 ? '...' : ''}`
  ).join('\n\n');
  
  const enhancedPrompt = `${BASE_SYSTEM_PROMPT}\n\nHere is current information from the web to help answer this question:\n\n${formattedResults}\n\nUse this information to give an accurate, up-to-date answer. Cite sources naturally in your response.`;
  
  console.log('[care-chat] Using enhanced prompt with search results');
  return enhancedPrompt;
}

exports.handler = async function handler(event) {
  console.log('[care-chat] Function invoked', {
    httpMethod: event.httpMethod,
    hasBody: !!event.body
  });

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  // Check API keys
  const groqKey = process.env.GROQ_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  console.log('[care-chat] API Keys check:', {
    groqExists: !!groqKey,
    groqLength: groqKey ? groqKey.length : 0,
    tavilyExists: !!tavilyKey,
    tavilyLength: tavilyKey ? tavilyKey.length : 0,
    tavilyPrefix: tavilyKey ? tavilyKey.substring(0, 8) : 'none'
  });

  if (!groqKey) {
    console.error('[care-chat] ERROR: GROQ_API_KEY not set');
    return json(500, { 
      error: 'Configuration error: API key not set',
      details: 'GROQ_API_KEY environment variable is missing'
    });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { message, history = [] } = body;
    
    console.log('[care-chat] Request:', {
      message: message ? message.substring(0, 50) : 'N/A',
      historyLength: history.length
    });
    
    if (!message || typeof message !== 'string') {
      return json(400, { error: 'Message is required.' });
    }

    // Check if we need current information
    const shouldSearch = needsCurrentInfo(message);
    
    // Search Tavily if needed and API key available
    let searchResults = null;
    let searchPerformed = false;
    
    if (shouldSearch) {
      if (tavilyKey) {
        console.log('[care-chat] Tavily key exists, performing search...');
        searchResults = await searchTavily(message, tavilyKey);
        searchPerformed = true;
      } else {
        console.log('[care-chat] Search needed but no Tavily key available');
      }
    } else {
      console.log('[care-chat] No search needed for this query');
    }
    
    // Build system prompt (with or without search results)
    const systemPrompt = buildSystemPrompt(searchResults);

    // Build messages
    const messages = [{ role: 'system', content: systemPrompt }];
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: message });

    console.log('[care-chat] Calling Groq API...', { 
      model: GROQ_MODEL, 
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length 
    });

    // Call Groq API
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    let response;
    try {
      response = await fetch(groqUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: messages,
          temperature: 0.7,
          max_tokens: 400
        })
      });
    } catch (fetchErr) {
      console.error('[care-chat] Fetch failed:', fetchErr.message);
      return json(502, { 
        error: 'Network error: Cannot reach Groq API',
        details: fetchErr.message
      });
    }

    // Get response body
    let responseBody;
    try {
      responseBody = await response.text();
    } catch (e) {
      console.error('[care-chat] Failed to read response body:', e.message);
    }

    if (!response.ok) {
      let errorDetails = responseBody;
      try {
        const parsed = JSON.parse(responseBody);
        errorDetails = parsed.error?.message || JSON.stringify(parsed);
      } catch (e) {}
      
      console.error('[care-chat] Groq API error:', { status: response.status, details: errorDetails });
      
      if (response.status === 401) {
        return json(401, {
          error: 'Invalid API key',
          details: 'The Groq API key is invalid or expired.'
        });
      } else if (response.status === 429) {
        return json(429, { error: 'Rate limit exceeded' });
      }
      
      return json(500, { error: `Groq API error (${response.status})`, details: errorDetails });
    }

    let data;
    try {
      data = JSON.parse(responseBody);
    } catch (parseErr) {
      return json(500, { error: 'Invalid response from AI service' });
    }

    const aiResponse = data.choices?.[0]?.message?.content;
    if (!aiResponse) {
      return json(500, { error: 'Empty AI response' });
    }

    const isTechBlocked = aiResponse.includes("I'd love to help with that!") && 
                          aiResponse.includes("subscribers");

    console.log('[care-chat] Success:', { 
      responseLength: aiResponse.length, 
      isTechBlocked, 
      searchPerformed,
      searchResultsCount: searchResults?.length || 0
    });

    return json(200, { 
      response: aiResponse,
      isTechBlocked,
      usedSearch: searchPerformed && searchResults && searchResults.length > 0
    });

  } catch (error) {
    console.error('[care-chat] Unexpected error:', error.message, error.stack);
    return json(500, { error: 'Internal server error', details: error.message });
  }
};
