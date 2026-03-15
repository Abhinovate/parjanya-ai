/**
 * PARJANYA AI — Live Weather & Market API
 * Netlify Function: /.netlify/functions/live-data
 * Env vars: OPENWEATHER_API_KEY, DATA_GOV_API_KEY (optional)
 */
const fetch = require("node-fetch");
const rateMap = new Map();
function rateOk(ip){const now=Date.now();const times=(rateMap.get(ip)||[]).filter(t=>now-t<60000);if(times.length>=30)return false;times.push(now);rateMap.set(ip,times);return true;}

// SECURITY VAULT: mask GPS to 10km grid
function maskCoords(lat,lon){return{lat:Math.round(parseFloat(lat)*10)/10,lon:Math.round(parseFloat(lon)*10)/10};}

function analyzeCropRisk(hourly,crop){
  const alerts=[];const h48=hourly.slice(0,48);
  const totalRain=h48.reduce((s,h)=>s+(h.rain?.["1h"]||0),0);
  const maxHumidity=Math.max(...h48.map(h=>h.humidity||60));
  const minTemp=Math.min(...h48.map(h=>h.temp||25));
  const maxTemp=Math.max(...h48.map(h=>h.temp||25));
  if(totalRain>20)alerts.push({type:"heavy_rain",severity:totalRain>50?"high":"medium",title:"Heavy Rain Alert — "+totalRain.toFixed(0)+"mm in 48h",action:{tomato:"Harvest ripe fruits. Spray Mancozeb 75 WP as cover.",onion:"URGENT: Harvest immediately — rain causes 35% cracking loss.",cotton:"Harvest all open bolls now.",default:"Harvest ready crops. Ensure drainage."}[crop?.toLowerCase()]||{tomato:"",onion:"",cotton:"",default:"Harvest ready crops. Ensure drainage."}["default"]});
  if(maxHumidity>85)alerts.push({type:"disease_risk",severity:"medium",title:"High Humidity — Disease Risk "+maxHumidity+"%",action:{tomato:"Preventive spray: Mancozeb 75 WP 2g/litre.",paddy:"Monitor blast. Maintain drainage.",default:"Increase monitoring. Consider fungicide."}[crop?.toLowerCase()]||"Increase crop monitoring."});
  if(minTemp<10)alerts.push({type:"cold_stress",severity:"medium",title:"Cold Alert — "+minTemp+"°C expected",action:"Light irrigation at sunset protects from cold."});
  if(maxTemp>42)alerts.push({type:"heat_stress",severity:"medium",title:"Heat Alert — "+maxTemp+"°C expected",action:"Irrigate morning/evening only. Mulch soil."});
  return alerts;
}

async function fetchMandiPrices(crop){
  try{
    const key=process.env.DATA_GOV_API_KEY||"579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
    const url=`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${key}&format=json&offset=0&limit=5&filters[State]=Karnataka&filters[Commodity]=${encodeURIComponent(crop)}`;
    const res=await fetch(url,{signal:AbortSignal.timeout(4000)});
    if(!res.ok)throw new Error(res.status);
    const data=await res.json();
    if(data.records?.length>0)return data.records.map(r=>({market:r.Market,district:r.District,minPrice:+r.Min_Price||0,maxPrice:+r.Max_Price||0,modalPrice:+r.Modal_Price||0,date:r.Arrival_Date}));
    return null;
  }catch(e){return null;}
}

const MOCK_PRICES={tomato:[{market:"Dharwad APMC",modalPrice:1240,minPrice:900,maxPrice:1480,date:"Today(est)"}],onion:[{market:"Hubli APMC",modalPrice:1820,minPrice:1500,maxPrice:2100,date:"Today(est)"}],maize:[{market:"Gadag APMC",modalPrice:1850,minPrice:1700,maxPrice:2000,date:"Today(est)"}],cotton:[{market:"Dharwad APMC",modalPrice:6200,minPrice:5800,maxPrice:6600,date:"Today(est)"}]};
const MOCK_WEATHER={current:{temp:28,humidity:72,description:"partly cloudy",windSpeed:8,uvIndex:6},next48h:{totalRain:14,maxTemp:34,minTemp:22,maxHumidity:85,rainHours:6},daily7:[{day:"Mon",maxTemp:32,minTemp:22,description:"Clear",rain:0,humidity:65},{day:"Tue",maxTemp:30,minTemp:21,description:"Clouds",rain:2,humidity:72},{day:"Wed",maxTemp:28,minTemp:20,description:"Clear",rain:0,humidity:68},{day:"Thu",maxTemp:25,minTemp:19,description:"Rain",rain:14,humidity:90},{day:"Fri",maxTemp:27,minTemp:20,description:"Clear",rain:0,humidity:70},{day:"Sat",maxTemp:31,minTemp:22,description:"Clouds",rain:1,humidity:66},{day:"Sun",maxTemp:33,minTemp:23,description:"Clear",rain:0,humidity:60}]};

