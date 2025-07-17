# MAGAX Dual-Chain Deployment Guide

## Overview

MAGAX uses a dual-chain architecture for optimal cost efficiency and security:

- **Ethereum**: MAGAX token deployment (security and prestige)
- **Polygon**: Presale contract deployment (99% lower gas costs)

This guide covers deployment to both networks.

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
# Ethereum Network Configuration (for MAGAX token)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Polygon Network Configuration (for presale contract)
POLYGON_MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_INFURA_KEY
POLYGON_MAINNET_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY

# Private Keys (NEVER commit these to version control)
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
ADMIN_PRIVATE_KEY=your_admin_private_key_here

# API Keys for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here

# Contract Configuration
TREASURY_ADDRESS=0x1234567890123456789012345678901234567890
RECORDER_ADDRESS=0x1234567890123456789012345678901234567890
ADMIN_ADDRESS=0x1234567890123456789012345678901234567890
```

### 2. Network Configuration

The `hardhat.config.js` is configured for dual-chain deployment:

**Ethereum Networks:**

- **Localhost**: Local development network
- **Sepolia**: Ethereum testnet (for token testing)
- **Mainnet**: Ethereum mainnet (for token deployment)

**Polygon Networks:**

- **Hardhat**: Local development network
- **Mumbai**: Polygon testnet (for presale testing)
- **Polygon**: Polygon mainnet (for presale deployment)

## Dual-Chain Deployment Process

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

Expected output: All 92 tests should pass.

### 3. Deploy Token to Ethereum Testnet (Sepolia)

Deploy the MAGAX token to Ethereum Sepolia testnet first:

```bash
TREASURY_ADDRESS=0x... npx hardhat run scripts/deploy.js --network sepolia
```

### 4. Deploy Presale to Polygon Testnet (Mumbai)

Deploy the presale contract to Polygon Mumbai testnet:

```bash
RECORDER_ADDRESS=0x... npx hardhat run scripts/deploy.js --network polygonMumbai
```

### 5. Verify Contracts

Verify contracts on their respective networks:

```bash
# Verify MAGAX token on Ethereum Sepolia
npx hardhat verify --network sepolia <TOKEN_CONTRACT_ADDRESS> <TREASURY_ADDRESS>

# Verify Presale contract on Polygon Mumbai
npx hardhat verify --network polygonMumbai <PRESALE_CONTRACT_ADDRESS> <RECORDER_ADDRESS>
```

### 6. Deploy to Mainnet

**Deploy Token to Ethereum Mainnet:**

```bash
TREASURY_ADDRESS=0x... npx hardhat run scripts/deploy.js --network mainnet
```

**Deploy Presale to Polygon Mainnet:**

```bash
RECORDER_ADDRESS=0x... npx hardhat run scripts/deploy.js --network polygon
```

## Unified Deployment Script

The deployment script automatically detects the network type and deploys the appropriate contract:

```bash
# For Ethereum networks (deploys token)
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/deploy.js --network mainnet

# For Polygon networks (deploys presale)
npx hardhat run scripts/deploy.js --network polygonMumbai
npx hardhat run scripts/deploy.js --network polygon
```

## Post-Deployment Setup

### 1. Update Environment Variables

After successful deployment, update your `.env` file with the deployed contract addresses:

```env
# Deployed Contract Addresses
ETHEREUM_TOKEN_ADDRESS=0x1234567890123456789012345678901234567890
POLYGON_PRESALE_ADDRESS=0x1234567890123456789012345678901234567890

# Network Confirmation
ETHEREUM_NETWORK=mainnet  # or sepolia for testnet
POLYGON_NETWORK=polygon   # or polygonMumbai for testnet
```

### 2. Role Configuration

Configure roles on the Polygon presale contract:

```javascript
// Grant RECORDER_ROLE to your backend service
await presaleContract.grantRole(RECORDER_ROLE, BACKEND_SERVICE_ADDRESS);

