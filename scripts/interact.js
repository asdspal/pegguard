const { ethers } = require("hardhat");
const fs = require("fs");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTimestamp(provider, targetTimestamp) {
  console.log(`Waiting for timestamp ${targetTimestamp}...`);
  while (true) {
    const block = await provider.getBlock("latest");
    if (block.timestamp >= targetTimestamp) {
      break;
    }
    const remaining = targetTimestamp - block.timestamp;
    console.log(`  ${remaining}s remaining...`);
    await sleep(10000);
  }
  console.log("Timestamp reached.");
}

async function main() {
  const deployments = JSON.parse(
    fs.readFileSync("deployments/rskTestnet.json")
  );
  const { MockOracle, PegGuardPool, PegGuard } = deployments.contracts;
  const { coverageStart, coverageEnd, disputeDuration } = deployments.config;
  const [deployer] = await ethers.getSigners();

  const oracle = await ethers.getContractAt("MockOracle", MockOracle);
  const pool = await ethers.getContractAt("PegGuardPool", PegGuardPool);
  const pegGuard = await ethers.getContractAt("PegGuard", PegGuard);

  console.log("\n=== PegGuard Demo — Full Lifecycle ===\n");

  // Step 1: LP deposits
  console.log("[1/6] LP depositing 0.0001 tRBTC...");
  const depositTx = await pool.deposit({
    value: ethers.parseEther("0.0001"),
  });
  await depositTx.wait();
  console.log("  TX:", depositTx.hash);
  console.log(
    "  totalStaked:",
    ethers.formatEther(await pool.totalStaked()),
    "tRBTC"
  );

  // Step 2: Buyer purchases coverage
  console.log("\n[2/6] Buyer purchasing coverage for 0.00001 tRBTC...");
  const coverageTx = await pool.purchaseCoverage({
    value: ethers.parseEther("0.00001"),
  });
  await coverageTx.wait();
  console.log("  TX:", coverageTx.hash);
  console.log(
    "  totalPremiums:",
    ethers.formatEther(await pool.totalPremiums()),
    "tRBTC"
  );

  // Step 3: Wait for coverageStart, then activate
  await waitForTimestamp(ethers.provider, coverageStart);
  console.log("\n[3/6] Activating coverage...");
  const activateTx = await pegGuard.activate();
  await activateTx.wait();
  console.log("  TX:", activateTx.hash);
  console.log("  State:", await pegGuard.getState(), "(1 = ACTIVE)");

  // Step 4: Report breach
  console.log("\n[4/6] Oracle reporting breach via PegGuard...");
  const breachTx = await pegGuard.reportBreach();
  await breachTx.wait();
  console.log("  TX:", breachTx.hash);
  console.log("  State:", await pegGuard.getState(), "(2 = DISPUTED)");
  console.log("  breachConfirmed:", await pegGuard.breachConfirmed());

  // Step 5: Wait for disputeEnd, then resolve
  const breachBlock = await ethers.provider.getBlock(breachTx.blockNumber);
  const disputeEnd = Number(breachBlock.timestamp) + disputeDuration;
  await waitForTimestamp(ethers.provider, disputeEnd);
  console.log("\n[5/6] Resolving after dispute window...");
  const resolveTx = await pegGuard.resolve();
  await resolveTx.wait();
  console.log("  TX:", resolveTx.hash);
  console.log("  State:", await pegGuard.getState(), "(3 = RESOLVED)");

  // Step 6: Buyer claims payout
  console.log("\n[6/6] Buyer claiming payout...");
  const balanceBefore = await ethers.provider.getBalance(deployer.address);
  const claimTx = await pool.claimPayout();
  await claimTx.wait();
  const balanceAfter = await ethers.provider.getBalance(deployer.address);
  console.log("  TX:", claimTx.hash);
  console.log(
    "  Balance delta:",
    ethers.formatEther(balanceAfter - balanceBefore),
    "tRBTC"
  );

  console.log("\n=== Demo Complete ===");
  console.log("All 6 lifecycle steps executed successfully on Rootstock testnet.");
}

main().catch(console.error);
