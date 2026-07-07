const { createClient } = require('@supabase/supabase-js');

const GROQ_MODEL = 'llama3-70b-8192';

const ROTATING_KEYWORDS = [
  'how to remove malware from Windows 10',
  'best free VPN for beginners',
  'how to set up a home network',
  'dual boot Windows and Linux guide',
  'how to back up your computer for free',
  'best open source alternatives to Windows software',
  'how to recover deleted files on Windows',
  'Linux vs Windows for everyday users',
  'how to secure your home WiFi network',
  'best free productivity apps for students',
  'how to clean up a slow laptop',
  'what is a VPN and do you need one',
  'how to transfer files from old PC to new PC',
  'best password managers free 2026',
  'how to update drivers on Windows 10',
  'is Windows 11 worth upgrading to',
  'how to fix a computer that wont turn on',
  'best free video editing software for beginners',
  'how to stop Windows from tracking you',
  'best refurbished desktop PCs 2026',
  'how to use Linux terminal for beginners',
  'free alternatives to Microsoft Office',
  'how to protect kids online parental controls',
  'best cheap laptops under 300 dollars',
  'how to run Android apps on Windows',
  'what is local AI and why it matters',
  'how to encrypt your hard drive for free',
  'best browser for privacy 2026',
  'how to spot a phishing email',
  'computer buying guide for seniors'
];

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
  if (t.includes('linux') || t.includes('windows') || t.includes('install') || t.includes('dual boot')) return 'Linux & OS';
  if (t.includes('virus') || t.includes('antivirus') || t.includes('protect') || t.includes('security') || t.includes('vpn') || t.includes('phishing') || t.includes('malware') || t.includes('encrypt') || t.includes('password')) return 'Security';
  if (t.includes('laptop') || t.includes('refurbished') || t.includes('budget') || t.includes('desktop') || t.includes('buying')) return 'Hardware';
  if (t.includes('geek squad') || t.includes('support') || t.includes('alternative')) return 'Tech Support';
  if (t.includes('speed') || t.includes('slow') || t.includes('clean') || t.includes('optimize')) return 'Performance';
  if (t.includes('guide') || t.includes('beginners') || t.includes('switch') || t.includes('how to')) return 'Guides';
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
- Include 1-2 natural mentions of Sentinel Prime products where genuinely relevant: SentinelCare for tech support, Sentinel Prospects for construction opportunity intelligence, Sentinel Guardian for security, or Sentinel Linux for privacy-first computing. Use links like [SentinelCare](/care), [Sentinel Prospects](https://prospects.sentinelprime.org), [Sentinel Guardian](/guardian), or [Sentinel Linux](/products#linux).
- Target the reader who is a non-expert everyday PC user.
- Do NOT include a table of contents or meta description.
- Do NOT add "---" dividers between sections.
- Output ONLY the article markdown, nothing else. No preamble like "Here's the article:".`;
}

async function getUsedKeywords(supabase) {
  try {
    const { data } = await supabase
      .from('blog_posts')
      .select('title')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map(r => r.title.toLowerCase());
  } catch (e) {
    return [];
  }
}

async function generateAndSave(topic) {
  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!groqKey || !supabaseUrl || !supabaseKey) {
    throw new Error('Missing environment variables: GROQ_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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
        { role: 'user', content: buildPrompt(topic) }
      ],
      max_tokens: 2048,
      temperature: 0.72
    })
  });

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    throw new Error('Groq API error ' + groqResponse.status + ': ' + errText);
  }

  const groqData = await groqResponse.json();
  const content = (groqData.choices?.[0]?.message?.content || '').trim();
  if (!content) throw new Error('Empty response from Groq');

  const h1Match = content.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1].replace(/\*\*/g, '').trim() : topic;

  const firstParaMatch = content.replace(/^#.+\n+/, '').match(/^(.+?)(?:\n\n|\n##)/s);
  const excerpt = firstParaMatch
    ? firstParaMatch[1].replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\*/g, '').trim().substring(0, 220)
    : topic;

  const baseSlug = slugify(title);
  const slug = baseSlug + '-' + Date.now().toString(36);
  const category = inferCategory(topic);

  const { data, error } = await supabase
    .from('blog_posts')
    .insert([{ title, slug, excerpt, content, category, published: true }])
    .select()
    .single();

  if (error) throw new Error('Supabase insert error: ' + error.message);

  return { title: data.title, slug: data.slug, category: data.category };
}

exports.handler = async function (event) {
  console.log('[blog-weekly] Scheduled generation triggered');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    const usedTitles = supabase ? await getUsedKeywords(supabase) : [];

    const unused = ROTATING_KEYWORDS.filter(kw => {
      const kwLower = kw.toLowerCase();
      return !usedTitles.some(t => t.includes(kwLower.split(' ').slice(0, 3).join(' ')));
    });

    const pool = unused.length > 0 ? unused : ROTATING_KEYWORDS;
    const topic = pool[Math.floor(Math.random() * pool.length)];

    console.log('[blog-weekly] Generating article for topic:', topic);

    const result = await generateAndSave(topic);

    console.log('[blog-weekly] Success:', result);
    return { statusCode: 200, body: JSON.stringify({ success: true, ...result }) };

  } catch (err) {
    console.error('[blog-weekly] Error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
