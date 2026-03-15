/* ═══════════════════════════════════════════════════════════════
   PARJANYA AI — NEW FEATURES BLOCK
   Copy everything between the two ═══ lines and paste it just
   before the closing </script> tag in your index.html
   ═══════════════════════════════════════════════════════════════

   ADDS:
   1. 📷  Bot-guided photo upload flow (4-step wizard inside chat)
   2. 🔬  Disease detection via GPT-4o Vision (image → diagnosis)
   3. 🌦  Auto weather fetch on every chat open + in scan flow
   4. 📊  Calculations: crop loss %, treatment cost ₹, dosage, timing
   5. 🗣  Kannada TTS for all results (uses your existing speakText())
   6. 🌾  Acreage memory — bot asks once, remembers for session
   7. 📍  GPS location auto-detect (with fallback to profile)
   8. ⚡  "Scan my crop" quick chip added to existing prompt bar

   ═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   SCAN STATE — tracks the 4-step wizard
────────────────────────────────────────────────────────────────*/
let scanState = {
  active: false,     // is scan wizard running?
  step: 0,           // 0=idle 1=crop 2=part 3=photo 4=scanning
  crop: null,
  part: null,
  photoBase64: null,
  photoMime: null,
  acres: null,
  weather: null,
};

/* ──────────────────────────────────────────────────────────────
   1. INJECT "📷 Scan" CHIP into existing quick-prompts bar
      (runs once on page load)
────────────────────────────────────────────────────────────────*/
(function injectScanChip() {
  // Wait for DOM to be ready
  const inject = () => {
    const bar = document.querySelector('.quick-prompts');
    if (!bar) return;
    // Don't add twice
    if (bar.querySelector('#scanChipBtn')) return;
    const btn = document.createElement('button');
    btn.className = 'qchip';
    btn.id = 'scanChipBtn';
    btn.innerHTML = '📷 ಫೋಟೋ ಸ್ಕ್ಯಾನ್';
    btn.title = 'Scan your crop for disease';
    btn.onclick = startScanFlow;
    // Insert as first chip
    bar.insertBefore(btn, bar.firstChild);

    // Also inject a hidden file input for photo upload
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.id = 'scanFileInput';
    fi.accept = 'image/*';
    fi.capture = 'environment'; // opens rear camera on mobile
    fi.style.display = 'none';
    fi.onchange = handleScanFileSelected;
    document.body.appendChild(fi);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

/* ──────────────────────────────────────────────────────────────
   2. LIVE WEATHER FETCH
      Uses Open-Meteo (free, no API key needed)
      Falls back to profile location if GPS denied
────────────────────────────────────────────────────────────────*/
async function getLiveWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=auto&forecast_days=3`;
    const res = await fetch(url);
    const d = await res.json();
    const c = d.current;
    // Decode weather code to label
    const wLabel = decodeWeatherCode(c.weather_code);
    return {
      temp: Math.round(c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m),
      rain: c.precipitation,
      wind: Math.round(c.wind_speed_10m),
      condition: wLabel,
      lat, lon
    };
  } catch (e) {
    return null;
  }
}

function decodeWeatherCode(code) {
  if (code === 0) return 'Clear sky ☀️';
  if (code <= 2) return 'Partly cloudy ⛅';
  if (code <= 3) return 'Overcast ☁️';
  if (code <= 49) return 'Foggy / hazy 🌫️';
  if (code <= 59) return 'Drizzle 🌦';
  if (code <= 69) return 'Rain 🌧';
  if (code <= 79) return 'Snow ❄️';
  if (code <= 82) return 'Rain showers 🌧';
  if (code <= 99) return 'Thunderstorm ⛈';
  return 'Variable 🌤';
}

async function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

// Known Karnataka city coordinates as fallback
const KARNATAKA_CITIES = {
  'dharwad': { lat: 15.4589, lon: 75.0078 },
  'hubli': { lat: 15.3647, lon: 75.1240 },
  'bangalore': { lat: 12.9716, lon: 77.5946 },
  'bengaluru': { lat: 12.9716, lon: 77.5946 },
  'mysore': { lat: 12.2958, lon: 76.6394 },
  'mysuru': { lat: 12.2958, lon: 76.6394 },
  'belagavi': { lat: 15.8497, lon: 74.4977 },
  'belgaum': { lat: 15.8497, lon: 74.4977 },
  'davangere': { lat: 14.4644, lon: 75.9218 },
  'raichur': { lat: 16.2120, lon: 77.3439 },
  'tumkur': { lat: 13.3409, lon: 77.1010 },
  'hassan': { lat: 13.0033, lon: 76.1004 },
  'gadag': { lat: 15.4167, lon: 75.6167 },
  'koppal': { lat: 15.3500, lon: 76.1500 },
};

async function resolveWeather() {
  // 1. Try GPS
  const coords = await getCoords();
  if (coords) {
    const w = await getLiveWeather(coords.lat, coords.lon);
    if (w) return w;
  }
  // 2. Try profile location
  if (farmerProfile.location) {
    const city = farmerProfile.location.toLowerCase().replace(/,.*/, '').trim();
    const c = KARNATAKA_CITIES[city];
    if (c) {
      const w = await getLiveWeather(c.lat, c.lon);
      if (w) return w;
    }
  }
  // 3. Default to Dharwad
  return await getLiveWeather(15.4589, 75.0078);
}

function weatherRiskAssessment(w) {
  if (!w) return { level: 'unknown', msg: '' };
  const risks = [];
  if (w.humidity > 70) risks.push('ಹೆಚ್ಚಿನ ತೇವಾಂಶ — ಶಿಲೀಂಧ್ರ ರೋಗ ಅಪಾಯ (High humidity — fungal risk)');
  if (w.humidity > 80) risks.push('ತುಂಬಾ ಹೆಚ್ಚಿನ ತೇವಾಂಶ — ಬ್ಲೈಟ್ ಅಪಾಯ ಹೆಚ್ಚಾಗಿದೆ (Very high humidity — blight risk elevated)');
  if (w.rain > 5) risks.push('ಇತ್ತೀಚಿನ ಮಳೆ — ಬೀಜಕ ಹರಡುವಿಕೆ ಸಾಧ್ಯ (Recent rain — spore spread likely)');
  if (w.temp > 32) risks.push('ಹೆಚ್ಚಿನ ಉಷ್ಣತೆ — ಕೀಟ ಚಟುವಟಿಕೆ ಹೆಚ್ಚಿದೆ (High temp — pest activity elevated)');
  const level = risks.length >= 2 ? 'high' : risks.length === 1 ? 'medium' : 'low';
  return { level, risks };
}

/* ──────────────────────────────────────────────────────────────
   3. SCAN FLOW — 4-step bot-guided wizard
────────────────────────────────────────────────────────────────*/

// ENTRY POINT — triggered by "📷 Scan" chip
function startScanFlow() {
  if (isBusy) return;
  scanState = { active: true, step: 1, crop: null, part: null, photoBase64: null, photoMime: null, acres: null, weather: null };
  openChat();
  updateStepBar(1);

  const cropList = ['🌾 Cotton / ಹತ್ತಿ', '🌽 Maize / ಮೆಕ್ಕೆಜೋಳ', '🌱 Jowar / ಜೋಳ', '🍅 Tomato / ಟೊಮ್ಯಾಟೊ', '🧅 Onion / ಈರುಳ್ಳಿ', '🌶 Chilli / ಮೆಣಸಿನಕಾಯಿ', '🥜 Groundnut / ಕಡಲೆ', '🌻 Sunflower / ಸೂರ್ಯಕಾಂತಿ', '🌾 Wheat / ಗೋಧಿ', '🌿 Other / ಇತರ'];

  const chipHtml = cropList.map(c =>
    `<button class="qchip" style="margin:2px" onclick="selectScanCrop('${c.split(' / ')[0].replace(/['"]/g,'')}')">${c}</button>`
  ).join('');

  addMsg(
    `<span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--green);background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);padding:2px 6px;border-radius:4px">📷 ಸ್ಕ್ಯಾನ್ — Step 1 of 4</span><br><br>` +
    `ಯಾವ ಬೆಳೆ ನೋಡ್ತಿದ್ದೀರಾ? <strong>Which crop are you checking?</strong><br><br>` +
    `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${chipHtml}</div>`,
    'bot'
  );
  if (ttsEnabled) speakText('ಯಾವ ಬೆಳೆ ನೋಡ್ತಿದ್ದೀರಾ? Which crop are you checking?', 'kn-IN');
}

