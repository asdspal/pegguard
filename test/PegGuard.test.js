const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PegGuard - Constructor", function () {
  async function deployFixture() {
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");
    const PegGuard = await ethers.getContractFactory("PegGuard");

    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const pool = await PegGuardPool.deploy();
    await pool.waitForDeployment();

    const block = await ethers.provider.getBlock("latest");
    const coverageStart = BigInt(block.timestamp + 60);
    const coverageEnd = BigInt(block.timestamp + 3600);
    const disputeDuration = 120n;

    const pegGuard = await PegGuard.deploy(
      oracle.target,
      pool.target,
      coverageStart,
      coverageEnd,
      disputeDuration
    );
    await pegGuard.waitForDeployment();

    return { pegGuard, oracle, pool, coverageStart, coverageEnd };
  }

  it("deploys with State.OPEN", async function () {
    const { pegGuard } = await deployFixture();
    expect(await pegGuard.getState()).to.equal(0n);
  });

  it("stores oracle address correctly", async function () {
    const { pegGuard, oracle } = await deployFixture();
    expect(await pegGuard.oracle()).to.equal(oracle.target);
  });

  it("stores pool address correctly", async function () {
    const { pegGuard, pool } = await deployFixture();
    expect(await pegGuard.pool()).to.equal(pool.target);
  });

  it("stores coverageStart and coverageEnd correctly", async function () {
    const { pegGuard, coverageStart, coverageEnd } = await deployFixture();
    expect(await pegGuard.coverageStart()).to.equal(coverageStart);
    expect(await pegGuard.coverageEnd()).to.equal(coverageEnd);
  });

  it("reverts if coverageEnd <= coverageStart", async function () {
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");
    const PegGuard = await ethers.getContractFactory("PegGuard");

    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const pool = await PegGuardPool.deploy();
    await pool.waitForDeployment();

    const block = await ethers.provider.getBlock("latest");
    const coverageStart = BigInt(block.timestamp + 100);
    const coverageEnd = BigInt(block.timestamp + 100);

    await expect(
      PegGuard.deploy(oracle.target, pool.target, coverageStart, coverageEnd, 120)
    ).to.be.revertedWith("Invalid coverage window");
  });
});
