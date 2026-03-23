/* ═══════════════════════════════════════════════════════════
   PARJANYA AI — Frontend Integration Layer
   Drop this in as your single <script> block.
   Replace ALL existing JS with this file.
═══════════════════════════════════════════════════════════ */
'use strict';

// ── CONFIG ────────────────────────────────────────────────
// FIX 1: Single declaration — no duplicates
const API = 'https://parjanya-ai.abhishekvkulkarni8055.workers.dev';

// ── CROP FALLBACK DATA ────────────────────────────────────
// FIX 7: Always shown instantly — section NEVER blank
const CROPS = [
  { id:'tomato',    e:'🍅', name:'Tomato',    kn:'ಟೊಮ್ಯಾಟೊ',   price:1240, prev:1105, mandi:'Hubli',     trend:'up',   advice:'sell'  },
  { id:'onion',     e:'🧅', name:'Onion',     kn:'ಈರುಳ್ಳಿ',    price:890,  prev:920,  mandi:'Dharwad',   trend:'down', advice:'hold'  },
  { id:'cotton',    e:'🌿', name:'Cotton',    kn:'ಹತ್ತಿ',       price:6820, prev:6700, mandi:'Hubli',     trend:'up',   advice:'hold'  },
  { id:'maize',     e:'🌽', name:'Maize',     kn:'ಮೆಕ್ಕೆ ಜೋಳ', price:2050, prev:1963, mandi:'Davanagere',trend:'up',   advice:'sell'  },
  { id:'chilli',    e:'🌶', name:'Chilli',    kn:'ಮೆಣಸು',      price:14200,prev:14360,mandi:'Byadgi',    trend:'down', advice:'urgent'},
  { id:'groundnut', e:'🥜', name:'Groundnut', kn:'ಶೇಂಗಾ',      price:5640, prev:5480, mandi:'Gadag',     trend:'up',   advice:'hold'  },
  { id:'tur',       e:'🫘', name:'Tur Dal',   kn:'ತೊಗರಿ',      price:8900, prev:8340, mandi:'Gulbarga',  trend:'up',   advice:'sell'  },
  { id:'paddy',     e:'🌾', name:'Paddy',     kn:'ಭತ್ತ',        price:2183, prev:2183, mandi:'MSP Fixed', trend:'flat', advice:'msp'   },
];

// ── STATE ─────────────────────────────────────────────────
let chatOpen  = false;
let chatBusy  = false;
let ttsOn     = true;
let voiceRec  = null;
let chatHist  = [];           // conversation memory
let farmerProfile = {};       // crop + location detected from conversation
let selectedCrop  = 'Tomato'; // for scan modal

// ── localStorage: restore state on page reload ────────────
(function restoreState() {
  try {
    const h = localStorage.getItem('paj_hist');
    if (h) chatHist = JSON.parse(h);
    const p = localStorage.getItem('paj_fp');
    if (p) farmerProfile = JSON.parse(p);
  } catch (_) {}
})();