function selectScanCrop(crop) {
  if (!scanState.active || scanState.step !== 1) return;
  // Clean crop name
  const cleanCrop = crop.replace(/[🌾🌽🌱🍅🧅🌶🥜🌻🌿]/u, '').trim();
  scanState.crop = cleanCrop;
  scanState.step = 2;
  updateStepBar(2);

  // Update farmer profile
  if (!farmerProfile.crop) { farmerProfile.crop = cleanCrop; updateProfileBar(); }

  addMsg(`${crop}`, 'user');

  const parts = [
    { icon: '🍃', label: 'Leaf / ಎಲೆ', val: 'leaf' },
    { icon: '🪵', label: 'Stem / ಕಾಂಡ', val: 'stem' },
    { icon: '🌸', label: 'Flower / ಹೂ', val: 'flower' },
    { icon: '🫚', label: 'Root / ಬೇರು', val: 'root' },
    { icon: '🍑', label: 'Fruit / ಹಣ್ಣು', val: 'fruit' },
    { icon: '🌿', label: 'Whole / ಇಡೀ', val: 'whole plant' },
  ];
  const partHtml = parts.map(p =>
    `<button onclick="selectScanPart('${p.val}','${p.icon} ${p.label}')" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(0,230,118,.15);background:rgba(0,230,118,.04);color:var(--muted);font-size:10px;cursor:pointer;margin:2px;transition:all .2s" onmouseover="this.style.borderColor='rgba(0,230,118,.4)';this.style.color='var(--green)'" onmouseout="this.style.borderColor='rgba(0,230,118,.15)';this.style.color='var(--muted)'">${p.icon}<br><span style="font-size:9px">${p.label}</span></button>`
  ).join('');

  setTimeout(() => {
    addMsg(
      `<span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--green);background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);padding:2px 6px;border-radius:4px">Step 2 of 4</span><br><br>` +
      `<strong>${cleanCrop}</strong> — ಯಾವ ಭಾಗ ಸಮಸ್ಯೆ? <strong>Which part is affected?</strong><br><br>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:4px">${partHtml}</div>`,
      'bot'
    );
    if (ttsEnabled) speakText('ಯಾವ ಭಾಗ ಸಮಸ್ಯೆ?', 'kn-IN');
  }, 400);
}

