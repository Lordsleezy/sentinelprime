const { json } = require('./care-shared');

const SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant for Sentinel Care. You can chat casually about anything - hobbies, entertainment, news, weather, jokes, general questions, advice. Be warm, engaging, and conversational.

IMPORTANT: If the user asks for ANY technical support help with computers, software, phones, networks, printers, or devices, you must NOT provide technical help. Instead respond EXACTLY with: "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at $14.99/month."

Never provide technical troubleshooting, fixes, or step-by-step tech instructions to non-subscribers. Only casual conversation.`;

const GROQ_MODEL = 'llama3-8b-8192';

exports.handler = async function handler(event) {
  // Log function invocation
  console.log('care-chat function invoked', {
    httpMethod: event.httpMethod,
    hasBody: !!event.body,
    timestamp: new Date().toISOString()
  });

  if (event.httpMethod !== 'POST') {
    console.log('Rejected: Method not allowed', event.httpMethod);
    return json(405, { error: 'Method not allowed.' });
  }

  // Check API key
  const apiKey = process.env.GROQ_API_KEY;
  console.log('GROQ_API_KEY check:', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0,
    startsWith: apiKey ? apiKey.substring(0, 7) : 'N/A'
  });

  if (!apiKey) {
    console.error('ERROR: GROQ_API_KEY not configured in environment variables');
    return json(500, { error: 'Groq API key not configured.' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { message, history = [] } = body;
    
    console.log('Request body parsed:', {
      hasMessage: !!message,
      messageType: typeof message,
      historyLength: history.length
    });
    
    if (!message || typeof message !== 'string') {
      console.log('Rejected: Message missing or invalid');
      return json(400, { error: 'Message is required.' });
    }

    // Build messages array from history + current message
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];
    
    // Add history (last 10 messages)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    console.log('Calling Groq API...', {
      model: GROQ_MODEL,
      messageCount: messages.length
    });

    // Call Groq API
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    console.log('Groq URL:', groqUrl);

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
    } catch (fetchError) {
      console.error('FETCH ERROR:', {
        message: fetchError.message,
        code: fetchError.code,
        type: fetchError.type,
        stack: fetchError.stack
      });
      return json(500, { 
        error: 'Failed to connect to Groq API.',
        details: fetchError.message
      });
    }

    console.log('Groq API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('Failed to parse error response:', e.message);
      }
      
      console.error('Groq API error response:', {
        status: response.status,
        errorData: JSON.stringify(errorData)
      });
      
      return json(500, { 
        error: 'AI service temporarily unavailable.',
        details: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse success response:', parseError.message);
      return json(500, { 
        error: 'Failed to parse AI response.'
      });
    }

    console.log('Groq API success:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length
    });

    const aiResponse = data.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

    // Check if this is a tech block response
    const isTechBlocked = aiResponse.includes("I'd love to help with that!") && 
                          aiResponse.includes("subscribers");

    console.log('Sending response:', {
      responseLength: aiResponse.length,
      isTechBlocked
    });

    return json(200, { 
      response: aiResponse,
      isTechBlocked: isTechBlocked
    });

  } catch (error) {
    console.error('UNEXPECTED ERROR:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return json(500, { error: 'Failed to process message: ' + error.message });
  }
};
