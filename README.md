# On-chain Forensics - one-command demo + drop-in agent plugins

Grade a token A-F before your agent trades it, or check that an asset is safe to settle as payment.
Every call returns a real answer from the live x402 API, or the decoded price of it.

```bash
# one command, one real answer
npx -y github:leohoudinisanders-byte/forensics-agent-demo

# grade a specific token on a specific chain
npx -y github:leohoudinisanders-byte/forensics-agent-demo --address 0x63706e401c06ac8513145b7687a14804d17f814b --chain base

# prove the plugins work with no host framework installed
npx -y github:leohoudinisanders-byte/forensics-agent-demo --selftest
```

## What the answer looks like

```
USD Coin (USDC) on base
grade A LIVE AND BROAD - score 89/100
flow 89 | transfers 1504 | wallets 640 | window 108m
depth $30M across 12 pair(s), $41M 24h volume (score 92)
basis: flow+depth
```

Two grading inputs are published separately, because they answer different questions:

- `flow_score_0_100` - pure transfer activity in the window (is anything happening?)
- `market_depth` - DEX liquidity and 24h volume from independent pairs (can you get out?)

A deep market can raise a flow-only grade (`grade_basis: "flow+depth"`, reason code
`DEPTH_SUPPORTS_GRADE`) but it can never lower one, never override a risk flag and never lift
a non-token. A quiet token with $30M of liquidity reads `C / QUIET BUT LIQUID`, not `F`.

## elizaOS

```js
import plugin from "./plugins/elizaos/index.js";
// add to your character's plugins array
```

Two actions: `TOKEN_VERDICT` and `SETTLE_SAFE_CHECK`. Both pull the address and chain out of
the message, so "grade 0x8335...2913 on base" just works.

## Coinbase AgentKit

```js
import { createProvider } from "./plugins/agentkit/index.js";
const provider = await createProvider();   // needs @coinbase/agentkit + zod
```

Actions: `token_verdict` and `settlesafe_check`, each returning a decision object your agent
can branch on (`grade`, `flags`, `depth`, `settle_safe`).

## Payment behaviour (important)

The plugins are dependency-free and call HTTP directly, so they work **before** you wire an
x402 signer. With a signer, a call settles at $0.02 per verdict. Without one, the action does
not throw: it returns the decoded 402 challenge (price, `payTo`, network, asset) so the agent
can tell the user exactly what the answer costs, or hand the payment to its own wallet.

Free trial: a new caller gets one real payload at $0.00 per route per day. That is what this
demo uses, which is why it runs with no wallet.

## Prices

| call | price |
|---|---|
| verdict, settlesafe, mints | $0.02 |
| wallet, token | $0.05 |
| memo, sweep | $0.25 |
| cached verdict (verdictFast) | $0.001 |

Catalog: https://onchainforensics.dev/llms.txt
Grades for 500 tokens: https://onchainforensics.dev/t/
Volume licensing: https://onchainforensics.dev/licensing.html

## MCP

```bash
npx -y github:leohoudinisanders-byte/forensics-mcp
```

MIT.
