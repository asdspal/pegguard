# PegGuard

**Bitcoin’s bridge, covered.**

PegGuard is a Rootstock-native smart contract system for bridge-risk coverage. It implements a timestamp-driven state machine that governs coverage activation, breach disputes, and final resolution. Liquidity providers stake rBTC, buyers purchase coverage, and payouts/withdrawals are enforced on-chain.

This repository implements the capstone MVP described in [`memory-bank/blueprint.docx`](memory-bank/blueprint.docx) and [`memory-bank/implementation-plan.md`](memory-bank/implementation-plan.md).

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

