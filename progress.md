## Milestone 0: Foundation & Validation

### Step M0.1: Scaffold Project — COMPLETED
- Hardhat project initialized with Rootstock testnet/mainnet network config
- Solidity compiler set to 0.8.25
- `@nomicfoundation/hardhat-verify` installed
- `.env.example` added and `.env` ignored
- Compile check passed

### Step M0.2: Structure and Interfaces — COMPLETED
- Created `contracts/interfaces/IPegGuardOracle.sol`
- Created `contracts/interfaces/IPegGuardPool.sol`
- Created `contracts/interfaces/IPegGuard.sol`
- Created baseline contract structure files (`PegGuard.sol`, `PegGuardPool.sol`)

### Step M0.3: MockOracle + First Tests — COMPLETED
- Implemented `contracts/MockOracle.sol` with OZ v5 `Ownable(msg.sender)`
- Added 3 unit tests in `test/MockOracle.test.js`
- All 3 MockOracle tests passing

## Milestone 1: PegGuard State Machine

### Step M1.1: State Enum, Variables, Constructor — COMPLETED
- Implemented enum/state variables and constructor in `contracts/PegGuard.sol`
- Added `getState()` view function
- Added 5 constructor tests in `test/PegGuard.test.js`
- Constructor test suite passing

## Milestone 2: Pool Core (Part 1)

### Step M2.1: Storage, Constructor, deposit() — COMPLETED
- Implemented all 7 pool storage variables in `contracts/PegGuardPool.sol`
- Added constructor `constructor(address _pegGuard)` and linked PegGuard address
- Implemented `deposit()` as payable with OPEN-state gate via `IPegGuard(pegGuard).getState()`
- Updated `contracts/interfaces/IPegGuardPool.sol` with pool function signatures and view methods
- Added `contracts/MockPegGuard.sol` for isolated pool state testing
- Added `test/PegGuardPool.test.js` with constructor + `deposit()` coverage
- `npx hardhat test test/PegGuardPool.test.js` passing (9/9)

## Verification Snapshot
- `npx hardhat compile` ✅
- `npx hardhat test test/MockOracle.test.js test/PegGuard.test.js` ✅
- `npx hardhat test test/PegGuardPool.test.js` ✅
- Current passing tests: 33/33 (`MockOracle` + `PegGuard` + `PegGuardPool`)

## Milestone 3: Integration Flows

### Step M3.1: Happy Path — Clean Resolution, LP Withdraws — COMPLETED
- Added shared deployment helper: `test/helpers/setup.js`
  - Deploy order uses circular-dependency workaround: temporary `PegGuardPool(ZeroAddress)` → `PegGuard` → final `PegGuardPool(pegGuard)`
- Added full lifecycle integration test suite: `test/integration/happyPath.test.js`
  - Flow covered: `deposit()` → `purchaseCoverage()` → `activate()` → `resolve()` → `withdraw()` → `claimPayout()` revert (no breach)
  - Time travel uses `evm_increaseTime` + `evm_mine` for both start and end window transitions
- Assertions included:
  - state transition to `ACTIVE` then `RESOLVED`
  - `breachConfirmed == false` on clean resolution path
  - LP withdraw event and numerical balance delta equals `stake + pro-rata premium`
  - buyer `claimPayout()` reverts with `No breach confirmed`

## Verification Snapshot (Updated)
- `npx hardhat test test/integration/happyPath.test.js` ✅ (7 passing)
- `npx hardhat test` ✅ (62 passing, 0 failing)

### Step M3.3: Edge Cases — Expired Window, Double Claim, Unauthorized Breach — COMPLETED
- Added edge-case integration suite: `test/integration/edgeCases.test.js`
  - Covered all Phase 3 scenarios from Blueprint Section 6:
    - expired coverage + no breach → `claimPayout()` reverts with `No breach confirmed`
    - double-claim attempt → second `claimPayout()` reverts with `Already claimed`
    - unauthorized `reportBreach()` caller → reverts with `Not oracle`
    - `resolve()` before time guard checked from both states:
      - ACTIVE path reverts with `Coverage not ended`
      - DISPUTED path reverts with `Dispute not ended`
    - `claimPayout()` from address with no purchased coverage → reverts with `No coverage`
- Added explicit post-revert assertions to verify no unintended state mutation for key storage:
  - `coverageAmounts`, `hasClaimed`, `breachConfirmed`, `state`

## Verification Snapshot (Final)
- `npx hardhat test test/integration/edgeCases.test.js` ✅ (5 passing)
- `npx hardhat test` ✅ (75 passing, 0 failing)
- `npx hardhat coverage` ✅
  - `PegGuard.sol`: 100% statements, 100% branches, 100% functions, 100% lines
  - `PegGuardPool.sol`: 100% statements, 90% branches, 100% functions, 100% lines

## Milestone 4: Deployment Tooling

### Step M4.1: Write and Validate deploy.js Script — COMPLETED
- Added [`scripts/deploy.js`](scripts/deploy.js:1) to deploy MockOracle → temp PegGuardPool → PegGuard → final PegGuardPool using Rootstock-specific timings and dispute duration (GAP 1)
- Script logs deployer address/balance, enforces sequential order, and persists coverage window metadata
- Local dry-run via `npx hardhat run scripts/deploy.js` (Hardhat network) succeeded and generated [`deployments/rskTestnet.json`](deployments/rskTestnet.json:1)
- `deployments/mainnet.json` remains gitignored; testnet deployments committed per Blueprint Section 7

### Step M4.3: Full Lifecycle Demo Script — IMPLEMENTED
- Added [`scripts/deployDemo.js`](scripts/deployDemo.js:1) with short demo windows: `coverageStart=+60s`, `coverageEnd=+300s`, `disputeDuration=120s`
- Added [`scripts/interact.js`](scripts/interact.js:1) to run full lifecycle: deposit → purchaseCoverage → activate → reportBreach → resolve → claimPayout
- Demo script reads [`deployments/rskTestnet.json`](deployments/rskTestnet.json:1) for addresses/config (no hardcoded addresses)
- TX hashes (testnet run completed):
  - deposit(): 0xa135bc71f32e9ce5bd60e7dfc5f2fbd07cee227e3a4edd2269dec0c4face67d5
  - purchaseCoverage(): 0xf1674c6aab31a911df88764a3096b2e47889da7bd3db334b4ca904271a7d6f6b
  - activate(): 0x5d3419211479bf56c155c12b8ea784894cd025e9c447854cd800b023e369f033
  - reportBreach(): 0x9df11782b6aafa1c59d87e1b746389124eb7ac2cf99181ef390512333dbaa772
  - resolve(): 0x45a26f6342cfeac8e2775f8b7b3cb4f1445b701873320e71eed9047c5e5fe877
  - claimPayout(): 0xb2c6cde0aeeb50a7e667f79126a7f59cef08e7e9c27933ef4744eb1e9dc75ab7

### Step M4.4: NatSpec + README — COMPLETED
- Added NatSpec comments to all public functions in `PegGuard.sol`, `PegGuardPool.sol`, and `MockOracle.sol`
- Documented integer division rounding caveat on `withdraw()`
- Updated README with setup, deployment, demo commands, scope table, and testnet addresses
- `npx hardhat test` still expected to pass 51/51 after doc changes
