# Timelock-Presale Integration Guide

## Overview

This document explains how the MAGAX timelock and presale contracts are integrated, their role-based association, and the deployment process. The architecture follows audit recommendations for clean separation of concerns while maintaining governance security.

## Architecture Philosophy

### Role-Based Association ✅

```solidity
// New approach - clean separation
contract MAGAXPresaleReceipts {
    // No direct timelock references
    function finalise() external onlyRole(FINALIZER_ROLE) {
        // Implementation
    }
}
```

## Contract Association

### 1. Constructor-Level Integration

The presale contract associates with the timelock through its constructor:

```solidity
// PreSaleOnChain.sol
constructor(address recorder, address admin) {
    if (recorder == address(0)) revert InvalidAddress();
    if (admin == address(0)) revert InvalidAddress();
    
    // Only the admin (timelock) gets admin role
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    
    // Deployer gets temporary operational roles
    _grantRole(RECORDER_ROLE, recorder);
    _grantRole(STAGE_MANAGER_ROLE, msg.sender);
    _grantRole(EMERGENCY_ROLE, msg.sender);
    _grantRole(FINALIZER_ROLE, msg.sender);
}
```

**Key Points:**

- `admin` parameter receives the timelock contract address
- Timelock becomes the sole holder of `DEFAULT_ADMIN_ROLE`
- Deployer gets temporary operational roles for initial setup

### 2. Role-Based Governance

The presale contract uses OpenZeppelin's `AccessControl` for role management:

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MAGAXPresaleReceipts is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    bytes32 public constant STAGE_MANAGER_ROLE = keccak256("STAGE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant FINALIZER_ROLE = keccak256("FINALIZER_ROLE");
    // DEFAULT_ADMIN_ROLE is inherited from AccessControl
}
```

## Role-Function Mapping

### Critical Functions (Timelock Protected)

These functions require 48-hour governance delay:

| Function | Required Role | Purpose | Timelock Delay |
|----------|---------------|---------|----------------|
| `finalise()` | `FINALIZER_ROLE` | Finalize presale and pause contract | 48 hours |
| `setMaxPromoBps()` | `DEFAULT_ADMIN_ROLE` | Update promotional bonus caps | 48 hours |
| `emergencyTokenWithdraw()` | `EMERGENCY_ROLE` | Withdraw accidentally sent tokens | 48 hours |

**Implementation:**

```solidity
function finalise() external onlyRole(FINALIZER_ROLE) {
    finalised = true;
    _pause();
    emit Finalised(uint40(block.timestamp));
}

function setMaxPromoBps(uint16 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (newCap == 0 || newCap > BASIS_POINTS) revert InvalidPromoBps();
    
    uint16 oldCap = maxPromoCapBps;
    maxPromoCapBps = newCap;
    emit MaxPromoBpsUpdated(oldCap, newCap, msg.sender);
}

function emergencyTokenWithdraw(IERC20 token, address to) 
    external onlyRole(EMERGENCY_ROLE) nonReentrant {
    if (to == address(0)) revert InvalidAddress();
    
    uint256 balance = token.balanceOf(address(this));
    if (balance == 0) revert NoTokensToWithdraw();
    
    token.safeTransfer(to, balance);
    emit EmergencyTokenWithdraw(address(token), to, balance);
}
```

### Operational Functions (Immediate Execution)

These functions can be executed immediately:

| Function | Required Role | Purpose | Execution |
|----------|---------------|---------|-----------|
| `recordPurchase()` | `RECORDER_ROLE` | Record user purchases | Immediate |
| `configureStage()` | `STAGE_MANAGER_ROLE` | Setup presale stages | Immediate |
| `activateStage()` | `STAGE_MANAGER_ROLE` | Activate presale stages | Immediate |
| `pause()`/`unpause()` | `DEFAULT_ADMIN_ROLE` | Emergency pause controls | Immediate |

### Emergency Functions (3-of-3 Multi-Sig)

Special immediate execution for critical situations:

| Function | Required Role | Purpose | Execution |
|----------|---------------|---------|-----------|
| `immediateEmergencyWithdraw()` | `EMERGENCY_ROLE` | Immediate token withdrawal | 3-of-3 confirmations |

**Implementation:**

```solidity
function immediateEmergencyWithdraw(IERC20 token, address to) 
    external onlyRole(EMERGENCY_ROLE) nonReentrant {
    // 3-of-3 multi-sig logic for immediate execution
    bytes32 operationHash = keccak256(abi.encodePacked(
        "IMMEDIATE_EMERGENCY_WITHDRAW", 
        address(token), 
        to, 
        block.timestamp
    ));
    
    // Implementation continues...
}
```

## Timelock Operation Flow

### 1. Schedule Operation (Proposal)

Any address with `PROPOSER_ROLE` on timelock can schedule operations:

```javascript
// Example: Schedule finalise() function
const data = presale.interface.encodeFunctionData("finalise");
const salt = ethers.randomBytes(32);

