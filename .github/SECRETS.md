# GitHub Secrets Configuration for Presale Deployment

## 🔐 Required Secrets

### Testnet Deployment (Polygon Amoy)

```
POLYGON_DEPLOYER_PRIVATE_KEY=0x... # Private key for testnet deployment
POLYGON_RPC_URL=https://polygon-amoy.infura.io/v3/YOUR_KEY # or Alchemy
RECORDER_ADDRESS=0x... # Address that can record purchases on testnet
POLYGONSCAN_API_KEY=YOUR_API_KEY # For contract verification
```

### Mainnet Deployment (Polygon)  

```
POLYGON_MAINNET_PRIVATE_KEY=0x... # Private key for mainnet deployment
POLYGON_MAINNET_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_KEY # or Alchemy
MAINNET_RECORDER_ADDRESS=0x... # Production recorder address
POLYGONSCAN_API_KEY=YOUR_API_KEY # Same API key works for both networks
```

## 🏗️ Environment Setup

### 1. Testnet Environment (`testnet`)

- **Required Reviewers:** 1
- **Branch Protection:** develop branch
- **Auto-deployment:** On PR merge to develop

### 2. Production Environment (`production`)

- **Required Reviewers:** 2
- **Wait Timer:** 5 minutes
- **Branch Protection:** main branch  
- **Auto-deployment:** On PR merge to main

## 🚀 Deployment Flow

### Testnet (Polygon Amoy)

1. **Trigger:** PR merged to `develop` branch
2. **Process:**
   - Run tests and security analysis
   - Deploy to Polygon Amoy testnet
   - Verify on Polygonscan
   - Save deployment info to `deployments/amoy/`
   - Create deployment summary

### Mainnet (Polygon)

1. **Trigger:** PR merged to `main` branch
2. **Process:**
   - Run tests and security analysis
   - Pre-deployment validation (gas prices, secrets)
   - Deploy to Polygon mainnet
   - Verify on Polygonscan
   - Create GitHub release
   - Save deployment info to `deployments/polygon/`

## 📁 Deployment Artifacts

### Testnet (`deployments/amoy/`)

```json
{
  "contractAddress": "0x...",
  "network": "polygonAmoy", 
  "chainId": 80002,
  "deploymentBlock": 12345,
  "deploymentDate": "2024-01-01T12:00:00Z",
  "deployer": "GitHub Actions",
  "recorderAddress": "0x...",
  "gasOptimized": true,
  "features": [...]
}
```

### Mainnet (`deployments/polygon/`)

```json
{
  "contractAddress": "0x...",
  "network": "polygon",
  "chainId": 137,
  "deploymentBlock": 12345,
  "deploymentDate": "2024-01-01T12:00:00Z", 
  "deployer": "GitHub Actions",
  "recorderAddress": "0x...",
  "releaseTag": "presale-v123",
  "verified": true,
  "gasOptimized": true,
  "securityAnalyzed": true,
  "features": [...],
  "stages": {
    "1": { "price": "0.00027", "allocation": "200000000", "status": "active" },
    "2": { "price": "0.000293", "allocation": "21000000", "status": "pending" },
    "3": { "price": "0.000318", "allocation": "22000000", "status": "pending" }
  }
}
```

## 🛡️ Security Features

- **Automated Testing:** Full test suite runs before deployment
- **Static Analysis:** Slither and Mythril security scans
- **Multi-reviewer Approval:** Production requires 2 reviewers
- **Contract Verification:** Automatic Polygonscan verification
- **Gas Price Monitoring:** Checks current gas prices before mainnet deployment
- **Rollback Protection:** Immutable contract addresses

## 📊 Integration Examples

### Frontend Integration

```javascript
// Load deployment info
import deployment from './deployments/polygon/presale-deployment.json';

const PRESALE_ADDRESS = deployment.contractAddress;
const PRESALE_ABI = [...]; // From artifacts

// Initialize contract
const presale = new ethers.Contract(PRESALE_ADDRESS, PRESALE_ABI, provider);
```

### Backend Integration

```bash
# Source deployment addresses
source deployments/polygon/addresses.env
echo "Presale address: $PRESALE_ADDRESS"
```

## ⚠️ Important Notes

1. **Contract Immutability:** Once deployed, contract addresses cannot be changed
2. **Recorder Role:** Only addresses with RECORDER_ROLE can record purchases
3. **Stage Management:** Admin can configure and activate new stages
4. **Emergency Controls:** Admin can pause contract in emergencies
5. **Gas Optimization:** Contract uses optimized storage (312 bits vs 440 bits)
6. **Security:** All transfers use SafeERC20 for maximum security
