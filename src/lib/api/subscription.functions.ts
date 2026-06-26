import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getMidtransConfig } from "../config.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Client anon server-side untuk data publik (paket langganan). Tidak butuh
// service role: RLS sudah mengizinkan SELECT paket aktif untuk anon, jadi
// landing page tetap jalan walau SUPABASE_SERVICE_ROLE_KEY belum diisi.
function getAnonClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Langganan berbayar via Midtrans Snap (fase 1: bayar per periode).
//
// Prinsip penting: harga & status SELALU ditentukan server.
//   * createTransaction membaca harga dari tabel `subscription_plans`
//     (bukan dari client) lalu meminta Snap token ke Midtrans.
//   * Pemberian akses (status 'active') TIDAK dilakukan di sini — itu tugas
//     webhook saat Midtrans mengirim settlement/capture. Lihat
//     src/server.ts (`/api/midtrans/webhook`).

const PLAN_CODES = ["plus", "keluarga"] as const;
const CYCLES = ["bulanan", "tahunan"] as const;

export interface PlanInfo {
  code: string;
  nama: string;
  harga_bulanan: number;
  harga_tahunan: number;
}

export interface PendingTxInfo {
  order_id: string;
  plan_code: string;
  cycle: string;
  gross_amount: number;
  expired_at: string | null;
}

export interface MySubscription {
  // Paket aktif (null bila masih Gratis / belum/expired).
  plan: string | null;
  cycle: string | null;
  active_until: string | null;
  // Transaksi menunggu pembayaran yang masih berlaku (untuk banner).
  pending: PendingTxInfo | null;
}

// ---- getPlans: dibaca landing page & checkout (boleh anon) -------------

export const getPlans = createServerFn({ method: "GET" }).handler(async (): Promise<PlanInfo[]> => {
  const supabase = getAnonClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("code, nama, harga_bulanan, harga_tahunan")
    .eq("aktif", true)
    .order("urutan", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    code: p.code,
    nama: p.nama,
    harga_bulanan: Number(p.harga_bulanan),
    harga_tahunan: Number(p.harga_tahunan),
  }));
});

// ---- createTransaction: minta Snap token (wajib login) ----------------

const createInput = z.object({
  plan_code: z.enum(PLAN_CODES),
  cycle: z.enum(CYCLES),
});

export interface CreateTransactionResult {
  token: string;
  client_key: string;
  snap_js_url: string;
  order_id: string;
}

