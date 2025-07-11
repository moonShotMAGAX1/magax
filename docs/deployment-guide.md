# Deployment Guide

## Prerequisites

### Environment Setup

1. **Node.js**: Version 16.0 or higher
2. **npm**: Latest version
3. **Hardhat**: Installed globally or locally

```bash
npm install --save-dev hardhat
```

### Dependencies

Install all required dependencies:

```bash
npm install
```

Required packages:

- `@openzeppelin/contracts`: Smart contract security libraries
- `@nomicfoundation/hardhat-toolbox`: Complete Hardhat development suite
- `hardhat`: Ethereum development environment

## Environment Configuration

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
cp env.example .env
```

Configure the following variables:

```env
# Network Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Private Keys (NEVER commit these to version control)
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
ADMIN_PRIVATE_KEY=your_admin_private_key_here

# Etherscan API (for contract verification)
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Treasury Address (where tokens will be minted)
TREASURY_ADDRESS=0x1234567890123456789012345678901234567890
```

### 2. Network Configuration

The `hardhat.config.js` is already configured for:

- **Localhost**: Local development network
- **Sepolia**: Ethereum testnet
- **Mainnet**: Ethereum mainnet

## Deployment Process

### 1. Compile Contracts

First, compile all contracts to ensure they're ready for deployment:

```bash
npx hardhat compile
```

### 2. Run Tests

Execute the full test suite to verify everything works correctly:

```bash
npx hardhat test
```

Expected output: All 63 tests should pass.

### 3. Deploy to Testnet (Sepolia)

Deploy contracts to Sepolia testnet first for testing:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 4. Verify Contracts on Etherscan

After deployment, verify the contracts on Etherscan:

```bash
# Verify MoonShotMAGAX token
npx hardhat verify --network sepolia <TOKEN_CONTRACT_ADDRESS> <TREASURY_ADDRESS>

# Verify MAGAXPresaleReceipts
npx hardhat verify --network sepolia <PRESALE_CONTRACT_ADDRESS>
```

### 5. Deploy to Mainnet

⚠️ **IMPORTANT**: Only deploy to mainnet after thorough testing on testnet.

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

## Post-Deployment Setup

### 1. Role Configuration

After deployment, configure the necessary roles:

```javascript
// Grant RECORDER_ROLE to your backend service
await presaleContract.grantRole(RECORDER_ROLE, BACKEND_SERVICE_ADDRESS);

// Optionally, revoke deployer admin rights and transfer to multisig
await presaleContract.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG_ADDRESS);
await presaleContract.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
```

### 2. Stage Configuration

Configure your initial presale stages:

```javascript
// Example: Configure first 3 stages
await presaleContract.configureStage(
    1,
    ethers.parseUnits("0.001", 6),    // $0.001 per MAGAX
    ethers.parseUnits("1000000", 18)  // 1M MAGAX tokens
);

await presaleContract.configureStage(
    2,
    ethers.parseUnits("0.002", 6),    // $0.002 per MAGAX
    ethers.parseUnits("2000000", 18)  // 2M MAGAX tokens
);

await presaleContract.configureStage(
    3,
    ethers.parseUnits("0.003", 6),    // $0.003 per MAGAX
    ethers.parseUnits("3000000", 18)  // 3M MAGAX tokens
);

// Activate the first stage
await presaleContract.activateStage(1);
```

### 3. Contract Verification

Verify that all functions work correctly:

```javascript
// Check stage configuration
const stageInfo = await presaleContract.getStageInfo(1);
console.log("Stage 1 Info:", stageInfo);

// Check current active stage
const currentStage = await presaleContract.getCurrentStageInfo();
console.log("Current Stage:", currentStage);

// Test purchase recording (with RECORDER_ROLE)
await presaleContract.recordPurchase(
    "0x1234...", // buyer address
    ethers.parseUnits("100", 6),  // 100 USDT
    ethers.parseUnits("100000", 18) // 100,000 MAGAX
);
```

## Security Checklist

### Pre-Deployment

- [ ] All tests pass
- [ ] Code has been reviewed
- [ ] Environment variables are properly set
- [ ] Treasury address is correctly configured
- [ ] Gas limits are appropriate for target network

### Post-Deployment

- [ ] Contracts verified on Etherscan
- [ ] Roles properly configured
- [ ] Initial stages configured and activated
- [ ] Admin keys secured (preferably with multisig)
- [ ] Monitoring and alerting set up
- [ ] Emergency procedures documented

## Monitoring and Maintenance

### 1. Event Monitoring

Set up monitoring for key events:

```javascript
// Monitor purchase recordings
presaleContract.on("PurchaseRecorded", (purchaseId, buyer, usdtAmount, magaxAmount, stage, pricePerToken) => {
    console.log(`New purchase: ${purchaseId} by ${buyer}`);
    // Update your analytics/database
});

// Monitor stage activations
presaleContract.on("StageActivated", (stage, pricePerToken, tokensAllocated) => {
    console.log(`Stage ${stage} activated`);
    // Update frontend stage display
});
```

### 2. Analytics Dashboard

Track key metrics:

- Total USDT raised
- Total MAGAX allocated
- Active stage progress
- Purchase volume by stage
- User participation statistics

### 3. Emergency Procedures

Have procedures ready for:

- Pausing the contract in emergencies
- Emergency token withdrawal
- Stage management adjustments
- Role management updates

## Troubleshooting

### Common Deployment Issues

1. **Gas Estimation Failed**
   - Check network connectivity
   - Verify account has sufficient ETH for gas
   - Review constructor parameters

2. **Contract Verification Failed**
   - Ensure exact constructor parameters match deployment
   - Check Solidity version matches hardhat.config.js
   - Verify network is supported by Etherscan

3. **Role Assignment Failed**
   - Verify deployer has admin rights
   - Check target address is valid
   - Ensure gas limit is sufficient

### Support Resources

- **Hardhat Documentation**: https://hardhat.org/docs
- **OpenZeppelin Docs**: https://docs.openzeppelin.com/
- **Etherscan API**: https://docs.etherscan.io/
- **Project Repository**: [Link to your GitHub repo](https://github.com/moonShotMAGAX1/magax)
