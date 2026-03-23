const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PegGuardPool - Constructor", function () {
  async function deployFixture() {
    const MockPegGuard = await ethers.getContractFactory("MockPegGuard");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");

    const mockPegGuard = await MockPegGuard.deploy();
    await mockPegGuard.waitForDeployment();

    const pool = await PegGuardPool.deploy(mockPegGuard.target);
    await pool.waitForDeployment();

    return { pool, mockPegGuard };
  }

  it("stores pegGuard address correctly", async function () {
    const { pool, mockPegGuard } = await deployFixture();
    expect(await pool.pegGuard()).to.equal(mockPegGuard.target);
  });

  it("initializes totalStaked to 0", async function () {
    const { pool } = await deployFixture();
    expect(await pool.totalStaked()).to.equal(0n);
  });

  it("initializes totalPremiums to 0", async function () {
    const { pool } = await deployFixture();
    expect(await pool.totalPremiums()).to.equal(0n);
  });
});

describe("PegGuardPool - deposit()", function () {
  async function deployFixture() {
    const [owner, lp1, lp2] = await ethers.getSigners();
    const MockPegGuard = await ethers.getContractFactory("MockPegGuard");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");

    const mockPegGuard = await MockPegGuard.deploy();
    await mockPegGuard.waitForDeployment();

    const pool = await PegGuardPool.deploy(mockPegGuard.target);
    await pool.waitForDeployment();

    return { owner, lp1, lp2, pool, mockPegGuard };
  }

  it("LP can deposit rBTC during OPEN state", async function () {
    const { pool, lp1 } = await deployFixture();
    await expect(pool.connect(lp1).deposit({ value: ethers.parseEther("1.0") })).to.not.be
      .reverted;
  });

  it("updates lpStakes for depositor", async function () {
    const { pool, lp1 } = await deployFixture();
    const amount = ethers.parseEther("1.0");

    await pool.connect(lp1).deposit({ value: amount });
    expect(await pool.lpStakes(lp1.address)).to.equal(amount);
  });

  it("updates totalStaked correctly", async function () {
    const { pool, lp1 } = await deployFixture();
    const amount = ethers.parseEther("1.0");

    await pool.connect(lp1).deposit({ value: amount });
    expect(await pool.totalStaked()).to.equal(amount);
  });

  it("multiple LPs can deposit independently", async function () {
    const { pool, lp1, lp2 } = await deployFixture();
    const amount1 = ethers.parseEther("1.5");
    const amount2 = ethers.parseEther("0.4");

    await pool.connect(lp1).deposit({ value: amount1 });
    await pool.connect(lp2).deposit({ value: amount2 });

    expect(await pool.lpStakes(lp1.address)).to.equal(amount1);
    expect(await pool.lpStakes(lp2.address)).to.equal(amount2);
    expect(await pool.totalStaked()).to.equal(amount1 + amount2);
  });

  it("reverts if msg.value is 0", async function () {
    const { pool, lp1 } = await deployFixture();

    await expect(pool.connect(lp1).deposit({ value: 0 })).to.be.revertedWith(
      "Must deposit > 0"
    );
  });

  it("reverts if state is not OPEN", async function () {
    const { pool, lp1, mockPegGuard } = await deployFixture();

    await mockPegGuard.setState(1);

    await expect(
      pool.connect(lp1).deposit({ value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Pool not open");
  });
});

describe("PegGuardPool - purchaseCoverage()", function () {
  async function deployFixture() {
    const [owner, buyer1, buyer2] = await ethers.getSigners();
    const MockPegGuard = await ethers.getContractFactory("MockPegGuard");
    const PegGuardPool = await ethers.getContractFactory("PegGuardPool");

    const mockPegGuard = await MockPegGuard.deploy();
    await mockPegGuard.waitForDeployment();

    const pool = await PegGuardPool.deploy(mockPegGuard.target);
    await pool.waitForDeployment();

    return { owner, buyer1, buyer2, pool, mockPegGuard };
  }

  it("buyer can purchase coverage during OPEN state", async function () {
    const { pool, buyer1 } = await deployFixture();

    await expect(
      pool.connect(buyer1).purchaseCoverage({ value: ethers.parseEther("1.0") })
    ).to.not.be.reverted;
  });

  it("records coverageAmounts correctly", async function () {
    const { pool, buyer1 } = await deployFixture();
    const amount = ethers.parseEther("0.75");

    await pool.connect(buyer1).purchaseCoverage({ value: amount });
    expect(await pool.coverageAmounts(buyer1.address)).to.equal(amount);
  });

  it("records premiumsPaid correctly", async function () {
    const { pool, buyer1 } = await deployFixture();
    const amount = ethers.parseEther("0.33");

    await pool.connect(buyer1).purchaseCoverage({ value: amount });
    expect(await pool.premiumsPaid(buyer1.address)).to.equal(amount);
  });

  it("updates totalPremiums correctly", async function () {
    const { pool, buyer1 } = await deployFixture();
    const amount = ethers.parseEther("1.2");

    await pool.connect(buyer1).purchaseCoverage({ value: amount });
    expect(await pool.totalPremiums()).to.equal(amount);
  });

  it("multiple buyers can purchase independently", async function () {
    const { pool, buyer1, buyer2 } = await deployFixture();
    const amount1 = ethers.parseEther("1.1");
    const amount2 = ethers.parseEther("0.4");

    await pool.connect(buyer1).purchaseCoverage({ value: amount1 });
    await pool.connect(buyer2).purchaseCoverage({ value: amount2 });

    expect(await pool.coverageAmounts(buyer1.address)).to.equal(amount1);
    expect(await pool.coverageAmounts(buyer2.address)).to.equal(amount2);
    expect(await pool.premiumsPaid(buyer1.address)).to.equal(amount1);
    expect(await pool.premiumsPaid(buyer2.address)).to.equal(amount2);
    expect(await pool.totalPremiums()).to.equal(amount1 + amount2);
  });

  it("reverts if msg.value is 0", async function () {
    const { pool, buyer1 } = await deployFixture();

    await expect(pool.connect(buyer1).purchaseCoverage({ value: 0 })).to.be.revertedWith(
      "Must pay premium > 0"
    );
  });

  it("reverts if state is not OPEN", async function () {
    const { pool, buyer1, mockPegGuard } = await deployFixture();

    await mockPegGuard.setState(1);

    await expect(
      pool.connect(buyer1).purchaseCoverage({ value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Pool not open");
  });
});
