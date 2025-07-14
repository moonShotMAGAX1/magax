# GitHub Secrets Setup Guide

This guide explains how to set up the required GitHub repository secrets for the CI/CD pipeline.

## Required Secrets

### Testnet Secrets (Sepolia)

Navigate to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SEPOLIA_DEPLOYER_PRIVATE_KEY` | Private key for testnet deployment wallet | `0x123abc...` |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint URL | `https://sepolia.infura.io/v3/YOUR_PROJECT_ID` |

### Mainnet Secrets (Production)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `MAINNET_DEPLOYER_PRIVATE_KEY` | Private key for mainnet deployment wallet | `0x456def...` |
| `MAINNET_RPC_URL` | Mainnet RPC endpoint URL | `https://mainnet.infura.io/v3/YOUR_PROJECT_ID` |

### Shared Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `TREASURY_ADDRESS` | Treasury wallet address (multi-sig recommended) | `0x789ghi...` |
| `RECORDER_ADDRESS` | Backend service wallet address | `0xabcdef...` |
| `ADMIN_ADDRESS` | Contract admin address (optional, defaults to treasury) | `0x123456...` |
| `ETHERSCAN_API_KEY` | Etherscan API key for contract verification | `ABC123DEF456...` |

## Setup Steps

### 1. Get Private Keys

```bash
# NEVER commit private keys to git!
# Use a dedicated deployment wallet
# For testnet: Create a new wallet and get Sepolia ETH from faucets
# For mainnet: Use a secure wallet with sufficient ETH for deployment
```

### 2. Get RPC URLs

- **Infura**: https://infura.io/ (Create project, get endpoint URLs)
- **Alchemy**: https://alchemy.com/ (Alternative RPC provider)
- **QuickNode**: https://quicknode.com/ (Another alternative)

### 3. Get Etherscan API Key

- Visit: https://etherscan.io/apis
- Create account and generate API key
- Use same key for both testnet and mainnet verification

### 4. Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** tab
3. In left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with exact name and value

## Security Best Practices

### Do This

- Use dedicated wallets for deployment (not personal wallets)
- Keep minimal ETH in deployment wallets
- Use environment-specific private keys (separate for testnet/mainnet)
- Regularly rotate API keys
- Use hardware wallets for mainnet deployment keys

### ❌ Don't Do This

- Never commit private keys to git
- Don't use personal wallet private keys
- Don't share private keys between environments
- Don't store secrets in code or config files

## Environment Setup

### GitHub Environments

1. Go to repository **Settings** → **Environments**
2. Create two environments:
   - `testnet` - for Sepolia deployments
   - `production` - for mainnet deployments

3. Configure environment protection rules:
   - **Testnet**: No restrictions (auto-deploy on develop branch)
   - **Production**: Require manual approval + admin review

### Environment-Specific Secrets

You can also set secrets per environment for additional security:

**Testnet Environment:**

- `SEPOLIA_PRIVATE_KEY`
- `SEPOLIA_RPC_URL`

**Production Environment:**

- `MAINNET_PRIVATE_KEY`
- `MAINNET_RPC_URL`

## Verification

### Test Your Setup

1. Check secrets are properly set:

   ```bash
   # In GitHub Actions, secrets will show as ***
   echo "Secrets configured: ${{ secrets.SEPOLIA_PRIVATE_KEY && 'YES' || 'NO' }}"
   ```

2. Test deployment locally first:

   ```bash
   # Create local .env file (DON'T commit!)
   cp env.example .env
   # Fill in values
   
   # Test compilation
   npx hardhat compile
   
   # Test deployment to testnet
   npx hardhat run scripts/deploy.js --network sepolia
   ```

## Deployment Triggers

### Automatic Deployments

- **Testnet**: Triggered on push to `develop` branch or `feat/*` branches
- **Mainnet**: Triggered on push to `main` branch with `[DEPLOY-MAINNET]` in commit message

### Manual Deployments

You can also trigger deployments manually through GitHub Actions UI:

1. Go to **Actions** tab
2. Select **Smart Contract CI/CD** workflow
3. Click **Run workflow**
4. Choose branch and environment

## Troubleshooting

### Common Issues

**"Insufficient funds" error:**

- Check wallet balance has enough ETH for gas fees
- Use gas price checker: `npx hardhat run scripts/check-gas-price.js`

**"Invalid private key" error:**

- Ensure private key includes `0x` prefix
- Verify private key is exactly 64 characters (+ 0x prefix)

**"Network not found" error:**

- Check RPC URL is correct and accessible
- Verify Infura/Alchemy project is active

**Contract verification fails:**

- Check Etherscan API key is valid
- Wait 30-60 seconds after deployment before verification
- Ensure constructor parameters match deployment

### Getting Help

- Check GitHub Actions logs for detailed error messages
- Use `npx hardhat test` to verify contracts work locally
- Check network status: https://status.infura.io/

## Example Workflow

### Testnet Deployment

1. Push code to `develop` branch
2. GitHub Actions automatically:
   - Runs tests
   - Deploys to Sepolia
   - Verifies contracts
   - Comments deployment info on PR

### Mainnet Deployment

1. Ensure code is thoroughly tested on testnet
2. Get professional audit completed
3. Push to `main` branch with commit message: `Deploy to mainnet [DEPLOY-MAINNET]`
4. GitHub Actions:
   - Runs all tests
   - Requires manual approval (if configured)
   - Deploys to mainnet
   - Verifies contracts
   - Creates GitHub release
   - Saves deployment artifacts

Remember: Mainnet deployments are permanent and irreversible. Always test thoroughly on testnet first!
