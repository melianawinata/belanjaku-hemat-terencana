import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getGeminiConfig } from "../config.server";

// Scan struk belanja via Gemini multimodal. Server-only (GEMINI_API_KEY tak
// bocor ke client). Menerima gambar struk (base64) + daftar kandidat item
// rencana, lalu mengembalikan baris struk terstruktur beserta tebakan
// pencocokan ke kandidat. Tidak menyentuh DB — hanya parsing; penyimpanan
// dilakukan di layar review setelah user mengoreksi.

const kandidatSchema = z.object({
  id: z.string(),
  nama: z.string(),
  merk: z.string().nullish(),
  satuan: z.string(),
});

const inputSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
  kandidat: z.array(kandidatSchema).max(100),
});

export type StrukKandidat = z.infer<typeof kandidatSchema>;

export interface StrukItem {
  nama_struk: string;
  nama_normal: string | null;
  qty: number;
  satuan: string | null;
  harga_satuan: number | null;
  harga_total: number;
  match_id: string | null;
  keyakinan: "tinggi" | "sedang" | "rendah";
}

export interface StrukResult {
  toko_terdeteksi: string | null;
  tanggal_terdeteksi: string | null;
  total_struk: number | null;
  items: StrukItem[];
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// JSON Schema (subset OpenAPI Gemini) untuk forced structured output.
const strukSchema = {
  type: "object",
  properties: {
    toko_terdeteksi: { type: "string", nullable: true },
    tanggal_terdeteksi: { type: "string", nullable: true },
    total_struk: { type: "number", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nama_struk: { type: "string" },
          nama_normal: { type: "string", nullable: true },
          qty: { type: "number" },
          satuan: { type: "string", nullable: true },
          harga_satuan: { type: "number", nullable: true },
          harga_total: { type: "number" },
          match_index: { type: "integer", nullable: true },
          keyakinan: { type: "string", enum: ["tinggi", "sedang", "rendah"] },
        },
        required: ["nama_struk", "qty", "harga_total", "match_index", "keyakinan"],
        propertyOrdering: [
          "nama_struk",
          "nama_normal",
          "qty",
          "satuan",
          "harga_satuan",
          "harga_total",
          "match_index",
          "keyakinan",
        ],
      },
    },
  },
  required: ["items"],
  propertyOrdering: ["toko_terdeteksi", "tanggal_terdeteksi", "total_struk", "items"],
};

function buildPrompt(kandidat: StrukKandidat[]): string {
  const daftar = kandidat
    .map((k, i) => `${i} : ${k.nama} : ${k.merk?.trim() || "-"} : ${k.satuan}`)
    .join("\n");

  return [
    "Kamu mengekstrak data dari STRUK BELANJA ritel Indonesia (mis. Alfamart, Indomaret, supermarket). Baca gambar struk dan keluarkan JSON sesuai skema.",
    "",
    "ATURAN:",
    "1. Ekstrak HANYA baris PRODUK yang dibeli. ABAIKAN baris non-produk: Subtotal, Total, PPN/Pajak, Pembulatan, Tunai/Cash, Kembali/Change, Poin, Diskon/Promo sebagai baris sendiri, NPWP, nama kasir, alamat, footer.",
    '2. HARGA dalam Rupiah sebagai angka bulat tanpa titik/koma (mis. "Rp 12.500" -> 12500).',
    "3. harga_total = jumlah yang benar-benar dibayar untuk baris itu (qty x harga satuan, SUDAH dikurangi diskon baris bila diskon menempel pada item).",
    "4. qty: ambil kuantitas; default 1 bila tak tertera. Untuk item timbang (per kg), qty = berat, satuan = kg.",
    '5. Bila satu produk tercetak di beberapa baris (nama lalu "qty x harga" di bawahnya), gabungkan jadi SATU item.',
    '6. nama_struk = teks persis seperti tercetak. nama_normal = versi rapi/panjang (mis. "MNYK GRG 2L" -> "Minyak Goreng 2 liter").',
    '7. PENCOCOKAN: di bawah ada DAFTAR RENCANA BELANJA bernomor. Untuk tiap item struk, set match_index ke nomor kandidat yang paling cocok secara makna (petakan singkatan, mis. "MNYK GRG"=minyak goreng, "TLR"=telur, "BRS"=beras). Bila tak ada yang cocok jelas, match_index = null. JANGAN memaksakan kecocokan.',
    '8. keyakinan: "tinggi" bila yakin, "sedang" bila mirip tapi ragu, "rendah" bila menebak atau tanpa padanan.',
    "9. JANGAN mengarang item yang tidak ada di struk. Bila gambar buram, keluarkan yang terbaca saja dengan keyakinan rendah.",
    "",
    kandidat.length > 0
      ? `DAFTAR RENCANA BELANJA (index : nama : merk : satuan):\n${daftar}`
      : "DAFTAR RENCANA BELANJA kosong — set semua match_index = null.",
  ].join("\n");
}

async function callGemini(input: z.infer<typeof inputSchema>): Promise<StrukResult> {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi di server.");

  const body = {
    contents: [
      {
        parts: [
          { text: buildPrompt(input.kandidat) },
          { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: strukSchema,
    },
  };

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

  let parsed: {
    toko_terdeteksi?: string | null;
    tanggal_terdeteksi?: string | null;
    total_struk?: number | null;
    items?: Array<Record<string, unknown>>;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Respons Gemini bukan JSON yang valid.");
  }

  const n = input.kandidat.length;
  const items: StrukItem[] = [];
  for (const row of parsed.items ?? []) {
    const harga_total = Math.round(Number(row.harga_total));
    if (!Number.isFinite(harga_total) || harga_total <= 0) continue; // buang baris diskon/non-produk yang lolos
    const qty = Number(row.qty) > 0 ? Number(row.qty) : 1;
    const idxRaw = row.match_index;
    const idx = Number.isInteger(idxRaw) ? Number(idxRaw) : -1;
    const match_id = idx >= 0 && idx < n ? input.kandidat[idx].id : null;
    const hargaSatuanRaw = Number(row.harga_satuan);
    const harga_satuan =
      Number.isFinite(hargaSatuanRaw) && hargaSatuanRaw > 0
        ? Math.round(hargaSatuanRaw)
        : Math.round(harga_total / qty);
    const keyakinan =
      row.keyakinan === "tinggi" || row.keyakinan === "sedang" ? row.keyakinan : "rendah";
    items.push({
      nama_struk: String(row.nama_struk ?? "").trim() || "(tak terbaca)",
      nama_normal:
        typeof row.nama_normal === "string" && row.nama_normal.trim()
          ? row.nama_normal.trim()
          : null,
      qty,
      satuan: typeof row.satuan === "string" && row.satuan.trim() ? row.satuan.trim() : null,
      harga_satuan,
      harga_total,
      match_id,
      keyakinan,
    });
  }

  return {
    toko_terdeteksi: typeof parsed.toko_terdeteksi === "string" ? parsed.toko_terdeteksi : null,
    tanggal_terdeteksi:
      typeof parsed.tanggal_terdeteksi === "string" ? parsed.tanggal_terdeteksi : null,
    total_struk: Number.isFinite(Number(parsed.total_struk)) ? Number(parsed.total_struk) : null,
    items,
  };
}

export const scanStrukAI = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    return await callGemini(data);
  });