await timelock.schedule(
    presaleAddress,           // Target contract
    0,                       // Value (0 for function calls)
    data,                    // Encoded function call
    ethers.ZeroHash,         // Predecessor operation
    salt,                    // Random salt for uniqueness
    48 * 60 * 60            // 48-hour delay
);
```

### 2. Wait Period (48 Hours)

The operation enters a pending state for exactly 48 hours:

```javascript
const operationId = await timelock.hashOperation(
    presaleAddress, 0, data, ethers.ZeroHash, salt
);

console.log("Operation pending:", await timelock.isOperationPending(operationId));
console.log("Operation ready:", await timelock.isOperationReady(operationId));
```

### 3. Execute Operation

After 48 hours, any address with `EXECUTOR_ROLE` can execute:

```javascript
await timelock.execute(
    presaleAddress,
    0,
    data,
    ethers.ZeroHash,
    salt
);
```

### 4. Call Chain

```
User → Timelock.execute() → Presale.finalise()
```

1. User calls `timelock.execute()`
2. Timelock validates delay and permissions
3. Timelock calls `presale.finalise()` as `msg.sender`
4. Presale checks `onlyRole(FINALIZER_ROLE)`
5. Since timelock has `FINALIZER_ROLE`, call succeeds

## Deployment Process

### 1. Timelock Deployment Script

**File:** `scripts/deploy-timelock.js`

```javascript
async function deployTimelock() {
    console.log("Deploying MAGAX Timelock with 48-hour delay...");
    
    const [deployer] = await ethers.getSigners();
    
    // 48-hour delay (172800 seconds)
    const minDelay = 48 * 60 * 60;
    
    // Multi-sig addresses that can propose/execute
    const proposers = [
        process.env.ADMIN_ADDRESS || deployer.address,
        process.env.ADMIN_2_ADDRESS || deployer.address,
        process.env.FINALIZER_ROLE_ADDRESS || deployer.address,
        // ... more addresses
    ].filter((addr, index, arr) => arr.indexOf(addr) === index); // Remove duplicates
    
    const executors = proposers; // Same addresses can execute
    const admin = ethers.ZeroAddress; // No admin role for full decentralization
    
    // Deploy timelock with strict security validations
    const MAGAXTimelock = await ethers.getContractFactory("MAGAXTimelock");
    const timelock = await MAGAXTimelock.deploy(minDelay, proposers, executors, admin);
    await timelock.waitForDeployment();
    
    return timelock;
}
```

**Security Validations in MAGAXTimelock.sol:**

```solidity
constructor(
    uint256 minDelay,           // Must be exactly 172800 (48 hours)
    address[] memory proposers, 
    address[] memory executors, 
    address admin               // MUST be zero address
) TimelockController(minDelay, proposers, executors, admin) {
    // Critical security validations
    require(minDelay == REQUIRED_MIN_DELAY, "Timelock: delay must be exactly 48 hours");
    require(admin == address(0), "Timelock: admin must be zero address for decentralization");
    require(proposers.length > 0, "Timelock: must have at least one proposer");
    require(executors.length > 0, "Timelock: must have at least one executor");
}
```

### 2. Presale Deployment with Timelock Integration

```javascript
async function deployPresaleWithTimelock() {
    // Deploy timelock first
    const { timelock, address: timelockAddress } = await deployTimelock();
    
    console.log("\nDeploying presale contract...");
    
    const recorder = process.env.RECORDER_ADDRESS;
    if (!recorder) {
        throw new Error("RECORDER_ADDRESS must be set in environment");
    }
    
    // Deploy presale with timelock as admin
    const MAGAXPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
    const presale = await MAGAXPresale.deploy(recorder, timelockAddress);
    await presale.waitForDeployment();
    
    // Verify admin role assignment
    const DEFAULT_ADMIN_ROLE = await presale.DEFAULT_ADMIN_ROLE();
    const isTimelockAdmin = await presale.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress);
    
    console.log("✅ Timelock has admin role:", isTimelockAdmin);
    console.log("✅ Deployer admin role:", await presale.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
    
    return { timelock, presale };
}
```

### 3. Role Setup Process

**Initial State After Deployment:**

```javascript
// Roles immediately after deployment
DEFAULT_ADMIN_ROLE: timelockAddress (sole admin)
RECORDER_ROLE: recorder.address (permanent)
STAGE_MANAGER_ROLE: deployer.address (temporary)
EMERGENCY_ROLE: deployer.address (temporary)
FINALIZER_ROLE: deployer.address (temporary)
```

**Post-Deployment Role Management:**

1. **Grant Critical Roles to Timelock** (through timelock itself):

```javascript
// Schedule role grants through timelock (48-hour delay each)
const grantFinalizerData = presale.interface.encodeFunctionData(
    "grantRole", [FINALIZER_ROLE, timelockAddress]
);

