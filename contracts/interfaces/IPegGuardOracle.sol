// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IPegGuardOracle {
    function reportBreach() external;

    function isBreachConfirmed() external view returns (bool);
}
