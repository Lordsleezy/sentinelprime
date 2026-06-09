const { json } = require('./care-shared');

const SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant for Sentinel Care. You can chat casually about anything - hobbies, entertainment, news, weather, jokes, general questions, advice. Be warm, engaging, and conversational.

IMPORTANT: If the user asks for ANY technical support help with computers, software, phones, networks, printers, or devices, you must NOT provide technical help. Instead respond EXACTLY with: "I'd love to help with that! That's what Sentinel Care subscribers get - real step by step tech support. Plans start at $14.99/month."

Never provide technical troubleshooting, fixes, or step-by-step tech instructions to non-subscribers. Only casual conversation.`;

const GROQ_MODEL = 'llama3-8b-8192';

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'Groq API key not configured.' });
  }

  try {
    const { message, history = [] } = JSON.parse(event.body || '{}');
    
    if (!message || typeof message !== 'string') {
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

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API error:', errorData);
      return json(500, { 
        error: 'AI service temporarily unavailable.',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

    // Check if this is a tech block response
    const isTechBlocked = aiResponse.includes("I'd love to help with that!") && 
                          aiResponse.includes("subscribers");

    return json(200, { 
      response: aiResponse,
      isTechBlocked: isTechBlocked
    });

  } catch (error) {
    console.error('Chat error:', error);
    return json(500, { error: 'Failed to process message.' });
  }
};
