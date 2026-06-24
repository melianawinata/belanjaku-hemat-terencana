// Kompres & resize gambar di client pakai Canvas API bawaan browser (tanpa
// dependency tambahan). Mengembalikan base64 (tanpa prefix `data:`) yang siap
// dikirim sebagai inlineData ke Gemini. Mengecilkan ukuran agar aman dari batas
// body serverless Vercel dan mempercepat panggilan vision.
export async function compressImageToBase64(
  file: File,
  maxDim = 1500,
  quality = 0.7,
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gagal memuat gambar."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung browser ini.");
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/jpeg", quality);
  const base64 = out.split(",")[1] ?? "";
  return { base64, mimeType: "image/jpeg" };
}