function generateOrderId(planCode: string): string {
  // Maks 50 char, hanya huruf/angka/dash. Cukup unik untuk satu user.
  const rand = Math.random().toString(36).slice(2, 8);
  return `SUB-${planCode}-${Date.now()}-${rand}`.toUpperCase();
}

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createInput)
  .handler(async ({ data, context }): Promise<CreateTransactionResult> => {
    const userId = context.userId as string;
    const { plan_code, cycle } = data;

    const cfg = getMidtransConfig();
    if (!cfg.serverKey || !cfg.clientKey) {
      throw new Error("Konfigurasi Midtrans belum lengkap di server.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Harga otoritatif dari DB.
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("code, nama, harga_bulanan, harga_tahunan")
      .eq("code", plan_code)
      .eq("aktif", true)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (!plan) throw new Error("Paket tidak ditemukan atau tidak aktif.");

    const grossAmount = Math.round(
      Number(cycle === "tahunan" ? plan.harga_tahunan : plan.harga_bulanan),
    );
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      throw new Error("Harga paket tidak valid.");
    }

    // Data customer untuk Snap (best-effort).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nama, email")
      .eq("id", userId)
      .maybeSingle();

    const orderId = generateOrderId(plan_code);
    const EXPIRY_HOURS = 24;
    const expiredAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    // Catat transaksi pending DULU (sumber audit) sebelum panggil Midtrans.
    const { error: insErr } = await supabaseAdmin.from("payment_transactions").insert({
      order_id: orderId,
      user_id: userId,
      plan_code,
      cycle,
      gross_amount: grossAmount,
      status: "pending",
      expired_at: expiredAt,
    });
    if (insErr) throw new Error(insErr.message);

    // Minta Snap token. Basic auth = base64(serverKey + ":").
    const auth = btoa(`${cfg.serverKey}:`);
    const periodeLabel = cycle === "tahunan" ? "Tahunan" : "Bulanan";
    const body = {
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      item_details: [
        {
          id: `${plan_code}-${cycle}`,
          price: grossAmount,
          quantity: 1,
          name: `BelanjaKu ${plan.nama} (${periodeLabel})`.slice(0, 50),
        },
      ],
      customer_details: {
        first_name: profile?.nama?.slice(0, 50) || "Pengguna",
        email: profile?.email || undefined,
      },
      // Batas waktu bayar; transaksi otomatis expire di sisi Midtrans.
      expiry: { unit: "hour", duration: EXPIRY_HOURS },
    };

    const res = await fetch(cfg.snapBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      await supabaseAdmin
        .from("payment_transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      throw new Error(`Midtrans error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as { token?: string; redirect_url?: string };
    if (!json.token) {
      await supabaseAdmin
        .from("payment_transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      throw new Error("Snap token tidak diterima dari Midtrans.");
    }

    await supabaseAdmin
      .from("payment_transactions")
      .update({ snap_token: json.token, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);

    return {
      token: json.token,
      client_key: cfg.clientKey,
      snap_js_url: cfg.snapJsUrl,
      order_id: orderId,
    };
  });

// ---- getMySubscription: status untuk gating & banner (wajib login) ----

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySubscription> => {
    const userId = context.userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const [{ data: sub }, { data: pending }] = await Promise.all([
      supabaseAdmin
        .from("user_subscriptions")
        .select("plan_code, cycle, period_end")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("period_end", nowIso)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("payment_transactions")
        .select("order_id, plan_code, cycle, gross_amount, expired_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .gt("expired_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      plan: sub?.plan_code ?? null,
      cycle: sub?.cycle ?? null,
      active_until: sub?.period_end ?? null,
      pending: pending
        ? {
            order_id: pending.order_id,
            plan_code: pending.plan_code,
            cycle: pending.cycle,
            gross_amount: Number(pending.gross_amount),
            expired_at: pending.expired_at,
          }
        : null,
    };
  });

// ---- getOrderStatus: untuk polling di halaman status (wajib login) ----

const orderInput = z.object({ order_id: z.string().min(1).max(80) });

export interface OrderStatus {
  order_id: string;
  status: string; // status internal: pending|paid|expired|failed|cancelled
  midtrans_status: string | null;
  plan_code: string;
  cycle: string;
  gross_amount: number;
}

// ---- cancelTransaction: batalkan order pending lalu bisa coba lagi --------

export const cancelTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const userId = context.userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx } = await supabaseAdmin
      .from("payment_transactions")
      .select("order_id, status")
      .eq("order_id", data.order_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!tx) throw new Error("Transaksi tidak ditemukan.");
    if (tx.status === "paid") throw new Error("Transaksi sudah dibayar, tidak bisa dibatalkan.");
    if (tx.status !== "pending") return { ok: true }; // sudah tak aktif

    // Best-effort: batalkan juga di Midtrans agar order tak menggantung.
    const cfg = getMidtransConfig();
    if (cfg.serverKey) {
      try {
        await fetch(`${cfg.apiBaseUrl}/${encodeURIComponent(data.order_id)}/cancel`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${cfg.serverKey}:`)}`,
            Accept: "application/json",
          },
        });
      } catch {
        // Abaikan — pembatalan sisi internal tetap dilakukan di bawah.
      }
    }

    await supabaseAdmin
      .from("payment_transactions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("order_id", data.order_id)
      .eq("status", "pending");
    return { ok: true };
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }): Promise<OrderStatus | null> => {
    const userId = context.userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const read = () =>
      supabaseAdmin
        .from("payment_transactions")
        .select("order_id, status, midtrans_status, plan_code, cycle, gross_amount")
        .eq("order_id", data.order_id)
        .eq("user_id", userId)
        .maybeSingle();

    let { data: tx } = await read();
    if (!tx) return null;

    // Rekonsiliasi: bila masih pending, tanyakan status asli ke Midtrans
    // (Status API). Penting untuk lokal/tanpa ngrok di mana webhook tak
    // terjangkau — tanpa ini layar status menggantung di "pending".
    if (tx.status === "pending") {
      const cfg = getMidtransConfig();
      if (cfg.serverKey) {
        try {
          const res = await fetch(`${cfg.apiBaseUrl}/${encodeURIComponent(data.order_id)}/status`, {
            headers: {
              Authorization: `Basic ${btoa(`${cfg.serverKey}:`)}`,
              Accept: "application/json",
            },
          });
          if (res.ok) {
            const j = (await res.json()) as {
              transaction_status?: string;
              fraud_status?: string;
              payment_type?: string;
            };
            if (j.transaction_status) {
              const { applyMidtransResult } = await import("./midtrans-webhook.server");
              await applyMidtransResult({
                order_id: data.order_id,
                transaction_status: j.transaction_status,
                fraud_status: j.fraud_status,
                payment_type: j.payment_type,
                raw: j as unknown as import("@/integrations/supabase/types").Json,
              });
              ({ data: tx } = await read());
            }
          }
        } catch {
          // Best-effort: kalau gagal, kembalikan status lokal apa adanya.
        }
      }
    }

    if (!tx) return null;
    return {
      order_id: tx.order_id,
      status: tx.status,
      midtrans_status: tx.midtrans_status,
      plan_code: tx.plan_code,
      cycle: tx.cycle,
      gross_amount: Number(tx.gross_amount),
    };
  });

// ---- getPaymentHistory: riwayat transaksi untuk halaman Profil ----------

export interface PaymentHistoryItem {
  order_id: string;
  plan_code: string;
  cycle: string;
  gross_amount: number;
  status: string;
  payment_type: string | null;
  created_at: string;
  paid_at: string | null;
}

export const getPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentHistoryItem[]> => {
    const userId = context.userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payment_transactions")
      .select("order_id, plan_code, cycle, gross_amount, status, payment_type, created_at, paid_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []).map((t) => ({
      order_id: t.order_id,
      plan_code: t.plan_code,
      cycle: t.cycle,
      gross_amount: Number(t.gross_amount),
      status: t.status,
      payment_type: t.payment_type,
      created_at: t.created_at,
      paid_at: t.paid_at,
    }));
  });