function selectScanPart(part, label) {
  if (!scanState.active || scanState.step !== 2) return;
  scanState.part = part;
  scanState.step = 3;
  updateStepBar(3);

  addMsg(`${label}`, 'user');

  setTimeout(() => {
    addMsg(
      `<span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--green);background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);padding:2px 6px;border-radius:4px">Step 3 of 4</span><br><br>` +
      `<strong>${part}</strong> ಫೋಟೋ ತೆಗೆದು ಕಳಿಸಿ 📷<br><br>` +
      `<div style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:10px">` +
      `📌 <strong style="color:var(--text)">ಉತ್ತಮ ಫೋಟೋಗಾಗಿ:</strong><br>` +
      `&nbsp;· 20–30 cm ದೂರ ಇಡಿ (keep 20–30 cm away)<br>` +
      `&nbsp;· ನೇರ ಸೂರ್ಯನ ಬೆಳಕಿನಲ್ಲಿ ತೆಗೆಯಿರಿ (use daylight)<br>` +
      `&nbsp;· ಎರಡೂ ಬದಿ ತೋರಿಸಿ (show both sides if possible)</div>` +
      `<div style="border:1px dashed rgba(0,230,118,.35);border-radius:12px;padding:18px;text-align:center;background:rgba(0,230,118,.03);cursor:pointer" onclick="document.getElementById('scanFileInput').click()">` +
      `<div style="font-size:28px;margin-bottom:8px">📷</div>` +
      `<div style="font-size:12px;font-weight:600;color:var(--green)">ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ</div>` +
      `<div style="font-size:10px;color:var(--muted);margin-top:4px">Tap to open Camera or Gallery</div>` +
      `</div>`,
      'bot'
    );
    if (ttsEnabled) speakText('ಫೋಟೋ ತೆಗೆದು ಕಳಿಸಿ. ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ತೆಗೆಯಿರಿ.', 'kn-IN');
  }, 400);
}

