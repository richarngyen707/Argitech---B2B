import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Fallback rule-based advisory generator for zero-cost / offline / missing key scenarios
function generateRuleBasedAdvisory(params: {
  weather: { temp: number; windSpeed: number; precipitation: number };
  battery: number;
  machinery: string;
  mission: string;
  coordinates: { lat: number; lng: number };
  locationName: string;
  language: string;
  fieldArea?: number;
  prescription?: {
    healthyAreaHa?: number;
    nitrogenAreaHa?: number;
    pestAreaHa?: number;
    totalWaterLiters?: number;
    totalNitrogenLiters?: number;
    totalPesticideLiters?: number;
    isSwarmMode?: boolean;
  };
}): { bullets: string[]; riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"; summary: string } {
  const { weather, battery, machinery, mission, coordinates, locationName, language, fieldArea = 2.5, prescription } = params;

  const healthyHa = prescription?.healthyAreaHa ?? fieldArea * 0.5;
  const nitrogenHa = prescription?.nitrogenAreaHa ?? fieldArea * 0.3;
  const pestHa = prescription?.pestAreaHa ?? fieldArea * 0.2;

  const waterL = prescription?.totalWaterLiters ?? healthyHa * 20;
  const nitrogenL = prescription?.totalNitrogenLiters ?? nitrogenHa * 15;
  const pestL = prescription?.totalPesticideLiters ?? pestHa * 12;
  const totalVolume = waterL + nitrogenL + pestL;

  const estimatedFlightTime = (fieldArea * 7.5).toFixed(1);
  const estimatedEnergy = Math.round(fieldArea * 35);
  const isHeavyMission = fieldArea > 2.5 || totalVolume > 40 || estimatedEnergy > 100;

  const isHighWind = weather.windSpeed > 20;
  const isRain = weather.precipitation > 1.5;
  const isLowBattery = battery <= 20;

  let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
  if (isLowBattery || (isHighWind && machinery.includes("Drone"))) {
    riskLevel = "CRITICAL";
  } else if (isRain || isHighWind || isHeavyMission) {
    riskLevel = isRain || isHighWind ? "HIGH" : "MODERATE";
  } else if (battery < 45 || weather.windSpeed > 14) {
    riskLevel = "MODERATE";
  }

  // Multi-language rule templates enforcing uniform DJI Agras T40 Swarm with 100% Water Spraying:
  // 1. Drone Alpha (DJI Agras T40) -> West Corridor Water Spraying & Micro-Hydration
  // 2. Drone Beta (DJI Agras T40) -> East Corridor Water Spraying & Bio-Shield Protection
  // 3. Autonomous Tractor (Yanmar YK1200) -> Ground Soil Verification & Swarm Sync
  const translations: Record<string, { bullets: string[]; summary: string }> = {
    en: {
      summary: `Simultaneous DJI Agras T40 Swarm Water Spraying & VRA Mission Plan for ${locationName} (${fieldArea.toFixed(1)} ha)`,
      bullets: [
        `💧 Drone Alpha (DJI Agras T40) -> West Corridor Water Spraying: Dispatched to West Sector (${healthyHa.toFixed(1)} ha canopy), delivering ${waterL.toFixed(0)}L Water Mist (200µm) with collision-free parallel swath flight.`,
        `🛡️ Drone Beta (DJI Agras T40) -> East Corridor Water Spraying: Dispatched to East Sector (${pestHa.toFixed(1)} ha targeted protection), delivering ${pestL.toFixed(0)}L Precision Water Bio-Shield at 140µm fine droplets in simultaneous non-interfering sync.`,
        `🚜 Autonomous Tractor (Yanmar YK1200) -> Ground Soil Verification & Swarm Sync: Sub-surface soil compaction diagnostics active; simultaneous dual-drone routes segregated with west/east spatial corridors and RTK ±2.5cm lock.`,
      ],
    },
    vi: {
      summary: `Kế Hoạch Bầy Drone DJI Agras T40 Phun Nước Đồng Thời & Kê Đơn VRA tại ${locationName} (${fieldArea.toFixed(1)} ha)`,
      bullets: [
        `💧 Drone Alpha (DJI Agras T40) -> Phun Nước Hành Lang Tây: Phân công phụ trách Phân khu Tây (${healthyHa.toFixed(1)} ha tán cây), phun ${waterL.toFixed(0)}L nước tạo ẩm vi lượng (200µm) theo luồng bay song song không va chạm.`,
        `🛡️ Drone Beta (DJI Agras T40) -> Phun Nước Hành Lang Đông: Đảm nhiệm Phân khu Đông (${pestHa.toFixed(1)} ha bảo vệ mục tiêu), phun ${pestL.toFixed(0)}L lá chắn sinh học dạng nước (140µm) bay đồng thời không gây cản trở.`,
        `🚜 Máy Kéo Tự Hành (Yanmar YK1200) -> Kiểm Tra Đất & Đồng Bộ Bầy: Giám sát nén đất và độ ẩm rễ; 2 drone bay song song phân làn không gian Tây/Đông an toàn tuyệt đối với RTK ±2.5cm.`,
      ],
    },
    es: {
      summary: `Plan de Misión de Enjambre DJI Agras T40 y Pulverización de Agua en ${locationName} (${fieldArea.toFixed(1)} ha)`,
      bullets: [
        `💧 Dron Alpha (DJI Agras T40) -> Pulverización de Agua Corredor Oeste: Despachado al Sector Oeste (${healthyHa.toFixed(1)} ha), aplicando ${waterL.toFixed(0)}L de Agua / Micro-Hidratación (200µm) en vuelo paralelo sin colisiones.`,
        `🛡️ Dron Beta (DJI Agras T40) -> Pulverización de Agua Corredor Este: Despachado al Sector Este (${pestHa.toFixed(1)} ha), aplicando ${pestL.toFixed(0)}L de Bio-Escudo de Agua (140µm) en sincronización simultánea sin interferencias.`,
        `🚜 Tractor Autónomo (Yanmar YK1200) -> Verificación de Suelo y Sincronización: Muestreo de compactación radicular; enjambre dual en vuelo simultáneo con corredores este/oeste y RTK ±2.5cm.`,
      ],
    },
    fr: {
      summary: `Plan de Mission d'Essaim DJI Agras T40 & Pulvérisation d'Eau à ${locationName} (${fieldArea.toFixed(1)} ha)`,
      bullets: [
        `💧 Drone Alpha (DJI Agras T40) -> Pulvérisation d'Eau Couloir Ouest : Déployé sur le Secteur Ouest (${healthyHa.toFixed(1)} ha), délivrant ${waterL.toFixed(0)}L d'Eau / Micro-Hydratation (200µm) en vol parallèle sans collision.`,
        `🛡️ Drone Bêta (DJI Agras T40) -> Pulvérisation d'Eau Couloir Est : Déployé sur le Secteur Est (${pestHa.toFixed(1)} ha), appliquant ${pestL.toFixed(0)}L de Bio-Bouclier à l'Eau (140µm) en vol simultané non interférant.`,
        `🚜 Tracteur Autonome (Yanmar YK1200) -> Vérification du Sol & Synchronisation : Analyse de compactage racinaire ; vol d'essaim simultané avec couloirs spatiaux Ouest/Est et précision RTK ±2.5cm.`,
      ],
    },
    zh: {
      summary: `${locationName} (${fieldArea.toFixed(1)} ha) 大疆 DJI Agras T40 双机协同水雾喷洒作业计划`,
      bullets: [
        `💧 无人机 Alpha (DJI Agras T40) -> 西区走廊水雾喷洒：专职西区地块 (${healthyHa.toFixed(1)} ha)，喷洒 ${waterL.toFixed(0)}L 纯水微雾 (200µm)，平行航带无干涉飞行。`,
        `🛡️ 无人机 Beta (DJI Agras T40) -> 东区走廊水雾防护：专职东区地块 (${pestHa.toFixed(1)} ha)，喷洒 ${pestL.toFixed(0)}L 精准生物微雾 (140µm)，双机同时起飞协同作业。`,
        `🚜 自动驾驶拖拉机 (Yanmar YK1200) -> 地表土壤墒情验证与多机协同：执行根系压实度巡检；双无人机按东西独立走廊与 RTK ±2.5cm 高精度协同。`,
      ],
    },
    pt: {
      summary: `Plano de Missão de Enxame DJI Agras T40 e Pulverização de Água em ${locationName} (${fieldArea.toFixed(1)} ha)`,
      bullets: [
        `💧 Drone Alpha (DJI Agras T40) -> Pulverização de Água Corredor Oeste: Enviado para o Setor Oeste (${healthyHa.toFixed(1)} ha), aplicando ${waterL.toFixed(0)}L de Água (200µm) em voo paralelo sem colisões.`,
        `🛡️ Drone Beta (DJI Agras T40) -> Pulverização de Água Corredor Leste: Enviado para o Setor Leste (${pestHa.toFixed(1)} ha), aplicando ${pestL.toFixed(0)}L de Bio-Escudo de Água (140µm) em voo simultâneo sem interferências.`,
        `🚜 Trator Autônomo (Yanmar YK1200) -> Verificação de Solo e Sincronização: Análise de compactação subsuperficial; enxame dual simultâneo com corredores oeste/leste e RTK ±2.5cm.`,
      ],
    },
  };

  const localized = translations[language] || translations.en;
  return {
    riskLevel,
    summary: localized.summary,
    bullets: localized.bullets,
  };
}

