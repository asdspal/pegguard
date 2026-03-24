const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { deployAll } = require("../helpers/setup");

describe("Edge Cases", function () {
  const coverageDelay = 60;
  const coverageDuration = 3600;
  const disputeDuration = 120;

  const stake = ethers.parseEther("1.0");
  const premiumPaid = ethers.parseEther("0.2");

  async function openPoolWithFunds() {
    const ctx = await deployAll(coverageDelay, coverageDuration, disputeDuration);
    const [, , buyer, outsider] = await ethers.getSigners();

    ctx.outsider = outsider;
    await ctx.pool.connect(ctx.lp).deposit({ value: stake });
    await ctx.pool.connect(buyer).purchaseCoverage({ value: premiumPaid });

    return ctx;
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

    return ethers.getSigner(oracleAddress);
  }

  async function stopOracleImpersonation(oracleAddress) {
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [oracleAddress],
    });
  }

  async function moveToCoverageStart() {
    await network.provider.send("evm_increaseTime", [coverageDelay]);
    await network.provider.send("evm_mine");
  }

  async function movePastCoverageEnd() {
    await network.provider.send("evm_increaseTime", [coverageDuration + 1]);
    await network.provider.send("evm_mine");
  }

  async function moveIntoActiveWindow() {
    await network.provider.send("evm_increaseTime", [1]);
    await network.provider.send("evm_mine");
  }

  async function activateAndReportBreach(ctx) {
    await moveToCoverageStart();
    await ctx.pegGuard.activate();
    await moveIntoActiveWindow();

    const oracleSigner = await getOracleSigner(ctx.oracle.target);
    await ctx.pegGuard.connect(oracleSigner).reportBreach();
    await stopOracleImpersonation(ctx.oracle.target);
  }

  async function resolveAfterDispute(ctx) {
    await network.provider.send("evm_increaseTime", [disputeDuration + 1]);
    await network.provider.send("evm_mine");
    await ctx.pegGuard.resolve();
  }

  it("buyer cannot claim when no breach confirmed", async function () {
    const ctx = await openPoolWithFunds();

    await moveToCoverageStart();
    await ctx.pegGuard.activate();
    await movePastCoverageEnd();
    await ctx.pegGuard.resolve();

    const beforeCoverage = await ctx.pool.coverageAmounts(ctx.buyer.address);
    const beforeClaimFlag = await ctx.pool.hasClaimed(ctx.buyer.address);

    await expect(ctx.pool.connect(ctx.buyer).claimPayout()).to.be.revertedWith(
      "No breach confirmed"
    );

    expect(await ctx.pool.coverageAmounts(ctx.buyer.address)).to.equal(beforeCoverage);
    expect(await ctx.pool.hasClaimed(ctx.buyer.address)).to.equal(beforeClaimFlag);
  });

  it("double-claim attempt reverts with Already claimed", async function () {
    const ctx = await openPoolWithFunds();

    await activateAndReportBreach(ctx);
    await resolveAfterDispute(ctx);
    await ctx.pool.connect(ctx.buyer).claimPayout();

    const beforeClaimFlag = await ctx.pool.hasClaimed(ctx.buyer.address);
    const beforeCoverage = await ctx.pool.coverageAmounts(ctx.buyer.address);

    await expect(ctx.pool.connect(ctx.buyer).claimPayout()).to.be.revertedWith(
      "Already claimed"
    );

    expect(await ctx.pool.hasClaimed(ctx.buyer.address)).to.equal(beforeClaimFlag);
    expect(await ctx.pool.coverageAmounts(ctx.buyer.address)).to.equal(beforeCoverage);
  });

  it("non-oracle address cannot call reportBreach", async function () {
    const ctx = await openPoolWithFunds();

    await moveToCoverageStart();
    await ctx.pegGuard.activate();

    const beforeState = await ctx.pegGuard.getState();
    const beforeBreach = await ctx.pegGuard.breachConfirmed();

    await expect(ctx.pegGuard.connect(ctx.outsider).reportBreach()).to.be.revertedWith(
      "Not oracle"
    );

    expect(await ctx.pegGuard.getState()).to.equal(beforeState);
    expect(await ctx.pegGuard.breachConfirmed()).to.equal(beforeBreach);
  });

  it("resolve() reverts if coverageEnd not reached", async function () {
    const ctx = await openPoolWithFunds();

    // ACTIVE path: before coverageEnd
    await moveToCoverageStart();
    await ctx.pegGuard.activate();

    const activeStateBefore = await ctx.pegGuard.getState();
    await expect(ctx.pegGuard.resolve()).to.be.revertedWith("Coverage not ended");
    expect(await ctx.pegGuard.getState()).to.equal(activeStateBefore);

    // DISPUTED path: before disputeEnd
    const oracleSigner = await getOracleSigner(ctx.oracle.target);
    await ctx.pegGuard.connect(oracleSigner).reportBreach();
    await stopOracleImpersonation(ctx.oracle.target);

    const disputedStateBefore = await ctx.pegGuard.getState();
    await expect(ctx.pegGuard.resolve()).to.be.revertedWith("Dispute not ended");
    expect(await ctx.pegGuard.getState()).to.equal(disputedStateBefore);
  });

  it("claimPayout() reverts for address with no coverage", async function () {
    const ctx = await openPoolWithFunds();

    await activateAndReportBreach(ctx);
    await resolveAfterDispute(ctx);

    const beforeOutsiderClaimFlag = await ctx.pool.hasClaimed(ctx.outsider.address);

    await expect(ctx.pool.connect(ctx.outsider).claimPayout()).to.be.revertedWith(
      "No coverage"
    );

    expect(await ctx.pool.hasClaimed(ctx.outsider.address)).to.equal(beforeOutsiderClaimFlag);
    expect(await ctx.pool.coverageAmounts(ctx.outsider.address)).to.equal(0n);
  });
});
