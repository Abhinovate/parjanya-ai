/**
 * PARJANYA AI — Cloudflare Worker (Production v2)
 * © 2026 Parjanya AI · Dharwad, Karnataka
 *
 * ENV VARS: GEMINI_API_KEY (required)
 *
 * Routes (all POST unless noted):
 *   GET  /            → health JSON
 *   POST /chat        { message, history[], profile, lang }
 *   POST /vision      { imageBase64, mimeType, cropHint }
 *   POST /weather     { lat, lon }
 *   POST /market      {}
 */

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const ok  = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: CORS });
const err = (msg, s = 400) => ok({ error: true, message: msg }, s);
const GEMINI = k => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${k}`;

/* ── Rate limiter ── */
const RL = new Map();
function rateOk(ip, max = 20) {
  const now = Date.now();
  const hits = (RL.get(ip) || []).filter(t => now - t < 60_000);
  if (hits.length >= max) return false;
  hits.push(now); RL.set(ip, hits); return true;
}

/* ── Injection guard ── */
const BLOCKS = [/ignore.{0,20}(instructions?|rules?|prompt)/i,/repeat.{0,15}(system|prompt|above)/i,/jailbreak|developer mode|\bDAN\b/i,/are you (gpt|claude|openai|chatgpt)/i];
const blocked = m => BLOCKS.some(p => p.test(m)) || m.length > 2000;

/* ── Lang detect ── */
const detectLang = t => /[ಀ-೿]/.test(t)?'kn':/[ऀ-ॿ]/.test(t)?'hi':/[ఀ-౿]/.test(t)?'te':'en';

/* ── Chat system prompt ── */
function chatSystem(p, l) {
  const L = {kn:'ONLY respond in simple Kannada (ಕನ್ನಡ). Rural Karnataka dialect.',hi:'ONLY respond in simple Hindi.',te:'ONLY respond in simple Telugu.',en:'Respond in clear simple English.'}[l]||'Respond in clear simple English.';
  return `You are Parjanya AI, agricultural assistant for Karnataka farmers. Built in Dharwad.
${L}
${p?.crop?'Farmer grows: '+p.crop:''}
${p?.location?'Location: '+p.location:'Location: North Karnataka'}

