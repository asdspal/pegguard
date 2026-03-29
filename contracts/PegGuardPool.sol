// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPegGuard.sol";

contract PegGuardPool is ReentrancyGuard {
    event PayoutClaimed(address indexed buyer, uint256 amount);
    event LPWithdrawn(address indexed lp, uint256 stake, uint256 premium);

    mapping(address => uint256) public lpStakes;
    mapping(address => uint256) public coverageAmounts;
    mapping(address => uint256) public premiumsPaid;
    uint256 public totalStaked;
    uint256 public totalPremiums;
    mapping(address => bool) public hasClaimed;
    address public pegGuard;

    /// @notice Creates a new pool linked to a PegGuard state machine.
    /// @dev PegGuard address is used for state gating and breach checks.
    /// @param _pegGuard Address of the PegGuard lifecycle contract.
    constructor(address _pegGuard) {
        pegGuard = _pegGuard;
    }

    /// @notice Allows an LP to stake rBTC into the coverage pool.
    /// @dev Only callable during OPEN state. msg.value must be > 0.
    /// @dev LP's share of premiums on withdrawal is proportional to stake.
    function deposit() external payable {
        require(IPegGuard(pegGuard).getState() == 0, "Pool not open");
        require(msg.value > 0, "Must deposit > 0");

        lpStakes[msg.sender] += msg.value;
        totalStaked += msg.value;
    }

    /// @notice Purchases coverage by paying an rBTC premium while the pool is OPEN.
    /// @dev MVP simplification: coverage is 1:1 with premium paid. Both
    /// @dev `coverageAmounts` and `premiumsPaid` are stored separately by design so they
    /// @dev can diverge in a post-MVP model that applies a coverage multiplier.
    function purchaseCoverage() external payable {
        require(IPegGuard(pegGuard).getState() == 0, "Pool not open");
        require(msg.value > 0, "Must pay premium > 0");

        coverageAmounts[msg.sender] += msg.value;
        premiumsPaid[msg.sender] += msg.value;
        totalPremiums += msg.value;
    }

    /// @notice Claims a payout after breach confirmation and RESOLVED state.
    /// @dev Requires breachConfirmed, non-zero coverage, and one-time claim.
    /// @dev Uses checks-effects-interactions before transferring rBTC.
    function claimPayout() external nonReentrant {
        require(IPegGuard(pegGuard).getState() == 3, "Not resolved");
        require(IPegGuard(pegGuard).breachConfirmed(), "No breach confirmed");
        require(!hasClaimed[msg.sender], "Already claimed");
        require(coverageAmounts[msg.sender] > 0, "No coverage");

        uint256 amount = coverageAmounts[msg.sender];
        hasClaimed[msg.sender] = true;
        coverageAmounts[msg.sender] = 0;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        emit PayoutClaimed(msg.sender, amount);
    }

    /**
     * @notice Withdraws the LP's principal stake plus pro-rata premium share after clean resolution.
     * @dev Premium distribution uses integer division: `(stake * totalPremiums) / totalStaked`.
     * @dev Integer truncation can cause the last withdrawer to receive 1 wei less than the exact
     *      pro-rata amount; the remainder stays in the pool balance as expected MVP behavior.
     */
    function withdraw() external nonReentrant {
        require(IPegGuard(pegGuard).getState() == 3, "Not resolved");
        require(!IPegGuard(pegGuard).breachConfirmed(), "Breach occurred, no withdrawal");

        uint256 stake = lpStakes[msg.sender];
        require(stake > 0, "No stake to withdraw");

        uint256 premium = (stake * totalPremiums) / totalStaked;
        lpStakes[msg.sender] = 0;

        (bool ok,) = msg.sender.call{value: stake + premium}("");
        require(ok, "Transfer failed");

        emit LPWithdrawn(msg.sender, stake, premium);
    }
}
