# Quick Deployment Commands for Polygon Amoy

## Simple 2-Address Multi-Sig Deployment

### ⚡ Quick Start

1. **Set up your .env file:**
```bash
# Copy to .env and fill in your values
POLYGON_DEPLOYER_PRIVATE_KEY=your_private_key_with_amoy_matic
MULTISIG_OWNER_1=0x... # Your first address
MULTISIG_OWNER_2=0x... # Your second address
MULTISIG_REQUIRED=2     # 2-of-2 signatures
RECORDER_ADDRESS=0x...  # Can be same as MULTISIG_OWNER_1
STAGE_MANAGER_ADDRESS=0x... # Can be same as MULTISIG_OWNER_2
POLYGONSCAN_API_KEY=your_api_key
```

2. **Deploy in order:**

```bash
# Step 1: Deploy 2-address multi-sig
npx hardhat run scripts/deploy-multisig.js --network amoy

# Step 2: Copy multi-sig address to .env as SIMPLE_MULTISIG_ADDRESS
# Then deploy timelock
npx hardhat run scripts/deploy-timelock.js --network amoy

# Step 3: Copy timelock address to .env as ADMIN_ADDRESS  
# Then deploy presale
npx hardhat run scripts/deploy.js --network amoy
```

## What Each Step Does

### Step 1: SimpleMultiSig
- Creates a 2-of-2 multi-signature wallet
- Both your addresses can propose transactions
- Requires both signatures to execute
- **Cost**: ~$1-2 in MATIC

### Step 2: Timelock  
- Creates 48-hour delay for all admin operations
- Multi-sig is the proposer/executor
- No individual EOA control
- **Cost**: ~$3-5 in MATIC

### Step 3: Presale
- Deploys main presale contract
- Timelock is the only admin
- Ready for testing presale operations
- **Cost**: ~$15-20 in MATIC

## Why This is Better Than Individual Addresses

| Individual EOAs | 2-Address Multi-Sig |
|-----------------|-------------------|
| ❌ Single point of failure | ✅ Requires consensus |
| ❌ Immediate execution | ✅ Deliberate process |
| ❌ No transparency | ✅ All transactions visible |
| ❌ Centralized control | ✅ Distributed control |
| ❌ Easy to compromise | ✅ Harder to attack |

## Testing Multi-Sig Operations

After deployment, test the flow:

```javascript
// 1. Your first address proposes to timelock
multiSig.submitTransaction(...)

// 2. Your second address confirms
multiSig.confirmTransaction(txId)

// 3. Multi-sig auto-executes to timelock
// 4. Wait 48 hours
// 5. Execute from timelock to presale
```

## Get Amoy MATIC

- **Faucet**: https://faucet.polygon.technology/
- **Amount needed**: ~$25-30 worth for all deployments
- **Bridge**: If you have Mumbai MATIC, bridge to Amoy

## Verification

After each deployment:

```bash
npx hardhat verify --network amoy DEPLOYED_ADDRESS constructor_args
```

Your deployment will be more secure than 99% of testnet projects! 🚀
