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
