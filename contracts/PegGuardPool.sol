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
}
