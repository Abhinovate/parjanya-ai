export default {
  async fetch(request, env) {
    const cors = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response('', { headers: cors });

    try {
      const { message, conversationHistory = [], farmerProfile = null } = await request.json();
      if (!message?.trim()) return new Response(JSON.stringify({ reply: 'Please send a message.' }), { headers: cors });

      const lang = /[ಀ-೿]/.test(message) ? 'kn' : /[ऀ-ॿ]/.test(message) ? 'hi' : 'en';

      const system = `You are Parjanya AI, agricultural assistant for Karnataka farmers.
${lang === 'kn' ? 'Respond ONLY in Kannada (ಕನ್ನಡ). Simple rural dialect.' : lang === 'hi' ? 'Hindi mein jawab do.' : 'Respond in clear English.'}
${farmerProfile?.crop ? 'Farmer crop: ' + farmerProfile.crop : ''}
${farmerProfile?.location ? 'Location: ' + farmerProfile.location : ''}
Rules: Only answer farming questions. Use Indian units. Mention Raitha Samparka Kendra 1800-425-1188 for pesticide advice. End with one clear action for today.`;

      const contents = [
        ...conversationHistory.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        }
      );

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not get response. Please try again.';
      return new Response(JSON.stringify({ reply }), { headers: cors });

    } catch (err) {
      return new Response(JSON.stringify({
        reply: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ / Please try again.'
      }), { headers: cors });
    }
  }
};