// Optionally, revoke deployer admin rights and transfer to multisig
await presaleContract.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG_ADDRESS);
await presaleContract.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
```

### 3. Stage Configuration

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

### 4. Cross-Chain Contract Verification

Verify that both contracts are properly deployed and configured:

**Ethereum Token Contract:**

```javascript
// Check token details
const tokenName = await tokenContract.name();
const tokenSymbol = await tokenContract.symbol();
const maxSupply = await tokenContract.getMaxSupply();
const owner = await tokenContract.owner();

console.log("Token Name:", tokenName);
console.log("Token Symbol:", tokenSymbol);
console.log("Max Supply:", ethers.formatUnits(maxSupply, 18));
console.log("Owner:", owner);
```

**Polygon Presale Contract:**

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

## Cost Comparison

The dual-chain architecture provides significant cost savings:

| Operation | Ethereum Cost | Polygon Cost | Savings |
|-----------|---------------|--------------|---------|
| Deploy Token | ~$30-50 | N/A | N/A |
| Deploy Presale | ~$150-300 | ~$2-5 | 95-99% |
| Record Purchase | ~$3-8 | ~$0.03-0.08 | 99% |
| Configure Stage | ~$5-15 | ~$0.05-0.15 | 99% |
| Activate Stage | ~$3-10 | ~$0.03-0.10 | 99% |

### Costs based on current gas prices: ETH ~10-20 Gwei, Polygon ~30-50 Gwei

The token deployment on Ethereum ensures security and prestige, while the presale operations on Polygon provide cost efficiency for high-volume transactions.

## Security Checklist

### Pre-Deployment

- [ ] All tests pass (73/73)
- [ ] Code has been reviewed
- [ ] Environment variables are properly set for both networks
- [ ] Treasury address is correctly configured
- [ ] Recorder and admin addresses are set
- [ ] Gas limits are appropriate for target networks
- [ ] Both Ethereum and Polygon RPC endpoints are working

### Post-Deployment

- [ ] Token contract verified on Etherscan
- [ ] Presale contract verified on Polygonscan
- [ ] Roles properly configured on presale contract
- [ ] Initial stages configured and activated
- [ ] Admin keys secured (preferably with multisig)
- [ ] Cross-chain monitoring and alerting set up
- [ ] Emergency procedures documented for both chains
- [ ] Contract addresses added to environment variables

## Monitoring and Maintenance

### 1. Dual-Chain Event Monitoring

Set up monitoring for both networks:

**Ethereum Token Events:**

```javascript
// Monitor token transfers and burns
tokenContract.on("Transfer", (from, to, value) => {
    console.log(`Token transfer: ${ethers.formatUnits(value, 18)} MAGAX from ${from} to ${to}`);
});

tokenContract.on("Burn", (from, value) => {
    console.log(`Token burn: ${ethers.formatUnits(value, 18)} MAGAX burned by ${from}`);
});
```

**Polygon Presale Events:**

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

Track key metrics across both chains:

**Ethereum Token Metrics:**

- Total supply and circulating supply
- Token holder distribution
- Transfer volume and frequency
- Burn events and deflationary effects

**Polygon Presale Metrics:**

- Total USDT raised
- Total MAGAX allocated
- Active stage progress
- Purchase volume by stage
- User participation statistics
- Gas costs and efficiency

### 3. Emergency Procedures

Have procedures ready for both chains:

**Ethereum Token Emergency:**

- Pausing token transfers (if enabled)
- Emergency token recovery procedures
- Owner key management and rotation

**Polygon Presale Emergency:**

- Pausing the presale contract
- Emergency ETH withdrawal
- Stage management adjustments
- Role management updates
- Cross-chain communication protocols

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

- **Hardhat Documentation**: [https://hardhat.org/docs](https://hardhat.org/docs)
- **OpenZeppelin Docs**: [https://docs.openzeppelin.com/](https://docs.openzeppelin.com/)
- **Etherscan API**: [https://docs.etherscan.io/](https://docs.etherscan.io/)
- **Polygonscan API**: [https://docs.polygonscan.com/](https://docs.polygonscan.com/)
- **Project Repository**: [https://github.com/moonShotMAGAX1/magax](https://github.com/moonShotMAGAX1/magax)
