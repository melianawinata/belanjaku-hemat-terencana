import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { bulanIni, bulanBerikutnya } from "@/lib/format";

/**
 * "Periode aktif" untuk halaman operasional (belanja, budget, generate, scan,
 * selesai, pengeluaran). User boleh menyiapkan belanja untuk BULAN INI atau
 * BULAN DEPAN — kasus umum: gajian akhir bulan, sudah mulai belanja kebutuhan
 * untuk bulan berikutnya. Periode lampau tetap read-only via menu History,
 * dan dashboard tetap memakai bulan riil (lihat bulanIni()).
 */
export interface Periode {
  bulan: number;
  tahun: number;
}

interface PeriodeContextValue {
  bulan: number;
  tahun: number;
  /** true jika periode aktif adalah bulan depan (bukan bulan berjalan). */
  isBulanDepan: boolean;
  setPeriode: (p: Periode) => void;
}

const PeriodeContext = createContext<PeriodeContextValue | null>(null);

const STORAGE_KEY = "belanjaku.periode-aktif";

/** Ordinal untuk membandingkan periode tanpa ambigu pergantian tahun. */
function ordinal(p: Periode): number {
  return p.tahun * 12 + (p.bulan - 1);
}

function samaPeriode(a: Periode, b: Periode): boolean {
  return a.bulan === b.bulan && a.tahun === b.tahun;
}

export function PeriodeProvider({ children }: { children: ReactNode }) {
  // Selalu mulai dari bulan ini agar render server & klien konsisten (no hydration
  // mismatch). Nilai tersimpan di localStorage diterapkan setelah mount.
  const [periode, setPeriodeState] = useState<Periode>(() => bulanIni());

  // Hanya bulan ini & bulan depan yang valid; lainnya dinormalisasi ke bulan ini.
  const setPeriode = (p: Periode) => {
    const ini = bulanIni();
    const depan = bulanBerikutnya(ini.bulan, ini.tahun);
    const next = samaPeriode(p, depan) ? depan : ini;
    setPeriodeState(next);
    if (typeof window !== "undefined") {
      if (samaPeriode(next, depan))
        localStorage.setItem(STORAGE_KEY, `${next.tahun}-${next.bulan}`);
      else localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Pulihkan pilihan "bulan depan" dari localStorage saat mount. Jika bulan sudah
  // berganti (nilai tersimpan kini < bulan berjalan), abaikan & balik ke bulan ini.
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    const [t, b] = raw.split("-").map(Number);
    if (!t || !b) return;
    const ini = bulanIni();
    const depan = bulanBerikutnya(ini.bulan, ini.tahun);
    const tersimpan = { bulan: b, tahun: t };
    if (samaPeriode(tersimpan, depan) && ordinal(tersimpan) > ordinal(ini)) {
      setPeriodeState(depan);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<PeriodeContextValue>(() => {
    const ini = bulanIni();
    return {
      bulan: periode.bulan,
      tahun: periode.tahun,
      isBulanDepan: ordinal(periode) > ordinal(ini),
      setPeriode,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode.bulan, periode.tahun]);

  return <PeriodeContext.Provider value={value}>{children}</PeriodeContext.Provider>;
}

export function usePeriode(): PeriodeContextValue {
  const ctx = useContext(PeriodeContext);
  if (!ctx) throw new Error("usePeriode harus dipakai di dalam <PeriodeProvider>");
  return ctx;
}
