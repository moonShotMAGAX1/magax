# Role System Update - Environment Configuration

## Overview

With the implementation of enterprise-grade multi-signature security, we've introduced new roles that require environment configuration for optimal security deployment.

## New Roles Added

| Role | Purpose | Multi-Sig Required | Default Assignment |
|------|---------|-------------------|-------------------|
| `STAGE_MANAGER_ROLE` | Configure and activate presale stages | No | Deployer |
| `EMERGENCY_ROLE` | Emergency token withdrawals | Yes (2-of-N) | Deployer |
| `FINALIZER_ROLE` | Finalize the presale | Yes (2-of-N) | Deployer |

## Environment Variables

### Required (Existing)

```env
TREASURY_ADDRESS=0x...        # Token recipient (Ethereum)
RECORDER_ADDRESS=0x...        # Backend service (Polygon)
```

### Optional (New - Enhanced Security)

```env
ADMIN_ADDRESS=0x...           # Contract admin (defaults to deployer)
STAGE_MANAGER_ADDRESS=0x...   # Stage management (defaults to deployer)
EMERGENCY_ROLE_ADDRESS=0x...  # Emergency operations (defaults to deployer)
FINALIZER_ROLE_ADDRESS=0x...  # Presale finalization (defaults to deployer)
```

## Security Recommendations

### For Development/Testing

- Use deployer address for all roles (default behavior)
- Single address deployment for simplicity

### For Production

- **Use separate addresses** for each role
- **Use multi-signature wallets** for:
  - `ADMIN_ADDRESS` (administrative operations)
  - `EMERGENCY_ROLE_ADDRESS` (emergency withdrawals)
  - `FINALIZER_ROLE_ADDRESS` (presale finalization)
- **Secure the RECORDER_ADDRESS** (limit to trusted backend only)

## Deployment Script Changes

The updated deployment script (`scripts/deploy.js`) now:

1. **Reads new environment variables** with fallback to deployer
2. **Assigns roles during deployment** based on configuration
3. **Logs role assignments** for audit trail
4. **Saves role addresses** in deployment artifacts

## Backward Compatibility

- **Existing deployments**: Continue to work without changes
- **Missing env vars**: Default to deployer address (safe fallback)
- **Deployment artifacts**: Now include role assignments for tracking

## Multi-Signature Workflow

The 2-of-N multi-signature system works as follows:

### Step-by-Step Behavior

| Step | What Happens | Real-World Consequence |
|------|-------------|----------------------|
| **1. First Call** | `confirmations == 0` → Proposal created | ✅ State changes are written and `OperationProposed` is logged before function returns.

⚠️ **Critical**: If wrapped with `requiresMultiSig` modifier, revert would roll back the event! |
| **2. Second Call** | `confirmations == 2` → Execution ready | ✅ `OperationConfirmed` and `OperationExecuted` emitted before business logic runs.
⚠️ **Issue**: If business logic later reverts, you get "phantom execution" in logs. |
| **3. Subsequent Calls** | Hash still present, already executable | 

⚠️ **Noise**: Will emit `OperationExecuted` on every call until cleanup occurs. |

### Current Implementation Details

**Protected Operations:**

- `finalise()` - Ends presale permanently
- `setMaxPromoBps()` - Updates promo bonus limits  
- `emergencyTokenWithdraw()` - Withdraws accidentally sent tokens

**Event Sequence:**

1. **First call**: Proposes operation → emits `OperationProposed`
2. **Second call**: Confirms operation → emits `OperationConfirmed` + `OperationExecuted`
3. **Business logic**: Executes after events are emitted
4. **Cleanup**: Clears operation state on successful completion

### Known Issues & Considerations

#### 1. **Event Timing Issue**

- `OperationExecuted` emits **before** business logic runs
- **Risk**: Indexers assume success even if operation later reverts
- **Mitigation**: Current functions use `return;` instead of `revert` to avoid this

#### 2. **Timestamp-Based Hashing in `finalise()`**

```solidity
bytes32 operationHash = keccak256(abi.encodePacked("FINALIZE_PRESALE", block.timestamp / 1 hours));
```

- **Risk**: Hash changes every hour - if proposer signs at 10:59 and confirmer at 11:00, they create different operations
- **Result**: Presale could become stuck until next hour boundary

#### 3. **Multiple Execution Events**

- If operation is already executable, subsequent calls emit additional `OperationExecuted` events
- **Impact**: Log noise, but not exploitable (functions have their own state checks)

#### 4. **Gas Considerations**

- Cleanup loop iterates over all confirmers (currently max 2)
- **Future risk**: If `REQUIRED_CONFIRMATIONS` increases, cleanup could hit gas limits

### Security Analysis

✅ **Strengths:**

- Proper state management with confirmation tracking
- Non-reverting pattern preserves state changes
- Role-based access control for proposal initiation

⚠️ **Areas for Improvement:**

- Event emission timing could mislead indexers
- Timestamp-based hashing creates timing vulnerabilities  
- Multiple execution events create log noise
- Price tolerance (±1 USDT) is 100% slack on micro-purchases

### Recommendations for Production

#### 1. **Fix Event Timing**

Move `OperationExecuted` emission after business logic:

```solidity
modifier requiresMultiSig(bytes32 operationHash, string memory operationType) {
    bool ready = _handleMultiSig(operationHash, operationType);
    if (!ready) return; // Early return instead of revert
    _;
    emit OperationExecuted(operationHash, msg.sender); // Move here
    _cleanupMultiSig(operationHash);
}
```

#### 2. **Use Deterministic Hashing**

Replace timestamp-based hashes:

```solidity
// Instead of: keccak256("FINALIZE_PRESALE", block.timestamp / 1 hours)
// Use: keccak256("FINALIZE_PRESALE")
bytes32 operationHash = keccak256("FINALIZE_PRESALE");
```

#### 3. **Prevent Multiple Execution Events**

```solidity
function _handleMultiSig(bytes32 operationHash, string memory operationType) internal returns (bool ready) {
    if (operationConfirmations[operationHash] >= REQUIRED_CONFIRMATIONS) {
        return true; // Already executable, don't emit again
    }
    // ... rest of logic
}
```

#### 4. **Proportional Price Tolerance**

```solidity
// Instead of fixed ±1 USDT tolerance
uint256 tolerance = (expectedUSDT > 1000e6) ? expectedUSDT / 1000 : 1e4; // 0.1% or 0.01 USDT
```

## Migration Guide

### For Existing Projects

1. **Update `.env`** with new role addresses (optional)
2. **Redeploy** to apply role separation
3. **Verify roles** using contract view functions

### For New Projects

1. **Configure `.env`** with separate addresses
2. **Deploy** using updated script
3. **Test role assignments** before mainnet

## Example Production Configuration

```env
# Core addresses
TREASURY_ADDRESS=0xYourMultiSigTreasury
RECORDER_ADDRESS=0xYourBackendService

# Enhanced security roles
ADMIN_ADDRESS=0xYourAdminMultiSig
STAGE_MANAGER_ADDRESS=0xYourStageManagerWallet
EMERGENCY_ROLE_ADDRESS=0xYourEmergencyMultiSig
FINALIZER_ROLE_ADDRESS=0xYourFinalizerMultiSig
```

This configuration provides:

- **Role separation** (different addresses for different functions)
- **Multi-sig protection** for critical operations
- **Audit trail** of all administrative actions
- **Emergency capabilities** with proper authorization

## Next Steps

1. Review and update your `.env` file
2. Test deployment on testnet with new configuration
3. Verify role assignments post-deployment
4. Document your role management procedures