await timelock.schedule(presaleAddress, 0, grantFinalizerData, ...);
// Wait 48 hours...
await timelock.execute(presaleAddress, 0, grantFinalizerData, ...);
```

2. **Revoke Deployer's Temporary Roles** (through timelock):

```javascript
// Revoke deployer's roles through governance
const revokeRoleData = presale.interface.encodeFunctionData(
    "revokeRole", [EMERGENCY_ROLE, deployer.address]
);

await timelock.schedule(presaleAddress, 0, revokeRoleData, ...);
// Wait 48 hours...
await timelock.execute(presaleAddress, 0, revokeRoleData, ...);
```

## Final Role Distribution

After complete setup:

| Role | Holder | Purpose |
|------|--------|---------|
| `DEFAULT_ADMIN_ROLE` | Timelock | Role management, admin functions |
| `FINALIZER_ROLE` | Timelock | Finalize presale |
| `EMERGENCY_ROLE` | Timelock + Multi-sig | Emergency operations |
| `STAGE_MANAGER_ROLE` | Operations Team | Stage management |
| `RECORDER_ROLE` | Backend Service | Record purchases |

## Security Benefits

1. **Complete Decentralization**: Only timelock has admin control
2. **48-Hour Protection**: All critical operations have mandatory delay
3. **Role Separation**: Different functions require different roles
4. **Emergency Access**: 3-of-3 multi-sig for immediate emergencies
5. **Audit Compliance**: Clean separation of governance and business logic

## Usage Examples

### Schedule Presale Finalization

```javascript
// 1. Encode the function call
const data = presale.interface.encodeFunctionData("finalise");

// 2. Schedule through timelock
await timelock.connect(proposer).schedule(
    presaleAddress, 0, data, ethers.ZeroHash, salt, DELAY
);

// 3. Wait 48 hours

// 4. Execute
await timelock.connect(executor).execute(
    presaleAddress, 0, data, ethers.ZeroHash, salt
);
```

### Update Promotional Caps

```javascript
// 1. Encode function with parameters
const newCap = 2000; // 20%
const data = presale.interface.encodeFunctionData("setMaxPromoBps", [newCap]);

// 2. Schedule and execute through timelock (48-hour delay)
// ... same process as above
```

### Immediate Emergency Withdrawal

```javascript
// Special case - no timelock delay, but requires 3-of-3 multi-sig
await presale.connect(emergencyRole1).immediateEmergencyWithdraw(tokenAddress, withdrawTo);
await presale.connect(emergencyRole2).immediateEmergencyWithdraw(tokenAddress, withdrawTo);
await presale.connect(emergencyRole3).immediateEmergencyWithdraw(tokenAddress, withdrawTo);
// Third call executes the withdrawal
```

This architecture provides robust governance with clear separation of concerns, meeting audit requirements while maintaining operational security.
