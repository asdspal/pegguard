const { ethers } = require("hardhat");

async function deployAll(coverageDelay, coverageDuration, disputeDuration) {
  const [deployer, lp, buyer] = await ethers.getSigners();

  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const coverageStart = BigInt(now + coverageDelay);
  const coverageEnd = coverageStart + BigInt(coverageDuration);

  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();

  const Pool = await ethers.getContractFactory("PegGuardPool");
  const tempPool = await Pool.deploy(ethers.ZeroAddress);
  await tempPool.waitForDeployment();

  const PegGuard = await ethers.getContractFactory("PegGuard");
  const pegGuard = await PegGuard.deploy(
    oracle.target,
    tempPool.target,
    coverageStart,
    coverageEnd,
    BigInt(disputeDuration)
  );
  await pegGuard.waitForDeployment();

  const pool = await Pool.deploy(pegGuard.target);
  await pool.waitForDeployment();

  return {
    oracle,
    pool,
    pegGuard,
    deployer,
    lp,
    buyer,
    coverageStart,
    coverageEnd,
  };
}

module.exports = { deployAll };