// Called when user selects a file
async function handleScanFileSelected(e) {
  const file = e.target.files[0];
  if (!file || !scanState.active || scanState.step !== 3) return;
  e.target.value = ''; // reset so same file can be re-selected

  scanState.step = 4;
  updateStepBar(4);

  // Show thumbnail in chat
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataUrl = ev.target.result;
    const base64 = dataUrl.split(',')[1];
    const mime = file.type || 'image/jpeg';
    scanState.photoBase64 = base64;
    scanState.photoMime = mime;

    // Show photo preview
    addMsg(
      `<div style="max-width:180px">` +
      `<img src="${dataUrl}" style="width:100%;border-radius:8px;border:1px solid rgba(0,230,118,.2)" alt="Crop photo"/>` +
      `<div style="font-size:9px;color:var(--muted);margin-top:3px">${file.name} · ${(file.size/1024).toFixed(0)}KB ✓</div>` +
      `</div>`,
      'user'
    );

    // Step 4 — fetch weather in parallel then run analysis
    document.getElementById('chatStatusTxt').textContent = '🌦 Fetching weather + scanning...';
    showTyping();
    updateStepBar(4);

    const w = await resolveWeather();
    scanState.weather = w;
    const risk = weatherRiskAssessment(w);

    // Show atmosphere card
    if (w) {
      removeTyping();
      addMsg(
        `<span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64b5f6;background:rgba(100,181,246,.08);border:1px solid rgba(100,181,246,.2);padding:2px 6px;border-radius:4px">🌦 Step 4 — Atmosphere auto-fetched</span><br><br>` +
        `<div style="background:rgba(100,181,246,.05);border:1px solid rgba(100,181,246,.15);border-radius:8px;padding:8px 10px;font-size:11px;line-height:1.9">` +
        `🌡 <strong>Temp:</strong> ${w.temp}°C &nbsp;|&nbsp; 💧 <strong>Humidity:</strong> ${w.humidity}%<br>` +
        `🌧 <strong>Recent rain:</strong> ${w.rain > 0 ? w.rain + 'mm' : 'None'} &nbsp;|&nbsp; 💨 <strong>Wind:</strong> ${w.wind} km/h<br>` +
        `☁️ <strong>Condition:</strong> ${w.condition}` +
        `</div>` +
        (risk.risks && risk.risks.length > 0 ?
          `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,193,7,.05);border:1px solid rgba(255,193,7,.2);border-radius:7px;font-size:10px;color:var(--amber);line-height:1.6">⚠️ ${risk.risks.join('<br>⚠️ ')}</div>` : ''
        ) +
        `<br>🔬 Scanning your photo now...`,
        'bot'
      );
      if (ttsEnabled) {
        const wtxt = `ಹವಾಮಾನ ಮಾಹಿತಿ: ಉಷ್ಣತೆ ${w.temp} ಡಿಗ್ರಿ, ತೇವಾಂಶ ${w.humidity} ಪ್ರತಿಶತ. ಫೋಟೋ ವಿಶ್ಲೇಷಣೆ ನಡೆಯುತ್ತಿದೆ.`;
        speakText(wtxt, 'kn-IN');
      }
      showTyping();
    }

    // Ask for acreage while analysing (non-blocking, store for calc)
    if (!scanState.acres && !farmerProfile.farmSize) {
      setTimeout(() => {
        const acreMsg = document.createElement('div');
        acreMsg.className = 'cmsg cmsg-bot';
        acreMsg.style.cssText = 'max-width:260px;margin-top:6px';
        acreMsg.innerHTML =
          `<span style="font-size:9px;color:var(--muted)">ಲೆಕ್ಕಾಚಾರಕ್ಕಾಗಿ / For calculations:</span><br>` +
          `ನಿಮ್ಮ ಹೊಲ ಎಷ್ಟು ಎಕರೆ? <strong>How many acres?</strong><br>` +
          `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">` +
          `<button class="qchip" onclick="setScanAcres(1)">1 acre</button>` +
          `<button class="qchip" onclick="setScanAcres(2)">2 acres</button>` +
          `<button class="qchip" onclick="setScanAcres(3)">3 acres</button>` +
          `<button class="qchip" onclick="setScanAcres(5)">5 acres</button>` +
          `<button class="qchip" onclick="setScanAcres(10)">10+ acres</button>` +
          `</div>`;
        document.getElementById('chatMsgs').appendChild(acreMsg);
        document.getElementById('chatMsgs').scrollTop = document.getElementById('chatMsgs').scrollHeight;
      }, 1200);
    } else {
      scanState.acres = farmerProfile.farmSize || 2;
    }

    // Run vision analysis
    await runDiseaseAnalysis(base64, mime, w, risk);
  };
  reader.readAsDataURL(file);
}

function setScanAcres(n) {
  scanState.acres = n;
  farmerProfile.farmSize = n;
  // Remove the acres question card
  const cards = document.querySelectorAll('#chatMsgs .cmsg-bot');
  cards.forEach(c => { if (c.innerHTML.includes('ಹೊಲ ಎಷ್ಟು ಎಕರೆ')) c.style.opacity = '0.4'; });
  addMsg(`${n} ಎಕರೆ (acres)`, 'user');
}