// In-memory cache & rate-limit cooldown
interface CachedAdvisory {
  data: any;
  timestamp: number;
}
const advisoryCache = new Map<string, CachedAdvisory>();
const CACHE_TTL_MS = 60_000; // 60-second TTL
let geminiCooldownUntil = 0;

// POST /api/advisory endpoint
app.post("/api/advisory", async (req: Request, res: Response) => {
  const { weather, battery, machinery, mission, coordinates, locationName, language, fieldArea, prescription } = req.body || {};

  const safeParams = {
    weather: {
      temp: Number(weather?.temp ?? 28),
      windSpeed: Number(weather?.windSpeed ?? 12),
      precipitation: Number(weather?.precipitation ?? 0),
    },
    battery: Number(battery ?? 85),
    machinery: String(machinery || "DJI Agras T40 Sprayer Drone"),
    mission: String(mission || "Precision Bio-Spraying"),
    coordinates: {
      lat: Number(coordinates?.lat ?? 10.005),
      lng: Number(coordinates?.lng ?? 105.722),
    },
    locationName: String(locationName || "Cần Thơ, Vietnam"),
    language: String(language || "en"),
    fieldArea: Number(fieldArea ?? 2.5),
    prescription: prescription || {},
  };

  // Cache key based on input parameters
  const cacheKey = `${safeParams.locationName}_${safeParams.fieldArea}_${safeParams.language}_${safeParams.machinery}_${safeParams.mission}_${JSON.stringify(safeParams.prescription)}`;
  const now = Date.now();
  const cached = advisoryCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  // If in rate limit / quota cooldown, directly return rule-based advisory
  if (now < geminiCooldownUntil) {
    const fallback = generateRuleBasedAdvisory(safeParams);
    const result = { source: "rule_engine", ...fallback };
    advisoryCache.set(cacheKey, { data: result, timestamp: now });
    return res.json(result);
  }

  const ai = getGeminiClient();
  if (!ai) {
    const fallback = generateRuleBasedAdvisory(safeParams);
    const result = { source: "rule_engine", ...fallback };
    advisoryCache.set(cacheKey, { data: result, timestamp: now });
    return res.json(result);
  }

  try {
    const languageNames: Record<string, string> = {
      en: "English",
      vi: "Vietnamese (Tiếng Việt)",
      es: "Spanish (Español)",
      fr: "French (Français)",
      zh: "Chinese (中文)",
      pt: "Portuguese (Português)",
    };

    const targetLangName = languageNames[safeParams.language] || "English";

    const healthyHa = Number(safeParams.prescription?.healthyAreaHa ?? safeParams.fieldArea * 0.5);
    const nitrogenHa = Number(safeParams.prescription?.nitrogenAreaHa ?? safeParams.fieldArea * 0.3);
    const pestHa = Number(safeParams.prescription?.pestAreaHa ?? safeParams.fieldArea * 0.2);

    const waterL = Number(safeParams.prescription?.totalWaterLiters ?? healthyHa * 20);
    const nitrogenL = Number(safeParams.prescription?.totalNitrogenLiters ?? nitrogenHa * 15);
    const pestL = Number(safeParams.prescription?.totalPesticideLiters ?? pestHa * 12);
    const totalVolume = (waterL + nitrogenL + pestL).toFixed(1);

    const prompt = `You are AgriTwin-B2B, an expert Agritech AI Operations Advisor for autonomous agricultural machinery, variable-rate prescription spraying, and drone swarms.
Analyze the following operational parameters:
- Location: ${safeParams.locationName} (Lat: ${safeParams.coordinates.lat}, Lng: ${safeParams.coordinates.lng})
- Target Field Area: ${safeParams.fieldArea} hectares (ha)
- Water Tank Calculations & Swarm Payload Distribution (VRA Mapping):
  * Healthy Foliar Canopy (West Sector): ${healthyHa.toFixed(2)} ha -> Water / Micro-Hydration: ${waterL.toFixed(1)} Liters (Rate: 15 L/ha)
  * Nutrient Deficit Zone: ${nitrogenHa.toFixed(2)} ha -> Water-Soluble Nutrient: ${nitrogenL.toFixed(1)} Liters (Rate: 15 L/ha)
  * Targeted Protection (East Sector): ${pestHa.toFixed(2)} ha -> Precision Water Bio-Shield: ${pestL.toFixed(1)} Liters (Rate: 20 L/ha)
  * Total Prescribed Water Payload: ${totalVolume} Liters
- Fleet & Execution: ${safeParams.prescription?.isSwarmMode ? 'Simultaneous Dual-Drone Swarm (DJI Agras T40 Alpha West Corridor + Beta East Corridor)' : safeParams.machinery}
- Mission Profile: ${safeParams.mission}
- Weather Conditions: Temperature ${safeParams.weather.temp}°C, Wind Speed ${safeParams.weather.windSpeed} km/h, Precipitation ${safeParams.weather.precipitation} mm/h
- Current Battery Level: ${safeParams.battery}%

Provide an actionable mission advisory with:
1. Overall Risk Level (LOW, MODERATE, HIGH, or CRITICAL)
2. A concise 1-sentence operational summary in ${targetLangName} referencing the ${safeParams.fieldArea} ha field and water spraying distribution
3. Exactly 3 crisp, highly actionable bullet points in ${targetLangName} formatted with exact fleet role division:
   - Bullet 1: "Drone Alpha (DJI Agras T40) -> West Corridor Water Spraying": Dispatched to West Sector (${healthyHa.toFixed(1)} ha), delivering ${waterL.toFixed(0)}L Water Mist (200µm) in collision-free parallel swath flight.
   - Bullet 2: "Drone Beta (DJI Agras T40) -> East Corridor Water Spraying": Dispatched to East Sector (${pestHa.toFixed(1)} ha), delivering ${pestL.toFixed(0)}L Precision Water Bio-Shield (140µm) in simultaneous non-interfering sync.
   - Bullet 3: "Autonomous Tractor (Yanmar YK1200) -> Ground Soil Verification & Swarm Sync": Sub-surface soil compaction diagnostics and autonomous swarm synchronization with west/east spatial corridors and RTK ±2.5cm lock.

IMPORTANT: All text in the response (summary and bullets) MUST be fully translated into ${targetLangName}.
Return valid JSON matching this structure:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "summary": "...",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text?.trim() || "";
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = generateRuleBasedAdvisory(safeParams);
    }

    const payload = {
      source: "gemini_ai",
      riskLevel: parsedData.riskLevel || (safeParams.battery <= 20 ? "CRITICAL" : "LOW"),
      summary: parsedData.summary || `Advisory generated for ${safeParams.locationName}`,
      bullets: Array.isArray(parsedData.bullets) && parsedData.bullets.length > 0
        ? parsedData.bullets.slice(0, 3)
        : generateRuleBasedAdvisory(safeParams).bullets,
    };

    advisoryCache.set(cacheKey, { data: payload, timestamp: now });
    return res.json(payload);
  } catch (err: any) {
    // If rate limited or quota exceeded, set cooldown to avoid spamming Gemini
    geminiCooldownUntil = Date.now() + 60_000;
    const fallback = generateRuleBasedAdvisory(safeParams);
    const payload = {
      source: "rule_engine",
      ...fallback,
    };
    advisoryCache.set(cacheKey, { data: payload, timestamp: now });
    return res.json(payload);
  }
});

// Vite Middleware for development & static serving for production
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AgriTwin-B2B server running on http://localhost:${PORT}`);
  });
}

start();