exports.handler=async function(event){
  const H={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS"};
  if(event.httpMethod==="OPTIONS")return{statusCode:200,headers:H,body:""};
  if(event.httpMethod!=="POST")return{statusCode:405,headers:H,body:JSON.stringify({error:"Method not allowed"})};
  const ip=event.headers["x-forwarded-for"]||"unknown";
  if(!rateOk(ip))return{statusCode:429,headers:H,body:JSON.stringify({error:"Rate limited"})};
  try{
    const{lat,lon,crop}=JSON.parse(event.body);
    if(!lat||!lon)return{statusCode:400,headers:H,body:JSON.stringify({error:"Location required"})};
    const apiKey=process.env.OPENWEATHER_API_KEY;
    if(!apiKey){
      return{statusCode:200,headers:H,body:JSON.stringify({mock:true,weather:MOCK_WEATHER,mandiPrices:MOCK_PRICES[crop?.toLowerCase()]||MOCK_PRICES.tomato,alerts:[{type:"mock",title:"Add OPENWEATHER_API_KEY to Netlify env vars for live data",severity:"low",action:""}],privacyNote:"GPS masking active"})};
    }
    const{lat:mLat,lon:mLon}=maskCoords(lat,lon);
    const wRes=await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${mLat}&lon=${mLon}&exclude=minutely&appid=${apiKey}&units=metric`,{signal:AbortSignal.timeout(5000)});
    if(!wRes.ok)throw new Error("OWM "+wRes.status);
    const wData=await wRes.json();
    const curr=wData.current;
    const hourly=wData.hourly||[];
    const daily=wData.daily||[];
    const h48=hourly.slice(0,48);
    const weather={
      current:{temp:curr.temp,humidity:curr.humidity,description:curr.weather?.[0]?.description||"",windSpeed:curr.wind_speed,uvIndex:curr.uvi},
      next48h:{totalRain:h48.reduce((s,h)=>s+(h.rain?.["1h"]||0),0),maxTemp:Math.max(...h48.map(h=>h.temp)),minTemp:Math.min(...h48.map(h=>h.temp)),maxHumidity:Math.max(...h48.map(h=>h.humidity)),rainHours:h48.filter(h=>(h.rain?.["1h"]||0)>0.5).length},
      daily7:daily.slice(0,7).map(d=>({day:new Date(d.dt*1000).toLocaleDateString("en-IN",{weekday:"short"}),maxTemp:d.temp.max,minTemp:d.temp.min,description:d.weather?.[0]?.main||"",rain:d.rain||0,humidity:d.humidity}))
    };
    const alerts=analyzeCropRisk(hourly,crop);
    const mandiPrices=crop?(await fetchMandiPrices(crop)||MOCK_PRICES[crop.toLowerCase()]||MOCK_PRICES.tomato):null;
    return{statusCode:200,headers:H,body:JSON.stringify({mock:false,weather,alerts,mandiPrices,mandiSource:mandiPrices?"data.gov.in":"estimated",privacyNote:`GPS masked to ${mLat},${mLon} (10km grid)`,fetchedAt:new Date().toISOString()})};
  }catch(err){
    console.error("live-data:",err.message);
    return{statusCode:200,headers:H,body:JSON.stringify({mock:true,weather:MOCK_WEATHER,mandiPrices:MOCK_PRICES.tomato,alerts:[],message:"Live data unavailable — showing estimates"})};
  }
};
