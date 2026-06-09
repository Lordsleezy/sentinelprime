const { json } = require('./care-shared');

const SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant for Sentinel Care. You can chat casually about anything - hobbies, entertainment, news, weather, jokes, general questions, advice. Be warm, engaging, and conversational.

IMPORTANT: If the user asks for ANY technical support help with computers, software, phones, networks, printers, or devices, you must NOT provide technical help. Instead respond EXACTLY with: "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at $14.99/month."

Never provide technical troubleshooting, fixes, or step-by-step tech instructions to non-subscribers. Only casual conversation.`;

const GROQ_MODEL = 'llama-3.1-8b-instant';

exports.handler = async function handler(event) {
  console.log('[care-chat] Function invoked', {
    httpMethod: event.httpMethod,
    hasBody: !!event.body,
    envKeys: Object.keys(process.env).filter(k => k.includes('GROQ') || k.includes('API')).join(', ')
  });

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  // Check API key
  const apiKey = process.env.GROQ_API_KEY;
  console.log('[care-chat] API Key check:', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0,
    prefix: apiKey ? apiKey.substring(0, 10) + '...' : 'N/A'
  });

  if (!apiKey) {
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
      hasMessage: !!message,
      messagePreview: message ? message.substring(0, 30) : 'N/A',
      historyLength: history.length
    });
    
    if (!message || typeof message !== 'string') {
      return json(400, { error: 'Message is required.' });
    }

    // Build messages
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: message });

    console.log('[care-chat] Calling Groq API...');

    // Call Groq API
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    let response;
    try {
      response = await fetch(groqUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: messages,
          temperature: 0.7,
          max_tokens: 300
        })
      });
    } catch (fetchErr) {
      console.error('[care-chat] Fetch failed:', fetchErr.message, fetchErr.code);
      return json(502, { 
        error: 'Network error: Cannot reach Groq API',
        details: fetchErr.message,
        code: fetchErr.code || 'UNKNOWN'
      });
    }

    console.log('[care-chat] Groq response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    // Get response body even for error status
    let responseBody;
    try {
      responseBody = await response.text();
      console.log('[care-chat] Response body:', responseBody.substring(0, 500));
    } catch (e) {
      console.error('[care-chat] Failed to read response body:', e.message);
    }

    if (!response.ok) {
      // Parse error details
      let errorDetails = responseBody;
      try {
        const parsed = JSON.parse(responseBody);
        errorDetails = parsed.error?.message || JSON.stringify(parsed);
      } catch (e) {
        // Keep raw body if JSON parse fails
      }
      
      console.error('[care-chat] Groq API error:', {
        status: response.status,
        details: errorDetails
      });
      
      // Return specific error based on status
      if (response.status === 401) {
        return json(401, {
          error: 'Invalid API key',
          details: 'The Groq API key is invalid or expired. Check GROQ_API_KEY in Netlify environment variables.'
        });
      } else if (response.status === 429) {
        return json(429, {
          error: 'Rate limit exceeded',
          details: 'Too many requests. Please wait a moment and try again.'
        });
      } else if (response.status >= 500) {
        return json(502, {
          error: 'Groq API server error',
          details: `Groq returned ${response.status}: ${errorDetails}`
        });
      }
      
      return json(500, {
        error: `Groq API error (${response.status})`,
        details: errorDetails
      });
    }

    // Parse successful response
    let data;
    try {
      data = JSON.parse(responseBody);
    } catch (parseErr) {
      console.error('[care-chat] Failed to parse success JSON:', parseErr.message);
      return json(500, {
        error: 'Invalid response from AI service',
        details: 'Failed to parse API response'
      });
    }

    const aiResponse = data.choices?.[0]?.message?.content;
    if (!aiResponse) {
      console.error('[care-chat] No response content:', data);
      return json(500, {
        error: 'Empty AI response',
        details: 'The API returned no content'
      });
    }

    const isTechBlocked = aiResponse.includes("I'd love to help with that!") && 
                          aiResponse.includes("subscribers");

    console.log('[care-chat] Success:', {
      responseLength: aiResponse.length,
      isTechBlocked
    });

    return json(200, { 
      response: aiResponse,
      isTechBlocked
    });

  } catch (error) {
    console.error('[care-chat] Unexpected error:', error.message, error.stack);
    return json(500, { 
      error: 'Internal server error',
      details: error.message
    });
  }
};
