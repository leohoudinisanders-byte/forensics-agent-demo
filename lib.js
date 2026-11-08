// Shared client for the On-chain Forensics API. Zero dependencies, Node 18+ (global fetch).
export const API = "https://solene-fa2010da.base44.app/functions/forensicsVerdict";
export const CATALOG = "https://onchainforensics.dev/llms.txt";
export const PRICES = { verdict: 0.02, settlesafe: 0.02, mints: 0.02, wallet: 0.05, token: 0.05, memo: 0.25 };

const UA = "forensics-agent-demo/1.0 (+https://onchainforensics.dev)";

function decodeChallenge(header) {
  try {
    const j = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const a = (j.accepts || [])[0] || {};
    return {
      price_usd: a.amount ? Number(a.amount) / 1e6 : null,
      network: a.network, asset: a.asset, payTo: a.payTo,
      maxTimeoutSeconds: a.maxTimeoutSeconds,
      resource: j.resource?.url, x402Version: j.x402Version,
    };
  } catch { return null; }
}

/** One call. Returns {status, data, challenge, ms}. Never throws on 402. */
export async function callVerdict({ address, chain = "base", trial = true, creditKey } = {}) {
  if (!address) throw new Error("address is required");
  const url = `${API}?address=${encodeURIComponent(address)}&chain=${chain}${trial ? "&trial=1" : ""}`;
  const headers = { "User-Agent": UA, Accept: "application/json" };
  if (creditKey) headers["X-Credit-Key"] = creditKey;
  const t0 = Date.now();
  const res = await fetch(url, { headers });
  const ms = Date.now() - t0;
  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* non-JSON */ }
  const header = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  // Paid and trial responses wrap the card in an envelope: { service, paid, free_trial, data: {...} }.
  const body = data && data.data && typeof data.data === "object" ? data.data : data;
  return { status: res.status, data: body, envelope: data, ms, challenge: res.status === 402 && header ? decodeChallenge(header) : null };
}

export function card(data) {
  if (!data) return "no payload";
  const md = data.market_depth || {};
  const lines = [
    `${data.token_name || "token"} (${data.token_symbol || "?"}) on ${data.chain || "?"}`,
    `grade ${data.grade || "?"} ${data.grade_label || ""} - score ${data.activity_score_0_100 ?? "?"}/100`,
    `flow ${data.flow_score_0_100 ?? "?"} | transfers ${data.transfers_recent ?? "?"} | wallets ${data.unique_wallets_recent ?? "?"} | window ${data.window_min ?? "?"}m`,
  ];
  if (md.available) {
    lines.push(`depth $${Math.round((md.liquidity_usd || 0) / 1000)}k across ${md.pairs_on_chain} pair(s), $${Math.round((md.volume_24h_usd || 0) / 1000)}k 24h volume (score ${md.depth_score_0_100})`);
  } else if (md.reason) {
    lines.push(`depth unavailable (${md.reason}) - grade is flow-only`);
  }
  if (data.grade_basis) lines.push(`basis: ${data.grade_basis}${(data.grade_reason_codes || []).length ? " (" + data.grade_reason_codes.join(", ") + ")" : ""}`);
  lines.push("");
  lines.push(data.plain_take || data.take || data.roast || "");
  return lines.filter(Boolean).join("\n");
}

export function nextStep(challenge) {
  if (!challenge) return "";
  return [
    "",
    `This caller's free allowance is spent, so the API answered with an x402 challenge instead of a payload:`,
    `  price  $${challenge.price_usd} (${challenge.resource ? "atomic amount in the challenge" : ""})`.replace(" ()", ""),
    `  payTo  ${challenge.payTo} on ${challenge.network}`,
    `  asset  ${challenge.asset}`,
    `A paying agent signs an EIP-3009 authorization and replays the request with the PAYMENT-SIGNATURE header.`,
    `Cheapest path to more calls: packs at https://onchainforensics.dev/licensing.html`,
  ].join("\n");
}

export const INSTALLS = [
  ["MCP (Claude Desktop, Cursor, any MCP client)", 'npx -y github:leohoudinisanders-byte/forensics-mcp'],
  ["elizaOS plugin", 'npx -y github:leohoudinisanders-byte/forensics-agent-demo --plugin elizaos'],
  ["Coinbase AgentKit provider", 'npx -y github:leohoudinisanders-byte/forensics-agent-demo --plugin agentkit'],
];
