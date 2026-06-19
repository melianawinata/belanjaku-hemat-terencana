export function formatRupiah(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  return "Rp " + n.toLocaleString("id-ID");
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString("id-ID");
}

export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function namaBulan(bulan: number): string {
  return NAMA_BULAN[(bulan - 1 + 12) % 12] ?? "";
}

export function labelBulanTahun(bulan: number, tahun: number): string {
  return `${namaBulan(bulan)} ${tahun}`;
}

export function bulanIni(): { bulan: number; tahun: number } {
  const d = new Date();
  return { bulan: d.getMonth() + 1, tahun: d.getFullYear() };
}

export function bulanSebelumnya(bulan: number, tahun: number): { bulan: number; tahun: number } {
  if (bulan === 1) return { bulan: 12, tahun: tahun - 1 };
  return { bulan: bulan - 1, tahun };
}

export function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()} ${namaBulan(d.getMonth() + 1)} ${d.getFullYear()}`;
}

export function formatTanggalWaktu(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const jam = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${formatTanggal(iso)} • ${jam} WIB`;
}