function saveHistory() {
  try { localStorage.setItem('paj_hist', JSON.stringify(chatHist.slice(-30))); } catch (_) {}
}
function saveProfile() {
  try { localStorage.setItem('paj_fp', JSON.stringify(farmerProfile)); } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════
   1. MARKET
═══════════════════════════════════════════════════════════ */
function renderCrops(crops) {
  const tbl = document.getElementById('cropTbl');
  if (!tbl) return;

  // Keep header, rebuild rows
  const hdr = tbl.querySelector('.ctbl-hdr');
  tbl.innerHTML = '';
  if (hdr) tbl.appendChild(hdr);

  crops.forEach((c, i) => {
    const chg = ((c.price - c.prev) / c.prev * 100);
    // FIX 4: Use single quotes inside template literals — no broken attributes
    const pctCls   = chg >= 0.2 ? 'pct-up' : chg <= -0.2 ? 'pct-dn' : 'pct-fl';
    const chgStr   = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%';
    const advMap   = {
      sell:   '<span class="adv-tag adv-sell">Sell Now</span>',
      hold:   '<span class="adv-tag adv-wait">Hold</span>',
      urgent: '<span class="adv-tag adv-urgent">Sell ASAP</span>',
      msp:    '<span class="adv-tag adv-msP">MSP Fixed</span>',
    };

    const row = document.createElement('div');
    row.className = 'crow';
    row.style.animationDelay = (i * 0.05) + 's';
    row.innerHTML = `
      <div class="cc-name">
        <span class="cc-emoji">${c.e}</span>
        <div>
          <div class="cc-nm">${c.name}</div>
          <div class="cc-kn">${c.kn} · ${c.mandi}</div>
        </div>
      </div>
      <div>
        <div class="cc-price">₹${c.price.toLocaleString('en-IN')}<span class="cc-unit">/q</span></div>
      </div>
      <div>
        <div class="${pctCls}">${chgStr}</div>
        <div class="cc-prev">vs yesterday</div>
      </div>
      <div>${advMap[c.advice] || advMap.hold}</div>
    `;
    tbl.appendChild(row);
  });
}

// FIX 2: Single function — no duplicate declarations
async function loadMarket() {
  const btn = document.getElementById('mktRefBtn');
  const ts  = document.getElementById('mktTs');

  if (btn) { btn.textContent = '↻ Loading...'; btn.disabled = true; }

  try {
    // FIX 3: Always include Content-Type and a body — worker expects JSON
    const res  = await fetch(API + '/market', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    '{}',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (data.prices) {
      // Merge live prices into our local array
      CROPS.forEach(c => {
        if (data.prices[c.id]) {
          const p = data.prices[c.id];
          if (p.price && p.price !== c.price) {
            c.prev  = c.price;
            c.price = p.price;
          }
          if (p.mandi && p.mandi !== 'MSP Fixed') c.mandi = p.mandi.split(' ')[0];
          if (p.trend) c.trend = p.trend;
        }
      });
      if (ts) ts.textContent = (data.source === 'live' ? '🟢 Live · ' : '⚪ Cached · ')
        + 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST';
    }
  } catch (e) {
    // FIX 8: On failure still render — fallback data already in CROPS[]
    if (ts) ts.textContent = '⚪ Using cached prices';
  }

  renderCrops(CROPS);
  if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
}

/* ═══════════════════════════════════════════════════════════
   2. WEATHER
═══════════════════════════════════════════════════════════ */
const WX_ICONS = { 0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',61:'🌦',63:'🌧',65:'⛈',80:'🌦',81:'🌧',95:'⛈' };
const WX_DESC  = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',61:'Light rain',63:'Rain',65:'Heavy rain',80:'Showers',95:'Thunderstorm' };
const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderWeather(d) {
  const c = d.current || {};

  // Today card
  setEl('wxTempVal', c.temp   || '—');
  setEl('wxHum',    (c.humidity  || '—') + '%');
  setEl('wxWind',   (c.windGust  || '—') + ' km/h');
  setEl('wxRain',   (c.rain72h   || '0') + ' mm');
  setEl('wxFeels',  (c.feelsLike || c.temp || '—') + '°C');

  const iconEl = document.getElementById('wxIcon');
  if (iconEl) iconEl.textContent = WX_ICONS[c.code || 0] || '🌤';
  setEl('wxCondText', WX_DESC[c.code || 0] || 'Fair');

  // 5-day forecast
  const fcEl = document.getElementById('wxForecast');
  if (fcEl && d.daily && d.daily.length) {
    fcEl.innerHTML = '';
    d.daily.slice(0, 5).forEach((dy, i) => {
      const row = document.createElement('div');
      row.className = 'wx-5day-row';
      row.innerHTML = `
        <div class="wxd-name">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dy.day || '—'}</div>
        <div class="wxd-icon">${WX_ICONS[dy.code || 0] || '⛅'}</div>
        <div class="wxd-rain" style="color:${dy.rain > 5 ? '#90caf9' : 'var(--muted)'}">${dy.rain}mm</div>
        <div class="wxd-hi">${dy.hi || '—'}°</div>
        <div class="wxd-lo">${dy.lo || '—'}°</div>
      `;
      fcEl.appendChild(row);
    });
  }

  // Hourly temperature bars
  const hbEl = document.getElementById('hourlyBars');
  if (hbEl && d.hourly && d.hourly.length) {
    hbEl.innerHTML = '';
    const hrs  = d.hourly.slice(0, 12);
    const maxT = Math.max(...hrs.map(x => x.temp || 0));
    const minT = Math.min(...hrs.map(x => x.temp || 0));
    hrs.forEach(h => {
      const pct  = Math.max(10, Math.round((h.temp - minT) / (maxT - minT + 0.1) * 70 + 15));
      const lbl  = h.time ? new Date(h.time).getHours() + 'h' : '—';
      const col  = h.temp > 38 ? '#ff5252' : h.temp > 32 ? '#ffc107' : '#69f0ae';
      const wrap = document.createElement('div');
      wrap.className = 'hb-wrap';
      wrap.innerHTML = `
        <div class="hb" style="height:${pct}%;background:${col};opacity:.75">
          <span class="hb-temp" style="color:${col}">${h.temp}°</span>
        </div>
        <div class="hb-lbl">${lbl}</div>
      `;
      hbEl.appendChild(wrap);
    });
  }

  // Harvest window
  const hwEl = document.getElementById('hwRow');
  if (hwEl && d.harvestWindow && d.harvestWindow.length) {
    hwEl.innerHTML = '';
    d.harvestWindow.forEach((w, i) => {
      const cls  = 'hw-slot hw-' + (w.quality === 'best' ? 'best' : w.quality === 'bad' ? 'bad' : 'ok');
      const lbl  = w.quality === 'best' ? 'BEST✓' : w.quality === 'bad' ? 'Rain❌' : 'OK';
      const slot = document.createElement('div');
      slot.className = cls;
      slot.innerHTML = `<span class="hw-day">${i === 0 ? 'Today' : w.day || '—'}</span>${lbl}`;
      hwEl.appendChild(slot);
    });
  }

  // Farm advisory
  const faEl = document.getElementById('farmAdvisory');
  if (faEl && d.advisories && d.advisories.length) {
    faEl.innerHTML = d.advisories.map(a => `
      <div class="fa-row urgency-${a.urgency}">
        <span class="fa-icon">${a.icon}</span>
        <div class="fa-body">
          <div class="fa-crop">${a.crop}</div>
          <div class="fa-msg">${a.msg}</div>
        </div>
      </div>
    `).join('');
  }
}

async function loadWeather(lat, lon) {
  try {
    const res = await fetch(API + '/weather', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ lat: lat || 15.45, lon: lon || 75.01 }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderWeather(data);
  } catch (e) {
    // Fallback: show static values so section is never blank
    setEl('wxTempVal', '36');
    setEl('wxCondText', 'Fair weather');
    const ic = document.getElementById('wxIcon');
    if (ic) ic.textContent = '🌤';
    setEl('wxHum',   '58%');
    setEl('wxWind',  '18 km/h');
    setEl('wxRain',  '2.4 mm');
    setEl('wxFeels', '39°C');
  }
}

/* ═══════════════════════════════════════════════════════════
   3. CHAT
═══════════════════════════════════════════════════════════ */
function scrollMsgs() {
  const m = document.getElementById('msgs');
  if (m) m.scrollTop = m.scrollHeight;
}

function appendMsg(html, cls) {
  const m = document.getElementById('msgs');
  if (!m) return;
  const d = document.createElement('div');
  d.className = 'cm ' + cls;
  d.innerHTML = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  m.appendChild(d);
  scrollMsgs();
}

function appendSys(text) {
  const m = document.getElementById('msgs');
  if (!m) return;
  const d = document.createElement('div');
  d.className = 'cm cs';
  d.textContent = text;
  m.appendChild(d);
  scrollMsgs();
}

function showTyping() {
  const m = document.getElementById('msgs');
  if (!m || document.getElementById('typd')) return;
  const d = document.createElement('div');
  d.id = 'typd';
  d.className = 'typd';
  d.innerHTML = '<span></span><span></span><span></span>';
  m.appendChild(d);
  scrollMsgs();
}

function removeTyping() {
  const t = document.getElementById('typd');
  if (t) t.remove();
}

// Detect farmer info from text to improve AI context
function detectProfile(text) {
  const tl = text.toLowerCase();
  ['dharwad','hubli','belagavi','mysuru','gadag','raichur','tumakuru','hassan'].forEach(loc => {
    if (tl.includes(loc) && !farmerProfile.location) {
      farmerProfile.location = loc[0].toUpperCase() + loc.slice(1) + ', Karnataka';
      saveProfile();
    }
  });
  ['tomato','onion','cotton','maize','paddy','chilli','groundnut','wheat','ragi'].forEach(crop => {
    if (tl.includes(crop) && !farmerProfile.crop) {
      farmerProfile.crop = crop[0].toUpperCase() + crop.slice(1);
      saveProfile();
    }
  });
}

// Offline keyword database — always works with no internet
const OFFLINE_DB = [
  { kw:['yellow leaf','ಹಳದಿ ಎಲೆ','early blight'],    d:'Early Blight',     t:'Mancozeb 75 WP @ 2g/litre every 7 days × 3.'           },
  { kw:['late blight','black spot','phytophthora'],     d:'Late Blight',      t:'URGENT: Remove plants. Metalaxyl+Mancozeb 2.5g/litre.'  },
  { kw:['fruit borer','hole fruit','ಹಣ್ಣು ಕೊರೆ'],     d:'Fruit Borer',      t:'Spinosad 45 SC @ 0.3ml/litre in evening.'              },
  { kw:['thrips','silver streak','ಥ್ರಿಪ್ಸ್'],          d:'Thrips',           t:'Fipronil 5 SC @ 1ml/litre inside leaf folds.'          },
  { kw:['bollworm','ಹತ್ತಿ ಹುಳ','cotton boll'],         d:'Pink Bollworm',    t:'Chlorpyrifos 20 EC @ 2.5ml/litre.'                     },
  { kw:['fall armyworm','FAW','ಮೆಕ್ಕೆ ಹುಳ'],           d:'Fall Armyworm',    t:'Emamectin Benzoate 5 SG @ 0.4g/litre into whorl.'     },
  { kw:['yellow','wilting','nitrogen','ಸಾರಜನಕ'],       d:'Nitrogen Def.',    t:'Urea @ 20-25 kg/acre with irrigation.'                 },
  { kw:['sell','mandi','market','ಬೆಲೆ','price'],       d:'Market Tip',       t:'Sell Mon/Fri. Call Kisan helpline: 1800-180-1551.'     },
  { kw:['rain','ಮಳೆ','hail','flood'],                  d:'Weather Advisory', t:'Harvest ready crops before rain. Cover with netting.'  },
];

function tryOffline(msg) {
  const q = msg.toLowerCase();
  let best = null, bestScore = 0;
  OFFLINE_DB.forEach(row => {
    const score = row.kw.filter(k => q.includes(k.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; best = row; }
  });
  if (!best || bestScore === 0) return null;
  return `📵 **Offline** — ${best.d}\n\n${best.t}\n\n⚠️ Raitha Samparka Kendra: 1800-425-1188`;
}

async function sendMessage() {
  const input = document.getElementById('mi');
  const sbtn  = document.getElementById('sbtn');
  const msg   = (input?.value || '').trim();

  if (!msg || chatBusy) return;
  input.value = '';
  chatBusy = true;
  if (sbtn) sbtn.disabled = true;

  stopTTS();
  detectProfile(msg);
  appendMsg(msg, 'cu');
  chatHist.push({ role: 'user', content: msg.substring(0, 1400) });
  saveHistory();

  // Offline fallback
  if (!navigator.onLine) {
    showTyping();
    await new Promise(r => setTimeout(r, 500));
    removeTyping();
    const reply = tryOffline(msg) || '📵 **Offline**\n\nNo local match.\n\n☎️ Kisan Call: **1800-180-1551**';
    appendMsg(reply, 'co');
    chatBusy = false;
    if (sbtn) sbtn.disabled = false;
    return;
  }

  showTyping();
  setChatStatus('🧠 Thinking...');

  try {
    const lang = document.getElementById('lsel')?.value || 'en-IN';

    // FIX 5: Always send Content-Type + history + profile + lang
    const res = await fetch(API + '/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: msg.substring(0, 1400),
        history: chatHist.slice(-12),
        profile: farmerProfile,
        lang:    lang.split('-')[0],
      }),
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data  = await res.json();
    const reply = (data.reply || '').replace(/[\u200B\u200C\u200D]/g, '').trim();

    removeTyping();
    chatHist.push({ role: 'assistant', content: reply });
    saveHistory();
    detectProfile(reply);
    appendMsg(reply, 'cb');

    if (ttsOn) setTimeout(() => speakText(reply, lang), 200);

  } catch (e) {
    removeTyping();
    const offline = tryOffline(msg);
    appendMsg(offline || 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ / Please try again. 🙏', offline ? 'co' : 'cb');
  }

  chatBusy = false;
  if (sbtn) sbtn.disabled = false;
  setChatStatus('Gemini · Kannada ready');
  input?.focus();
}

// Prefill and send a quick question
function quickAsk(q) {
  if (!chatOpen) openChat();
  const inp = document.getElementById('mi');
  if (inp) inp.value = q;
  setTimeout(sendMessage, 180);
}

/* ═══════════════════════════════════════════════════════════
   4. BUTTONS — open/close/clear
═══════════════════════════════════════════════════════════ */
function openChat() {
  chatOpen = true;
  document.getElementById('chat')?.classList.add('open');
  const fabi = document.getElementById('fabi');
  if (fabi) fabi.className = 'fa-solid fa-xmark';
  const fu = document.getElementById('fu');
  if (fu) fu.style.display = 'none';
  setTimeout(() => document.getElementById('mi')?.focus(), 150);
}

function closeChat() {
  chatOpen = false;
  stopTTS();
  document.getElementById('chat')?.classList.remove('open');
  const fabi = document.getElementById('fabi');
  if (fabi) fabi.className = 'fa-solid fa-microphone';
}

// FIX 6: togChat — FAB opens/closes chat. Does NOT start voice directly.
function togChat() {
  if (chatOpen) closeChat();
  else openChat();
}

function clearChat() {
  chatHist = [];
  saveHistory();
  const msgs = document.getElementById('msgs');
  if (msgs) msgs.innerHTML = '';
  appendSys('Chat cleared. Memory reset.');
}

function setChatStatus(text) {
  const el = document.getElementById('cst');
  if (el) el.textContent = text;
}

/* ═══════════════════════════════════════════════════════════
   5. VOICE — speech-to-text + text-to-speech
═══════════════════════════════════════════════════════════ */

// TTS — speak AI reply aloud
function speakText(text, forceLang) {
  if (!ttsOn || !window.speechSynthesis) return;
  stopTTS();

  const clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/\s+/g, ' ').trim()
    .substring(0, 650);

  // Auto-detect language from script
  let lang = forceLang || 'en-IN';
  if (!forceLang) {
    if (/[ಀ-೿]/.test(clean)) lang = 'kn-IN';
    else if (/[ऀ-ॿ]/.test(clean)) lang = 'hi-IN';
    else if (/[ఀ-౿]/.test(clean)) lang = 'te-IN';
  }

  const utt  = new SpeechSynthesisUtterance(clean);
  utt.lang   = lang;
  utt.rate   = 0.9;
  utt.pitch  = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const voice  = voices.find(v => v.lang === lang)
              || voices.find(v => v.lang.startsWith(lang.split('-')[0]));
  if (voice) utt.voice = voice;

  utt.onstart = () => {
    document.getElementById('ttsw')?.classList.add('show');
    setChatStatus('🔊 Speaking...');
  };
  utt.onend = utt.onerror = () => {
    document.getElementById('ttsw')?.classList.remove('show');
    setChatStatus('Gemini · Kannada ready');
  };

  window.speechSynthesis.speak(utt);
}

function stopTTS() {
  window.speechSynthesis?.cancel();
  document.getElementById('ttsw')?.classList.remove('show');
}

function toggleTTS() {
  ttsOn = !ttsOn;
  const btn = document.getElementById('ttsb');
  if (btn) {
    btn.classList.toggle('on', ttsOn);
    btn.innerHTML = ttsOn
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
  }
  if (!ttsOn) stopTTS();
}

// FIX 6: Voice INPUT — separate from FAB. Triggered by mic button inside chat.
function startVoice() {
  if (chatBusy) return;
  stopTTS();

  // FIX: Safe feature detection — works on Chrome, crashes gracefully on others
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    appendSys('Voice input needs Chrome browser.');
    return;
  }

  if (!voiceRec) {
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRec  = new SR();
    voiceRec.continuous     = false;
    voiceRec.interimResults = false;
    voiceRec.onresult = e => {
      const transcript = e.results[0][0].transcript;
      const inp = document.getElementById('mi');
      if (inp) inp.value = transcript;
      stopVoiceUI();
      setTimeout(sendMessage, 280);
    };
    voiceRec.onerror = stopVoiceUI;
    voiceRec.onend   = stopVoiceUI;
  }

  const lang = document.getElementById('lsel')?.value || 'en-IN';
  voiceRec.lang = lang;

  try {
    voiceRec.start();
    // Show listening UI
    const vbtn = document.getElementById('vbtn');
    if (vbtn) {
      vbtn.classList.add('lst');
      vbtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    }
    document.getElementById('vwv')?.classList.add('show');
    const vwl = document.getElementById('vwl');
    if (vwl) vwl.textContent = lang === 'kn-IN' ? 'ಕೇಳ್ತಿದ್ದೇನೆ...' : lang === 'hi-IN' ? 'सुन रहा हूं...' : 'Listening...';
    setChatStatus('🎙 Listening...');
  } catch (e) {
    stopVoiceUI();
  }
}

function stopVoiceUI() {
  const vbtn = document.getElementById('vbtn');
  if (vbtn) {
    vbtn.classList.remove('lst');
    vbtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
  }
  document.getElementById('vwv')?.classList.remove('show');
  setChatStatus('Gemini · Kannada ready');
}

/* ═══════════════════════════════════════════════════════════
   6. SCAN MODAL
═══════════════════════════════════════════════════════════ */
function openScanModal() {
  document.getElementById('scanModal')?.classList.add('open');
  document.getElementById('scanResult')?.classList.remove('show');
}

function closeScanModal() {
  document.getElementById('scanModal')?.classList.remove('open');
}

// Crop pill selection in scan modal
document.querySelectorAll('.crop-pill').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.crop-pill').forEach(b => b.classList.remove('on'));
    this.classList.add('on');
    selectedCrop = this.dataset.crop || 'Other';
  });
});

