/* ═══════════════════════════════════════════════════════════════
   NETLIFY FUNCTION PATCH — netlify/functions/chatbot.js
   
   Find your existing chatbot.js Netlify function and add the
   highlighted section below. It handles vision (image) requests
   from the new scan feature.
   ═══════════════════════════════════════════════════════════════ */

// Your existing chatbot.js probably looks something like this:
// exports.handler = async (event) => { ... }
//
// ADD THIS BLOCK inside your handler, BEFORE your existing
// message handling logic:

/* ── ADD THIS SECTION ── */
const body = JSON.parse(event.body);

// Handle vision/image analysis requests from scan flow
if (body.isVision && body.visionPayload) {
  try {
    const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body.visionPayload)
    });
    const visionData = await visionRes.json();
    const reply = visionData.choices?.[0]?.message?.content || '{}';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Vision analysis failed', reply: '{}' })
    };
  }
}
/* ── END ADD ── */

// ... rest of your existing chatbot.js continues below ...
