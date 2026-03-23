// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPegGuard.sol";

contract PegGuardPool is ReentrancyGuard {
    mapping(address => uint256) public lpStakes;
    mapping(address => uint256) public coverageAmounts;
    mapping(address => uint256) public premiumsPaid;
    uint256 public totalStaked;
    uint256 public totalPremiums;
    mapping(address => bool) public hasClaimed;
    address public pegGuard;

    constructor(address _pegGuard) {
        pegGuard = _pegGuard;
    }

    function deposit() external payable {
        require(IPegGuard(pegGuard).getState() == 0, "Pool not open");
        require(msg.value > 0, "Must deposit > 0");

        lpStakes[msg.sender] += msg.value;
        totalStaked += msg.value;
    }

    /**
     * @notice Purchases coverage by paying an rBTC premium while the pool is OPEN.
     * @dev MVP simplification: coverage is 1:1 with premium paid. Both
     * `coverageAmounts` and `premiumsPaid` are stored separately by design so they
     * can diverge in a post-MVP model that applies a coverage multiplier.
     */
    function purchaseCoverage() external payable {
        require(IPegGuard(pegGuard).getState() == 0, "Pool not open");
        require(msg.value > 0, "Must pay premium > 0");

        coverageAmounts[msg.sender] += msg.value;
        premiumsPaid[msg.sender] += msg.value;
        totalPremiums += msg.value;
    }
}
