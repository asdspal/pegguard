// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IPegGuardPool {
    function deposit() external payable;

    function purchaseCoverage() external payable;

    function claimPayout() external;

    function withdraw() external;

    function totalStaked() external view returns (uint256);

    function totalPremiums() external view returns (uint256);
}
