/**
 * PARJANYA AI — UNIFIED MASTER BUILD v5.0
 * Website + AI + Vision in one file.
 */

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="kn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parjanya AI — Voice Farm Assistant</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <style>
        :root { --ink: #060d06; --gold: #f0c040; --red: #ef5350; }
        body { background: var(--ink); color: white; font-family: sans-serif; margin: 0; text-align: center; }
        #lang-screen { position: fixed; inset: 0; background: var(--ink); z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .big-card { width: 80%; padding: 25px; margin: 10px; border-radius: 15px; border: 2px solid var(--gold); background: #111b0c; color: white; font-size: 24px; font-weight: bold; cursor: pointer; }
        #main-app { display: none; padding: 20px; }
        .mic-btn { width: 120px; height: 120px; border-radius: 50%; background: var(--gold); border: none; font-size: 40px; margin: 30px auto; display: block; cursor: pointer; box-shadow: 0 0 30px rgba(240,192,64,0.4); }
        .pulse { animation: p 1.5s infinite; background: var(--red); color: white; }
        @keyframes p { 0% { box-shadow: 0 0 0 0 rgba(239,83,80, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(239,83,80, 0); } 100% { box-shadow: 0 0 0 0 rgba(239,83,80, 0); } }
        .alert { background: var(--red); padding: 15px; border-radius: 10px; margin-bottom: 20px; display: none; font-weight: bold; }
        .weather-info { background: #111b0c; border: 1px solid #333; padding: 20px; border-radius: 15px; }
    </style>
</head>
<body>
    <div id="lang-screen">
        <h1 style="color:var(--gold)">Parjanya AI</h1>
        <p>ಭಾಷೆ ಆರಿಸಿ / Choose Language</p>
        <div class="big-card" onclick="init('kn-IN')">ಕನ್ನಡ (Kannada)</div>
        <div class="big-card" onclick="init('hi-IN')">हिन्दी (Hindi)</div>
        <div class="big-card" onclick="init('en-IN')">English</div>
    </div>

    <div id="main-app">
        <div id="alert-banner" class="alert"></div>
        <div class="weather-info">
            <h3 id="status-text">Detecting Farm Location...</h3>
            <p id="weather-detail">Scanning for Hail and Rain</p>
        </div>
        <button id="mic" class="mic-btn" onclick="listen()"><i class="fa-solid fa-microphone"></i></button>
        <p id="ai-response" style="font-size: 1.2rem; margin: 20px; color: var(--gold);">Tap the Mic to Start Talking</p>
        
        <button class="big-card" style="font-size:18px" onclick="document.getElementById('cam').click()">
            <i class="fa-solid fa-camera"></i> Scan Crop Disease
        </button>
        <input type="file" id="cam" accept="image/*" capture="environment" style="display:none" onchange="scan(event)">
    </div>

    <script>
        let lang = 'kn-IN';
        const synth = window.speechSynthesis;

        function init(l) {
            lang = l;
            document.getElementById('lang-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            speak(l === 'kn-IN' ? "ನಮಸ್ಕಾರ, ನಾನು ಪರ್ಜನ್ಯ. ಕೇಳಲು ಮೈಕ್ ಒತ್ತಿ." : "Hello, I am Parjanya. Tap the mic to talk.");
            checkWeather();
        }

        function speak(t) {
            if (synth.speaking) synth.cancel();
            const u = new SpeechSynthesisUtterance(t);
            u.lang = lang; u.rate = 0.9;
            synth.speak(u);
            document.getElementById('ai-response').innerText = t;
        }

        function listen() {
            const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!Rec) return alert("Please use Chrome or Android browser.");
            const r = new Rec(); r.lang = lang;
            r.onstart = () => document.getElementById('mic').classList.add('pulse');
            r.onresult = async (e) => {
                const txt = e.results[0][0].transcript;
                document.getElementById('ai-response').innerText = "...";
                const res = await fetch(window.location.href, { method: 'POST', body: JSON.stringify({ message: txt, langHint: lang }) });
                const data = await res.json();
                speak(data.reply);
            };
            r.onend = () => document.getElementById('mic').classList.remove('pulse');
            r.start();
        }

        async function scan(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (f) => {
                const b64 = f.target.result.split(',')[1];
                speak("Analyzing... ದಯವಿಟ್ಟು ಕಾಯಿರಿ");
                const res = await fetch(window.location.href, { method: 'POST', body: JSON.stringify({ isVision: true, imageBase64: b64, mimeType: file.type }) });
                const data = await res.json();
                const resObj = typeof data === 'string' ? JSON.parse(data) : data;
                speak(resObj.kannada || resObj.disease);
            };
            reader.readAsDataURL(file);
        }

        function checkWeather() {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude; const lon = pos.coords.longitude;
                document.getElementById('status-text').innerText = "Farm Area: " + lat.toFixed(2) + "N, " + lon.toFixed(2) + "E";
                const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&hourly=precipitation&forecast_days=1');
                const d = await res.json();
                if (d.hourly.precipitation.slice(0, 4).some(r => r > 0.1)) {
                    const m = lang === 'kn-IN' ? "ಮಳೆ ಮುನ್ಸೂಚನೆ ಇದೆ!" : "Rain Alert Soon!";
                    document.getElementById('alert-banner').innerText = m;
                    document.getElementById('alert-banner').style.display = 'block';
                    speak(m);
                } else { document.getElementById('weather-detail').innerText = "No disasters expected in 4 hours."; }
            });
        }
    </script>
</body>
</html>
`;

export default {
  async fetch(request, env) {
    // GET request shows the website
    if (request.method === 'GET') {
      return new Response(HTML_CONTENT, { headers: { 'Content-Type': 'text/html' } });
    }

    // POST request handles the AI
    if (request.method === 'POST') {
      const body = await request.json();
      const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

      // Vision Mode
      if (body.isVision) {
        const r = await fetch(GEMINI_URL, {
          method: 'POST',
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Identify crop disease. JSON only: {disease, treatment, kannada, healthy:bool}" }] },
            contents: [{ role: 'user', parts: [{ inlineData: { mimeType: body.mimeType, data: body.imageBase64 } }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        const d = await r.json();
        return new Response(JSON.stringify(d.candidates[0].content.parts[0].text), { headers: CORS });
      }

      // Chat Mode
      const r = await fetch(GEMINI_URL, {
        method: 'POST',
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `You are Parjanya AI. Answer in ${body.langHint}. Max 2 sentences. End with one action for TODAY.` }] },
          contents: [{ role: 'user', parts: [{ text: body.message }] }]
        })
      });
      const d = await r.json();
      return new Response(JSON.stringify({ reply: d.candidates[0].content.parts[0].text }), { headers: { 'Content-Type': 'application/json' } });
    }
  }
};
