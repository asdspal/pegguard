# PegGuard

**Bitcoin’s bridge, covered.**

PegGuard is a Rootstock-native smart contract system for bridge-risk coverage. It implements a timestamp-driven state machine that governs coverage activation, breach disputes, and final resolution. Liquidity providers stake rBTC, buyers purchase coverage, and payouts/withdrawals are enforced on-chain.

This repository implements the capstone MVP described in [`memory-bank/blueprint.docx`](memory-bank/blueprint.docx) and [`memory-bank/implementation-plan.md`](memory-bank/implementation-plan.md).

## What this project does

PegGuard creates a minimal on-chain insurance primitive for BTC bridge users on Rootstock:

1. **Liquidity Providers (LPs)** deposit rBTC into a shared pool.
2. **Coverage Buyers** pay premiums to buy coverage during the setup window.
3. At `coverageStart`, the system moves from setup to active coverage.
4. If a breach is reported by the oracle, the system enters dispute mode.
5. After resolution, funds are released by strict rules:
   - **Breach confirmed**: buyers claim payouts.
   - **No breach**: LPs withdraw principal + pro-rata premiums.

In short: PegGuard formalizes the coverage lifecycle as deterministic smart contract behavior rather than off-chain policy.

## Rules the protocol enforces

These are hard guarantees encoded in contract logic, not social agreements.

### Lifecycle rules ([`PegGuard`](contracts/PegGuard.sol))

- The protocol starts in `OPEN` and can only move through valid transitions.
- `activate()` is allowed only when `block.timestamp >= coverageStart`.
- `reportBreach()` is allowed only in `ACTIVE` and only by the configured oracle.
- `resolve()` is allowed only from:
  - `ACTIVE` after `coverageEnd`, or
  - `DISPUTED` after `disputeEnd`.
- Invalid transitions revert.

### Pool rules ([`PegGuardPool`](contracts/PegGuardPool.sol))

- `deposit()` and `purchaseCoverage()` are allowed only while pool state is `OPEN`.
- `claimPayout()` requires:
  - global state `RESOLVED`,
  - `breachConfirmed == true`,
  - caller has coverage,
  - caller has not claimed before.
- `withdraw()` requires:
  - global state `RESOLVED`,
  - `breachConfirmed == false`,
  - caller has LP stake.

### Security rules

- `claimPayout()` and `withdraw()` are `nonReentrant`.
- Both functions zero/mark critical storage before external value transfer (checks-effects-interactions).
- Oracle-triggered breach path is restricted via `onlyOracle`.

## Why these design choices

### 1) Explicit state machine instead of implicit flags

Using `OPEN/ACTIVE/DISPUTED/RESOLVED` makes behavior auditable and prevents ambiguous mixed states. Every sensitive action checks state first.

### 2) Time-based automation (`block.timestamp`)

Coverage windows and dispute windows are objective and enforceable on-chain, reducing reliance on operators and manual coordination.

### 3) Event-first transitions

Every major transition emits an event so off-chain services, indexers, and UIs can reconstruct lifecycle history without custom tracing.

### 4) Separated responsibilities

- [`PegGuard`](contracts/PegGuard.sol): policy/lifecycle decisions.
- [`PegGuardPool`](contracts/PegGuardPool.sol): fund custody and accounting.

This separation limits cross-cutting complexity and improves testability.

### 5) Conservative MVP economics

Coverage is currently **1:1 with premium paid** (simple and transparent). The mappings are still separated (`coverageAmounts`, `premiumsPaid`) so future multiplier pricing can be added without redesigning storage.

### 6) Security-first payout model

Reentrancy protection + one-time claim flags + zero-before-transfer prevents common payout exploits and aligns with OpenZeppelin best practices.

## Project Goals

- Provide a decentralized coverage primitive for bridge users.
- Keep lifecycle logic deterministic via `block.timestamp`.
- Enforce clear phase transitions and event-first observability.
- Protect fund-moving functions with reentrancy defenses.

## Core Contracts

- [`PegGuard`](contracts/PegGuard.sol): coverage lifecycle state machine
  - States: `OPEN -> ACTIVE -> DISPUTED -> RESOLVED`
  - Controls activation, breach reporting, and resolution