/* ──────────────────────────────────────────────────────────────
   4. DISEASE ANALYSIS via GPT-4o Vision
────────────────────────────────────────────────────────────────*/
async function runDiseaseAnalysis(base64, mime, weather, risk) {
  isBusy = true;
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('chatStatusTxt').textContent = '🔬 Analysing crop image...';

  // Wait for acres if not set yet (up to 15s)
  let waited = 0;
  while (!scanState.acres && waited < 15000) {
    await new Promise(r => setTimeout(r, 500));
    waited += 500;
  }
  const acres = scanState.acres || 2;

  const weatherContext = weather
    ? `Current weather: ${weather.temp}°C, humidity ${weather.humidity}%, rain ${weather.rain}mm, wind ${weather.wind}km/h, condition: ${weather.condition}. Risk level: ${risk.level}.`
    : 'Weather data unavailable.';

  const systemPrompt = `You are Parjanya AI, an expert Indian agricultural disease detection AI. 
A farmer has uploaded a photo of their ${scanState.crop || 'crop'} ${scanState.part || 'plant'}.
${weatherContext}
Farm size: ${acres} acres.
Location: ${farmerProfile.location || 'Karnataka, India'}.

Analyse the image and respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "disease": "Disease name in English",
  "disease_kn": "ರೋಗದ ಹೆಸರು ಕನ್ನಡದಲ್ಲಿ",
  "confidence": 85,
  "pathogen": "Causal organism (e.g. Alternaria solani)",
  "severity": 65,
  "stage": "Early / Moderate / Severe",
  "spread_risk": "Low / Medium / High",
  "spread_reason": "Brief reason (e.g. high humidity favours spread)",
  "crop_loss_min": 15,
  "crop_loss_max": 25,
  "yield_loss_qtl_per_acre": 2.5,
  "treatment_cost_min": 1200,
  "treatment_cost_max": 1800,
  "fungicide": "Product name (e.g. Mancozeb 75WP)",
  "dose": "400g per acre",
  "spray_water": "200 litres per acre",
  "sprays_needed": 2,
  "spray_interval_days": 7,
  "spray_timing": "Morning before 10am or after 4pm. Avoid spraying before rain.",
  "immediate_actions": ["Action 1 in Kannada (English)", "Action 2", "Action 3"],
  "prevention": "One prevention tip in Kannada (English)",
  "speak_result_kn": "2-sentence spoken summary in Kannada for TTS"
}

If image is unclear or not a plant, still return valid JSON with disease: "Image unclear - please retake photo", confidence: 0.`;

  try {
    const payload = {
      model: 'gpt-4o',
      max_tokens: 900,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' } }
          ]
        }
      ]
    };

    // Send via your existing Netlify function
    const res = await fetch('/.netlify/functions/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '__VISION__',
        visionPayload: payload,
        farmerProfile,
        isVision: true
      })
    });

    removeTyping();

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // Parse JSON result
    let result;
    try {
      const raw = (data.reply || data.content || '').replace(/```json|```/g, '').trim();
      result = JSON.parse(raw);
    } catch (parseErr) {
      // If JSON parse fails, do offline fallback
      result = buildOfflineDiseaseResult(scanState.crop, scanState.part, weather);
    }

    showDiseaseResults(result, acres, weather);

  } catch (err) {
    removeTyping();
    // Offline fallback — still shows useful estimated results
    const fallback = buildOfflineDiseaseResult(scanState.crop, scanState.part, weather);
    showDiseaseResults(fallback, acres, weather);
  }

  scanState.active = false;
  updateStepBar(0);
  isBusy = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('chatStatusTxt').textContent = 'GPT-4o · Self-learning · Kannada ready';
}

