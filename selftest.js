// Proves the shared client and both plugins work without any host framework installed.
import plugin, { tokenVerdictAction, settleSafeAction } from "./plugins/elizaos/index.js";
import { verdictAction, settlesafeAction } from "./plugins/agentkit/index.js";
import { callVerdict } from "./lib.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log(`  PASS ${name} ${extra}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

console.log("client");
const r = await callVerdict({ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" });
ok("live call answered", r.status === 200 || r.status === 402, `(HTTP ${r.status}, ${r.ms}ms)`);
ok("payload or decoded challenge", Boolean(r.data) || Boolean(r.challenge));
if (r.challenge) ok("challenge carries payTo + price", Boolean(r.challenge.payTo) && r.challenge.price_usd > 0, `($${r.challenge.price_usd})`);

console.log("elizaos plugin");
ok("plugin exposes two actions", plugin.actions.length === 2);
ok("validate accepts an address", await tokenVerdictAction.validate({}, { content: { text: "grade 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on base" } }));
ok("validate rejects junk", !(await tokenVerdictAction.validate({}, { content: { text: "hello" } })));
const ev = await tokenVerdictAction.handler({}, { content: { text: "grade 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on base" } });
ok("handler returns text", typeof ev.text === "string" && ev.text.length > 10, `-> "${ev.text.slice(0, 70)}..."`);
const sv = await settleSafeAction.handler({}, { content: { text: "is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 safe on base?" } });
ok("settlesafe handler returns text", typeof sv.text === "string" && sv.text.length > 10, `-> "${sv.text.slice(0, 70)}..."`);

console.log("agentkit provider");
ok("verdict action has schema slot + invoke", verdictAction.name === "token_verdict" && typeof verdictAction.invoke === "function");
const ak = await verdictAction.invoke({ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" });
ok("invoke returns a decision object", typeof ak === "object" && ("grade" in ak || "error" in ak), JSON.stringify(ak).slice(0, 90));
const ak2 = await settlesafeAction.invoke({ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" });
ok("settlesafe invoke returns an object", typeof ak2 === "object", JSON.stringify(ak2).slice(0, 90));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
