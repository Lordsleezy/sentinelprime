const { json } = require('./care-shared');

const SYSTEM_PROMPT = `You are Sentinel, a friendly AI assistant for Sentinel Care. You can chat casually about anything — news, weather, jokes, general questions. However if the user asks for ANY technical support help with computers, software, printers, phones, networks, or devices, respond ONLY with: I'd love to help with that! Technical support is available to Sentinel Care subscribers. Plans start at $14.99/month — cancel anytime. Never provide tech support to non-subscribers. Be warm, friendly and conversational for everything else.`;

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'Anthropic API key not configured.' });
  }

  try {
    const { message, history = [] } = JSON.parse(event.body || '{}');
    
    if (!message || typeof message !== 'string') {
      return json(400, { error: 'Message is required.' });
    }

    // Build messages array from history + current message
    const messages = [];
    
    // Add history (last 10 messages to stay within token limits)
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

    // Call Anthropic Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', errorData);
      return json(500, { 
        error: 'AI service temporarily unavailable.',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || 'I apologize, I could not generate a response.';

    return json(200, { 
      response: aiResponse,
      isTechBlocked: aiResponse.includes('Technical support is available to Sentinel Care subscribers')
    });

  } catch (error) {
    console.error('Chat error:', error);
    return json(500, { error: 'Failed to process message.' });
  }
};
