import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getFirebaseAdminAuth() {
  if (getApps().length === 0) {
    const configPath = path.resolve(__dirname, "firebase-applet-config.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (!parsed.projectId) {
      throw new Error("projectId tidak ditemukan di firebase-applet-config.json");
    }
    initializeApp({ projectId: parsed.projectId });
  }
  return getAuth(getApp());
}

interface RateLimitBucket {
  timestamps: number[];
}

function createSlidingWindowLimiter(options: {
  maxRequests: number;
  windowMs: number;
  maxBuckets?: number;
}) {
  const buckets = new Map<string, RateLimitBucket>();
  const maxBuckets = options.maxBuckets ?? 5000;

  return function checkRateLimit(key: string, now = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
    resetEpochSeconds: number;
  } {
    const cutoff = now - options.windowMs;
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxBuckets) {
        for (const [k, b] of buckets.entries()) {
          const active = b.timestamps.filter((ts) => ts > cutoff);
          if (active.length === 0) {
            buckets.delete(k);
          } else {
            b.timestamps = active;
          }
          if (buckets.size < maxBuckets) break;
        }
        if (buckets.size >= maxBuckets) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey !== undefined) buckets.delete(oldestKey);
        }
      }
      bucket = { timestamps: [] };
      buckets.set(key, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= options.maxRequests) {
      const oldestActive = bucket.timestamps[0] ?? now;
      const retryAfterMs = Math.max(1000, oldestActive + options.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        resetEpochSeconds: Math.ceil((oldestActive + options.windowMs) / 1000),
      };
    }

    bucket.timestamps.push(now);
    const oldestActive = bucket.timestamps[0] ?? now;
    return {
      allowed: true,
      remaining: Math.max(0, options.maxRequests - bucket.timestamps.length),
      retryAfterSeconds: 0,
      resetEpochSeconds: Math.ceil((oldestActive + options.windowMs) / 1000),
    };
  };
}

function isValidIsoCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function getConfiguredApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!raw || raw === "MY_GEMINI_API_KEY") {
    return null;
  }
  return raw;
}

function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorInfo(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; code?: number; message?: string };
  const message =
    errObj?.message || "Terjadi kesalahan saat menghubungi layanan Gemini AI.";
  let status =
    typeof errObj?.status === "number"
      ? errObj.status
      : typeof errObj?.code === "number"
        ? errObj.code
        : 500;

  if (status === 500) {
    if (message.includes('"code":503') || message.includes("UNAVAILABLE")) {
      status = 503;
    } else if (
      message.includes('"code":429') ||
      message.includes("RESOURCE_EXHAUSTED")
    ) {
      status = 429;
    } else if (
      message.includes('"code":403') ||
      message.includes("PERMISSION_DENIED")
    ) {
      status = 403;
    } else if (
      message.includes('"code":400') ||
      message.includes("API_KEY_INVALID")
    ) {
      status = 400;
    }
  }

  return { status, message };
}

function isAuthError(status: number, message: string): boolean {
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    message.includes("API_KEY_INVALID") ||
    message.includes("PERMISSION_DENIED")
  );
}

function isTransientOrQuotaError(status: number, message: string): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("UNAVAILABLE") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("DEADLINE_EXCEEDED") ||
    message.includes("high demand") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT")
  );
}

function extractRawJsonText(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  const directText = response.text?.trim();
  if (directText) return directText;
  const parts = response.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
  }
  return "";
}

function parsePlanJson(rawText: string): Record<string, unknown> {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx > startIdx) {
      return JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as Record<
        string,
        unknown
      >;
    }
    throw new Error("Format JSON dari respons model AI tidak valid.");
  }
}

function asNonEmptyString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return fallback;
}

