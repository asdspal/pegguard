const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying demo with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "tRBTC"
  );

  // Step 1: Deploy MockOracle (kept for reference/testing)
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("MockOracle deployed to:", oracle.target);

  // Step 2: Deploy PegGuardPool (temp address, re-deployed after PegGuard)
  const Pool = await ethers.getContractFactory("PegGuardPool");
  const poolTemp = await Pool.deploy(ethers.ZeroAddress);
  await poolTemp.waitForDeployment();

  // Step 3: Configure short demo coverage window (~1 minute total)
  const block = await ethers.provider.getBlock("latest");
  const coverageStart = block.timestamp + 10;
  const coverageEnd = block.timestamp + 40;
  const disputeDuration = 10;
  const oracleAddress = deployer.address;

  // Step 4: Deploy PegGuard
  const PegGuard = await ethers.getContractFactory("PegGuard");
  const pegGuard = await PegGuard.deploy(
    oracleAddress,
    poolTemp.target,
    coverageStart,
    coverageEnd,
    disputeDuration
  );
  await pegGuard.waitForDeployment();
  console.log("PegGuard deployed to:", pegGuard.target);

  // Step 5: Re-deploy Pool with real PegGuard address
  const pool = await Pool.deploy(pegGuard.target);
  await pool.waitForDeployment();
  console.log("PegGuardPool deployed to:", pool.target);

  // Step 6: Write addresses to deployments file
  const deployments = {
    network: "rskTestnet",
    chainId: 31,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MockOracle: oracle.target,
      PegGuardPool: pool.target,
      PegGuard: pegGuard.target,
    },
    config: {
      coverageStart,
      coverageEnd,
      disputeDuration,
    },
  };

  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(
    "deployments/rskTestnet.json",
    JSON.stringify(deployments, null, 2)
  );
  console.log("Demo deployment saved to deployments/rskTestnet.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