/* Offline fallback when API is unavailable */
function buildOfflineDiseaseResult(crop, part, weather) {
  const isHighHumidity = weather && weather.humidity > 70;
  return {
    disease: isHighHumidity ? 'Fungal Leaf Spot (suspected)' : 'Leaf Blight (suspected)',
    disease_kn: isHighHumidity ? 'ಎಲೆ ಚುಕ್ಕೆ ರೋಗ (ಶಂಕಿತ)' : 'ಎಲೆ ಬ್ಲೈಟ್ (ಶಂಕಿತ)',
    confidence: 60,
    pathogen: 'Possible fungal infection (offline estimate)',
    severity: isHighHumidity ? 65 : 45,
    stage: 'Early–Moderate',
    spread_risk: isHighHumidity ? 'High' : 'Medium',
    spread_reason: isHighHumidity ? 'High humidity favours fungal spread' : 'Moderate conditions',
    crop_loss_min: 10,
    crop_loss_max: 20,
    yield_loss_qtl_per_acre: 2.0,
    treatment_cost_min: 800,
    treatment_cost_max: 1400,
    fungicide: 'Mancozeb 75WP or Copper Oxychloride',
    dose: '2g per litre of water',
    spray_water: '200 litres per acre',
    sprays_needed: 2,
    spray_interval_days: 7,
    spray_timing: 'Morning before 10am. Avoid spraying before rain.',
    immediate_actions: [
      'ರೋಗಿಷ್ಠ ಎಲೆಗಳನ್ನು ತೆಗೆದುಹಾಕಿ (Remove and destroy infected leaves)',
      'ಶಿಫಾರಸು ಮಾಡಿದ ಶಿಲೀಂಧ್ರನಾಶಕ ಸಿಂಪಡಿಸಿ (Apply recommended fungicide)',
      'ನೀರಾವರಿ ತಗ್ಗಿಸಿ (Reduce overhead irrigation)'
    ],
    prevention: 'ಬೀಜ ಸಂಸ್ಕರಣೆ ಮಾಡಿ ಮತ್ತು ಬೆಳೆ ಸರದಿ ಅನುಸರಿಸಿ (Treat seeds and follow crop rotation)',
    speak_result_kn: 'ನಿಮ್ಮ ಬೆಳೆಯಲ್ಲಿ ಎಲೆ ರೋಗ ಕಂಡುಬಂದಿದೆ. ತಕ್ಷಣ ಶಿಲೀಂಧ್ರನಾಶಕ ಸಿಂಪಡಿಸಿ.',
    _offline: true
  };
}

