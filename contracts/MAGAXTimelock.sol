// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title MAGAXTimelock
 * @notice 48-hour timelock controller for MAGAX presale critical operations
 * @dev Enforces 48-hour delay on critical governance functions with security validations
 */
contract MAGAXTimelock is TimelockController {
    uint256 public constant REQUIRED_MIN_DELAY = 172800; // 48 hours in seconds
    
    constructor(
        uint256 minDelay,           // Must be exactly 48 hours = 172800 seconds
        address[] memory proposers, // Multi-sig wallets that can propose
        address[] memory executors, // Multi-sig wallets that can execute
        address admin               // MUST be zero address for full decentralization
    ) TimelockController(minDelay, proposers, executors, admin) {
        // Critical security validations
        require(minDelay == REQUIRED_MIN_DELAY, "Timelock: delay must be exactly 48 hours");
        require(admin == address(0), "Timelock: admin must be zero address for decentralization");
        require(proposers.length > 0, "Timelock: must have at least one proposer");
        require(executors.length > 0, "Timelock: must have at least one executor");
    }
    
    /**
     * @notice Get the current minimum delay
     * @return The minimum delay in seconds (48 hours)
     */
    function getCurrentDelay() external view returns (uint256) {
        return getMinDelay();
    }
}
