/**
 * PARJANYA AI — Computer Vision Pest & Disease Detection
 * Function: /.netlify/functions/vision-detect
 * Env: OPENAI_API_KEY
 * Max image: 4MB | Rate limit: 10/min/IP
 * Security: Images processed in memory, never stored
 */
const fetch = require("node-fetch");

const visionMap = new Map();
function visionOk(ip){const now=Date.now();const t=(visionMap.get(ip)||[]).filter(x=>now-x<60000);if(t.length>=10)return false;t.push(now);visionMap.set(ip,t);return true;}

const SYSTEM = `You are an expert agricultural plant pathologist specializing in Karnataka, India crops.
Analyze the crop leaf/plant image. Return JSON ONLY (no markdown).
Schema: {"disease":"common name","scientificName":"Genus sp.","confidence":75,"severity":"moderate","symptomsObserved":"what you see","treatment":"product + dose + method","urgency":"within48h","affectedCrops":["tomato"],"prevention":"long-term advice","disclaimer":"Verify with Raitha Samparka Kendra before applying any pesticide.","healthy":false,"unclear":false,"kannada":"ಕನ್ನಡ ಸಲಹೆ"}
Rules: confidence 50-95. If unclear image say unclear:true. If healthy say healthy:true. Use Indian units ml/litre g/litre kg/acre. Be specific and actionable.`;

exports.handler = async function(event){
  const H={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS"};
  if(event.httpMethod==="OPTIONS")return{statusCode:200,headers:H,body:""};
  if(event.httpMethod!=="POST")return{statusCode:405,headers:H,body:JSON.stringify({error:"Method not allowed"})};
  const ip=event.headers["x-forwarded-for"]||"unknown";
  if(!visionOk(ip))return{statusCode:429,headers:H,body:JSON.stringify({error:"Too many uploads. Wait 1 minute."})};

  try{
    const{imageBase64,mimeType="image/jpeg",cropHint="",langHint="en"}=JSON.parse(event.body);
    if(!imageBase64)return{statusCode:400,headers:H,body:JSON.stringify({error:"No image provided"})};
    if(!["image/jpeg","image/png","image/webp"].includes(mimeType))return{statusCode:400,headers:H,body:JSON.stringify({error:"Only JPEG/PNG/WebP accepted"})};
    if(imageBase64.length>5_500_000)return{statusCode:400,headers:H,body:JSON.stringify({error:"Image too large — use photo under 4MB"})};

    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return{statusCode:200,headers:H,body:JSON.stringify({mock:true,disease:"Demo — Add OPENAI_API_KEY to Netlify env vars",confidence:0,treatment:"Real GPT-4o Vision analysis runs when API key is configured.",kannada:"OPENAI_API_KEY ಸೇರಿಸಿ."})};

    const userText=cropHint?`Analyze this ${cropHint} crop for diseases/pests. JSON only.`:"Analyze this crop leaf for diseases, pests, or deficiencies. JSON only.";
    const sysPrompt=SYSTEM+(cropHint?` Farmer says this is ${cropHint}.`:"")+( langHint==="kn"?" Kannada field must be in Kannada script.":"");

    const res=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
      body:JSON.stringify({
        model:"gpt-4o",max_tokens:600,
        messages:[
          {role:"system",content:sysPrompt},
          {role:"user",content:[
            {type:"image_url",image_url:{url:`data:${mimeType};base64,${imageBase64}`,detail:"high"}},
            {type:"text",text:userText}
          ]}
        ],
        response_format:{type:"json_object"}
      })
    });

    if(!res.ok)throw new Error("OpenAI "+res.status);
    const data=await res.json();
    const raw=data.choices?.[0]?.message?.content;
    if(!raw)throw new Error("Empty vision response");

    let result;
    try{result=JSON.parse(raw);}catch(e){const m=raw.match(/\{[\s\S]+\}/);if(m)result=JSON.parse(m[0]);else throw new Error("Parse failed");}
    result.analyzedAt=new Date().toISOString();
    result.model="gpt-4o-vision";
    result.tokensUsed=data.usage?.total_tokens||0;
    return{statusCode:200,headers:H,body:JSON.stringify(result)};

  }catch(err){
    console.error("vision-detect:",err.message);
    return{statusCode:200,headers:H,body:JSON.stringify({error:true,disease:"Analysis failed",message:"Take a clear, well-lit close-up photo of the affected leaf and try again.",treatment:"Ensure good lighting, hold camera 20-30cm from leaf.",confidence:0,kannada:"ಸ್ಪಷ್ಟ ಬೆಳಕಿನಲ್ಲಿ ಹತ್ತಿರದ ಫೋಟೋ ತೆಗೆದು ಮತ್ತೆ ಕಳಿಸಿ."})};
  }
};
