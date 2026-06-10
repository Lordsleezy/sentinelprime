const { createClient } = require('@supabase/supabase-js');

const GROQ_MODEL = 'llama3-70b-8192';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function inferCategory(topic) {
  const t = topic.toLowerCase();
  if (t.includes('linux') || t.includes('windows') || t.includes('install')) return 'Linux & OS';
  if (t.includes('virus') || t.includes('antivirus') || t.includes('protect') || t.includes('security')) return 'Security';
  if (t.includes('laptop') || t.includes('refurbished') || t.includes('budget') || t.includes('student')) return 'Hardware';
  if (t.includes('geek squad') || t.includes('worth it') || t.includes('alternative') || t.includes('cheaper')) return 'Tech Support';
  if (t.includes('speed') || t.includes('slow') || t.includes('optimize')) return 'Performance';
  if (t.includes('switch') || t.includes('beginners') || t.includes('guide')) return 'Guides';
  return 'Tech Tips';
}

function buildPrompt(topic) {
  return `Write a comprehensive, SEO-optimized blog article for sentinelprime.org targeting the keyword: "${topic}"

Requirements:
- Length: 900-1200 words
- Format: Markdown
- Structure:
  # [Compelling H1 title that includes the keyword naturally]
  
  [Opening paragraph: hook the reader, state what they'll learn - 2-3 sentences]
  
  ## [Section 1 H2]
  [2-3 paragraphs of practical, actionable content]
  
  ## [Section 2 H2]
  [2-3 paragraphs]
  
  ## [Section 3 H2]
  [2-3 paragraphs]
  
  ## [Section 4 H2 - optional, only if needed]
  [2-3 paragraphs]
  
  ## Conclusion
  [Wrap-up paragraph, 1-2 sentences mentioning Sentinel Prime as a resource]

Rules:
- Write in a clear, practical, helpful voice. Not robotic.
- Include 1-2 natural mentions of Sentinel Prime products where genuinely relevant (Sentinel Care for tech support, SentinelAI for local AI, Sentinel Drive for privacy). Use markdown links like [Sentinel Care](/care) or [SentinelAI](/sentinel-ai).
- Target the reader who is a non-expert everyday PC user.
- Do NOT include a table of contents or meta description.
- Do NOT add "---" dividers between sections.
- Output ONLY the article markdown, nothing else. No preamble like "Here's the article:".`;
}

exports.handler = async function (event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const adminKey = process.env.BLOG_ADMIN_KEY;
  if (adminKey) {
    const authHeader = event.headers['authorization'] || event.headers['x-admin-key'] || '';
    const provided = authHeader.replace(/^Bearer\s+/i, '');
    if (provided !== adminKey) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  let topic;
  try {
    const body = JSON.parse(event.body || '{}');
    topic = (body.topic || '').trim();
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!topic) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing required field: topic' }) };
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + groqKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert tech writer creating SEO blog articles for sentinelprime.org, a privacy-first tech company. Write practical, honest, helpful content for everyday PC users. Always output clean Markdown only.'
          },
          {
            role: 'user',
            content: buildPrompt(topic)
          }
        ],
        max_tokens: 2048,
        temperature: 0.72
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('[generate-blog] Groq error:', groqResponse.status, errText);
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Groq API error', detail: errText }) };
    }

    const groqData = await groqResponse.json();
    const content = (groqData.choices?.[0]?.message?.content || '').trim();

    if (!content) {
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Empty response from Groq' }) };
    }

    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1].replace(/\*\*/g, '').trim() : topic;

    const firstParaMatch = content.replace(/^#.+\n+/, '').match(/^(.+?)(?:\n\n|\n##)/s);
    const excerpt = firstParaMatch
      ? firstParaMatch[1].replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\*/g, '').trim().substring(0, 220)
      : topic;

    const baseSlug = slugify(title);
    const slug = baseSlug + '-' + Date.now().toString(36);
    const category = inferCategory(topic);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('blog_posts')
      .insert([{
        title,
        slug,
        excerpt,
        content,
        category,
        published: true
      }])
      .select()
      .single();

    if (error) {
      console.error('[generate-blog] Supabase insert error:', error);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Database error', detail: error.message }) };
    }

    console.log('[generate-blog] Created article:', { slug, title, category });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        post: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          category: data.category,
          url: 'https://sentinelprime.org/blog/' + data.slug
        }
      })
    };

  } catch (err) {
    console.error('[generate-blog] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error', detail: err.message })
    };
  }
};