/* ──────────────────────────────────────────────────────────────
   5. SHOW RESULTS — disease card + calculation card + TTS
────────────────────────────────────────────────────────────────*/
function showDiseaseResults(r, acres, weather) {
  const totalCostMin = Math.round(r.treatment_cost_min * acres);
  const totalCostMax = Math.round(r.treatment_cost_max * acres);
  const totalYieldLoss = (r.yield_loss_qtl_per_acre * acres).toFixed(1);
  const sevColor = r.severity > 60 ? 'var(--red)' : r.severity > 35 ? 'var(--amber)' : 'var(--green)';
  const sevBar = `<div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;margin-top:3px;overflow:hidden"><div style="height:100%;width:${r.severity}%;background:${sevColor};border-radius:2px"></div></div>`;

  // ── Disease card ──
  const diseaseCard =
    `<span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--amber);background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.2);padding:2px 6px;border-radius:4px">🔬 ರೋಗ ಪತ್ತೆ / Disease detected${r._offline ? ' (offline estimate)' : ''}</span><br><br>` +
    `<div style="background:var(--bg2);border:1px solid rgba(255,193,7,.18);border-radius:10px;overflow:hidden;margin-bottom:8px">` +
      `<div style="padding:8px 10px;background:rgba(255,193,7,.07);border-bottom:1px solid rgba(255,193,7,.1);display:flex;align-items:center;gap:6px">` +
        `<span style="font-size:18px">🍃</span>` +
        `<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--amber)">${r.disease}</div>` +
        `<div style="font-size:10px;color:var(--muted)">${r.disease_kn}</div></div>` +
        `<span style="background:var(--amber);color:#060d08;font-size:9px;font-weight:700;padding:2px 7px;border-radius:100px">${r.confidence}%</span>` +
      `</div>` +
      `<div style="padding:8px 10px;font-size:11px;display:flex;flex-direction:column;gap:3px">` +
        `<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Pathogen</span><span style="color:var(--text)">${r.pathogen}</span></div>` +
        `<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Stage</span><span style="color:var(--text)">${r.stage}</span></div>` +
        `<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Severity</span><span style="color:${sevColor};font-weight:600">${r.severity}%</span></div>` +
        sevBar +
        `<div style="display:flex;justify-content:space-between;margin-top:2px"><span style="color:var(--muted)">Spread risk</span><span style="color:${r.spread_risk==='High'?'var(--red)':'var(--amber)';}">${r.spread_risk} — ${r.spread_reason}</span></div>` +
      `</div>` +
    `</div>`;

  // ── Calculation card ──
  const calcCard =
    `<div style="background:var(--card);border:1px solid rgba(0,230,118,.2);border-radius:10px;overflow:hidden;margin-bottom:8px">` +
      `<div style="padding:7px 10px;background:linear-gradient(135deg,rgba(0,230,118,.1),rgba(29,233,182,.05));border-bottom:1px solid rgba(0,230,118,.12)">` +
        `<div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.06em">📊 ಒಟ್ಟು ಲೆಕ್ಕ — ${acres} Acre${acres>1?'s':''}</div>` +
      `</div>` +
      `<div style="padding:8px 10px;font-size:11px;display:flex;flex-direction:column;gap:4px">` +
        calcRow('ಬೆಳೆ ನಷ್ಟ / Crop loss', `${r.crop_loss_min}–${r.crop_loss_max}%`, 'var(--red)') +
        calcRow('Yield impact', `~${totalYieldLoss} quintal${totalYieldLoss > 1 ? 's' : ''}`, 'var(--red)') +
        calcRow('Treatment cost', `₹ ${totalCostMin.toLocaleString('en-IN')} – ${totalCostMax.toLocaleString('en-IN')}`, 'var(--text)') +
        calcRow('Fungicide', r.fungicide, 'var(--green)') +
        calcRow('Dose', r.dose, 'var(--text)') +
        calcRow('Water needed', r.spray_water, 'var(--text)') +
        calcRow('Sprays needed', `${r.sprays_needed}× (${r.spray_interval_days} days apart)`, 'var(--text)') +
        calcRow('Spray window', r.spray_timing, 'var(--green3)') +
      `</div>` +
    `</div>`;

  // ── Immediate actions ──
  const actionsHtml = r.immediate_actions && r.immediate_actions.length
    ? `<div style="background:rgba(0,230,118,.03);border:1px solid rgba(0,230,118,.12);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11px">` +
      `<div style="font-size:9px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">⚡ ತಕ್ಷಣದ ಕ್ರಮಗಳು / Immediate actions</div>` +
      r.immediate_actions.map((a,i) => `<div style="padding:3px 0;border-bottom:1px solid rgba(0,230,118,.06);color:var(--muted)">${i+1}. ${a}</div>`).join('') +
      `</div>` : '';

  // ── Weather timing alert ──
  const timingAlert = weather
    ? `<div style="padding:7px 9px;background:rgba(255,193,7,.05);border:1px solid rgba(255,193,7,.18);border-radius:8px;font-size:10px;color:var(--amber);line-height:1.6;margin-bottom:8px">🌦 ${r.spray_timing}</div>`
    : '';

  // ── Action chips ──
  const chips =
    `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">` +
    `<button class="qchip" onclick="startScanFlow()">📷 ಹೊಸ ಸ್ಕ್ಯಾನ್</button>` +
    `<button class="qchip" onclick="shareScanResult()">📤 Share</button>` +
    `<button class="qchip" onclick="quickAsk('ಯಾವ ಅಂಗಡಿಯಲ್ಲಿ ${r.fungicide} ಸಿಗ್ತದೆ?')">🛒 ಖರೀದಿ</button>` +
    `<button class="qchip" onclick="quickAsk('${r.disease} ಸಂಪೂರ್ಣ ಚಿಕಿತ್ಸಾ ಯೋಜನೆ ಕೊಡಿ')">📋 Full plan</button>` +
    `</div>`;

  addMsg(diseaseCard + calcCard + actionsHtml + timingAlert + chips, 'bot');

  // ── Kannada TTS for results ──
  if (ttsEnabled) {
    const speakText_kn = r.speak_result_kn ||
      `${r.disease_kn || r.disease} ರೋಗ ಕಂಡುಬಂದಿದೆ. ತೀವ್ರತೆ ${r.severity} ಪ್ರತಿಶತ. ` +
      `${acres} ಎಕರೆಗೆ ₹${totalCostMin} ರಿಂದ ₹${totalCostMax} ಚಿಕಿತ್ಸಾ ವೆಚ್ಚ ಆಗ್ತದೆ. ` +
      `${r.fungicide} ಬಳಸಿ ${r.sprays_needed} ಬಾರಿ ಸಿಂಪಡಿಸಿ.`;
    setTimeout(() => speakText(speakText_kn, 'kn-IN'), 600);
  }

  // Update conversation history so GPT-4o knows what was found
  const summary = `[Scan result] Crop: ${scanState.crop}, Part: ${scanState.part}, Disease: ${r.disease} (${r.confidence}% confidence), Severity: ${r.severity}%, Acres: ${acres}, Treatment: ${r.fungicide} ${r.dose}`;
  conversationHistory.push({ role: 'assistant', content: summary });
}

