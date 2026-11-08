// On-chain Forensics for elizaOS.
// Dependency-free: the actions call the HTTP API directly. If the runtime has an x402 signer,
// calls settle at $0.02; if not, the action returns the decoded 402 challenge (price, payTo,
// network) so the agent can surface the exact cost instead of failing.
const API = "https://solene-fa2010da.base44.app/functions/forensicsVerdict";
const UA = "elizaos-onchain-forensics/1.0";

function decode(header) {
  try {
    const j = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const a = (j.accepts || [])[0] || {};
    return { price_usd: a.amount ? Number(a.amount) / 1e6 : null, network: a.network, payTo: a.payTo, asset: a.asset };
  } catch { return null; }
}

async function get(params) {
  const url = API + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  const h = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  const card = body && body.data && typeof body.data === "object" ? body.data : body; // envelope wrapper
  return { status: res.status, body: card, challenge: res.status === 402 && h ? decode(h) : null };
}

const extractAddress = (t = "") => (t.match(/0x[0-9a-fA-F]{40}/) || [])[0];
const extractChain = (t = "") => (/\beth(ereum)?\b/i.test(t) ? "ethereum" : /\bbase\b/i.test(t) ? "base" : "base");

export const tokenVerdictAction = {
  name: "TOKEN_VERDICT",
  similes: ["GRADE_TOKEN", "IS_THIS_TOKEN_SAFE", "TOKEN_RISK"],
  description: "Grade an ERC-20 before trading it: A-F letter grade, risk flags, transfer flow and DEX depth. $0.02 per call, free trial for a new caller.",
  examples: [[
    { user: "user", content: { text: "grade 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on base" } },
    { user: "assistant", content: { text: "Checking.", action: "TOKEN_VERDICT" } },
  ]],
  validate: async (_runtime, message) => Boolean(extractAddress(message?.content?.text)),
  handler: async (runtime, message, _state, _options, callback) => {
    const address = extractAddress(message?.content?.text);
    const chain = extractChain(message?.content?.text);
    if (!address) return { success: false, text: "I need a token contract address (0x...)." };
    const r = await get({ address, chain, trial: "1" });
    if (r.status === 200 && r.body) {
      const b = r.body, md = b.market_depth || {};
      const text = [
        `${b.token_name || b.token_symbol} on ${chain}: grade ${b.grade} (${b.grade_label}), score ${b.activity_score_0_100}/100.`,
        `${b.transfers_recent} transfers from ${b.unique_wallets_recent} wallets in ${b.window_min}m.`,
        md.available ? `Depth $${Math.round((md.liquidity_usd||0)/1000)}k across ${md.pairs_on_chain} pairs, $${Math.round((md.volume_24h_usd||0)/1000)}k 24h volume.` : `Depth unavailable (${md.reason || "no DEX pair"}).`,
        b.plain_take || "",
      ].filter(Boolean).join(" ");
      if (callback) await callback({ text, action: "TOKEN_VERDICT", content: { grade: b.grade, score: b.activity_score_0_100, address, chain } });
      return { success: true, text, data: { grade: b.grade, score: b.activity_score_0_100, flags: b.flags, market_depth: md } };
    }
    const text = r.challenge
      ? `The verdict for ${address} costs $${r.challenge.price_usd} in USDC on ${r.challenge.network} (payTo ${r.challenge.payTo}). This runtime has no x402 signer, so I cannot pay for it.`
      : `The verdict API returned HTTP ${r.status} for ${address}.`;
    if (callback) await callback({ text, action: "TOKEN_VERDICT" });
    return { success: false, text, data: { challenge: r.challenge, status: r.status } };
  },
};

export const settleSafeAction = {
  name: "SETTLE_SAFE_CHECK",
  similes: ["CAN_I_SETTLE", "CHECK_SETTLEMENT_SAFETY"],
  description: "Check whether an asset is safe to settle or accept as payment: canonical registry match, ERC-20 readability, risk flags. $0.02 per call.",
  examples: [[
    { user: "user", content: { text: "is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 safe to accept as payment on base?" } },
    { user: "assistant", content: { text: "Checking.", action: "SETTLE_SAFE_CHECK" } },
  ]],
  validate: async (_runtime, message) => Boolean(extractAddress(message?.content?.text)),
  handler: async (runtime, message, _state, _options, callback) => {
    const address = extractAddress(message?.content?.text);
    const chain = extractChain(message?.content?.text);
    if (!address) return { success: false, text: "I need a contract address to check." };
    const res = await fetch(`https://solene-fa2010da.base44.app/functions/forensicsSettlesafe?address=${address}&chain=${chain}&trial=1`, { headers: { "User-Agent": UA } });
    const text = await res.text();
    let raw = null; try { raw = JSON.parse(text); } catch {}
    const b = raw && raw.data && typeof raw.data === "object" ? raw.data : raw;
    if (res.status === 200 && b) {
      const out = `${b.settle_safe ? "SAFE to settle" : "NOT safe to settle"}: ${b.asset_status || "?"}. ${(b.reasons || []).join("; ")}`;
      if (callback) await callback({ text: out, action: "SETTLE_SAFE_CHECK" });
      return { success: true, text: out, data: { settle_safe: b.settle_safe, asset_status: b.asset_status, risk_flags: b.risk_flags } };
    }
    const out = `Settlesafe answered HTTP ${res.status} (its free allowance for this caller is spent; the paid call is $0.02).`;
    if (callback) await callback({ text: out, action: "SETTLE_SAFE_CHECK" });
    return { success: false, text: out };
  },
};

const plugin = {
  name: "onchain-forensics",
  description: "Token risk grades and settlement safety from the On-chain Forensics x402 API.",
  actions: [tokenVerdictAction, settleSafeAction],
  providers: [],
  evaluators: [],
};

export default plugin;
export { plugin };
