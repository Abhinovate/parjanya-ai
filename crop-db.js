/**
 * PARJANYA AI — OFFLINE CROP INTELLIGENCE DATABASE
 * ══════════════════════════════════════════════════
 * Loaded by Service Worker. Works with zero internet.
 * Covers Karnataka's top 12 crops × common diseases,
 * pests, soil deficiencies, and market timing heuristics.
 *
 * Structure per entry:
 *   keywords   — trigger words in any supported language
 *   disease    — diagnosis name
 *   confidence — offline confidence (lower than live AI)
 *   symptoms   — what to look for
 *   treatment  — exact product + dose
 *   prevention — long-term advice
 *   urgency    — 'immediate' | 'within48h' | 'monitor'
 *   season     — 'kharif' | 'rabi' | 'both'
 *   crops      — which crops this affects
 */

const OFFLINE_DB = {

  version: "2.1.0",
  lastUpdated: "2026-01",
  crops: ["tomato","onion","cotton","maize","paddy","sugarcane","groundnut","sunflower","soybean","ragi","jowar","chilli"],

  /* ══════════════════════════════════════════════
     DISEASES — TOMATO
  ══════════════════════════════════════════════ */
  diseases: [
    {
      id: "TOM-001",
      keywords: ["yellow leaf","yellow spot","ಹಳದಿ ಎಲೆ","हल्दी पत्ता","brown ring","alternaria","early blight","tomato blight"],
      crops: ["tomato"],
      disease: "Early Blight (Alternaria solani)",
      confidence: 72,
      urgency: "within48h",
      season: "both",
      symptoms: "Dark brown circular spots with yellow halos on lower leaves. Rings form inside spots like a target. Begins on older leaves first.",
      treatment: "Spray Mancozeb 75 WP @ 2g/litre OR Chlorothalonil 75 WP @ 2g/litre. Repeat every 7-10 days for 3 sprays.",
      prevention: "Remove crop debris after harvest. Avoid overhead irrigation. Maintain 60cm plant spacing. Mulch soil.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "ಹರಡುವ ಮೊದಲೇ Mancozeb 75 WP 2g/litre ನೀರಿಗೆ ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ. 48 ಗಂಟೆಯಲ್ಲಿ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಿ."
    },
    {
      id: "TOM-002",
      keywords: ["late blight","black spot","dark patch","ಕಪ್ಪು ಕಲೆ","phytophthora","water soaked","rotting tomato"],
      crops: ["tomato","potato"],
      disease: "Late Blight (Phytophthora infestans)",
      confidence: 78,
      urgency: "immediate",
      season: "kharif",
      symptoms: "Water-soaked greenish-black patches on leaves and stems. White powdery growth on leaf undersides in humid weather. Fruits develop firm brown rot.",
      treatment: "IMMEDIATE: Remove infected plants/leaves. Spray Metalaxyl + Mancozeb (Ridomil Gold) @ 2.5g/litre. Spray every 5-7 days.",
      prevention: "Plant resistant varieties (PKM-1, Arka Rakshak). Avoid wet foliage. Ensure field drainage.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "ತಕ್ಷಣ ರೋಗಿಷ್ಠ ಎಲೆ ತೆಗೆದು ಸುಡಿ. Metalaxyl + Mancozeb 2.5g/litre ಸಿಂಪಡಿಸಿ."
    },
    {
      id: "TOM-003",
      keywords: ["mosaic","curl leaf","leaf curl","yellow mosaic","virus","ಮೊಸಾಯಿಕ್","curling","stunted growth tomato"],
      crops: ["tomato","chilli"],
      disease: "Tomato Leaf Curl Virus (TLCV)",
      confidence: 65,
      urgency: "immediate",
      season: "both",
      symptoms: "Leaves curl upward, turn yellow, become leathery. New growth is stunted and pale. Whitefly insects visible on leaf undersides.",
      treatment: "No cure for virus. REMOVE infected plants immediately to prevent spread. Spray Imidacloprid 17.8 SL @ 0.3ml/litre to control whitefly vector.",
      prevention: "Install yellow sticky traps. Use reflective mulch. Plant resistant varieties. Border crops of maize or bajra.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "ಈ ರೋಗಕ್ಕೆ ಔಷಧ ಇಲ್ಲ. ರೋಗಿಷ್ಠ ಗಿಡ ತಕ್ಷಣ ಕಿತ್ತು ಸುಡಿ."
    },
    {
      id: "TOM-004",
      keywords: ["fruit borer","worm inside fruit","fruit damage","Helicoverpa","ಹಣ್ಣು ಕೊರೆಯುತ್ತಿದೆ","hole in tomato"],
      crops: ["tomato","chilli","cotton"],
      disease: "Fruit Borer (Helicoverpa armigera)",
      confidence: 85,
      urgency: "within48h",
      season: "both",
      symptoms: "Small holes in fruits. Caterpillars feed inside fruit. Frass (droppings) visible near entry holes. Can cause 60-80% fruit loss if untreated.",
      treatment: "Spray Spinosad 45 SC @ 0.3ml/litre OR Emamectin Benzoate 5 SG @ 0.4g/litre. Apply in evening for best effect.",
      prevention: "Install pheromone traps (1/acre). Intercrop with marigold. Use Bacillus thuringiensis (Bt) spray.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "Spinosad 45 SC 0.3ml/litre ಸಾಯಂಕಾಲ ಸಿಂಪಡಿಸಿ. ಫೆರೊಮೋನ್ ಟ್ರ್ಯಾಪ್ ಹಾಕಿ."
    },

    /* ══════════════════════════════════════════════
       DISEASES — ONION
    ══════════════════════════════════════════════ */
    {
      id: "ONI-001",
      keywords: ["purple blotch","onion purple","ಈರುಳ್ಳಿ ನೇರಳೆ","onion fungus","Alternaria porri","purple onion"],
      crops: ["onion"],
      disease: "Purple Blotch (Alternaria porri)",
      confidence: 80,
      urgency: "within48h",
      season: "rabi",
      symptoms: "Small white lesions with purple centres on leaves. Lesions enlarge with yellow borders. Leaves wither from tip downward. Bulb scales may be infected.",
      treatment: "Spray Mancozeb 75 WP @ 2g/litre + Carbendazim 50 WP @ 1g/litre mixed together. Apply every 7 days for 3-4 applications.",
      prevention: "Treat seeds before sowing. Avoid excessive nitrogen. Ensure good field drainage. Crop rotation with non-allium crops.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "Mancozeb 75 WP 2g + Carbendazim 1g litre ನೀರಿಗೆ ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ."
    },
    {
      id: "ONI-002",
      keywords: ["thrips onion","silver streak","white streak","ಥ್ರಿಪ್ಸ್","scratching","silvery leaves onion"],
      crops: ["onion","chilli","cotton"],
      disease: "Thrips (Thrips tabaci)",
      confidence: 82,
      urgency: "within48h",
      season: "both",
      symptoms: "Silver-white streaks on leaves. Tiny yellowish insects visible on leaf folds. Leaves crinkle and curl. Severe infestation causes crop failure.",
      treatment: "Spray Fipronil 5 SC @ 1ml/litre OR Spinosad 45 SC @ 0.3ml/litre. Target insides of leaf folds where thrips hide.",
      prevention: "Blue sticky traps. Avoid water stress. Avoid excess nitrogen. Intercrop with coriander.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "Fipronil 5 SC 1ml/litre ಎಲೆ ಮಡಿಕೆಗಳ ಒಳಗೂ ಸಿಂಪಡಿಸಿ."
    },

    /* ══════════════════════════════════════════════
       DISEASES — PADDY/RICE
    ══════════════════════════════════════════════ */
    {
      id: "PAD-001",
      keywords: ["blast","rice blast","neck rot","ಭತ್ತ ಬ್ಲಾಸ್ಟ್","eye spot paddy","Pyricularia","grey spot rice"],
      crops: ["paddy"],
      disease: "Rice Blast (Pyricularia oryzae)",
      confidence: 77,
      urgency: "immediate",
      season: "kharif",
      symptoms: "Diamond/eye-shaped grey-white lesions with brown borders on leaves. Neck of panicle turns brown and breaks. Can cause 100% crop loss if neck blast occurs.",
      treatment: "Spray Tricyclazole 75 WP @ 0.6g/litre OR Isoprothiolane 40 EC @ 1.5ml/litre. Apply at early tillering and panicle initiation.",
      prevention: "Use resistant varieties (IR-64, MTU-1010). Balanced NPK — avoid excess nitrogen. Drain water periodically.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "Tricyclazole 75 WP 0.6g/litre ಸಿಂಪಡಿಸಿ. ಸಾರಜನಕ ಗೊಬ್ಬರ ಕಡಿಮೆ ಮಾಡಿ."
    },
    {
      id: "PAD-002",
      keywords: ["brown planthopper","BPH","hopper burn","paddy yellowing","hopperburn","ಎಲೆ ಕಪ್ಪಾಗುತ್ತಿದೆ","circular yellowing paddy"],
      crops: ["paddy"],
      disease: "Brown Planthopper (Nilaparvata lugens)",
      confidence: 80,
      urgency: "immediate",
      season: "kharif",
      symptoms: "Circular yellowing/browning patches in field called 'hopper burn'. Tiny brown insects at base of plants. Crop collapses rapidly in affected patches.",
      treatment: "Drain field. Spray Buprofezin 25 SC @ 1ml/litre OR Thiamethoxam 25 WG @ 0.3g/litre at base of plants.",
      prevention: "Avoid excessive nitrogen. Don't allow continuous flooding. Plant resistant varieties. Conserve natural enemies.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "ತಕ್ಷಣ ನೀರು ಬಸಿದು Buprofezin 1ml/litre ಗಿಡದ ತಳಭಾಗಕ್ಕೆ ಸಿಂಪಡಿಸಿ."
    },

    /* ══════════════════════════════════════════════
       DISEASES — COTTON
    ══════════════════════════════════════════════ */
    {
      id: "COT-001",
      keywords: ["bollworm","pink bollworm","spotty cotton","cotton boll damage","ಹತ್ತಿ ಹುಳು","Pectinophora"],
      crops: ["cotton"],
      disease: "Pink Bollworm (Pectinophora gossypiella)",
      confidence: 82,
      urgency: "immediate",
      season: "kharif",
      symptoms: "Circular entry holes in bolls. Lint staining inside. Pink larvae inside seeds. Damaged bolls fail to open. Seeds have rosetted appearance.",
      treatment: "Spray Chlorpyrifos 20 EC @ 2.5ml/litre OR Profenofos 50 EC @ 2ml/litre. Apply at boll formation stage.",
      prevention: "Pheromone traps (5/acre). Early sowing. Bt cotton varieties. Destroy crop residue after harvest.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "ಫೆರೊಮೋನ್ ಟ್ರ್ಯಾಪ್ ಹಾಕಿ. Chlorpyrifos 20 EC 2.5ml/litre ಸಿಂಪಡಿಸಿ."
    },
    {
      id: "COT-002",
      keywords: ["cotton leaf reddening","red leaf cotton","potassium deficiency cotton","leaf edges brown cotton"],
      crops: ["cotton"],
      disease: "Potassium Deficiency / Leaf Reddening",
      confidence: 68,
      urgency: "within48h",
      season: "kharif",
      symptoms: "Leaf margins turn red or purple. Older leaves affected first. Interveinal yellowing. Premature leaf drop. Associated with sandy soils or waterlogged fields.",
      treatment: "Apply Muriate of Potash (MOP) @ 25 kg/acre as topdressing. Foliar spray of 1% KNO3 (potassium nitrate) for quick relief.",
      prevention: "Soil test before sowing. Apply recommended K fertilizer. Avoid waterlogging.",
      disclaimer: "Get soil test done at Raitha Samparka Kendra to confirm deficiency.",
      kannada: "MOP ಗೊಬ್ಬರ 25 kg/ಎಕರೆ ಹಾಕಿ. ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ."
    },

    /* ══════════════════════════════════════════════
       DISEASES — MAIZE
    ══════════════════════════════════════════════ */
    {
      id: "MAI-001",
      keywords: ["fall armyworm","FAW","corn borer","ಮೆಕ್ಕೆಜೋಳ ಹುಳ","maize leaf holes","window pane maize","caterpillar maize"],
      crops: ["maize"],
      disease: "Fall Armyworm (Spodoptera frugiperda)",
      confidence: 88,
      urgency: "immediate",
      season: "kharif",
      symptoms: "Irregular holes in leaves with fine sawdust-like frass. Window-pane feeding pattern. Caterpillars with inverted Y on head. Attacks whorl stage most severely.",
      treatment: "Spray Emamectin Benzoate 5 SG @ 0.4g/litre into whorl. OR Chlorantraniliprole 18.5 SC @ 0.3ml/litre. Apply in early morning.",
      prevention: "Early sowing. Pheromone traps. Natural enemies (egg parasitoids). Sand+lime mixture into whorl at early stage.",
      disclaimer: "Verify with Raitha Samparka Kendra before applying any pesticide.",
      kannada: "Emamectin Benzoate 0.4g/litre ತಿರಟೆಯ ಒಳಗೆ ಹಾಕಿ. ಬೆಳಿಗ್ಗೆ ಮಾಡಿ."
    },

    /* ══════════════════════════════════════════════
       SOIL DEFICIENCIES
    ══════════════════════════════════════════════ */
    {
      id: "SOIL-001",
      keywords: ["nitrogen deficiency","pale yellow leaves","stunted crop","light green crop","overall yellowing","ಸಾರಜನಕ ಕೊರತೆ","urea deficiency"],
      crops: ["tomato","onion","maize","paddy","cotton","chilli","soybean"],
      disease: "Nitrogen (N) Deficiency",
      confidence: 62,
      urgency: "within48h",
      season: "both",
      symptoms: "Pale yellow-green colour starting from older lower leaves. Stunted plant growth. Thin stems. Yellowing progresses upward.",
      treatment: "Apply Urea @ 20-25 kg/acre as topdressing with irrigation. For quick response: foliar spray of 2% urea solution.",
      prevention: "Split nitrogen application: 1/3 basal, 1/3 at vegetative stage, 1/3 at flowering. Get soil test.",
      disclaimer: "Soil test recommended for accurate dose. Over-application causes burning.",
      kannada: "Urea 20-25 kg/ಎಕರೆ ನೀರಾವರಿ ಜೊತೆ ಹಾಕಿ. ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ."
    },
    {
      id: "SOIL-002",
      keywords: ["zinc deficiency","khaira","white bud","interveinal chlorosis","zinc","ಸತು ಕೊರತೆ","little leaf"],
      crops: ["paddy","maize","wheat","soybean"],
      disease: "Zinc (Zn) Deficiency — Khaira in Paddy",
      confidence: 68,
      urgency: "within48h",
      season: "both",
      symptoms: "Brown-rust spots on lower leaves. Midrib becomes pale. Plants stunted 2-4 weeks after transplanting. New leaves narrowed (little leaf).",
      treatment: "Apply Zinc Sulphate @ 10 kg/acre to soil. OR foliar spray of Zinc Sulphate 0.5% + Lime 0.25% solution.",
      prevention: "Apply Zinc Sulphate 10 kg/acre every 2-3 years. Common in flooded paddy soils.",
      disclaimer: "Soil test to confirm zinc deficiency level.",
      kannada: "Zinc Sulphate 10 kg/ಎಕರೆ ಮಣ್ಣಿಗೆ ಹಾಕಿ ಅಥವಾ 0.5% ದ್ರಾವಣ ಸಿಂಪಡಿಸಿ."
    },
    {
      id: "SOIL-003",
      keywords: ["iron deficiency","young leaves yellow","new leaf yellow","interveinal yellow","iron chlorosis","ಕಬ್ಬಿಣ ಕೊರತೆ"],
      crops: ["soybean","groundnut","tomato","maize"],
      disease: "Iron (Fe) Deficiency",
      confidence: 58,
      urgency: "monitor",
      season: "both",
      symptoms: "Yellowing between veins on young leaves. Veins remain green while leaf tissue yellows. More severe on alkaline/calcareous soils.",
      treatment: "Foliar spray of FeSO4 (Ferrous Sulphate) @ 0.5% solution. Add citric acid 0.1% to improve absorption.",
      prevention: "Avoid overwatering. Soil acidification with sulfur on alkaline soils. Apply organic matter.",
      disclaimer: "Iron deficiency common in black cotton soils of Karnataka. Soil pH test recommended.",
      kannada: "Ferrous Sulphate 0.5% (5g/litre) ಹೊಸ ಎಲೆಗಳ ಮೇಲೆ ಸಿಂಪಡಿಸಿ."
    },

    /* ══════════════════════════════════════════════
       IRRIGATION / WATER STRESS
    ══════════════════════════════════════════════ */
    {
      id: "WATR-001",
      keywords: ["wilting","drooping","water stress","drought stress","ಬಾಡುತ್ತಿದೆ","hanging leaves","crop wilting","morning wilt"],
      crops: ["tomato","chilli","cotton","soybean","groundnut"],
      disease: "Water Stress / Moisture Deficit",
      confidence: 75,
      urgency: "within48h",
      season: "both",
      symptoms: "Leaves drooping and wilting, especially midday. Soil dry 5-6 inches deep. If wilting recovers at night — water stress. If no recovery — possible root disease.",
      treatment: "Irrigate immediately with 3-4 cm water. Apply mulch to conserve moisture. Avoid over-irrigation which causes root rot.",
      prevention: "Drip irrigation reduces water use 40-50%. Mulching with dry grass/plastic. Irrigate in evening, not midday.",
      disclaimer: "If wilting persists after watering, suspect Fusarium wilt fungus — different treatment needed.",
      kannada: "ತಕ್ಷಣ 3-4 cm ನೀರು ಕೊಡಿ. ತಣ್ಣಗಾದ ಮೇಲೂ ಬಾಡಿದ್ರೆ ಬೇರು ರೋಗ ಇರಬಹುದು."
    },

    /* ══════════════════════════════════════════════
       MARKET & SELLING HEURISTICS
    ══════════════════════════════════════════════ */
    {
      id: "MKT-001",
      keywords: ["when sell","selling time","price down","mandi price","sell crop","best price","ಯಾವಾಗ ಮಾರಬೇಕು","ಬೆಲೆ ಎಷ್ಟು","market rate"],
      crops: ["tomato","onion","cotton","maize","paddy","chilli","groundnut"],
      disease: "Market Timing Advisory",
      confidence: 55,
      urgency: "monitor",
      season: "both",
      symptoms: "Offline market guidance only. Live prices unavailable without internet.",
      treatment: "General rules: 1) Sell Monday-Tuesday or Friday-Saturday — avoid Wednesday (typically lowest). 2) Rains = lower prices next 2 days (transport difficulty). 3) Festival weeks = higher demand for vegetables. 4) Check enam.gov.in for live prices when internet available.",
      prevention: "Build storage capacity to avoid distress selling. Join farmer producer organisations (FPO) for better price negotiation.",
      disclaimer: "For live mandi prices: visit enam.gov.in or call your nearest APMC at 1800-180-1551.",
      kannada: "ಆನ್‌ಲೈನ್ ಇಲ್ಲದೆ ನಿಖರ ಬೆಲೆ ಹೇಳಲು ಆಗದು. enam.gov.in ನೋಡಿ ಅಥವಾ 1800-180-1551 ಕರೆ ಮಾಡಿ."
    },

    /* ══════════════════════════════════════════════
       GENERAL WEATHER HEURISTICS
    ══════════════════════════════════════════════ */
    {
      id: "WTH-001",
      keywords: ["rain forecast","rain coming","will it rain","harvest before rain","ಮಳೆ ಬರ್ತದಾ","ಫಸಲು ತೆಗೆಯಲಿ","harvest timing rain"],
      crops: ["tomato","onion","cotton","chilli","soybean"],
      disease: "Pre-Rain Harvest Advisory",
      confidence: 50,
      urgency: "monitor",
      season: "kharif",
      symptoms: "Offline weather advisory only. No live forecast available.",
      treatment: "Karnataka monsoon patterns: SW Monsoon Jun-Sep, NE monsoon Oct-Nov. If your crop is ready and SW monsoon is approaching — harvest within 48 hours of first dark cloud formations from the west. Onion: harvest before any rain prediction to prevent cracking. Cotton: harvest open bolls within 24 hours of rain prediction.",
      prevention: "Cover harvested crop with tarpaulin. Use drying platforms. Avoid harvesting wet crops for storage.",
      disclaimer: "For accurate 48-hour weather: OpenWeatherMap.org or IMD Agromet service at 1800-180-1717.",
      kannada: "ಸಿಗ್ನಲ್ ಇಲ್ಲದೆ ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ ಕೊಡಲು ಆಗದು. IMD: 1800-180-1717 ಕರೆ ಮಾಡಿ."
    }
  ],

  /* ══════════════════════════════════════════════
     GOVERNMENT SCHEMES — offline helplines
  ══════════════════════════════════════════════ */
  schemes: [
    { name: "PM Fasal Bima Yojana", description: "Crop insurance scheme", contact: "1800-200-7710", how: "Register through Common Service Centre or bank before sowing." },
    { name: "PM-KISAN", description: "₹6,000/year direct income support", contact: "155261", how: "Aadhaar-linked bank account required. Register at pmkisan.gov.in." },
    { name: "Raitha Samparka Kendra", description: "Karnataka agri extension services", contact: "1800-425-1188", how: "Visit nearest Raitha Samparka Kendra for soil testing, seeds, advisory." },
    { name: "eNAM", description: "National agricultural market — live mandi prices", contact: "1800-270-0224", how: "Register at enam.gov.in for better market access." },
    { name: "Kisan Call Centre", description: "Free agri advisory by phone", contact: "1800-180-1551", how: "Toll-free. Available in Kannada, Hindi, Telugu. 6 AM to 10 PM." }
  ]

};

/* ── Export ── */
if(typeof window !== 'undefined') window.OFFLINE_DB = OFFLINE_DB;
if(typeof module !== 'undefined') module.exports = OFFLINE_DB;