function calcRow(label, value, color) {
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(0,230,118,.05);padding-bottom:3px">` +
    `<span style="color:var(--muted)">${label}</span>` +
    `<span style="font-weight:600;color:${color}">${value}</span>` +
    `</div>`;
}

/* ──────────────────────────────────────────────────────────────
   6. STEP BAR — shows progress in chat header area
────────────────────────────────────────────────────────────────*/
function updateStepBar(step) {
  let bar = document.getElementById('pjStepBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pjStepBar';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:5px;padding:7px;background:var(--bg3);border-bottom:1px solid rgba(0,230,118,.06);font-size:10px;transition:all .3s';
    // Insert after profile bar
    const profileBar = document.getElementById('profileBar');
    if (profileBar && profileBar.parentNode) {
      profileBar.parentNode.insertBefore(bar, profileBar.nextSibling);
    }
  }
  if (step === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const labels = ['', 'Crop', 'Part', 'Photo', 'Scanning'];
  let html = '';
  for (let i = 1; i <= 4; i++) {
    const done = i < step;
    const active = i === step;
    const dotColor = done || active ? '#00e676' : '#3d5c42';
    const glow = active ? ';box-shadow:0 0 0 3px rgba(0,230,118,.15)' : '';
    html += `<div style="width:7px;height:7px;border-radius:50%;background:${dotColor}${glow}"></div>`;
    if (i < 4) html += `<div style="width:20px;height:1px;background:${done ? '#00e676' : '#3d5c42'}"></div>`;
  }
  html += `<span style="margin-left:6px;color:var(--muted);font-size:9px">${labels[step] || ''} (${step}/4)</span>`;
  bar.innerHTML = html;
}

/* ──────────────────────────────────────────────────────────────
   7. AUTO WEATHER on chat open
      Shows a compact weather card as first bot message when
      the chat is opened (once per session)
────────────────────────────────────────────────────────────────*/
let weatherShownThisSession = false;

const _origOpenChat = openChat;
openChat = async function() {
  _origOpenChat();
  if (!weatherShownThisSession) {
    weatherShownThisSession = true;
    const w = await resolveWeather();
    if (w) {
      const risk = weatherRiskAssessment(w);
      const riskLine = risk.risks && risk.risks.length
        ? `<div style="margin-top:5px;font-size:10px;color:var(--amber)">⚠️ ${risk.risks[0]}</div>` : '';
      addMsg(
        `<div style="background:rgba(100,181,246,.05);border:1px solid rgba(100,181,246,.15);border-radius:9px;padding:8px 10px;font-size:11px">` +
        `<div style="font-size:9px;font-weight:600;color:#64b5f6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">🌦 Live Weather — ${farmerProfile.location || 'Your location'}</div>` +
        `<div style="display:flex;gap:14px;flex-wrap:wrap">` +
        `<span>🌡 <strong>${w.temp}°C</strong></span>` +
        `<span>💧 <strong>${w.humidity}%</strong> humidity</span>` +
        `<span>${w.condition}</span>` +
        `</div>` +
        riskLine +
        `</div>`,
        'bot'
      );
    }
  }
};

/* ──────────────────────────────────────────────────────────────
   8. SHARE RESULT (basic — copies to clipboard or uses share API)
────────────────────────────────────────────────────────────────*/
function shareScanResult() {
  const text = `Parjanya AI Scan Result\n` +
    `Crop: ${scanState.crop || 'Unknown'} | Part: ${scanState.part || 'Unknown'}\n` +
    `Disease: ${document.querySelector('#chatMsgs .cmsg-bot:last-of-type')?.innerText?.substring(0, 200) || 'See Parjanya AI'}\n\n` +
    `Scanned with Parjanya AI — India's AI for farming`;
  if (navigator.share) {
    navigator.share({ title: 'Parjanya AI Crop Scan', text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => addSystemMsg('Result copied to clipboard! 📋'));
  } else {
    addSystemMsg('Share: Copy the result from the chat above 📋');
  }
}

/* ──────────────────────────────────────────────────────────────
   9. QUICK ASK helper (already in your code, this is a safe
      re-declaration that won't break anything)
────────────────────────────────────────────────────────────────*/
if (typeof quickAsk === 'undefined') {
  function quickAsk(text) {
    document.getElementById('msgInput').value = text;
    sendMsg();
  }
}

/* ──────────────────────────────────────────────────────────────
   END OF PARJANYA AI NEW FEATURES
────────────────────────────────────────────────────────────────*/