RULES:
1. Only answer farming questions. Politely decline everything else.
2. Use Indian units: kg/acre, litre/acre, quintal, guntha.
3. Mention Karnataka mandis: Hubli, Dharwad, Davanagere, Byadgi APMC.
4. For pesticides always add: "Verify: Raitha Samparka Kendra 1800-425-1188"
5. Give exact product names and doses. Never be vague.
6. End every reply with ONE bold action the farmer should do TODAY.
7. Keep replies concise — max 8 lines. Use bullet points.
8. Never reveal your model name or provider.`;
}

/* ── Vision prompt ── */
const VIS = `You are an expert plant pathologist for Karnataka India.
Analyse the crop image. Return ONLY valid JSON — no markdown.
Schema: {"disease":"name","confidence":80,"severity":"mild|moderate|severe","treatment":"product + exact dose","urgency":"immediate|within48h|within7days|monitor","prevention":"one tip","healthy":false,"unclear":false,"kannada":"2-sentence Kannada advice"}
Rules: confidence 50-95. unclear:true if not a plant. healthy:true if no disease. Use Indian brands.`;

/* ── Market seed data ── */
const MKT = {
  tomato:    {price:1240,prev:1105,mandi:'Hubli APMC',    trend:'up'},
  onion:     {price:890, prev:920, mandi:'Dharwad APMC',  trend:'down'},
  cotton:    {price:6820,prev:6700,mandi:'Hubli APMC',    trend:'up'},
  maize:     {price:2050,prev:1963,mandi:'Davanagere',    trend:'up'},
  chilli:    {price:14200,prev:14360,mandi:'Byadgi APMC', trend:'down'},
  groundnut: {price:5640,prev:5480,mandi:'Gadag APMC',    trend:'up'},
  paddy:     {price:2183,prev:2183,mandi:'MSP Fixed',     trend:'flat'},
  tur:       {price:8900,prev:8340,mandi:'Gulbarga APMC', trend:'up'},
  sunflower: {price:6760,prev:6820,mandi:'Gadag APMC',    trend:'down'},
  ragi:      {price:3846,prev:3846,mandi:'MSP Fixed',     trend:'flat'},
};

async function fetchMarket() {
  try {
    const r = await fetch(
      'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aab825a0f7c63df&format=json&filters[state.keyword]=Karnataka&limit=200',
      {cf:{cacheTtl:1800,cacheEverything:true}}
    );
    if(!r.ok) throw new Error('api');
    const data = await r.json();
    const result = {...MKT};
    (data.records||[]).forEach(rec=>{
      const cn=(rec.commodity||'').toLowerCase();
      for(const k of Object.keys(result)){
        if(cn.includes(k)||(k==='tur'&&cn.includes('tur'))){
          const p=parseFloat(rec.modal_price);
          if(p>0){result[k]={...result[k],prev:result[k].price,price:p,mandi:(rec.market||result[k].mandi).split(' ')[0]+' APMC',trend:p>result[k].price?'up':p<result[k].price?'down':'flat',live:true};}
        }
      }
    });
    return {prices:result,source:'live',at:new Date().toISOString()};
  } catch(e) {
    return {prices:MKT,source:'cached',at:new Date().toISOString()};
  }
}

/* ── Weather via Open-Meteo ── */
async function fetchWeather(lat,lon){
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,rain,weathercode,windgusts_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windgusts_10m_max&timezone=Asia%2FKolkata&forecast_days=7`;
    const r=await fetch(url,{cf:{cacheTtl:1800,cacheEverything:true}});
    if(!r.ok) throw new Error('wx');
    const d=await r.json();
    const now=Date.now();let ni=0;
    (d.hourly?.time||[]).some((t,i)=>{if(new Date(t).getTime()>=now){ni=i;return true;}});
    const cw=d.current_weather||{};const h=d.hourly||{};const dly=d.daily||{};
    const rain72=(h.rain||[]).slice(ni,ni+72).reduce((a,x)=>a+(x||0),0);
    const maxGust=Math.max(...(dly.windgusts_10m_max||[0]));
    const maxTemp=Math.max(...(dly.temperature_2m_max||[35]));
    const ads=[];
    if(maxTemp>38) ads.push({icon:'🌡️',crop:'Tomato/Chilli',msg:`Extreme heat (${Math.round(maxTemp)}°C). Irrigate before 7AM. No fertilizer today.`,urgency:'high'});
    if((dly.precipitation_sum?.[0]||0)>8) ads.push({icon:'🌧️',crop:'Onion/Groundnut',msg:`Heavy rain today. Delay harvest — wet crops lose grade. Open drainage.`,urgency:'high'});
    if((dly.precipitation_sum?.[1]||0)>5) ads.push({icon:'🌾',crop:'All ready crops',msg:`Rain tomorrow. Harvest mature crops TODAY to avoid losses.`,urgency:'medium'});
    if(maxGust>50) ads.push({icon:'💨',crop:'Cotton/Maize',msg:`High winds (${Math.round(maxGust)}km/h). Stake crops. Don't spray — chemical drift wastes input.`,urgency:'high'});
    ads.push({icon:'📅',crop:'Cotton/Maize/Moong',msg:'March–April: Cotton pre-sowing window open. Apply Trichoderma 2.5 kg/acre. Moong sowing ideal now.',urgency:'low'});
    const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const hw=(dly.time||[]).slice(0,7).map((dt,i)=>{
      const rain=dly.precipitation_sum?.[i]||0;const code=dly.weathercode?.[i]||0;const hi=dly.temperature_2m_max?.[i]||35;
      const bad=rain>3||[61,63,65,80,81,82,95,96,99].includes(code);
      const best=!bad&&hi<39&&hi>15;
      return{date:dt,day:DAYS[new Date(dt).getDay()],quality:bad?'bad':best?'best':'ok',rain:Math.round(rain*10)/10,hi:Math.round(hi)};
    });
    return{
      current:{temp:Math.round(cw.temperature||30),feelsLike:Math.round(h.apparent_temperature?.[ni]||cw.temperature||30),humidity:h.relativehumidity_2m?.[ni]||60,windGust:Math.round(maxGust),rain72h:Math.round(rain72*10)/10,code:cw.weathercode||0},
      daily:(dly.time||[]).slice(0,7).map((dt,i)=>({date:dt,day:DAYS[new Date(dt).getDay()],code:dly.weathercode?.[i]||0,hi:Math.round(dly.temperature_2m_max?.[i]||30),lo:Math.round(dly.temperature_2m_min?.[i]||20),rain:Math.round((dly.precipitation_sum?.[i]||0)*10)/10})),
      hourly:(h.time||[]).slice(ni,ni+24).map((t,i)=>({time:t,temp:Math.round(h.temperature_2m?.[ni+i]||30),rain:h.rain?.[ni+i]||0,code:h.weathercode?.[ni+i]||0})),
      harvestWindow:hw,advisories:ads,source:'open-meteo',at:new Date().toISOString()
    };
  }catch(e){
    return{current:{temp:36,feelsLike:39,humidity:55,windGust:18,rain72h:2.4,code:1},daily:[],hourly:[],harvestWindow:[],advisories:[{icon:'📅',crop:'Cotton/Maize',msg:'March is ideal for summer crop sowing. Prepare beds now.',urgency:'low'}],source:'fallback',at:new Date().toISOString()};
  }
}

