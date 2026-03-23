const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockOracle", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const mockOracle = await MockOracle.deploy();
    await mockOracle.waitForDeployment();

    return { mockOracle, owner, other };
  }

  it("starts with breach not confirmed", async function () {
    const { mockOracle } = await deployFixture();
    expect(await mockOracle.isBreachConfirmed()).to.equal(false);
  });

  it("allows owner to report breach", async function () {
    const { mockOracle } = await deployFixture();
    await mockOracle.reportBreach();
    expect(await mockOracle.isBreachConfirmed()).to.equal(true);
  });

  it("reverts when non-owner reports breach", async function () {
    const { mockOracle, other } = await deployFixture();

    await expect(mockOracle.connect(other).reportBreach()).to.be.revertedWithCustomError(
      mockOracle,
      "OwnableUnauthorizedAccount"
    );
  });
});
