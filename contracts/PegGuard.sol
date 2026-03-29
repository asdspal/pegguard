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

    event CoverageActivated(uint256 start, uint256 end, uint256 poolSize);
    event BreachReported(address oracle, uint256 timestamp);
    event CoverageExpired(uint256 timestamp, uint256 totalPremiums);

    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == address(oracle), "Not oracle");
        _;
    }

    /// @notice Initializes PegGuard with oracle, pool, and coverage window settings.
    /// @dev Sets initial state to OPEN and stores dispute duration.
    /// @param _oracle Address of the breach oracle.
    /// @param _pool Address of the PegGuardPool contract.
    /// @param _coverageStart Unix timestamp when coverage begins.
    /// @param _coverageEnd Unix timestamp when coverage ends.
    /// @param _disputeDurationInput Dispute window duration in seconds.
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

    /// @notice Returns the current lifecycle state.
    /// @dev Exposes the enum value for off-chain and pool checks.
    function getState() external view returns (State) {
        return state;
    }

    /// @notice Transitions the contract from OPEN to ACTIVE state.
    /// @dev Callable by anyone once block.timestamp >= coverageStart.
    /// @dev Emits CoverageActivated with pool size at time of activation.
    function activate() external inState(State.OPEN) {
        require(block.timestamp >= coverageStart, "Coverage not started");

        state = State.ACTIVE;
        emit CoverageActivated(coverageStart, coverageEnd, pool.totalStaked());
    }

    /// @notice Reports a peg breach and opens the dispute window.
    /// @dev Only callable by the configured oracle during ACTIVE.
    /// @dev Sets breachConfirmed, disputeEnd, and emits BreachReported.
    function reportBreach() external inState(State.ACTIVE) onlyOracle {
        breachConfirmed = true;
        disputeEnd = block.timestamp + _disputeDuration;
        state = State.DISPUTED;
        emit BreachReported(msg.sender, block.timestamp);
    }

    /// @notice Resolves coverage after the coverage or dispute window ends.
    /// @dev ACTIVE resolves after coverageEnd; DISPUTED resolves after disputeEnd.
    /// @dev Emits CoverageExpired with total premiums at resolution.
    function resolve() external {
        if (state == State.ACTIVE) {
            require(block.timestamp >= coverageEnd, "Coverage not ended");
        } else if (state == State.DISPUTED) {
            require(block.timestamp >= disputeEnd, "Dispute not ended");
        } else {
            revert("Cannot resolve from current state");
        }

        state = State.RESOLVED;
        emit CoverageExpired(block.timestamp, pool.totalPremiums());
    }
}
