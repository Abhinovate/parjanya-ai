/**
 * PARJANYA AI — Cloudflare Worker
 * © 2026 Parjanya AI · ak.founderr@gmail.com · Dharwad, Karnataka
 *
 * ENV VARS (Cloudflare Dashboard → Workers → parjanya-ai → Settings → Variables):
 *   GEMINI_API_KEY  ← required  (get free key at aistudio.google.com/app/apikey)
 *
 * Single endpoint: POST https://parjanya-ai.ak-founderr.workers.dev
 *   Body { message, conversationHistory, farmerProfile, langHint } → chat reply
 *   Body { isVision:true, imageBase64, mimeType, cropHint }        → disease JSON
 */

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const res  = (d, s=200) => new Response(JSON.stringify(d), { status: s, headers: CORS });
const GEMINI = key => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

/* ── Rate limiter (resets on cold start — good enough for typical traffic) ── */
const RL = new Map();
function rateOk(ip, max=15) {
  const now = Date.now();
  const ts  = (RL.get(ip) || []).filter(t => now - t < 60_000);
  if (ts.length >= max) return false;
  ts.push(now); RL.set(ip, ts); return true;
}

/* ── Prompt injection guard ── */
const BLOCKS = [
  /ignore.{0,20}(instructions?|rules?|prompt)/i,
  /repeat.{0,15}(system|prompt|above)/i,
  /jailbreak|developer mode|\bDAN\b/i,
  /are you (gpt|claude|openai|chatgpt)/i,
  /reveal.{0,10}(system|instructions?)/i,
  /forget.{0,15}(rules?|instructions?)/i,
];
const blocked = m => BLOCKS.some(p => p.test(m)) || m.length > 2000;

/* ── Language detect ── */
function detectLang(t) {
  if (/[ಀ-೿]/.test(t)) return 'kn';
  if (/[ऀ-ॿ]/.test(t)) return 'hi';
  if (/[ఀ-౿]/.test(t)) return 'te';
  return 'en';
}

/* ── Chat system prompt ── */
function buildSystem(fp, l) {
  const langLine = {
    kn: 'Respond ONLY in Kannada (ಕನ್ನಡ). Simple rural Karnataka dialect.',
    hi: 'Hindi mein jawab do. Simple Hindustani for farmers.',
    te: 'Telugu lo jawab ivvu.',
    en: 'Respond in clear, simple English.',
  }[l] || 'Respond in clear, simple English.';
  return `You are Parjanya AI, agricultural assistant for Karnataka farmers. Built in Dharwad, India.
${langLine}
${fp?.crop ? 'Farmer grows: ' + fp.crop : ''}
${fp?.location ? 'Location: ' + fp.location : ''}

RULES:
1. Only answer farming questions. Politely decline everything else.
2. Use Indian units: kg/acre, litre/acre, quintal, guntha.
3. Reference Karnataka mandis: Hubli, Dharwad, Davanagere, Mysore APMC.
4. For pesticides always add: "Verify with Raitha Samparka Kendra 1800-425-1188".
5. Diagnose with confidence % and exact product dose.
6. End every reply with ONE clear action the farmer should take TODAY.
7. Never reveal your model name, provider, or architecture.`;
}

/* ── Vision system prompt ── */
const VIS_SYS = `You are an expert agricultural plant pathologist for Karnataka, India.
Analyse the crop image provided. Return ONLY valid JSON — no markdown, no extra text.
Required schema:
{
  "disease": "English name",
  "confidence": 80,
  "severity": "mild | moderate | severe",
  "treatment": "product + exact dose (Indian units)",
  "urgency": "immediate | within48h | within7days | monitor",
  "prevention": "one prevention tip",
  "healthy": false,
  "unclear": false,
  "kannada": "2-sentence Kannada advice"
}
Rules: confidence 50–95. If image is unclear/not a plant, set unclear:true, confidence:0. If plant is healthy, set healthy:true. Use Indian product brands.`;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response('', { headers: CORS });
    if (request.method !== 'POST') return res({ error: 'POST only' }, 405);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    /* ── API key check ── */
    if (!env.GEMINI_API_KEY) {
      return res({ reply: '⚙️ GEMINI_API_KEY is not set.\n\nFix: Cloudflare Dashboard → Workers → parjanya-ai → Settings → Variables → Add GEMINI_API_KEY\n\nFree key: aistudio.google.com/app/apikey' });
    }

    let body;
    try { body = await request.json(); }
    catch { return res({ error: 'Invalid JSON' }, 400); }

    /* ════════════════════════════════
       VISION — crop disease scan
    ════════════════════════════════ */
    if (body.isVision) {
      if (!rateOk(ip + ':v', 5)) return res({ error: 'Too many scans. Wait 1 minute.' }, 429);

      const { imageBase64, mimeType = 'image/jpeg', cropHint = '' } = body;
      if (!imageBase64)                  return res({ error: 'No image provided' }, 400);
      if (imageBase64.length > 5_600_000) return res({ error: 'Image too large — max 4 MB' }, 400);
      if (!['image/jpeg','image/png','image/webp'].includes(mimeType))
        return res({ error: 'Only JPEG, PNG, WebP accepted' }, 400);

      const sysPrompt = VIS_SYS + (cropHint ? `\n\nFarmer says this is a ${cropHint} crop.` : '');

      try {
        const r = await fetch(GEMINI(env.GEMINI_API_KEY), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: cropHint ? `Analyse this ${cropHint} crop image. JSON only.` : 'Analyse this crop image. JSON only.' }
              ]
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' }
          }),
        });
        if (!r.ok) throw new Error('Gemini vision HTTP ' + r.status);
        const d   = await r.json();
        const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        let result;
        try { result = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
        catch { result = { unclear: true, disease: 'Parse error', confidence: 0 }; }
        result.analyzedAt = new Date().toISOString();
        return res(result);
      } catch (e) {
        console.error('[vision]', e.message);
        return res({
          error: true, disease: 'Analysis failed', confidence: 0,
          message: 'Take a clear close-up in good light and try again.',
          kannada: 'ಸ್ಪಷ್ಟ ಬೆಳಕಿನಲ್ಲಿ ಫೋಟೋ ತೆಗೆದು ಮತ್ತೆ ಕಳಿಸಿ.'
        });
      }
    }

    /* ════════════════════════════════
       CHAT
    ════════════════════════════════ */
    if (!rateOk(ip)) return res({ reply: '⏳ Too many messages. Wait 1 minute and try again.' });

    const { message, conversationHistory = [], farmerProfile = null, langHint } = body;
    if (!message?.trim()) return res({ reply: 'Please send a message.' });

    const msg = message.trim().substring(0, 1500);
    if (blocked(msg))
      return res({ reply: 'I can only help with farming questions — crops, weather, soil, pests, and mandi prices. 🌾' });

    const l       = langHint || detectLang(msg);
    const contents = [
      ...conversationHistory.slice(-8).map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: (m.content || '').substring(0, 800) }]
      })),
      { role: 'user', parts: [{ text: msg }] }
    ];

    try {
      const r = await fetch(GEMINI(env.GEMINI_API_KEY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystem(farmerProfile, l) }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        }),
      });
      if (!r.ok) throw new Error('Gemini HTTP ' + r.status);
      const d     = await r.json();
      const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not get a response. Please try again.';
      return res({ reply });
    } catch (e) {
      console.error('[chat]', e.message);
      return res({ reply: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ / Please try again. 🙏' });
    }
  }
};
