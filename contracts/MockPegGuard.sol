// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract MockPegGuard {
    uint8 private _state;
    bool private _breachConfirmed;

    constructor() {
        _state = 0;
    }

    function setState(uint8 newState) external {
        _state = newState;
    }

    function setBreachConfirmed(bool value) external {
        _breachConfirmed = value;
    }

    function getState() external view returns (uint8) {
        return _state;
    }

    function breachConfirmed() external view returns (bool) {
        return _breachConfirmed;
    }
}
