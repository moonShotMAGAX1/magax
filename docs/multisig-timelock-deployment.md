# Multi-Sig Timelock Deployment Guide

## Architecture Overview

```
Multi-Sig Contracts → Timelock (48h delay) → Presale Contract
     (Consensus)        (Security Delay)      (Operations)
```

## Deployment Order

### 1. Deploy Multi-Sig Contracts (Optional - if not already deployed)

```bash
# Deploy SimpleMultiSig (if using custom multi-sig)
npx hardhat run scripts/deploy-multisig.js --network sepolia

# Or use existing Gnosis Safe contracts
```

### 2. Configure Environment Variables

Update `.env` with multi-sig contract addresses:

```bash
# Multi-sig contract addresses (NOT individual EOAs)
MULTISIG_PROPOSER_1_ADDRESS=0x... # Your primary multi-sig contract
GNOSIS_SAFE_ADDRESS=0x...         # Gnosis Safe contract (if using)
SIMPLE_MULTISIG_ADDRESS=0x...     # SimpleMultiSig contract (if deployed)

# Required role addresses
RECORDER_ADDRESS=0x...            # Backend service wallet
STAGE_MANAGER_ADDRESS=0x...       # Stage management wallet
# ADMIN_ADDRESS will be set to timelock address after deployment
```

### 3. Deploy Timelock

```bash
npx hardhat run scripts/deploy-timelock.js --network sepolia
```

This will:

- Deploy timelock with multi-sig contracts as proposers/executors
- Set 48-hour delay for all operations
- Output timelock address for next step

### 4. Update Environment with Timelock Address

```bash
# Copy timelock address from deployment output
ADMIN_ADDRESS=0x...  # Set to deployed timelock address
```

### 5. Deploy Presale Contract

```bash
npx hardhat run scripts/deploy.js --network amoy
```

## Operational Flow

### Making Changes to Presale

1. **Multi-sig proposes** operation to timelock
2. **Timelock enforces** 48-hour delay
3. **Multi-sig executes** operation after delay
4. **Presale contract** receives admin command from timelock

### Example: Emergency Pause

```solidity
// 1. Multi-sig calls timelock.schedule()
timelock.schedule(
    presaleAddress,           // target
    0,                       // value
    abi.encodeCall("pause"),  // data
    bytes32(0),              // predecessor
    salt,                    // salt
    delay                    // 48 hours
);

// 2. Wait 48 hours

// 3. Multi-sig calls timelock.execute()
timelock.execute(
    presaleAddress,
    0,
    abi.encodeCall("pause"),
    bytes32(0),
    salt
);
```

## Security Benefits

- **Consensus**: Multi-sig requires multiple approvals
- **Delay**: Timelock provides time to detect/respond to attacks
- **Transparency**: All operations are publicly visible on-chain
- **Decentralization**: No single point of failure

## Testing

Always test the full flow on testnet:

```bash
# 1. Deploy multi-sig and timelock on Sepolia
# 2. Deploy presale on Amoy
# 3. Test multi-sig → timelock → presale operations
# 4. Verify 48-hour delays work correctly
```