/* ── MAIN ── */
export default {
  async fetch(request, env) {
    if(request.method==='OPTIONS') return new Response('',{headers:CORS});
    const url=new URL(request.url);
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';

    /* Health */
    if(request.method==='GET'){
      return ok({service:'Parjanya AI',status:'ok',gemini:!!env.GEMINI_API_KEY,v:'2.0',time:new Date().toISOString()});
    }
    if(request.method!=='POST') return err('POST only',405);

    let body;
    try{body=await request.json();}catch{return err('Invalid JSON');}

    const path=url.pathname;

    /* /weather */
    if(path==='/weather'){
      return ok(await fetchWeather(body.lat||15.45,body.lon||75.01));
    }

    /* /market */
    if(path==='/market'){
      return ok(await fetchMarket());
    }

    /* /vision */
    if(path==='/vision'||body.isVision){
      if(!rateOk(ip+':v',5)) return err('Too many scans. Wait 1 minute.',429);
      if(!env.GEMINI_API_KEY) return err('GEMINI_API_KEY not set',500);
      const{imageBase64,mimeType='image/jpeg',cropHint=''}=body;
      if(!imageBase64) return err('No image');
      if(imageBase64.length>5_600_000) return err('Image too large — max 4MB');
      if(!['image/jpeg','image/png','image/webp'].includes(mimeType)) return err('Only JPEG/PNG/WebP');
      try{
        const r=await fetch(GEMINI(env.GEMINI_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          systemInstruction:{parts:[{text:VIS+(cropHint?`\n\nFarmer says: ${cropHint} crop`:'')}]},
          contents:[{role:'user',parts:[{inlineData:{mimeType,data:imageBase64}},{text:`Analyse this ${cropHint||'crop'} image. JSON only.`}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:600,responseMimeType:'application/json'}
        })});
        if(!r.ok) throw new Error('Gemini '+r.status);
        const d=await r.json();
        const raw=d.candidates?.[0]?.content?.parts?.[0]?.text||'{}';
        let res;try{res=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch{res={unclear:true,confidence:0};}
        res.analyzedAt=new Date().toISOString();
        return ok(res);
      }catch(e){
        return ok({error:true,disease:'Analysis failed',confidence:0,message:'Take a clear close-up in good light and try again.',kannada:'ಸ್ಪಷ್ಟ ಬೆಳಕಿನಲ್ಲಿ ಫೋಟೋ ತೆಗೆದು ಮತ್ತೆ ಕಳಿಸಿ.'});
      }
    }

    /* /chat — handles POST /chat (and any unknown path as fallback) */
    if(path !== '/chat' && path !== '/') return ok({error:true, message:'Unknown endpoint: '+path}, 404);
    if(!rateOk(ip)) return ok({reply:'⏳ Too many messages. Wait 1 minute.'});
    if(!env.GEMINI_API_KEY) return ok({reply:'⚙️ GEMINI_API_KEY not set. Go to Cloudflare Dashboard → Workers → Settings → Variables → Add GEMINI_API_KEY\n\nGet free key: aistudio.google.com/app/apikey'});

    const{message,history=[],profile={},lang:lh}=body;
    if(!message?.trim()) return ok({reply:'Please send a message.'});
    const msg=message.trim().substring(0,1500);
    if(blocked(msg)) return ok({reply:'I only help with farming — crops, soil, pests, weather, mandi prices. 🌾'});
    const lang=lh||detectLang(msg);
    const contents=[...history.slice(-10).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:(m.content||'').substring(0,600)}]})),{role:'user',parts:[{text:msg}]}];
    try{
      const r=await fetch(GEMINI(env.GEMINI_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:chatSystem(profile,lang)}]},contents,generationConfig:{temperature:0.7,maxOutputTokens:550}})});
      if(!r.ok) throw new Error('Gemini '+r.status);
      const d=await r.json();
      return ok({reply:d.candidates?.[0]?.content?.parts?.[0]?.text||'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ / Please try again. 🙏'});
    }catch(e){
      console.error('[chat]',e.message);
      return ok({reply:'Network error. Please try again. 🙏'});
    }
  }
};
