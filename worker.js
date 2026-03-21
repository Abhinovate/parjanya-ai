/**
 * PARJANYA AI — UNIFIED BUILD v6.0 (STABLE)
 */

export default {
  async fetch(request, env) {
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response('', { headers: CORS_HEADERS });

    // --- ROUTE: WEBSITE (GET) ---
    if (request.method === 'GET') {
      return new Response(getHTML(), { headers: { 'Content-Type': 'text/html', ...CORS_HEADERS } });
    }

    // --- ROUTE: AI (POST) ---
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

        // 1. Vision Mode (Disease Detection)
        if (body.isVision) {
          const r = await fetch(GEMINI_URL, {
            method: 'POST',
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: "Identify crop disease. Return JSON: {disease, treatment, kannada, healthy:boolean}" }] },
              contents: [{ role: 'user', parts: [{ inlineData: { mimeType: body.mimeType, data: body.imageBase64 } }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });
          const d = await r.json();
          const replyText = d.candidates[0].content.parts[0].text;
          return new Response(replyText, { headers: CORS_HEADERS });
        }

        // 2. Chat Mode (Voice Assistant)
        const r = await fetch(GEMINI_URL, {
          method: 'POST',
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `You are Parjanya AI. Answer in ${body.langHint}. Max 2 sentences. End with one action for TODAY.` }] },
            contents: [{ role: 'user', parts: [{ text: body.message }] }]
          })
        });
        const d = await r.json();
        const reply = d.candidates[0].content.parts[0].text;
        return new Response(JSON.stringify({ reply }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

      } catch (err) {
        return new Response(JSON.stringify({ reply: "Error connecting to AI. Check GEMINI_API_KEY." }), { status: 500, headers: CORS_HEADERS });
      }
    }
  }
};

function getHTML() {
  return `
<!DOCTYPE html>
<html lang="kn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parjanya AI</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <style>
        :root { --ink: #060d06; --gold: #f0c040; --red: #ef5350; }
        body { background: var(--ink); color: white; font-family: sans-serif; margin: 0; text-align: center; }
        #lang-screen { position: fixed; inset: 0; background: var(--ink); z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .big-card { width: 85%; padding: 25px; margin: 10px; border-radius: 15px; border: 2px solid var(--gold); background: #111b0c; color: white; font-size: 22px; cursor: pointer; }
        #app { display: none; padding: 20px; }
        .mic { width: 100px; height: 100px; border-radius: 50%; background: var(--gold); border: none; font-size: 35px; margin: 20px auto; display: block; }
        .pulse { animation: p 1.5s infinite; background: var(--red); color: white; }
        @keyframes p { 0% { box-shadow: 0 0 0 0 rgba(239,83,80, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(239,83,80, 0); } 100% { box-shadow: 0 0 0 0 rgba(239,83,80, 0); } }
        .alert { background: var(--red); padding: 15px; border-radius: 10px; margin-bottom: 20px; display: none; }
    </style>
</head>
<body>
    <div id="lang-screen">
        <h1 style="color:var(--gold)">Parjanya AI</h1>
        <div class="big-card" onclick="init('kn-IN')">ಕನ್ನಡ (Kannada)</div>
        <div class="big-card" onclick="init('hi-IN')">हिन्दी (Hindi)</div>
        <div class="big-card" onclick="init('en-IN')">English</div>
    </div>
    <div id="app">
        <div id="warn" class="alert"></div>
        <h3 id="loc">Detecting Farm...</h3>
        <button id="mic" class="mic" onclick="listen()"><i class="fa-solid fa-microphone"></i></button>
        <p id="resp" style="color:var(--gold); font-size: 1.2rem;">ಮಾತಾಡಲು ಮೈಕ್ ಒತ್ತಿ</p>
        <button class="big-card" style="font-size:16px" onclick="document.getElementById('c').click()">📷 Scan Crop Disease</button>
        <input type="file" id="c" accept="image/*" capture="environment" style="display:none" onchange="scan(event)">
    </div>
    <script>
        let lang = 'kn-IN';
        const synth = window.speechSynthesis;
        function init(l) {
            lang = l; document.getElementById('lang-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            speak(l==='kn-IN'?'ನಮಸ್ಕಾರ, ನಾನು ಪರ್ಜನ್ಯ. ಕೇಳಲು ಮೈಕ್ ಒತ್ತಿ.':'Hello, I am Parjanya. Tap mic.');
            check();
        }
        function speak(t) {
            if (synth.speaking) synth.cancel();
            const u = new SpeechSynthesisUtterance(t); u.lang = lang; u.rate = 0.9;
            synth.speak(u); document.getElementById('resp').innerText = t;
        }
        function listen() {
            const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if(!Rec) return alert("Use Chrome browser");
            const r = new Rec(); r.lang = lang;
            r.onstart = () => document.getElementById('mic').classList.add('pulse');
            r.onresult = async (e) => {
                const txt = e.results[0][0].transcript;
                const res = await fetch(window.location.href, { method: 'POST', body: JSON.stringify({ message: txt, langHint: lang }) });
                const data = await res.json(); speak(data.reply);
            };
            r.onend = () => document.getElementById('mic').classList.remove('pulse');
            r.start();
        }
        async function scan(e) {
            const f = e.target.files[0]; const reader = new FileReader();
            reader.onload = async (ev) => {
                const b64 = ev.target.result.split(',')[1]; speak("Analyzing...");
                const res = await fetch(window.location.href, { method: 'POST', body: JSON.stringify({ isVision:true, imageBase64:b64, mimeType:f.type }) });
                const d = await res.json();
                const obj = typeof d === 'string' ? JSON.parse(d) : d;
                speak(obj.kannada || obj.disease);
            };
            reader.readAsDataURL(f);
        }
        function check() {
            navigator.geolocation.getCurrentPosition(async (p) => {
                document.getElementById('loc').innerText = "Farm: " + p.coords.latitude.toFixed(2) + "N";
                const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude='+p.coords.latitude+'&longitude='+p.coords.longitude+'&hourly=precipitation&forecast_days=1');
                const d = await r.json();
                if(d.hourly.precipitation.slice(0,4).some(x => x > 0.1)) {
                    const m = lang==='kn-IN'?"ಮಳೆ ಬರುವ ಸಾಧ್ಯತೆ ಇದೆ!":"Rain warning!";
                    document.getElementById('warn').innerText = m; document.getElementById('warn').style.display = 'block'; speak(m);
                }
            });
        }
    </script>
</body>
</html>
  `;
}
