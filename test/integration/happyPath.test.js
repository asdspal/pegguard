const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { deployAll } = require("../helpers/setup");

describe("Happy Path — Clean Resolution", function () {
  const coverageDelay = 60;
  const coverageDuration = 3600;
  const disputeDuration = 120;

  const stake = ethers.parseEther("1.0");
  const premiumPaid = ethers.parseEther("0.2");

  async function openPoolWithFunds() {
    const ctx = await deployAll(coverageDelay, coverageDuration, disputeDuration);
    await ctx.pool.connect(ctx.lp).deposit({ value: stake });
    await ctx.pool.connect(ctx.buyer).purchaseCoverage({ value: premiumPaid });
    return ctx;
  }

  async function moveToCoverageStart() {
    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
  }

  async function movePastCoverageEnd() {
    await network.provider.send("evm_increaseTime", [coverageDuration]);
    await network.provider.send("evm_mine");
  }

  async function activateAndResolveNoBreach(ctx) {
    await moveToCoverageStart();
    await ctx.pegGuard.activate();
    await movePastCoverageEnd();
    await ctx.pegGuard.resolve();
  }

  it("LP deposits rBTC successfully", async function () {
    const { pool, lp } = await deployAll(coverageDelay, coverageDuration, disputeDuration);

    await expect(pool.connect(lp).deposit({ value: stake })).to.not.be.reverted;
    expect(await pool.lpStakes(lp.address)).to.equal(stake);
    expect(await pool.totalStaked()).to.equal(stake);
  });

  it("buyer purchases coverage successfully", async function () {
    const { pool, buyer } = await deployAll(coverageDelay, coverageDuration, disputeDuration);

    await expect(pool.connect(buyer).purchaseCoverage({ value: premiumPaid })).to.not.be.reverted;
    expect(await pool.coverageAmounts(buyer.address)).to.equal(premiumPaid);
    expect(await pool.premiumsPaid(buyer.address)).to.equal(premiumPaid);
    expect(await pool.totalPremiums()).to.equal(premiumPaid);
  });

  it("activate() transitions to ACTIVE at coverageStart", async function () {
    const ctx = await openPoolWithFunds();

    await moveToCoverageStart();
    await ctx.pegGuard.activate();

    expect(await ctx.pegGuard.getState()).to.equal(1n);
  });

  it("resolve() transitions to RESOLVED after coverageEnd", async function () {
    const ctx = await openPoolWithFunds();

    await activateAndResolveNoBreach(ctx);

    expect(await ctx.pegGuard.getState()).to.equal(3n);
    expect(await ctx.pegGuard.breachConfirmed()).to.equal(false);
  });

  it("LP withdraws stake plus correct pro-rata premium", async function () {
    const ctx = await openPoolWithFunds();
    await activateAndResolveNoBreach(ctx);

    const expectedPremium = (stake * premiumPaid) / stake;

    await expect(ctx.pool.connect(ctx.lp).withdraw())
      .to.emit(ctx.pool, "LPWithdrawn")
      .withArgs(ctx.lp.address, stake, expectedPremium);
  });

  it("LP balance increases by stake + premium after withdrawal", async function () {
    const ctx = await openPoolWithFunds();
    await activateAndResolveNoBreach(ctx);

    const expectedPremium = (stake * premiumPaid) / stake;
    const expectedPayout = stake + expectedPremium;

    const before = await ethers.provider.getBalance(ctx.lp.address);
    const tx = await ctx.pool.connect(ctx.lp).withdraw();
    const receipt = await tx.wait();
    const gasPrice = receipt.gasPrice ?? tx.gasPrice ?? 0n;
    const gasCost = receipt.gasUsed * gasPrice;
    const after = await ethers.provider.getBalance(ctx.lp.address);

    expect(after - before + gasCost).to.equal(expectedPayout);
  });

  it("buyer claimPayout() reverts — no breach confirmed", async function () {
    const ctx = await openPoolWithFunds();
    await activateAndResolveNoBreach(ctx);

    await ctx.pool.connect(ctx.lp).withdraw();

    await expect(ctx.pool.connect(ctx.buyer).claimPayout()).to.be.revertedWith(
      "No breach confirmed"
    );
  });
});