- [`PegGuardPool`](contracts/PegGuardPool.sol): staking, premium accounting, claims, LP withdrawals
- [`MockOracle`](contracts/MockOracle.sol): owner-gated oracle for MVP/testing

Interfaces:

- [`IPegGuard`](contracts/interfaces/IPegGuard.sol)
- [`IPegGuardPool`](contracts/interfaces/IPegGuardPool.sol)
- [`IPegGuardOracle`](contracts/interfaces/IPegGuardOracle.sol)

Test helpers/contracts:

- [`MockPegGuard`](contracts/MockPegGuard.sol)
- [`ReentrantClaimAttacker`](contracts/ReentrantClaimAttacker.sol)

## State Machine

```text
OPEN      --(timestamp >= coverageStart)--> ACTIVE
ACTIVE    --(oracle reports breach)-------> DISPUTED
ACTIVE    --(timestamp >= coverageEnd)----> RESOLVED
DISPUTED  --(timestamp >= disputeEnd)-----> RESOLVED
```

## Key Events

- `CoverageActivated(uint256 start, uint256 end, uint256 poolSize)`
- `BreachReported(address oracle, uint256 timestamp)`
- `CoverageExpired(uint256 timestamp, uint256 totalPremiums)`
- `PayoutClaimed(address indexed buyer, uint256 amount)`
- `LPWithdrawn(address indexed lp, uint256 stake, uint256 premium)`

## Tech Stack

- Solidity `0.8.25`
- Hardhat
- Ethers.js v6
- OpenZeppelin Contracts v5
- Rootstock Testnet/Mainnet configuration in [`hardhat.config.js`](hardhat.config.js)

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy [` .env.example`](.env.example) to `.env` and set values:

```bash
cp .env.example .env
```

Required variables:

- `PRIVATE_KEY`
- `RSK_TESTNET_RPC_URL` (default public node provided)
- `RSK_MAINNET_RPC_URL` (default public node provided)
- `VERIFY_API_KEY` (optional for Blockscout verify plugin setup)

### 3) Compile

```bash
npm run compile
```

### 4) Run tests

```bash
npm test
```

Current status in this repo: **75 passing tests** (unit + integration).

## Test Coverage Structure

- Unit tests:
  - [`test/MockOracle.test.js`](test/MockOracle.test.js)
  - [`test/PegGuard.test.js`](test/PegGuard.test.js)
  - [`test/PegGuardPool.test.js`](test/PegGuardPool.test.js)
- Integration tests:
  - [`test/integration/happyPath.test.js`](test/integration/happyPath.test.js)
  - [`test/integration/breachPath.test.js`](test/integration/breachPath.test.js)
  - [`test/integration/edgeCases.test.js`](test/integration/edgeCases.test.js)
- Shared setup:
  - [`test/helpers/setup.js`](test/helpers/setup.js)

## Security Notes

- `claimPayout()` and `withdraw()` are protected with `nonReentrant`.
- Payout logic follows checks-effects-interactions ordering.
- Oracle-triggered breach path is access-controlled via `onlyOracle`.
- Time-based guards prevent premature state transitions.

## Network Configuration

Configured in [`hardhat.config.js`](hardhat.config.js):

- `rskTestnet` (chainId `31`)
- `rskMainnet` (chainId `30`)
- Gas price pinned to `60000000`
- Blockscout custom chain settings included for verification flows

## Current Repository Layout

```text
contracts/
  MockOracle.sol
  MockPegGuard.sol
  PegGuard.sol
  PegGuardPool.sol
  ReentrantClaimAttacker.sol
  interfaces/
    IPegGuard.sol
    IPegGuardOracle.sol
    IPegGuardPool.sol

test/
  MockOracle.test.js
  PegGuard.test.js
  PegGuardPool.test.js
  helpers/setup.js
  integration/
    happyPath.test.js
    breachPath.test.js
    edgeCases.test.js
```

## Roadmap Context

From the memory bank plan, the broader capstone path includes:

- Testnet deployments and Blockscout verification
- Lifecycle interaction scripts
- Production oracle direction via Rootstock Attestation Service (post-MVP)

This repo currently contains the complete contract/test core for that path.
