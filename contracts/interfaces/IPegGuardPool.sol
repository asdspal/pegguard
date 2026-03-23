// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IPegGuardPool {
    function totalStaked() external view returns (uint256);

    function totalPremiums() external view returns (uint256);
}
