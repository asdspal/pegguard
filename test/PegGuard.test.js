const { expect } = require("chai");
const { ethers, network } = require("hardhat");

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

describe("PegGuard - activate()", function () {
  async function deployFixture() {
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");
    const PegGuard = await ethers.getContractFactory("PegGuard");

    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const pool = await PegGuardPool.deploy();
    await pool.waitForDeployment();

    const block = await ethers.provider.getBlock("latest");
    const coverageDelay = 60;
    const coverageStart = BigInt(block.timestamp + coverageDelay);
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

    return { pegGuard, pool, coverageStart, coverageEnd, coverageDelay };
  }

  it("reverts if called before coverageStart", async function () {
    const { pegGuard } = await deployFixture();

    await expect(pegGuard.activate()).to.be.revertedWith("Coverage not started");
  });

  it("transitions to ACTIVE after coverageStart", async function () {
    const { pegGuard, coverageDelay } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");

    await pegGuard.activate();
    expect(await pegGuard.getState()).to.equal(1n);
  });

  it("emits CoverageActivated with correct args", async function () {
    const { pegGuard, coverageStart, coverageEnd, coverageDelay } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");

    await expect(pegGuard.activate())
      .to.emit(pegGuard, "CoverageActivated")
      .withArgs(coverageStart, coverageEnd, 0n);
  });

  it("reverts if called twice (not in OPEN state)", async function () {
    const { pegGuard, coverageDelay } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");

    await pegGuard.activate();

    await expect(pegGuard.activate()).to.be.revertedWith("Invalid state");
  });
});
