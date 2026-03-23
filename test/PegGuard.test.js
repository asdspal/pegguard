const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("PegGuard - Constructor", function () {
  async function deployFixture() {
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");
    const PegGuard = await ethers.getContractFactory("PegGuard");

    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const pool = await PegGuardPool.deploy(ethers.ZeroAddress);
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

    const pool = await PegGuardPool.deploy(ethers.ZeroAddress);
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

    const pool = await PegGuardPool.deploy(ethers.ZeroAddress);
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

describe("PegGuard - reportBreach()", function () {
  async function deployFixture() {
    const [deployer, nonOracle] = await ethers.getSigners();
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");
    const PegGuard = await ethers.getContractFactory("PegGuard");

    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const pool = await PegGuardPool.deploy(ethers.ZeroAddress);
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

    return {
      deployer,
      nonOracle,
      pegGuard,
      oracle,
      coverageDelay,
      disputeDuration,
    };
  }

  async function getOracleSigner(oracleAddress) {
    await network.provider.request({
      method: "hardhat_setBalance",
      params: [oracleAddress, "0x3635C9ADC5DEA00000"],
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [oracleAddress],
    });

    return await ethers.getSigner(oracleAddress);
  }

  it("reverts if called by non-oracle address", async function () {
    const { pegGuard, nonOracle, coverageDelay } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await expect(pegGuard.connect(nonOracle).reportBreach()).to.be.revertedWith("Not oracle");
  });

  it("reverts if state is not ACTIVE", async function () {
    const { pegGuard, oracle } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await expect(pegGuard.connect(oracleSigner).reportBreach()).to.be.revertedWith("Invalid state");

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });

  it("sets breachConfirmed = true", async function () {
    const { pegGuard, oracle, coverageDelay } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await pegGuard.connect(oracleSigner).reportBreach();
    expect(await pegGuard.breachConfirmed()).to.equal(true);

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });

  it("sets state to DISPUTED", async function () {
    const { pegGuard, oracle, coverageDelay } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await pegGuard.connect(oracleSigner).reportBreach();
    expect(await pegGuard.getState()).to.equal(2n);

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });

  it("sets disputeEnd correctly", async function () {
    const { pegGuard, oracle, coverageDelay, disputeDuration } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    const tx = await pegGuard.connect(oracleSigner).reportBreach();
    const receipt = await tx.wait();
    const reportBlock = await ethers.provider.getBlock(receipt.blockNumber);

    expect(await pegGuard.disputeEnd()).to.equal(BigInt(reportBlock.timestamp) + disputeDuration);

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });

  it("emits BreachReported with oracle address and timestamp", async function () {
    const { pegGuard, oracle, coverageDelay } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    const tx = await pegGuard.connect(oracleSigner).reportBreach();
    const receipt = await tx.wait();
    const reportBlock = await ethers.provider.getBlock(receipt.blockNumber);

    await expect(tx)
      .to.emit(pegGuard, "BreachReported")
      .withArgs(oracle.target, BigInt(reportBlock.timestamp));

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });
});

describe("PegGuard - resolve()", function () {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");
    const PegGuard = await ethers.getContractFactory("PegGuard");

    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const pool = await PegGuardPool.deploy(ethers.ZeroAddress);
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

    return {
      deployer,
      pegGuard,
      oracle,
      pool,
      coverageDelay,
      coverageDuration: Number(coverageEnd - coverageStart),
    };
  }

  async function getOracleSigner(oracleAddress) {
    await network.provider.request({
      method: "hardhat_setBalance",
      params: [oracleAddress, "0x3635C9ADC5DEA00000"],
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [oracleAddress],
    });

    return await ethers.getSigner(oracleAddress);
  }

  it("resolves ACTIVE → RESOLVED after coverageEnd (no breach path)", async function () {
    const { pegGuard, coverageDelay, coverageDuration } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await network.provider.send("evm_increaseTime", [coverageDuration]);
    await network.provider.send("evm_mine");

    await pegGuard.resolve();
    expect(await pegGuard.getState()).to.equal(3n);
    expect(await pegGuard.breachConfirmed()).to.equal(false);
  });

  it("reverts if ACTIVE and coverageEnd not reached", async function () {
    const { pegGuard, coverageDelay } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await expect(pegGuard.resolve()).to.be.revertedWith("Coverage not ended");
  });

  it("resolves DISPUTED → RESOLVED after disputeEnd (breach path)", async function () {
    const { pegGuard, oracle, coverageDelay } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await pegGuard.connect(oracleSigner).reportBreach();

    await network.provider.send("evm_increaseTime", [120]);
    await network.provider.send("evm_mine");

    await pegGuard.resolve();
    expect(await pegGuard.getState()).to.equal(3n);
    expect(await pegGuard.breachConfirmed()).to.equal(true);

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });

  it("reverts if DISPUTED and disputeEnd not reached", async function () {
    const { pegGuard, oracle, coverageDelay } = await deployFixture();
    const oracleSigner = await getOracleSigner(oracle.target);

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await pegGuard.connect(oracleSigner).reportBreach();

    await expect(pegGuard.resolve()).to.be.revertedWith("Dispute not ended");

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracle.target],
    });
  });

  it("reverts if called from OPEN or RESOLVED state", async function () {
    const { pegGuard, coverageDelay, coverageDuration } = await deployFixture();

    await expect(pegGuard.resolve()).to.be.revertedWith("Cannot resolve from current state");

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await network.provider.send("evm_increaseTime", [coverageDuration]);
    await network.provider.send("evm_mine");
    await pegGuard.resolve();

    await expect(pegGuard.resolve()).to.be.revertedWith("Cannot resolve from current state");
  });

  it("emits CoverageExpired with correct totalPremiums", async function () {
    const { pegGuard, pool, coverageDelay, coverageDuration } = await deployFixture();

    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
    await pegGuard.activate();

    await network.provider.send("evm_increaseTime", [coverageDuration]);
    await network.provider.send("evm_mine");

    const tx = await pegGuard.resolve();
    const receipt = await tx.wait();
    const resolveBlock = await ethers.provider.getBlock(receipt.blockNumber);

    await expect(tx)
      .to.emit(pegGuard, "CoverageExpired")
      .withArgs(BigInt(resolveBlock.timestamp), await pool.totalPremiums());
  });
});
