// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockOracle is Ownable {
    bool private breachConfirmed;

    /// @notice Initializes the mock oracle with the deployer as owner.
    /// @dev Owner is allowed to report a breach for testing and MVP flows.
    constructor() Ownable(msg.sender) {}

    /// @notice Marks a breach as confirmed.
    /// @dev Only callable by the owner; flips breachConfirmed to true.
    function reportBreach() external onlyOwner {
        breachConfirmed = true;
    }

    /// @notice Returns whether a breach has been confirmed.
    /// @dev Used by PegGuard to read oracle status in tests/MVP flows.
    function isBreachConfirmed() external view returns (bool) {
        return breachConfirmed;
    }
}
