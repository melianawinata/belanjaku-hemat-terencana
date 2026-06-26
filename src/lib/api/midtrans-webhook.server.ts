// Pemrosesan status pembayaran Midtrans.
//
// Status bisa datang dari DUA sumber yang memakai logika sama:
//   1. Webhook (HTTP Notification) -> handleMidtransWebhook (verifikasi signature).
//   2. Polling layar status -> Status API Midtrans (lihat getOrderStatus),
//      penting untuk lokal/ngrok-less di mana webhook tak terjangkau.
//
// Inti pemberian akses ada di applyMidtransResult: idempotent, dan saat lunas
// memberi periode aktif di user_subscriptions.

import { getMidtransConfig } from "../config.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

interface MidtransNotification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
}

async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time-ish compare untuk hex string sama panjang.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function addPeriod(from: Date, cycle: string): Date {
  const d = new Date(from);
  if (cycle === "tahunan") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mapStatus(
  transaction_status?: string,
  fraud_status?: string,
): "pending" | "paid" | "expired" | "failed" | "cancelled" {
  const ts = transaction_status;
  if (ts === "capture") return fraud_status === "accept" ? "paid" : "pending";
  if (ts === "settlement") return "paid";
  if (ts === "pending") return "pending";
  if (ts === "expire") return "expired";
  if (ts === "deny") return "failed";
  if (ts === "cancel" || ts === "refund" || ts === "chargeback") return "cancelled";
  return "pending";
}

export interface ApplyResult {
  found: boolean;
  status?: string;
}

/**
 * Terapkan hasil transaksi Midtrans ke DB (idempotent) dan, bila lunas,
 * berikan periode langganan aktif. Dipakai webhook maupun polling Status API.
 */
export async function applyMidtransResult(params: {
  order_id: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  raw?: Json;
}): Promise<ApplyResult> {
  const { order_id } = params;

  const { data: tx, error: txErr } = await supabaseAdmin
    .from("payment_transactions")
    .select("order_id, user_id, plan_code, cycle, status")
    .eq("order_id", order_id)
    .maybeSingle();
  if (txErr) {
    console.error(`[midtrans] db error: ${txErr.message}`);
    throw new Error("db error");
  }
  if (!tx) return { found: false };

  // Idempotent — sudah final, jangan proses ulang.
  if (tx.status === "paid") return { found: true, status: "paid" };

  const internal = mapStatus(params.transaction_status, params.fraud_status);
  const nowIso = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: internal,
      midtrans_status: params.transaction_status ?? null,
      payment_type: params.payment_type ?? null,
      raw_notification: params.raw ?? null,
      paid_at: internal === "paid" ? nowIso : null,
      updated_at: nowIso,
    })
    .eq("order_id", order_id)
    .neq("status", "paid");
  if (updErr) {
    console.error(`[midtrans] update gagal: ${updErr.message}`);
    throw new Error("update failed");
  }

  // Saat lunas, berikan periode aktif (idempotent via source_order_id).
  if (internal === "paid") {
    const { data: existing } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("source_order_id", order_id)
      .maybeSingle();

    if (!existing) {
      // Tumpuk di atas periode aktif yang masih berjalan (kalau ada) agar
      // sisa hari tidak hangus; selain itu mulai dari sekarang.
      const { data: activeSub } = await supabaseAdmin
        .from("user_subscriptions")
        .select("period_end")
        .eq("user_id", tx.user_id)
        .eq("status", "active")
        .gt("period_end", nowIso)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      const base = activeSub?.period_end ? new Date(activeSub.period_end) : new Date();
      const { error: subErr } = await supabaseAdmin.from("user_subscriptions").insert({
        user_id: tx.user_id,
        plan_code: tx.plan_code,
        cycle: tx.cycle,
        status: "active",
        period_start: base.toISOString(),
        period_end: addPeriod(base, tx.cycle).toISOString(),
        source_order_id: order_id,
      });
      if (subErr) {
        console.error(`[midtrans] gagal buat langganan: ${subErr.message}`);
        throw new Error("subscription failed");
      }
    }
  }

  return { found: true, status: internal };
}

export async function handleMidtransWebhook(request: Request): Promise<Response> {
  const cfg = getMidtransConfig();
  if (!cfg.serverKey) {
    console.error("[midtrans-webhook] MIDTRANS_SERVER_KEY belum diset.");
    return json({ ok: false, error: "not configured" }, 500);
  }

  let notif: MidtransNotification;
  try {
    notif = (await request.json()) as MidtransNotification;
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }

  const { order_id, status_code, gross_amount, signature_key } = notif;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return json({ ok: false, error: "missing fields" }, 400);
  }

  // Verifikasi signature: SHA512(order_id+status_code+gross_amount+ServerKey).
  const expected = await sha512Hex(order_id + status_code + gross_amount + cfg.serverKey);
  if (!safeEqual(expected, signature_key)) {
    console.error(`[midtrans-webhook] signature mismatch order_id=${order_id}`);
    return json({ ok: false, error: "invalid signature" }, 403);
  }

  try {
    const res = await applyMidtransResult({
      order_id,
      transaction_status: notif.transaction_status,
      fraud_status: notif.fraud_status,
      payment_type: notif.payment_type,
      raw: notif as unknown as Json,
    });
    if (!res.found) {
      console.error(`[midtrans-webhook] order tidak ditemukan: ${order_id}`);
      return json({ ok: false, error: "order not found" }, 404);
    }
    return json({ ok: true, status: res.status }, 200);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "error" }, 500);
  }
}
