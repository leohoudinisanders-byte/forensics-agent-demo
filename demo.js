#!/usr/bin/env node
// forensics-demo - one command, one real answer from the On-chain Forensics x402 API.
import { callVerdict, card, nextStep, INSTALLS, PRICES } from "./lib.js";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : d; };

if (args[0] === "--selftest") { await import("./selftest.js"); }
else if (args[0] === "--plugin") {
  const which = args[1];
  console.log(`Install for ${which}:\n`);
  console.log(`  copy plugins/${which} into your project, or run: npx -y github:leohoudinisanders-byte/forensics-agent-demo`);
  console.log(`\nThe plugin is dependency-free: it calls the HTTP API directly, so it works whether or not the`);
  console.log(`host has an x402 signer yet. With a signer it pays $0.02/call; without one it returns the`);
  console.log(`decoded challenge (price, payTo, network) instead of an error.`);
  process.exit(0);
}

const address = flag("address", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const chain = flag("chain", "base");

console.log(`\nOn-chain Forensics - live call\n${"=".repeat(46)}`);
try {
  const r = await callVerdict({ address, chain });
  console.log(`HTTP ${r.status} in ${r.ms}ms\n`);
  if (r.data && r.status === 200) console.log(card(r.data));
  console.log(nextStep(r.challenge));
} catch (e) {
  console.log(`network error: ${e.message}`);
}

console.log(`\n${"=".repeat(46)}\nWire it into your agent:\n`);
for (const [what, cmd] of INSTALLS) console.log(`  ${what}\n    ${cmd}\n`);
console.log(`Prices: verdict $${PRICES.verdict}, settlesafe $${PRICES.settlesafe}, mints $${PRICES.mints}, wallet/token $${PRICES.wallet}, memo $${PRICES.memo}`);
console.log(`Catalog: https://onchainforensics.dev/llms.txt\n`);
