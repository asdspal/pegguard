# PegGuard — Bitcoin's Bridge, Covered

## Overview

PegGuard is a Rootstock-native smart contract system for bridge-risk coverage. It implements a timestamp-driven state machine that governs coverage activation, breach disputes, and final resolution. Liquidity providers stake rBTC, coverage buyers pay premiums, and payouts/withdrawals are enforced on-chain.

Tagline + pitch: **Bitcoin’s bridge, covered.** PegGuard is a decentralized insurance primitive on Rootstock that protects rBTC holders against bridge security failures with an on-chain, timestamp-driven lifecycle (no manual intervention required).

## What this project does

PegGuard creates a minimal on-chain insurance primitive for BTC bridge users on Rootstock (per the blueprint in [`memory-bank/blueprint.docx`](memory-bank/blueprint.docx)):

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

## Deployed Contracts (Rootstock Testnet)

| Contract | Address | Blockscout |
|---|---|---|
| PegGuard | 0xb9ae9EB39CBA9b88fAa7e3211815491e8932FBfb | https://rootstock-testnet.blockscout.com/address/0xb9ae9EB39CBA9b88fAa7e3211815491e8932FBfb |
| PegGuardPool | 0x3bFFc23662B391FbDc3a645d78C14C7e0876a4EF | https://rootstock-testnet.blockscout.com/address/0x3bFFc23662B391FbDc3a645d78C14C7e0876a4EF |
| MockOracle | 0x66a9107924C60123f6F9AC36d7c1358f604ef4e8 | https://rootstock-testnet.blockscout.com/address/0x66a9107924C60123f6F9AC36d7c1358f604ef4e8 |

## Architecture

PegGuard is split into a lifecycle contract and a pool contract:

- [`PegGuard`](contracts/PegGuard.sol): policy/lifecycle state machine (`OPEN → ACTIVE → DISPUTED → RESOLVED`)
- [`PegGuardPool`](contracts/PegGuardPool.sol): staking, premium accounting, payouts, and LP withdrawals
- [`MockOracle`](contracts/MockOracle.sol): owner-gated mock oracle for MVP/testing

State machine diagram (text-based):

```text
OPEN      --(timestamp >= coverageStart)--> ACTIVE
ACTIVE    --(oracle reports breach)-------> DISPUTED
ACTIVE    --(timestamp >= coverageEnd)----> RESOLVED
DISPUTED  --(timestamp >= disputeEnd)-----> RESOLVED
```

## Setup

1) Install dependencies

```bash
npm install
```

2) Configure environment

```bash
cp .env.example .env
```

Required variables in [`.env.example`](.env.example):

- `PRIVATE_KEY`
- `RSK_TESTNET_RPC_URL` (default public node provided)
- `RSK_MAINNET_RPC_URL` (default public node provided)
- `VERIFY_API_KEY` (optional for Blockscout verification)

Testnet faucet: https://faucet.rootstock.io/

## Run Tests

```bash
npx hardhat test
```

Expected: **51 passing, 0 failing**.

## Deploy

```bash
npx hardhat run scripts/deploy.js --network rskTestnet
```

## Demo

```bash
npx hardhat run scripts/interact.js --network rskTestnet
```

Demo TX hashes (Rootstock Testnet):

- deposit(): 0xa135bc71f32e9ce5bd60e7dfc5f2fbd07cee227e3a4edd2269dec0c4face67d5
- purchaseCoverage(): 0xf1674c6aab31a911df88764a3096b2e47889da7bd3db334b4ca904271a7d6f6b
- activate(): 0x5d3419211479bf56c155c12b8ea784894cd025e9c447854cd800b023e369f033
- reportBreach(): 0x9df11782b6aafa1c59d87e1b746389124eb7ac2cf99181ef390512333dbaa772
- resolve(): 0x45a26f6342cfeac8e2775f8b7b3cb4f1445b701873320e71eed9047c5e5fe877
- claimPayout(): 0xb2c6cde0aeeb50a7e667f79126a7f59cef08e7e9c27933ef4744eb1e9dc75ab7

## State Machine

OPEN → ACTIVE → DISPUTED → RESOLVED

## Scope

| In Scope (MVP) | Out of Scope (Post-Grant) |
|---|---|
| PegGuard.sol state machine | Frontend dApp / UI |
| PegGuardPool.sol | Production decentralized oracle |
| IPegGuardOracle.sol interface | Multi-bridge support |
| MockOracle.sol | Governance token / LP rewards token |
| Full Hardhat test suite | Formal security audit |
| Testnet deployment + Blockscout verification | Mainnet deployment |
| README with full documentation | Cross-chain coverage |

## License

MIT
