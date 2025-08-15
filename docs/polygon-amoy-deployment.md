# Polygon Amoy Testnet Deployment Guide

## Simple 2-Address Multi-Sig Setup

### What is SimpleMultiSig?

- A lightweight multi-signature contract included in your project
- Requires 2 out of 2 (or 2 out of 3) signatures to execute transactions
- Perfect for testnet where you control multiple test addresses
- No need for Gnosis Safe on testnet - SimpleMultiSig is sufficient

## Step-by-Step Deployment on Polygon Amoy

### Prerequisites

1. **Get Amoy testnet tokens**:

   ```bash
   # Get MATIC from Polygon faucet
   # https://faucet.polygon.technology/
   ```

2. **Set up test addresses**:
   - Address 1: Your main deployer address
   - Address 2: Your secondary test address
   - Both need Amoy MATIC for transactions

### 1. Configure Environment

Create `.env` file with your test addresses:

```bash
# Polygon Amoy RPC
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Your deployer private key (with Amoy MATIC)
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Test addresses for multi-sig (your addresses)
MULTISIG_OWNER_1=0x... # Your main address
MULTISIG_OWNER_2=0x... # Your second address

# Required signatures (2 for maximum security)
MULTISIG_REQUIRED=2

# Role addresses (can be same as multi-sig owners for testing)
RECORDER_ADDRESS=0x...      # Can be MULTISIG_OWNER_1
STAGE_MANAGER_ADDRESS=0x... # Can be MULTISIG_OWNER_2
```

### 2. Deploy SimpleMultiSig

First, update the deploy script for your addresses:

```bash
# Edit scripts/deploy-multisig.js
# Replace the owners array with your actual addresses
```

Then deploy:

```bash
npx hardhat run scripts/deploy-multisig.js --network amoy
```

**Example output**:

```
✅ SimpleMultiSig deployed to: 0xABC123...
📝 Add this to your .env file:
SIMPLE_MULTISIG_ADDRESS=0xABC123...
```

### 3. Deploy Timelock with Multi-Sig

Update your `.env` with the multi-sig address:

```bash
SIMPLE_MULTISIG_ADDRESS=0xABC123... # From step 2
```

Deploy timelock:

```bash
npx hardhat run scripts/deploy-timelock.js --network amoy
```

### 4. Deploy Presale Contract

Update `.env` with timelock address:

```bash
ADMIN_ADDRESS=0xDEF456... # Timelock address from step 3
```

Deploy presale:

```bash
npx hardhat run scripts/deploy.js --network amoy
```

## Complete .env Template for Amoy

```bash
# Network Configuration
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=your_private_key_with_amoy_matic

# Multi-Sig Configuration (Your 2 test addresses)
MULTISIG_OWNER_1=0x... # Your main test address
MULTISIG_OWNER_2=0x... # Your second test address
MULTISIG_REQUIRED=2    # 2-of-2 signatures required

# Deployed Contracts (Fill after each deployment)
SIMPLE_MULTISIG_ADDRESS=     # After step 2
TIMELOCK_ADDRESS=            # After step 3
POLYGON_PRESALE_ADDRESS=     # After step 4

# Role Addresses (Use your test addresses)
RECORDER_ADDRESS=0x...       # Can be MULTISIG_OWNER_1
STAGE_MANAGER_ADDRESS=0x...  # Can be MULTISIG_OWNER_2
ADMIN_ADDRESS=               # Set to TIMELOCK_ADDRESS

# Verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## Testing the Multi-Sig Flow

### 1. Test Multi-Sig Transaction

```javascript
// Example: Pause presale via multi-sig → timelock
const multiSig = await ethers.getContractAt("SimpleMultiSig", MULTISIG_ADDRESS);
const timelock = await ethers.getContractAt("MAGAXTimelock", TIMELOCK_ADDRESS);

// 1. Submit transaction to multi-sig
const pauseData = presale.interface.encodeFunctionData("pause");
const txId = await multiSig.submitTransaction(
    TIMELOCK_ADDRESS,
    0,
    timelock.interface.encodeFunctionData("schedule", [
        PRESALE_ADDRESS,  // target
        0,                // value
        pauseData,        // data
        ethers.ZeroHash,  // predecessor
        ethers.randomBytes(32), // salt
        48 * 60 * 60      // 48 hour delay
    ])
);

// 2. Second owner confirms (if 2-of-2)
// Switch to second address and call:
// await multiSig.confirmTransaction(txId);

// 3. Wait 48 hours, then execute
```

## Why 2-Address Multi-Sig is Perfect for Testnet

✅ **Simple**: Only need 2 test addresses
✅ **Secure**: Still requires consensus
✅ **Fast**: No external dependencies
✅ **Educational**: Learn multi-sig mechanics
✅ **Cost-effective**: Lower gas costs than Gnosis

## Advantages vs Individual Addresses

| Individual EOAs | 2-Address Multi-Sig |
|-----------------|-------------------|
| Single point of failure | Requires consensus |
| Immediate execution | Deliberate process |
| No transparency | All transactions visible |
| Centralized | Distributed control |

Your 2-address setup provides real multi-sig security while being simple enough for testnet development!
