// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./interfaces/IPegGuardOracle.sol";
import "./interfaces/IPegGuardPool.sol";

contract PegGuard {
    enum State {
        OPEN,
        ACTIVE,
        DISPUTED,
        RESOLVED
    }

    State public state;
    uint256 public coverageStart;
    uint256 public coverageEnd;
    uint256 public disputeEnd;
    IPegGuardOracle public oracle;
    IPegGuardPool public pool;
    bool public breachConfirmed;
    uint256 private _disputeDuration;

    constructor(
        address _oracle,
        address _pool,
        uint256 _coverageStart,
        uint256 _coverageEnd,
        uint256 _disputeDurationInput
    ) {
        require(_coverageEnd > _coverageStart, "Invalid coverage window");

        oracle = IPegGuardOracle(_oracle);
        pool = IPegGuardPool(_pool);
        coverageStart = _coverageStart;
        coverageEnd = _coverageEnd;
        _disputeDuration = _disputeDurationInput;
        state = State.OPEN;
    }

    function getState() external view returns (State) {
        return state;
    }
}
