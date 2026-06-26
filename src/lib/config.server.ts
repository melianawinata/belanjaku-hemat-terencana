import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}

// Midtrans (payment gateway) config. SERVER_KEY is server-only (signs Snap
// requests + verifies webhook signatures); CLIENT_KEY is safe to ship to the
// browser (used by snap.js). Sandbox vs Production is toggled by
// MIDTRANS_IS_PRODUCTION — default is sandbox so dev/testing never touches
// real funds. Endpoints differ per environment.
export function getMidtransConfig() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return {
    serverKey: process.env.MIDTRANS_SERVER_KEY?.trim() ?? "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY?.trim() ?? "",
    isProduction,
    // Snap API (create transaction / get token).
    snapBaseUrl: isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions",
    // snap.js loaded by the browser to render the payment popup.
    snapJsUrl: isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js",
    // Core API v2 (status / cancel / dll) untuk operasi transaksi.
    apiBaseUrl: isProduction
      ? "https://api.midtrans.com/v2"
      : "https://api.sandbox.midtrans.com/v2",
  };
}

// Gemini config for AI price estimation. The API key is server-only.
// useSearchGrounding is OFF by default (MVP runs on the model's own
// knowledge); set GEMINI_SEARCH_GROUNDING=true to enable Google Search
// grounding for fresher "harga terkini" without touching the call site.
export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim(),
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    useSearchGrounding: process.env.GEMINI_SEARCH_GROUNDING === "true",
  };
}
