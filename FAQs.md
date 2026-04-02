# PegGuard — Frequently Asked Questions

Architectural decisions, design rationale, and answers to questions
a technical reviewer would reasonably ask about PegGuard.

---

## Table of Contents

1. [What is PegGuard in plain English?](#1-what-is-peguard-in-plain-english)
2. [Core State Machine](#2-core-state-machine)
3. [Who calls which function?](#3-who-calls-which-function)
4. [What is the primitive argument?](#4-what-is-the-primitive-argument)
5. [What are interfaces and why do you use them?](#5-what-are-interfaces-and-why-do-you-use-them)
6. [Security — ReentrancyGuard](#6-security--reentrancyguard)
7. [Security — Double Claim Prevention](#7-security--double-claim-prevention)
8. [Pro-Rata Distribution](#8-pro-rata-distribution)
9. [Dual-Path Resolve](#9-dual-path-resolve)
10. [Oracle Design](#10-oracle-design)
11. [Fixed Time Window](#11-fixed-time-window)
12. [What if no one buys coverage?](#12-what-if-no-one-buys-coverage)
13. [What if coverage expires mid-bridge?](#13-what-if-coverage-expires-mid-bridge)
14. [Known Limitations](#14-known-limitations)
15. [Post-MVP Roadmap](#15-post-mvp-roadmap)

---

## 1. What is PegGuard in Plain English?

Think of PegGuard like travel insurance you buy before a flight.

**Setting it up**
The contract is deployed for a fixed time window. During that window
two groups of people show up:

- **Liquidity Providers (LPs)** put money into the pool. They are
  like the insurance company — they believe nothing bad will happen
  and want to earn yield.
- **Coverage Buyers** pay a small premium. They are like the traveller
  buying insurance — they want protection if something goes wrong
  during their bridge.

**The bridge happens**
The buyer bridges their Bitcoin through the Union Bridge and receives
rBTC on Rootstock. They are now protected for the duration of the
coverage window.

**Two possible endings**

- **Breach** — the oracle reports a failure. After a dispute window
  closes, buyers get back what they lost. LPs lose their stake —
  that was the risk they took for the yield.

- **No breach** — the window expires cleanly. LPs get their full
  stake back plus a share of all premiums collected. The more they
  staked, the more they earn.

No one controls the outcome. No admin can override it. The contract
watches the clock and the oracle and enforces the rules automatically.

**One sentence version**

> PegGuard is a time-locked insurance pool — LPs back it, buyers
> protect themselves with it, and the contract pays out automatically
> if the oracle reports a bridge failure, or returns everyone's money
> if nothing goes wrong.

---

## 2. Core State Machine

PegGuard has four states:

```
OPEN → ACTIVE → DISPUTED → RESOLVED
               ↘ (no breach) ↗
```

| State | Meaning | Who can act |
|---|---|---|
| OPEN | Contract deployed, accepting deposits and coverage purchases | LPs deposit, Buyers purchase |
| ACTIVE | Coverage window live, bridge users are protected | Oracle can report breach |
| DISPUTED | Breach reported, dispute window open | Anyone waits for disputeEnd |
| RESOLVED | Final state — payouts or withdrawals enabled | Buyers claim OR LPs withdraw |

**OPEN is not a transition — it is the birth state.**
The contract is in OPEN the moment it is deployed. No one needs to
call a function to enter it. Deploy = open for business.

**Why a state machine instead of a simpler design?**
State machines make every valid transition explicit and every invalid
one impossible. There is no function you can call at the wrong time —
the modifier reverts it. It also makes the contract easy to audit —
you just need to verify four states and five transitions.

**Why `block.timestamp` and not block numbers?**
Block numbers are harder to reason about for humans and integrators.
Rootstock targets 30-second blocks but that is not guaranteed.
Timestamps in seconds are what users understand — "your coverage
lasts 7 days" — and they map directly to constructor parameters.

---

## 3. Who Calls Which Function?

### Liquidity Provider

| Function | State Required | What Happens |
|---|---|---|
| `deposit()` | OPEN | Stakes rBTC — recorded in `lpStakes[msg.sender]` |
| `withdraw()` | RESOLVED + no breach | Gets stake + pro-rata premium back |

### Coverage Buyer

| Function | State Required | What Happens |
|---|---|---|
| `purchaseCoverage()` | OPEN | Pays premium — recorded in `coverageAmounts[msg.sender]` |
| `claimPayout()` | RESOLVED + breach confirmed | Receives `coverageAmounts[msg.sender]` back |

### Oracle

| Function | State Required | Who | What Happens |
|---|---|---|---|
| `reportBreach()` | ACTIVE | Oracle only | Sets `breachConfirmed = true`, opens dispute window |

### Anyone (Permissionless)

| Function | State Required | Time Condition | What Happens |
|---|---|---|---|
| `activate()` | OPEN | `block.timestamp >= coverageStart` | OPEN → ACTIVE |
| `resolve()` | ACTIVE or DISPUTED | `>= coverageEnd` or `>= disputeEnd` | → RESOLVED |

**The design principle: time creates permission.**
No step requires a privileged admin key. The clock does the
authorization. `activate()` and `resolve()` are permissionless
because the time condition is the only gate that matters.

---

## 4. What is the Primitive Argument?

PegGuard is not a product built for one use case. It is a building
block — a behavioral primitive.

The core mechanism is a time-governed state machine that defines:
- Locked capital
- Time-gated release windows
- Event-driven resolution

Insurance is one application layered on top. The same underlying
primitive could power escrow, vesting with clawback, performance
bonds, or any collateral system on Rootstock.

**What makes it composable?**
Any bridge on Rootstock implements one interface —
`IPegGuardOracle` — with two functions:

```solidity
function reportBreach() external;
function isBreachConfirmed() external view returns (bool);
```

Point that interface at their monitoring system and their users
immediately get the full coverage lifecycle. The Union Bridge is
the first integration. The primitive works for any bridge.

---

## 5. What are Interfaces and Why Do You Use Them?

An interface is a job description. It says:

> "I don't care who you are or how you work internally —
> as long as you can do these specific things, I can work with you."

**The problem interfaces solve**

PegGuard and PegGuardPool need to talk to each other:
- PegGuardPool needs to ask PegGuard: *"what state are you in?"*
- PegGuard needs to ask PegGuardPool: *"how much is totalStaked?"*

If PegGuard imports PegGuardPool directly and PegGuardPool imports
PegGuard directly — circular dependency. The compiler refuses to
compile it.

Interfaces break the circle:

```
PegGuard     → imports → IPegGuardPool  ✅
PegGuardPool → imports → IPegGuard      ✅
No circular dependency
```

**Three interfaces in PegGuard**

`IPegGuardOracle` — any oracle must implement two functions.
MockOracle today. RAS oracle in Phase 2. PegGuard never changes.

`IPegGuardPool` — PegGuard reads `totalStaked()` and
`totalPremiums()` from whatever pool is connected.

`IPegGuard` — PegGuardPool reads `getState()` and
`breachConfirmed()` to gate its functions correctly.

**Real world analogy**
A power socket is the interface — it defines the shape. The plug
is the implementation — phone charger, laptop charger, kettle.
They all look different inside but they all fit the socket because
they match the shape. PegGuard does not care what the oracle looks
like inside. It just needs the right shape.

---

## 6. Security — ReentrancyGuard

A reentrancy attack works like this: a malicious contract calls
`claimPayout()`, and inside its `receive()` function calls
`claimPayout()` again before the first call finishes — draining
the pool multiple times for one legitimate claim.

OpenZeppelin's `ReentrancyGuard` blocks this with a mutex — a lock
set at the start of the function and released at the end. Any second
call while the lock is held reverts immediately.

Applied to both `claimPayout()` and `withdraw()` — the two functions
that move native rBTC out of the contract.

**ReentrancyGuard alone is not enough.**
PegGuard also follows **checks-effects-interactions**:

```solidity
// CHECKS
require(!hasClaimed[msg.sender], "Already claimed");
require(coverageAmounts[msg.sender] > 0, "No coverage");

// EFFECTS — storage zeroed BEFORE the transfer
uint256 amount = coverageAmounts[msg.sender];
hasClaimed[msg.sender] = true;
coverageAmounts[msg.sender] = 0;

// INTERACTION — transfer happens last
(bool ok,) = msg.sender.call{value: amount}("");
require(ok, "Transfer failed");
```

Even if ReentrancyGuard were removed, the storage is already zeroed
before any external call. Two independent defenses on the most
critical functions.

**Why `.call` and not `transfer()`?**
`.call` forwards all available gas and works for contract recipients.
`transfer()` has a hardcoded 2300 gas stipend that fails for contracts
with non-trivial `receive()` functions. Current Solidity best practice
is always `.call` for native token transfers.

---

## 7. Security — Double Claim Prevention

`hasClaimed[msg.sender]` is set to `true` before the transfer.
Any second call hits `require(!hasClaimed[msg.sender])` and reverts.

**What if the transfer fails — is the buyer locked out?**

No. Solidity transactions are atomic. If `require(ok, "Transfer failed")`
reverts, the entire transaction reverts — including the
`hasClaimed[msg.sender] = true` assignment. The buyer's state is
exactly as it was before the call. They can try again.

The only case where a buyer genuinely cannot claim is pool insolvency
— not enough rBTC in the contract to cover all claims. That is a
known MVP limitation around the missing solvency cap, not a bug
in the claim logic.

---

## 8. Pro-Rata Distribution

When no breach occurs, LPs share the premium pool proportionally
to how much they staked.

**Formula:**
```solidity
uint256 premium = (lpStakes[msg.sender] * totalPremiums) / totalStaked;
```

**Example:**

| LP | Staked | Share | Total Premiums | Earns |
|---|---|---|---|---|
| LP1 | 3 rBTC | 75% | 0.4 rBTC | 0.3 rBTC |
| LP2 | 1 rBTC | 25% | 0.4 rBTC | 0.1 rBTC |

**Why pro-rata and not equal split?**
Equal split penalises large LPs who take on more risk. Pro-rata
aligns incentives — the more you stake, the more exposure you take,
the more you earn. Standard model used by every insurance pool in DeFi.

**Integer division caveat**
Solidity truncates on division. The last LP to withdraw may receive
1 wei less than expected due to rounding. This is documented in
NatSpec and acceptable for MVP. A production version would use an
accumulator pattern to handle it precisely.

---

## 9. Dual-Path Resolve

`resolve()` is one function that handles two completely different
situations:

```solidity
function resolve() external {
    if (state == State.ACTIVE) {
        // Path A — no breach, coverage window expired cleanly
        require(block.timestamp >= coverageEnd, "Coverage not ended");
    } else if (state == State.DISPUTED) {
        // Path B — breach reported, dispute window now closed
        require(block.timestamp >= disputeEnd, "Dispute not ended");
    } else {
        revert("Cannot resolve from current state");
    }
    state = State.RESOLVED;
    emit CoverageExpired(block.timestamp, pool.totalPremiums());
}
```

**Path A** — no breach. Coverage window ran its full duration.
LPs win. They call `withdraw()`.

**Path B** — oracle reported breach. Dispute window closed.
Buyers win. They call `claimPayout()`.

Same function, same final state (`RESOLVED`), but `breachConfirmed`
tells the pool which actors get paid. That boolean is the fork
in the road.

---

## 10. Oracle Design

**MVP — MockOracle**
The deployer calls `reportBreach()` manually. Single trusted key.
Intentional placeholder — the interface is the integration point,
not the implementation.

**Why is the oracle a separate contract with an interface?**
Any oracle implementation that satisfies `IPegGuardOracle` works
with PegGuard immediately. Swapping the oracle requires zero changes
to PegGuard or PegGuardPool.

**Phase 2 — RAS Attestation (planned)**
Rootstock Attestation Service is EAS-compatible and live on
Rootstock mainnet and testnet. A registered attestor submits a
signed on-chain attestation when a breach is detected. The oracle
contract verifies the attestation schema and attestor identity
before calling `reportBreach()`.

```
Bridge monitor detects anomaly
    → Attestor signs breach attestation on RAS
    → RAS oracle verifies attestation + attestor identity
    → Calls pegGuard.reportBreach()
```

**Other oracle designs possible**

Multisig oracle — 3-of-5 independent parties must agree before
`reportBreach()` is called. Collusion-resistant.

Automated on-chain monitor — watches for specific bridge contract
events like emergency pauses or unusual withdrawal volumes and
triggers autonomously with no human latency.

**What if the oracle reports a false breach?**
The dispute window exists for exactly this. After `reportBreach()`
is called there is a time window before `RESOLVED` is reachable.
A production system would use this window for a counter-attestation
or governance challenge. In MVP the window is there structurally —
the challenge mechanism is Phase 2.

---

## 11. Fixed Time Window

**Why a fixed time window?**
MVP simplification. A fixed window means the state machine always
terminates cleanly — no open-ended liability, no complex accounting,
no funds locked indefinitely. Every participant knows exactly when
they can withdraw.

The window duration is just a constructor parameter. Shortening it,
rolling it, or making it per-user are Phase 3 changes, not
architecture changes. The core logic does not change.

**Why does the demo redeploy contracts?**
Once `coverageEnd` passes the contract moves to RESOLVED. It is
terminal — the state machine only moves forward, never backward.
Each PegGuard deployment is a single insurance policy for a specific
time period. Just like a real insurance policy — when it expires
you buy a new one.

For the demo, `deployDemo.js` deploys with short windows
(60s / 5min / 2min) so the full lifecycle fits in one session.

**Perpetual pool — the natural evolution**
The fixed window limitation is a deployment concern, not a contract
design flaw. The clean solution is to separate the two concerns:

- **Pool** — perpetual, always open, LPs deposit once
- **Coverage windows** — time-based, multiple run simultaneously,
  all drawing from the same pool

```
PegGuardPool (perpetual)
    ├── PegGuard Window #1  [Jan 1–8]   → RESOLVED
    ├── PegGuard Window #2  [Jan 8–15]  → RESOLVED
    ├── PegGuard Window #3  [Jan 15–22] → ACTIVE ← current
    └── PegGuard Window #4  [Jan 22–29] → OPEN ← next
```

LPs deposit once. Stake backs all future windows automatically.
Buyers always have a window available. A factory contract deploys
new windows on a rolling schedule. The primitive stays identical —
only the deployment pattern changes.

---

## 12. What if No One Buys Coverage?

LPs get their full stake back with zero premium — no gain, no loss.

```solidity
uint256 premium = (lpStakes[msg.sender] * 0) / totalStaked = 0;
LP receives: stake + 0 = full stake back
```

This is correct and intentional. LPs are taking on risk in exchange
for yield. If no one buys, there was no risk and there is no yield.

**The cold start problem**
This reveals a real two-sided market challenge — LPs need buyers
to make money, buyers need LPs to have protection. Production
solutions include protocol-seeded liquidity, LP rewards tokens,
and minimum pool size requirements before a window goes live.

---

## 13. What if Coverage Expires Mid-Bridge?

If the bridge is still in progress when the coverage window expires
and no breach was reported, the buyer cannot claim. Their premium
goes to LPs as earned yield.

This is correct insurance behavior. The premium is the price of
protection during that window — not a deposit you get back if
nothing happened. The buyer was protected during the window.
The fact that their bridge was still in progress does not change
the terms they agreed to at purchase.

**The timing risk this reveals**
Buyers need to ensure their bridge completes within the coverage
window they purchased. Per-user coverage duration — where each
buyer sets their own window at purchase time — is the Phase 3 fix.
With rolling windows, buyers can also purchase into the next window
if their bridge extends beyond the current one.

---

## 14. Known Limitations

These are deliberate MVP scope decisions, not bugs.

| Limitation | Why Acceptable in MVP | Production Fix |
|---|---|---|
| No solvency cap | Pool can oversell coverage relative to stake | Cap total coverage sold at totalStaked |
| Fixed window UX friction | Buyers must time bridge to window | Rolling windows + per-user duration |
| Single oracle key | Trusted role — known weakness | RAS attestation or multisig oracle |
| No cancel/refund in OPEN | Funds locked if deploy is abandoned | Add cancel() function with timelock |
| 10% branch gap in PegGuardPool | One transfer-failure path untested | Close before mainnet deployment |
| Integer division rounding | Last LP gets 1 wei less | Accumulator pattern in production |
| One wallet in demo | LP and buyer are same address | Different users = different wallets naturally |

---

## 15. Post-MVP Roadmap

**Phase 2 — Mainnet + RAS Oracle**
- Replace MockOracle with RAS-attested breach signal
- Deploy on Rootstock mainnet
- Security review

**Phase 3 — Perpetual Pool + Coverage Multiplier**
- Persistent pool backing multiple rolling windows
- Coverage multiplier — LP pool backs 10× stake
  (pay 0.001 rBTC premium, covered for 0.01 rBTC)
- Factory contract for automated window deployment
- Per-user coverage duration

**Grant**
- Rootstock Collective infrastructure grant submission
- PegGuard as public good — any Rootstock bridge integrates
  by implementing IPegGuardOracle

---

*PegGuard — Bitcoin's Bridge, Covered*
*github.com/asdspal/pegguard*
