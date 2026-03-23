// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IPegGuard {
    function getState() external view returns (uint8);

    function breachConfirmed() external view returns (bool);
}
