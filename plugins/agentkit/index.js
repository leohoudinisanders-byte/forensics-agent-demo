// On-chain Forensics as a Coinbase AgentKit action provider.
// Fetches the real grade over HTTP, so it works before you wire an x402 signer: with one, the
// call settles at $0.02 and returns the card; without one, the action returns the decoded
// challenge (price, payTo, network) rather than an error, which keeps the agent's loop intact.
// The base class is imported lazily so this file can be loaded (and tested) without AgentKit present.
const API_BASE = "https://solene-fa2010da.base44.app/functions";
const UA = "agentkit-onchain-forensics/1.0";

function decode(header) {
  try {
    const j = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const a = (j.accepts || [])[0] || {};
    return { price_usd: a.amount ? Number(a.amount) / 1e6 : null, network: a.network, payTo: a.payTo, asset: a.asset };
  } catch { return null; }
}

async function read(fn, params) {
  const url = `${API_BASE}/${fn}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  const h = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  const card = body && body.data && typeof body.data === "object" ? body.data : body; // envelope wrapper
  return { status: res.status, body: card, challenge: res.status === 402 && h ? decode(h) : null };
}

const verdictAction = {
  name: "token_verdict",
  description: "Grade an ERC-20 token A-F before trading it: risk flags, transfer flow, unique wallets and DEX depth. Use this before any swap into an unfamiliar token. Costs $0.02 USDC.",
  schema: null, // filled with a zod schema when AgentKit is present
  invoke: async ({ address, chain = "base" }) => {
    const r = await read("forensicsVerdict", { address, chain, trial: "1" });
    if (r.status === 200 && r.body) {
      const b = r.body, md = b.market_depth || {};
      return {
        token: b.token_symbol, grade: b.grade, grade_label: b.grade_label,
        score: b.activity_score_0_100, flow_score: b.flow_score_0_100, basis: b.grade_basis,
        transfers: b.transfers_recent, wallets: b.unique_wallets_recent, window_min: b.window_min,
        flags: b.flags, depth: md.available ? { liquidity_usd: md.liquidity_usd, volume_24h_usd: md.volume_24h_usd, pairs: md.pairs_on_chain } : { unavailable: md.reason },
        take: b.plain_take,
      };
    }
    return { error: "payment_required_or_unavailable", status: r.status, challenge: r.challenge, hint: "pay $0.02 on " + (r.challenge?.network || "eip155:8453") };
  },
};

const settlesafeAction = {
  name: "settlesafe_check",
  description: "Check whether an asset is safe to settle or accept as payment: canonical registry match, ERC-20 readability and risk flags. Costs $0.02 USDC.",
  schema: null,
  invoke: async ({ address, chain = "base" }) => {
    const r = await read("forensicsSettlesafe", { address, chain, trial: "1" });
    if (r.status === 200 && r.body) {
      return { settle_safe: r.body.settle_safe, asset_status: r.body.asset_status, risk_flags: r.body.risk_flags, reasons: r.body.reasons };
    }
    return { error: "payment_required_or_unavailable", status: r.status, challenge: r.challenge };
  },
};

/** Async factory: pulls the AgentKit base class + zod, then returns a ready provider instance. */
export async function createProvider() {
  const { ActionProvider } = await import("@coinbase/agentkit");
  const { z } = await import("zod");
  const schema = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("ERC-20 contract address"), chain: z.enum(["base", "ethereum"]).default("base").describe("chain to read") });
  verdictAction.schema = schema; settlesafeAction.schema = schema;
  return new (class extends ActionProvider {
    constructor() { super("onchain-forensics", []); }
    supportsNetwork = () => true;
    getActions = () => [verdictAction, settlesafeAction];
  })();
}

export { verdictAction, settlesafeAction };
export default { createProvider };
