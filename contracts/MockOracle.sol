// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockOracle is Ownable {
    bool private breachConfirmed;

    constructor() Ownable(msg.sender) {}

    function reportBreach() external onlyOwner {
        breachConfirmed = true;
    }

    function isBreachConfirmed() external view returns (bool) {
        return breachConfirmed;
    }
}