function normalizePlan(
  raw: Record<string, unknown>,
  executionDate: string
) {
  const preparationStages = Array.isArray(raw.preparationStages)
    ? raw.preparationStages
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
          phase: asNonEmptyString(item.phase, `Tahap ${index + 1}`),
          title: asNonEmptyString(item.title, "Tahapan Persiapan"),
          description: asNonEmptyString(item.description, "-"),
        }))
    : [];

  const coordinationMeetings = Array.isArray(raw.coordinationMeetings)
    ? raw.coordinationMeetings
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          title: asNonEmptyString(item.title, "Rapat Koordinasi"),
          participants: asNonEmptyString(item.participants, "Tim PusKI"),
          timing: asNonEmptyString(item.timing, "Sebelum pelaksanaan"),
          agenda: asNonEmptyString(item.agenda, "-"),
        }))
    : [];

  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          dateRange: asNonEmptyString(item.dateRange, executionDate),
          milestone: asNonEmptyString(item.milestone, "-"),
          picRole: asNonEmptyString(item.picRole, "Tim Pelaksana PusKI"),
        }))
    : [];

  const supportingRequirements = Array.isArray(raw.supportingRequirements)
    ? raw.supportingRequirements
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          category: asNonEmptyString(item.category, "Pendukung"),
          item: asNonEmptyString(item.item, "-"),
        }))
    : [];

  const stageOutputs = Array.isArray(raw.stageOutputs)
    ? raw.stageOutputs
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
          stage: asNonEmptyString(item.stage, `Tahap ${index + 1}`),
          output: asNonEmptyString(item.output, "-"),
          indicator: asNonEmptyString(item.indicator, "-"),
        }))
    : [];

  return {
    summary: asNonEmptyString(raw.summary),
    suggestedCategory: asNonEmptyString(
      raw.suggestedCategory,
      "Rapat Persiapan"
    ),
    suggestedPrepStartDate: normalizeIsoDate(
      raw.suggestedPrepStartDate,
      executionDate
    ),
    suggestedReminderDate: normalizeIsoDate(
      raw.suggestedReminderDate,
      executionDate
    ),
    recommendedTargetOutput: asNonEmptyString(raw.recommendedTargetOutput),
    preparationStages,
    coordinationMeetings,
    timeline,
    supportingRequirements,
    stageOutputs,
  };
}

const PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Ringkasan strategis pelaksanaan kegiatan (2-3 kalimat).",
    },
    suggestedCategory: {
      type: Type.STRING,
      description:
        "Salah satu kategori: Sidang dan Forum Internasional, Rapat Koordinasi, Rapat Persiapan, Kerja Sama Bilateral, Kerja Sama Multilateral, Kunjungan Delegasi, Pelatihan dan Capacity Building, atau Lainnya.",
    },
    suggestedPrepStartDate: {
      type: Type.STRING,
      description: "Saran tanggal mulai persiapan dalam format YYYY-MM-DD.",
    },
    suggestedReminderDate: {
      type: Type.STRING,
      description: "Saran tanggal pengingat utama dalam format YYYY-MM-DD.",
    },
    recommendedTargetOutput: {
      type: Type.STRING,
      description: "Rumusan target output utama kegiatan secara ringkas dan terukur.",
    },
    preparationStages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING, description: "Nomor/kode fase, misal Tahap 1" },
          title: { type: Type.STRING, description: "Judul tahapan persiapan" },
          description: { type: Type.STRING, description: "Uraian langkah operasional" },
        },
        required: ["phase", "title", "description"],
      },
    },
    coordinationMeetings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Nama rapat koordinasi" },
          participants: { type: Type.STRING, description: "Unsur peserta/instansi terlibat" },
          timing: { type: Type.STRING, description: "Waktu pelaksanaan yang disarankan (misal H-21)" },
          agenda: { type: Type.STRING, description: "Agenda pembahasan utama" },
        },
        required: ["title", "participants", "timing", "agenda"],
      },
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dateRange: { type: Type.STRING, description: "Rentang tanggal pelaksanaan tahap" },
          milestone: { type: Type.STRING, description: "Tonggak kegiatan utama" },
          picRole: { type: Type.STRING, description: "Penanggung jawab fungsional" },
        },
        required: ["dateRange", "milestone", "picRole"],
      },
    },
    supportingRequirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "Kelompok kebutuhan (Substansi, Administrasi, Logistik, Protokol)" },
          item: { type: Type.STRING, description: "Rincian kebutuhan pendukung" },
        },
        required: ["category", "item"],
      },
    },
    stageOutputs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stage: { type: Type.STRING, description: "Nama tahapan" },
          output: { type: Type.STRING, description: "Target output terukur" },
          indicator: { type: Type.STRING, description: "Indikator keberhasilan" },
        },
        required: ["stage", "output", "indicator"],
      },
    },
  },
  required: [
    "summary",
    "suggestedCategory",
    "suggestedPrepStartDate",
    "suggestedReminderDate",
    "recommendedTargetOutput",
    "preparationStages",
    "coordinationMeetings",
    "timeline",
    "supportingRequirements",
    "stageOutputs",
  ],
};

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "64kb" }));

  const adminAuth = getFirebaseAdminAuth();
  const aiPlannerIpLimiter = createSlidingWindowLimiter({
    maxRequests: 30,
    windowMs: 60_000,
  });
  const aiPlannerUserBurstLimiter = createSlidingWindowLimiter({
    maxRequests: 5,
    windowMs: 60_000,
  });
  const aiPlannerUserWindowLimiter = createSlidingWindowLimiter({
    maxRequests: 20,
    windowMs: 15 * 60_000,
  });

  app.get("/api/ai-status", (_req, res) => {
    const apiKey = getConfiguredApiKey();
    res.json({
      configured: Boolean(apiKey),
    });
  });

  app.post("/api/ai-planner", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const ipCheck = aiPlannerIpLimiter(clientIp);
    if (!ipCheck.allowed) {
      res.setHeader("Retry-After", String(ipCheck.retryAfterSeconds));
      res.status(429).json({
        configured: true,
        error: `Terlalu banyak permintaan dari alamat ini. Silakan tunggu ${ipCheck.retryAfterSeconds} detik sebelum mencoba lagi.`,
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        configured: true,
        error:
          "Autentikasi Firebase diperlukan. Silakan login terlebih dahulu sebelum mengakses AI Activity Planner.",
      });
      return;
    }

    const idToken = authHeader.slice("Bearer ".length).trim();
    if (!idToken) {
      res.status(401).json({
        configured: true,
        error: "Token autentikasi tidak ditemukan.",
      });
      return;
    }

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      res.status(401).json({
        configured: true,
        error:
          "Token autentikasi Firebase tidak valid atau telah kedaluwarsa. Silakan login kembali.",
      });
      return;
    }

    if (decodedToken.email_verified !== true) {
      res.status(403).json({
        configured: true,
        error:
          "Akun belum terverifikasi email untuk mengakses AI Activity Planner.",
      });
      return;
    }

    const burstCheck = aiPlannerUserBurstLimiter(decodedToken.uid);
    const windowCheck = aiPlannerUserWindowLimiter(decodedToken.uid);
    res.setHeader("X-RateLimit-Limit", "5");
    res.setHeader("X-RateLimit-Remaining", String(burstCheck.remaining));
    res.setHeader("X-RateLimit-Reset", String(burstCheck.resetEpochSeconds));

    if (!burstCheck.allowed || !windowCheck.allowed) {
      const retryAfter = Math.max(
        burstCheck.retryAfterSeconds,
        windowCheck.retryAfterSeconds,
        1
      );
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        configured: true,
        error: `Batas laju permintaan AI Activity Planner untuk akun Anda tercapai. Silakan tunggu ${retryAfter} detik sebelum mencoba lagi.`,
      });
      return;
    }

    const apiKey = getConfiguredApiKey();
    if (!apiKey) {
      res.status(503).json({
        configured: false,
        error:
          "Integrasi Gemini AI belum terkonfigurasi di lingkungan aplikasi ini. Silakan atur GEMINI_API_KEY melalui panel Settings > Secrets di Google AI Studio.",
      });
      return;
    }

    const { activityName, executionDate, team, additionalContext } = req.body ?? {};
    if (
      typeof activityName !== "string" ||
      !activityName.trim() ||
      typeof executionDate !== "string" ||
      !executionDate.trim()
    ) {
      res.status(400).json({
        configured: true,
        error: "Nama kegiatan dan tanggal pelaksanaan wajib diisi.",
      });
      return;
    }

    const cleanActivityName = activityName.trim();
    const cleanExecutionDate = executionDate.trim();
    const cleanTeam = typeof team === "string" ? team.trim() : "";
    const cleanContext =
      typeof additionalContext === "string" ? additionalContext.trim() : "";

    if (cleanActivityName.length > 300) {
      res.status(400).json({
        configured: true,
        error: "Nama kegiatan maksimal 300 karakter.",
      });
      return;
    }

    if (!isValidIsoCalendarDate(cleanExecutionDate)) {
      res.status(400).json({
        configured: true,
        error: "Format tanggal pelaksanaan harus YYYY-MM-DD yang valid.",
      });
      return;
    }

    if (cleanTeam.length > 120 || cleanContext.length > 1000) {
      res.status(400).json({
        configured: true,
        error: "Panjang nama tim atau konteks tambahan melebihi batas.",
      });
      return;
    }

    try {
      const ai = createGeminiClient(apiKey);
      const todayIso = new Date().toISOString().slice(0, 10);

      const prompt = [
        "Anda adalah perencana program senior dan diplomat kelembagaan internasional pada Pusat Kelembagaan Internasional (PusKI), Kementerian Komunikasi dan Digital Republik Indonesia.",
        `Tanggal referensi hari ini: ${todayIso}.`,
        `Susun rencana kerja operasional yang terstruktur, realistis, dan siap dieksekusi dalam Bahasa Indonesia formal untuk kegiatan berikut:`,
        `- Nama Kegiatan: ${activityName.trim()}`,
        `- Target Tanggal Pelaksanaan: ${executionDate.trim()}`,
        team ? `- Tim Pelaksana: ${String(team).trim()}` : "",
        additionalContext ? `- Konteks Tambahan: ${String(additionalContext).trim()}` : "",
        "",
        "Ketentuan penyusunan:",
        "1. Hitung tanggal mundur persiapan dan tanggal pengingat yang masuk akal menuju tanggal pelaksanaan (format YYYY-MM-DD).",
        "2. Berikan 4-6 tahapan persiapan kronologis beserta deskripsi konkret.",
        "3. Berikan 3-5 rapat koordinasi yang diperlukan (internal PusKI, lintas unit Kemkomdigi, maupun antar-kementerian/mitra internasional seperti Kemlu atau delegasi terkait).",
        "4. Susun timeline kegiatan dengan rentang tanggal spesifik menjelang hari-H.",
        "5. Rinci kebutuhan pendukung (substansi/dokumen, protokol & keimigrasian, logistik/rapat, anggaran/administrasi).",
        "6. Tetapkan target output terukur untuk setiap tahapan.",
      ]
        .filter(Boolean)
        .join("\n");

      const modelAttempts: Array<{
        model: string;
        thinkingLevel?: ThinkingLevel;
        delayBeforeMs: number;
      }> = [
        { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW, delayBeforeMs: 0 },
        { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW, delayBeforeMs: 900 },
        { model: "gemini-3.1-flash-lite", delayBeforeMs: 900 },
        { model: "gemini-3.1-flash-lite", delayBeforeMs: 1800 },
      ];

      let lastError: unknown = null;
      let rawText = "";

      for (const attempt of modelAttempts) {
        if (attempt.delayBeforeMs > 0) {
          await sleep(attempt.delayBeforeMs);
        }

        try {
          const response = await ai.models.generateContent({
            model: attempt.model,
            contents: prompt,
            config: {
              systemInstruction:
                "Berikan jawaban murni dalam format JSON terstruktur sesuai schema, menggunakan Bahasa Indonesia baku tata kelola pemerintahan dan diplomasi digital Indonesia.",
              responseMimeType: "application/json",
              responseSchema: PLAN_RESPONSE_SCHEMA,
              ...(attempt.thinkingLevel
                ? { thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
                : {}),
            },
          });

          const extracted = extractRawJsonText(response);
          if (extracted) {
            rawText = extracted;
            break;
          }
          lastError = new Error("Model AI mengembalikan respons kosong.");
        } catch (attemptErr: unknown) {
          lastError = attemptErr;
          const { status, message } = getErrorInfo(attemptErr);
          console.warn(
            `[AI Planner] Attempt failed (${attempt.model}, status=${status}): ${message}`
          );
          if (isAuthError(status, message)) {
            throw attemptErr;
          }
          if (!isTransientOrQuotaError(status, message)) {
            throw attemptErr;
          }
        }
      }

      if (!rawText) {
        if (lastError) {
          throw lastError;
        }
        res.status(502).json({
          configured: true,
          error:
            "Model Gemini AI tidak mengembalikan respons teks. Silakan coba beberapa saat lagi.",
        });
        return;
      }

      const parsed = parsePlanJson(rawText);
      const plan = normalizePlan(parsed, executionDate.trim());

      res.json({
        configured: true,
        plan,
      });
    } catch (error: unknown) {
      const { status, message } = getErrorInfo(error);
      console.error("[AI Planner] Final generation error:", status, message);

      if (isAuthError(status, message)) {
        res.status(status).json({
          configured: false,
          error:
            "Kunci API Gemini tidak valid atau belum memiliki izin. Periksa pengaturan GEMINI_API_KEY pada panel Settings > Secrets.",
        });
        return;
      }

      if (status === 429 || message.includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({
          configured: true,
          error:
            "Batas kuota permintaan Gemini AI sedang tercapai. Silakan tunggu sejenak lalu coba kembali.",
        });
        return;
      }

      if (status === 503 || message.includes("UNAVAILABLE")) {
        res.status(503).json({
          configured: true,
          error:
            "Layanan model Gemini AI sedang mengalami lonjakan permintaan sementara. Silakan coba kembali beberapa saat lagi.",
        });
        return;
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        configured: true,
        error: `Gagal menghasilkan rencana AI: ${message}`,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build assets not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PusKI Activity Management Dashboard running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
