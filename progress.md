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
