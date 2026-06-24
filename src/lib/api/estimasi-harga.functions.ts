import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getGeminiConfig } from "../config.server";

// AI price estimation via Gemini. Runs server-only so GEMINI_API_KEY never
// reaches the browser. Used as a *fallback* in the Belanja screen: callers
// only send items that have no histori_harga to fall back on.
//
// Batch by design — the "Perkiraan AI" button estimates the whole list in a
// single call, and the per-row button just sends an array of one.

const itemSchema = z.object({
  nama: z.string().min(1),
  merk: z.string().nullish(),
  satuan: z.string().min(1),
});

const inputSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  // Optional region hint to nudge estimates toward local pricing.
  kota: z.string().nullish(),
});

export type EstimasiItem = z.infer<typeof itemSchema>;

export interface EstimasiHasil {
  harga_estimasi: number;
  harga_min: number;
  harga_max: number;
  keyakinan: "rendah" | "sedang" | "tinggi";
}

// Aligned 1:1 with the input `items` array by index. null = no estimate.
export type EstimasiResponse = (EstimasiHasil | null)[];

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// JSON Schema (OpenAPI subset Gemini accepts) for forced structured output.
const responseSchema = {
  type: "object",
  properties: {
    hasil: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          harga_estimasi: { type: "number" },
          harga_min: { type: "number" },
          harga_max: { type: "number" },
          keyakinan: { type: "string", enum: ["rendah", "sedang", "tinggi"] },
        },
        required: ["index", "harga_estimasi", "harga_min", "harga_max", "keyakinan"],
      },
    },
  },
  required: ["hasil"],
};

function buildPrompt(items: EstimasiItem[], kota?: string | null): string {
  const lokasi = kota?.trim() ? ` di wilayah ${kota.trim()}` : "";
  const daftar = items
    .map((it, i) => {
      const merk = it.merk?.trim() ? `, merk/varian: ${it.merk.trim()}` : "";
      return `${i}. ${it.nama} (satuan: ${it.satuan}${merk})`;
    })
    .join("\n");

  return [
    `Kamu asisten yang memperkirakan harga ritel terkini barang kebutuhan rumah tangga di Indonesia${lokasi}.`,
    "Untuk setiap item di bawah, perkirakan harga PER SATUAN yang diminta (bukan per kemasan lain).",
    "Berikan harga estimasi dalam Rupiah (angka bulat, tanpa titik/koma), beserta rentang minimum dan maksimum yang wajar.",
    'Tingkat keyakinan: "tinggi" untuk barang umum yang harganya stabil, "sedang" bila bervariasi, "rendah" bila kamu tidak yakin atau nama item ambigu.',
    "Jangan mengarang merk tertentu jika tidak disebutkan. Jika ragu, lebih baik beri rentang lebar dan keyakinan rendah.",
    "Sertakan kembali `index` sesuai nomor di daftar.",
    "",
    "Daftar item:",
    daftar,
  ].join("\n");
}

async function callGemini(items: EstimasiItem[], kota?: string | null): Promise<EstimasiResponse> {
  const { apiKey, model, useSearchGrounding } = getGeminiConfig();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di server.");
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: buildPrompt(items, kota) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema,
    },
  };
  // Grounding-ready: flip GEMINI_SEARCH_GROUNDING=true to fetch fresher prices.
  if (useSearchGrounding) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Respons Gemini kosong.");

  let parsed: { hasil?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Respons Gemini bukan JSON yang valid.");
  }

  // Map back to input order by echoed index; missing items stay null.
  const out: EstimasiResponse = items.map(() => null);
  for (const row of parsed.hasil ?? []) {
    const idx = Number(row.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) continue;
    const est = Number(row.harga_estimasi);
    if (!Number.isFinite(est) || est <= 0) continue;
    const min = Number(row.harga_min);
    const max = Number(row.harga_max);
    const keyakinan =
      row.keyakinan === "tinggi" || row.keyakinan === "rendah" ? row.keyakinan : "sedang";
    out[idx] = {
      harga_estimasi: Math.round(est),
      harga_min: Number.isFinite(min) && min > 0 ? Math.round(min) : Math.round(est),
      harga_max: Number.isFinite(max) && max >= est ? Math.round(max) : Math.round(est),
      keyakinan,
    };
  }
  return out;
}

export const estimasiHargaAI = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const hasil = await callGemini(data.items, data.kota);
    return { hasil };
  });