// Close modal when clicking backdrop
document.getElementById('scanModal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('scanModal')) closeScanModal();
});

async function onScanUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    alert('Image too large — max 4 MB');
    return;
  }

  const sr = document.getElementById('scanResult');
  if (sr) {
    sr.classList.add('show');
    sr.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--muted)">
        <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--gold);font-size:20px;display:block;margin-bottom:8px"></i>
        Analysing with AI...
      </div>
    `;
  }

  const reader = new FileReader();
  reader.onload = async ev => {
    const b64 = ev.target.result.split(',')[1];
    try {
      const res = await fetch(API + '/vision', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: b64, mimeType: file.type || 'image/jpeg', cropHint: selectedCrop }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      if (!sr) return;

      if (data.error || data.unclear) {
        sr.innerHTML = `<div style="color:#ff5252;font-weight:700">⚠️ ${data.message || 'Could not analyse. Take a clearer photo.'}</div>`;
      } else if (data.healthy) {
        sr.innerHTML = `
          <div class="sr-disease" style="color:var(--teal)">✅ Plant Looks Healthy!</div>
          <div class="sr-conf" style="color:var(--teal)">No disease detected.</div>
          <div class="sr-row"><span class="sr-label">Tip:</span> ${data.prevention || ''}</div>
          ${data.kannada ? `<div class="sr-kn">${data.kannada}</div>` : ''}
        `;
      } else {
        const sev = { mild:'🟡', moderate:'🟠', severe:'🔴' };
        sr.innerHTML = `
          <div class="sr-disease">${sev[data.severity] || '⚠️'} ${data.disease}</div>
          <div class="sr-conf">Confidence: ${data.confidence}% · Severity: ${data.severity} · ${data.urgency}</div>
          <div class="sr-row"><span class="sr-label">💊 Treatment:</span> ${data.treatment}</div>
          <div class="sr-row"><span class="sr-label">🛡 Prevention:</span> ${data.prevention}</div>
          <div class="sr-row" style="color:var(--amber);font-size:11px">⚠️ Verify: Raitha Samparka Kendra 1800-425-1188</div>
          ${data.kannada ? `<div class="sr-kn">${data.kannada}</div>` : ''}
        `;
        if (ttsOn && data.kannada) setTimeout(() => speakText(data.kannada, 'kn-IN'), 300);
      }
    } catch (err) {
      if (sr) sr.innerHTML = `<div style="color:#ff5252">❌ Scan failed. Check internet and try again.</div>`;
    }
  };
  reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════════════════════════
   7. NAV + SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  document.getElementById('nav')?.classList.toggle('s', scrollY > 38);
}, { passive: true });

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('on'), i * 55);
    }
  });
}, { threshold: 0.07, rootMargin: '0px 0px -26px 0px' });
document.querySelectorAll('.rv').forEach(el => revealObserver.observe(el));

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═══════════════════════════════════════════════════════════
   8. RAIN CANVAS (background animation)
═══════════════════════════════════════════════════════════ */
(function rainCanvas() {
  const c = document.getElementById('c');
  if (!c) return;
  const ctx = c.getContext('2d');
  let drops = [];
  function resize() {
    c.width  = innerWidth;
    c.height = innerHeight;
    drops = [];
    for (let i = 0; i < 50; i++) drops.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      l: Math.random() * 16 + 5,
      s: Math.random() * 1.6 + 0.7,
      o: Math.random() * 0.3 + 0.08,
    });
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    drops.forEach(p => {
      ctx.strokeStyle = `rgba(76,175,80,${p.o})`;
      ctx.lineWidth   = 0.55;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.l * 0.14, p.y + p.l);
      ctx.stroke();
      p.y += p.s;
      p.x -= p.s * 0.12;
      if (p.y > c.height) { p.y = -18; p.x = Math.random() * c.width; }
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ═══════════════════════════════════════════════════════════
   9. ONLINE / OFFLINE
═══════════════════════════════════════════════════════════ */
window.addEventListener('online',  () => {
  document.getElementById('offp')?.classList.remove('show');
  appendSys('🌐 Online — live AI active.');
});
window.addEventListener('offline', () => {
  document.getElementById('offp')?.classList.add('show');
  appendSys('📵 Offline — local database active.');
});
if (!navigator.onLine) document.getElementById('offp')?.classList.add('show');

// Preload voices for TTS
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {};

/* ═══════════════════════════════════════════════════════════
   10. INIT — runs once on page load
═══════════════════════════════════════════════════════════ */
(function init() {
  // ── Market: render cached data IMMEDIATELY, then fetch live
  renderCrops(CROPS);
  setTimeout(loadMarket, 1000);
  setInterval(loadMarket, 30 * 60 * 1000);

  // ── Weather: get GPS then call /weather
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Math.round(pos.coords.latitude  * 10) / 10;
        const lon = Math.round(pos.coords.longitude * 10) / 10;
        loadWeather(lat, lon);
      },
      () => loadWeather(15.45, 75.01),  // Default: Dharwad
      { timeout: 6000 }
    );
  } else {
    loadWeather(15.45, 75.01);
  }
  setInterval(() => loadWeather(15.45, 75.01), 30 * 60 * 1000);
})();
