# Integration Guide

This guide provides step-by-step instructions for integrating with the MoonShot MAGAX presale system.

## Prerequisites

- Node.js and npm/yarn installed
- Hardhat or similar Ethereum development framework
- Web3 library (ethers.js recommended)
- Access to Ethereum testnet/mainnet
- Contract addresses and ABIs

## Quick Start Setup

### 1. Install Dependencies

```bash
npm install ethers dotenv
```

### 2. Environment Configuration

Create a `.env` file:

```bash
# Network Configuration
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
PRIVATE_KEY=your-private-key

# Contract Addresses
PRESALE_CONTRACT_ADDRESS=0x...
TOKEN_CONTRACT_ADDRESS=0x...

# Role Addresses
ADMIN_ADDRESS=0x...
RECORDER_ADDRESS=0x...
```

### 3. Basic Contract Setup

```javascript
const { ethers } = require('ethers');
require('dotenv').config();

// Provider setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Contract ABIs (simplified for example)
const PRESALE_ABI = [
    "function recordPurchase(address buyer, uint128 usdtAmount, uint128 magaxAmount)",
    "function getReceipts(address buyer) view returns (tuple(uint128 usdt, uint128 magax, uint40 time, uint8 stage, uint128 pricePerToken)[])",
    "function getCurrentStageInfo() view returns (uint8 stage, uint128 pricePerToken, uint128 tokensAllocated, uint128 tokensSold, uint128 tokensRemaining, bool isActive)",
    "function configureStage(uint8 stage, uint128 pricePerToken, uint128 tokensAllocated)",
    "function activateStage(uint8 stage)",
    "event PurchaseRecorded(address indexed buyer, uint128 usdt, uint128 magax, uint40 time, uint8 stage, uint128 pricePerToken, uint256 totalUserPurchases, bool isNewBuyer)"
];

// Contract instance
const presaleContract = new ethers.Contract(
    process.env.PRESALE_CONTRACT_ADDRESS,
    PRESALE_ABI,
    provider
);
```

## Frontend Integration

### 1. Display Current Stage Information

```javascript
async function getCurrentStageInfo() {
    try {
        const stageInfo = await presaleContract.getCurrentStageInfo();
        
        return {
            stage: stageInfo.stage,
            price: ethers.formatUnits(stageInfo.pricePerToken, 6),
            allocated: ethers.formatUnits(stageInfo.tokensAllocated, 18),
            sold: ethers.formatUnits(stageInfo.tokensSold, 18),
            remaining: ethers.formatUnits(stageInfo.tokensRemaining, 18),
            isActive: stageInfo.isActive
        };
    } catch (error) {
        console.error('Error fetching stage info:', error);
        throw error;
    }
}

// Usage in React component
function StageDisplay() {
    const [stageInfo, setStageInfo] = useState(null);
    
    useEffect(() => {
        getCurrentStageInfo()
            .then(setStageInfo)
            .catch(console.error);
    }, []);
    
    if (!stageInfo) return <div>Loading...</div>;
    
    return (
        <div>
            <h3>Stage {stageInfo.stage}</h3>
            <p>Price: ${stageInfo.price} per MAGAX</p>
            <p>Remaining: {stageInfo.remaining} MAGAX</p>
            <progress 
                value={stageInfo.sold} 
                max={stageInfo.allocated}
            />
        </div>
    );
}
```

### 2. Display User Purchase History

```javascript
async function getUserPurchaseHistory(userAddress) {
    try {
        const receipts = await presaleContract.getReceipts(userAddress);
        
        return receipts.map(receipt => ({
            usdt: ethers.formatUnits(receipt.usdt, 6),
            magax: ethers.formatUnits(receipt.magax, 18),
            timestamp: new Date(Number(receipt.time) * 1000),
            stage: receipt.stage,
            pricePerToken: ethers.formatUnits(receipt.pricePerToken, 6)
        }));
    } catch (error) {
        console.error('Error fetching user receipts:', error);
        throw error;
    }
}

// Usage in React component
function PurchaseHistory({ userAddress }) {
    const [purchases, setPurchases] = useState([]);
    
    useEffect(() => {
        if (userAddress) {
            getUserPurchaseHistory(userAddress)
                .then(setPurchases)
                .catch(console.error);
        }
    }, [userAddress]);
    
    return (
        <div>
            <h3>Purchase History</h3>
            {purchases.map((purchase, index) => (
                <div key={index} className="purchase-item">
                    <p>Stage {purchase.stage}</p>
                    <p>${purchase.usdt} USDT → {purchase.magax} MAGAX</p>
                    <p>Price: ${purchase.pricePerToken} per token</p>
                    <p>{purchase.timestamp.toLocaleDateString()}</p>
                </div>
            ))}
        </div>
    );
}
```

### 3. Real-time Updates with Events

```javascript
class PresaleEventListener {
    constructor(contract) {
        this.contract = contract;
        this.listeners = new Map();
    }
    
    // Listen for purchase events
    onPurchaseRecorded(callback) {
        const filter = this.contract.filters.PurchaseRecorded();
        
        this.contract.on(filter, (buyer, usdt, magax, time, stage, pricePerToken, totalUserPurchases, isNewBuyer, event) => {
            const purchaseData = {
                buyer,
                usdt: ethers.formatUnits(usdt, 6),
                magax: ethers.formatUnits(magax, 18),
                timestamp: new Date(Number(time) * 1000),
                stage: Number(stage),
                pricePerToken: ethers.formatUnits(pricePerToken, 6),
                totalUserPurchases: Number(totalUserPurchases),
                isNewBuyer,
                transactionHash: event.transactionHash
            };
            
            callback(purchaseData);
        });
    }
    
    // Listen for stage changes
    onStageActivated(callback) {
        const filter = this.contract.filters.StageActivated();
        
        this.contract.on(filter, (stage, event) => {
            callback({
                stage: Number(stage),
                transactionHash: event.transactionHash
            });
        });
    }
    
    // Stop all listeners
    removeAllListeners() {
        this.contract.removeAllListeners();
    }
}

// Usage
const eventListener = new PresaleEventListener(presaleContract);

eventListener.onPurchaseRecorded((purchase) => {
    console.log('New purchase:', purchase);
    // Update UI, show notification, etc.
});

eventListener.onStageActivated((stageData) => {
    console.log('Stage activated:', stageData.stage);
    // Refresh stage info, notify users, etc.
});
```

## Backend Integration

### 1. Purchase Recording Service

```javascript
class PurchaseRecorder {
    constructor(privateKey, contractAddress, contractABI) {
        this.wallet = new ethers.Wallet(privateKey, provider);
        this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
    }
    
    async recordPurchase(buyerAddress, usdtAmount, magaxAmount) {
        try {
            // Convert amounts to proper units
            const usdtAmountWei = ethers.parseUnits(usdtAmount.toString(), 6);
            const magaxAmountWei = ethers.parseUnits(magaxAmount.toString(), 18);
            
            // Validate inputs
            await this.validatePurchase(buyerAddress, usdtAmountWei, magaxAmountWei);
            
            // Record purchase
            const tx = await this.contract.recordPurchase(
                buyerAddress,
                usdtAmountWei,
                magaxAmountWei
            );
            
            const receipt = await tx.wait();
            
            return {
                success: true,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };
            
        } catch (error) {
            console.error('Purchase recording failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async validatePurchase(buyer, usdtAmount, magaxAmount) {
        // Check current stage info
        const stageInfo = await this.contract.getCurrentStageInfo();
        
        if (!stageInfo.isActive) {
            throw new Error('No active stage');
        }
        
        if (magaxAmount > stageInfo.tokensRemaining) {
            throw new Error('Insufficient tokens in current stage');
        }
        
        // Check purchase limits
        const MAX_PURCHASE = ethers.parseUnits("1000000", 6); // 1M USDT
        if (usdtAmount > MAX_PURCHASE) {
            throw new Error('Purchase amount exceeds limit');
        }
        
        // Add other validations as needed
    }
}

// Usage
const recorder = new PurchaseRecorder(
    process.env.RECORDER_PRIVATE_KEY,
    process.env.PRESALE_CONTRACT_ADDRESS,
    PRESALE_ABI
);

// API endpoint example (Express.js)
app.post('/api/record-purchase', async (req, res) => {
    const { buyerAddress, usdtAmount, magaxAmount } = req.body;
    
    // Verify payment off-chain first
    const paymentVerified = await verifyPayment(req.body);
    
    if (!paymentVerified) {
        return res.status(400).json({ error: 'Payment verification failed' });
    }
    
    const result = await recorder.recordPurchase(buyerAddress, usdtAmount, magaxAmount);
    
    if (result.success) {
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error
        });
    }
});
```

### 2. Stage Management Service

```javascript
class StageManager {
    constructor(privateKey, contractAddress, contractABI) {
        this.wallet = new ethers.Wallet(privateKey, provider);
        this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
    }
    
    async configureStage(stage, priceUSDT, tokensAllocated) {
        try {
            const priceWei = ethers.parseUnits(priceUSDT.toString(), 6);
            const tokensWei = ethers.parseUnits(tokensAllocated.toString(), 18);
            
            const tx = await this.contract.configureStage(stage, priceWei, tokensWei);
            const receipt = await tx.wait();
            
            return {
                success: true,
                transactionHash: receipt.hash
            };
        } catch (error) {
            console.error('Stage configuration failed:', error);
            throw error;
        }
    }
    
    async activateStage(stage) {
        try {
            const tx = await this.contract.activateStage(stage);
            const receipt = await tx.wait();
            
            return {
                success: true,
                transactionHash: receipt.hash
            };
        } catch (error) {
            console.error('Stage activation failed:', error);
            throw error;
        }
    }
    
    async setupMultipleStages(stageConfigs) {
        const results = [];
        
        for (const config of stageConfigs) {
            try {
                const result = await this.configureStage(
                    config.stage,
                    config.price,
                    config.allocation
                );
                results.push({ stage: config.stage, ...result });
            } catch (error) {
                results.push({ 
                    stage: config.stage, 
                    success: false, 
                    error: error.message 
                });
            }
        }
        
        return results;
    }
}

// Usage
const stageManager = new StageManager(
    process.env.ADMIN_PRIVATE_KEY,
    process.env.PRESALE_CONTRACT_ADDRESS,
    PRESALE_ABI
);

// Setup initial stages
const stageConfigs = [
    { stage: 1, price: 0.001, allocation: 1000000 },
    { stage: 2, price: 0.002, allocation: 2000000 },
    { stage: 3, price: 0.003, allocation: 3000000 },
    // ... more stages
];

stageManager.setupMultipleStages(stageConfigs)
    .then(results => console.log('Stage setup results:', results));
```

## Analytics Integration

### 1. Presale Analytics Dashboard

```javascript
class PresaleAnalytics {
    constructor(contractAddress, contractABI) {
        this.contract = new ethers.Contract(contractAddress, contractABI, provider);
    }
    
    async getOverallStats() {
        const stats = await this.contract.getPresaleStats();
        const currentStage = await this.contract.getCurrentStageInfo();
        
        return {
            totalRaised: ethers.formatUnits(stats.totalUSDTRaised, 6),
            totalTokensSold: ethers.formatUnits(stats.totalMAGAXSold, 18),
            uniqueBuyers: Number(stats.totalUniqueBuyers),
            currentStage: {
                stage: Number(currentStage.stage),
                price: ethers.formatUnits(currentStage.pricePerToken, 6),
                progress: Number(currentStage.tokensSold) / Number(currentStage.tokensAllocated)
            }
        };
    }
    
    async getStageProgress(stageNumber) {
        const stageInfo = await this.contract.getStageInfo(stageNumber);
        
        return {
            stage: stageNumber,
            price: ethers.formatUnits(stageInfo.pricePerToken, 6),
            allocated: ethers.formatUnits(stageInfo.tokensAllocated, 18),
            sold: ethers.formatUnits(stageInfo.tokensSold, 18),
            remaining: ethers.formatUnits(stageInfo.tokensRemaining, 18),
            progress: Number(stageInfo.tokensSold) / Number(stageInfo.tokensAllocated),
            isActive: stageInfo.isActive
        };
    }
    
    async getAllStagesProgress() {
        const stages = [];
        
        for (let i = 1; i <= 50; i++) {
            try {
                const stageInfo = await this.getStageProgress(i);
                if (stageInfo.allocated > 0) { // Only include configured stages
                    stages.push(stageInfo);
                }
            } catch (error) {
                // Stage not configured, skip
                continue;
            }
        }
        
        return stages;
    }
}

// Usage
const analytics = new PresaleAnalytics(
    process.env.PRESALE_CONTRACT_ADDRESS,
    PRESALE_ABI
);

// Dashboard API endpoint
app.get('/api/analytics', async (req, res) => {
    try {
        const [overallStats, stagesProgress] = await Promise.all([
            analytics.getOverallStats(),
            analytics.getAllStagesProgress()
        ]);
        
        res.json({
            overall: overallStats,
            stages: stagesProgress
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Error Handling

### Common Error Cases

```javascript
class PresaleErrorHandler {
    static handleContractError(error) {
        if (error.code === 'CALL_EXCEPTION') {
            // Custom error handling
            const errorName = error.reason || error.data;
            
            switch (errorName) {
                case 'ExceedsMaxPurchase()':
                    return 'Purchase amount exceeds maximum limit of 1M USDT';
                case 'InsufficientStageTokens()':
                    return 'Not enough tokens remaining in current stage';
                case 'StageNotActive()':
                    return 'Current stage is not active';
                case 'InvalidAddress()':
                    return 'Invalid address provided';
                case 'InvalidAmount()':
                    return 'Invalid amount - must be greater than 0';
                case 'DuplicatePurchase()':
                    return 'Duplicate purchase detected';
                default:
                    return `Contract error: ${errorName}`;
            }
        }
        
        if (error.code === 'INSUFFICIENT_FUNDS') {
            return 'Insufficient gas funds for transaction';
        }
        
        if (error.code === 'NETWORK_ERROR') {
            return 'Network connection error - please try again';
        }
        
        return error.message || 'Unknown error occurred';
    }
}

// Usage in API
app.post('/api/record-purchase', async (req, res) => {
    try {
        const result = await recorder.recordPurchase(buyerAddress, usdtAmount, magaxAmount);
        res.json(result);
    } catch (error) {
        const friendlyMessage = PresaleErrorHandler.handleContractError(error);
        res.status(400).json({ 
            success: false, 
            error: friendlyMessage 
        });
    }
});
```

## Testing Integration

### Unit Tests Example

```javascript
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Presale Integration Tests', function () {
    let presaleContract, admin, recorder, buyer;
    
    beforeEach(async function () {
        [admin, recorder, buyer] = await ethers.getSigners();
        
        // Deploy contract
        const PresaleFactory = await ethers.getContractFactory('MAGAXPresaleReceipts');
        presaleContract = await PresaleFactory.deploy(recorder.address);
        
        // Configure and activate stage
        await presaleContract.connect(admin).configureStage(
            1,
            ethers.parseUnits('0.001', 6),
            ethers.parseUnits('1000000', 18)
        );
        await presaleContract.connect(admin).activateStage(1);
    });
    
    it('Should record purchase correctly', async function () {
        const usdtAmount = ethers.parseUnits('100', 6);
        const magaxAmount = ethers.parseUnits('1000', 18);
        
        await expect(
            presaleContract.connect(recorder).recordPurchase(
                buyer.address,
                usdtAmount,
                magaxAmount
            )
        ).to.emit(presaleContract, 'PurchaseRecorded');
        
        const receipts = await presaleContract.getReceipts(buyer.address);
        expect(receipts).to.have.length(1);
        expect(receipts[0].stage).to.equal(1);
    });
});
```

## Production Deployment Checklist

### Pre-Deployment

- [ ] All contracts audited
- [ ] Tests passing on testnet
- [ ] Stage configurations planned
- [ ] Admin/recorder roles assigned
- [ ] Gas estimation completed
- [ ] Monitoring system ready

### Post-Deployment

- [ ] Contract verification on Etherscan
- [ ] Initial stage configuration
- [ ] Event monitoring active
- [ ] Analytics dashboard deployed
- [ ] Emergency procedures documented
- [ ] Team training completed

## Next Steps

- **[Security Features](./security-features.md)** - Security mechanisms and best practices
- **[Event Reference](./event-reference.md)** - All contract events
- **[Error Reference](./error-reference.md)** - Error handling and troubleshooting

## Golang Backend Integration

### 1. Setup and Dependencies

```bash
# Initialize Go module
go mod init presale-backend

# Install dependencies
go get github.com/ethereum/go-ethereum
go get github.com/ethereum/go-ethereum/ethclient
go get github.com/ethereum/go-ethereum/accounts/abi/bind
go get github.com/ethereum/go-ethereum/crypto
go get github.com/joho/godotenv
```

### 2. Generate Contract Bindings

First, generate Go bindings from your contract ABI:

```bash
# Install abigen
go install github.com/ethereum/go-ethereum/cmd/abigen@latest

# Generate bindings (assuming you have the ABI file)
abigen --abi=./artifacts/contracts/PreSaleOnChain.sol/MAGAXPresaleReceipts.json --pkg=contracts --out=contracts/presale.go
```

### 3. Environment Configuration

```go
// config/config.go
package config

import (
    "log"
    "os"
    
    "github.com/joho/godotenv"
)

type Config struct {
    RPCUrl                  string
    PrivateKey             string
    PresaleContractAddress string
    TokenContractAddress   string
    AdminAddress           string
    RecorderAddress        string
}

func LoadConfig() *Config {
    err := godotenv.Load()
    if err != nil {
        log.Fatal("Error loading .env file")
    }
    
    return &Config{
        RPCUrl:                  os.Getenv("RPC_URL"),
        PrivateKey:             os.Getenv("RECORDER_PRIVATE_KEY"),
        PresaleContractAddress: os.Getenv("PRESALE_CONTRACT_ADDRESS"),
        TokenContractAddress:   os.Getenv("TOKEN_CONTRACT_ADDRESS"),
        AdminAddress:           os.Getenv("ADMIN_ADDRESS"),
        RecorderAddress:        os.Getenv("RECORDER_ADDRESS"),
    }
}
```

### 4. Contract Client Setup

```go
// client/client.go
package client

import (
    "context"
    "crypto/ecdsa"
    "math/big"
    "log"
    
    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
    
    "your-project/config"
    "your-project/contracts"
)

type PresaleClient struct {
    client   *ethclient.Client
    contract *contracts.MAGAXPresaleReceipts
    auth     *bind.TransactOpts
    address  common.Address
}

func NewPresaleClient(cfg *config.Config) (*PresaleClient, error) {
    // Connect to Ethereum client
    client, err := ethclient.Dial(cfg.RPCUrl)
    if err != nil {
        return nil, err
    }
    
    // Parse contract address
    contractAddress := common.HexToAddress(cfg.PresaleContractAddress)
    
    // Create contract instance
    contract, err := contracts.NewMAGAXPresaleReceipts(contractAddress, client)
    if err != nil {
        return nil, err
    }
    
    // Setup transaction auth
    privateKey, err := crypto.HexToECDSA(cfg.PrivateKey)
    if err != nil {
        return nil, err
    }
    
    publicKey := privateKey.Public()
    publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
    if !ok {
        return nil, err
    }
    
    fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
    
    chainID, err := client.NetworkID(context.Background())
    if err != nil {
        return nil, err
    }
    
    auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
    if err != nil {
        return nil, err
    }
    
    return &PresaleClient{
        client:   client,
        contract: contract,
        auth:     auth,
        address:  fromAddress,
    }, nil
}
```

### 5. Purchase Recording Service

```go
// services/purchase.go
package services

import (
    "context"
    "fmt"
    "math/big"
    
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core/types"
    
    "your-project/client"
)

type PurchaseService struct {
    client *client.PresaleClient
}

type PurchaseRequest struct {
    BuyerAddress string  `json:"buyer_address"`
    USDTAmount   float64 `json:"usdt_amount"`
    MAGAXAmount  float64 `json:"magax_amount"`
}

type PurchaseResponse struct {
    Success         bool   `json:"success"`
    TransactionHash string `json:"transaction_hash,omitempty"`
    BlockNumber     uint64 `json:"block_number,omitempty"`
    GasUsed         uint64 `json:"gas_used,omitempty"`
    Error           string `json:"error,omitempty"`
}

func NewPurchaseService(client *client.PresaleClient) *PurchaseService {
    return &PurchaseService{client: client}
}

func (s *PurchaseService) RecordPurchase(req PurchaseRequest) (*PurchaseResponse, error) {
    // Validate inputs
    if err := s.validatePurchase(req); err != nil {
        return &PurchaseResponse{
            Success: false,
            Error:   err.Error(),
        }, nil
    }
    
    // Convert amounts to wei
    usdtAmountWei := USDTToWei(req.USDTAmount)
    magaxAmountWei := MAGAXToWei(req.MAGAXAmount)
    
    // Convert buyer address
    buyerAddr := common.HexToAddress(req.BuyerAddress)
    
    // Record purchase on blockchain
    tx, err := s.client.contract.RecordPurchase(
        s.client.auth,
        buyerAddr,
        usdtAmountWei,
        magaxAmountWei,
    )
    if err != nil {
        return &PurchaseResponse{
            Success: false,
            Error:   fmt.Sprintf("Transaction failed: %v", err),
        }, nil
    }
    
    // Wait for confirmation
    receipt, err := bind.WaitMined(context.Background(), s.client.client, tx)
    if err != nil {
        return &PurchaseResponse{
            Success: false,
            Error:   fmt.Sprintf("Transaction confirmation failed: %v", err),
        }, nil
    }
    
    return &PurchaseResponse{
        Success:         true,
        TransactionHash: tx.Hash().Hex(),
        BlockNumber:     receipt.BlockNumber.Uint64(),
        GasUsed:         receipt.GasUsed,
    }, nil
}

func (s *PurchaseService) validatePurchase(req PurchaseRequest) error {
    // Check if buyer address is valid
    if !common.IsHexAddress(req.BuyerAddress) {
        return fmt.Errorf("invalid buyer address")
    }
    
    // Check amounts
    if req.USDTAmount <= 0 || req.MAGAXAmount <= 0 {
        return fmt.Errorf("amounts must be greater than 0")
    }
    
    // Check maximum purchase limit (1M USDT)
    if req.USDTAmount > 1000000 {
        return fmt.Errorf("purchase amount exceeds maximum limit of 1M USDT")
    }
    
    // Check current stage status
    stageInfo, err := s.client.contract.GetCurrentStageInfo(nil)
    if err != nil {
        return fmt.Errorf("failed to get stage info: %v", err)
    }
    
    if !stageInfo.IsActive {
        return fmt.Errorf("no active stage")
    }
    
    // Check if enough tokens remain in stage
    magaxAmountWei := MAGAXToWei(req.MAGAXAmount)
    if magaxAmountWei.Cmp(stageInfo.TokensRemaining) > 0 {
        return fmt.Errorf("insufficient tokens in current stage")
    }
    
    return nil
}

// Helper functions for unit conversions
func USDTToWei(amount float64) *big.Int {
    // USDT has 6 decimals
    multiplier := new(big.Int).Exp(big.NewInt(10), big.NewInt(6), nil)
    amountInt := new(big.Int).SetInt64(int64(amount * 1000000))
    return new(big.Int).Div(amountInt, big.NewInt(1000000)).Mul(amountInt, big.NewInt(1))
}

func MAGAXToWei(amount float64) *big.Int {
    // MAGAX has 18 decimals
    multiplier := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
    amountInt := new(big.Int).SetInt64(int64(amount * 1e18))
    return new(big.Int).Div(amountInt, big.NewInt(1e18))
}

func WeiToUSDT(wei *big.Int) float64 {
    divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(6), nil)
    result := new(big.Int).Div(wei, divisor)
    return float64(result.Int64())
}

func WeiToMAGAX(wei *big.Int) float64 {
    divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
    result := new(big.Int).Div(wei, divisor)
    return float64(result.Int64())
}
```

### 6. Stage Management Service

```go
// services/stage.go
package services

import (
    "fmt"
    "math/big"
    
    "your-project/client"
)

type StageService struct {
    client *client.PresaleClient
}

type StageConfig struct {
    Stage           uint8   `json:"stage"`
    PriceUSDT       float64 `json:"price_usdt"`
    TokensAllocated float64 `json:"tokens_allocated"`
}

type StageInfo struct {
    Stage           uint8   `json:"stage"`
    PricePerToken   float64 `json:"price_per_token"`
    TokensAllocated float64 `json:"tokens_allocated"`
    TokensSold      float64 `json:"tokens_sold"`
    TokensRemaining float64 `json:"tokens_remaining"`
    IsActive        bool    `json:"is_active"`
    Progress        float64 `json:"progress"`
}

func NewStageService(client *client.PresaleClient) *StageService {
    return &StageService{client: client}
}

func (s *StageService) ConfigureStage(config StageConfig) error {
    priceWei := USDTToWei(config.PriceUSDT)
    tokensWei := MAGAXToWei(config.TokensAllocated)
    
    tx, err := s.client.contract.ConfigureStage(
        s.client.auth,
        config.Stage,
        priceWei,
        tokensWei,
    )
    if err != nil {
        return fmt.Errorf("configure stage failed: %v", err)
    }
    
    _, err = bind.WaitMined(context.Background(), s.client.client, tx)
    if err != nil {
        return fmt.Errorf("transaction confirmation failed: %v", err)
    }
    
    return nil
}

func (s *StageService) ActivateStage(stage uint8) error {
    tx, err := s.client.contract.ActivateStage(s.client.auth, stage)
    if err != nil {
        return fmt.Errorf("activate stage failed: %v", err)
    }
    
    _, err = bind.WaitMined(context.Background(), s.client.client, tx)
    if err != nil {
        return fmt.Errorf("transaction confirmation failed: %v", err)
    }
    
    return nil
}

func (s *StageService) GetCurrentStageInfo() (*StageInfo, error) {
    stageInfo, err := s.client.contract.GetCurrentStageInfo(nil)
    if err != nil {
        return nil, fmt.Errorf("failed to get current stage info: %v", err)
    }
    
    progress := float64(0)
    if stageInfo.TokensAllocated.Cmp(big.NewInt(0)) > 0 {
        progress = float64(stageInfo.TokensSold.Int64()) / float64(stageInfo.TokensAllocated.Int64()) * 100
    }
    
    return &StageInfo{
        Stage:           stageInfo.Stage,
        PricePerToken:   WeiToUSDT(stageInfo.PricePerToken),
        TokensAllocated: WeiToMAGAX(stageInfo.TokensAllocated),
        TokensSold:      WeiToMAGAX(stageInfo.TokensSold),
        TokensRemaining: WeiToMAGAX(stageInfo.TokensRemaining),
        IsActive:        stageInfo.IsActive,
        Progress:        progress,
    }, nil
}

func (s *StageService) GetStageInfo(stage uint8) (*StageInfo, error) {
    stageInfo, err := s.client.contract.GetStageInfo(nil, stage)
    if err != nil {
        return nil, fmt.Errorf("failed to get stage %d info: %v", stage, err)
    }
    
    progress := float64(0)
    if stageInfo.TokensAllocated.Cmp(big.NewInt(0)) > 0 {
        progress = float64(stageInfo.TokensSold.Int64()) / float64(stageInfo.TokensAllocated.Int64()) * 100
    }
    
    return &StageInfo{
        Stage:           stage,
        PricePerToken:   WeiToUSDT(stageInfo.PricePerToken),
        TokensAllocated: WeiToMAGAX(stageInfo.TokensAllocated),
        TokensSold:      WeiToMAGAX(stageInfo.TokensSold),
        TokensRemaining: WeiToMAGAX(stageInfo.TokensRemaining),
        IsActive:        stageInfo.IsActive,
        Progress:        progress,
    }, nil
}
```

### 7. Event Monitoring

```go
// services/monitor.go
package services

import (
    "context"
    "log"
    "math/big"
    
    "github.com/ethereum/go-ethereum"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core/types"
    
    "your-project/client"
    "your-project/contracts"
)

type EventMonitor struct {
    client   *client.PresaleClient
    contract *contracts.MAGAXPresaleReceipts
}

type PurchaseEvent struct {
    Buyer               common.Address `json:"buyer"`
    USDTAmount          float64        `json:"usdt_amount"`
    MAGAXAmount         float64        `json:"magax_amount"`
    Timestamp           uint64         `json:"timestamp"`
    Stage               uint8          `json:"stage"`
    PricePerToken       float64        `json:"price_per_token"`
    TotalUserPurchases  uint64         `json:"total_user_purchases"`
    IsNewBuyer          bool           `json:"is_new_buyer"`
    TransactionHash     string         `json:"transaction_hash"`
    BlockNumber         uint64         `json:"block_number"`
}

func NewEventMonitor(client *client.PresaleClient) *EventMonitor {
    return &EventMonitor{
        client:   client,
        contract: client.contract,
    }
}

func (m *EventMonitor) StartMonitoring(ctx context.Context) {
    // Subscribe to purchase events
    purchaseChan := make(chan *contracts.MAGAXPresaleReceiptsPurchaseRecorded)
    
    sub, err := m.contract.WatchPurchaseRecorded(
        &bind.WatchOpts{Context: ctx},
        purchaseChan,
        []common.Address{}, // All buyers
    )
    if err != nil {
        log.Fatal("Failed to subscribe to purchase events:", err)
    }
    
    // Subscribe to stage events
    stageActivatedChan := make(chan *contracts.MAGAXPresaleReceiptsStageActivated)
    
    stageSub, err := m.contract.WatchStageActivated(
        &bind.WatchOpts{Context: ctx},
        stageActivatedChan,
        []uint8{}, // All stages
    )
    if err != nil {
        log.Fatal("Failed to subscribe to stage events:", err)
    }
    
    go func() {
        for {
            select {
            case err := <-sub.Err():
                log.Printf("Purchase subscription error: %v", err)
                return
            case err := <-stageSub.Err():
                log.Printf("Stage subscription error: %v", err)
                return
            case event := <-purchaseChan:
                m.handlePurchaseEvent(event)
            case event := <-stageActivatedChan:
                m.handleStageActivatedEvent(event)
            case <-ctx.Done():
                return
            }
        }
    }()
}

func (m *EventMonitor) handlePurchaseEvent(event *contracts.MAGAXPresaleReceiptsPurchaseRecorded) {
    purchaseEvent := PurchaseEvent{
        Buyer:               event.Buyer,
        USDTAmount:          WeiToUSDT(event.Usdt),
        MAGAXAmount:         WeiToMAGAX(event.Magax),
        Timestamp:           uint64(event.Time),
        Stage:               event.Stage,
        PricePerToken:       WeiToUSDT(event.PricePerToken),
        TotalUserPurchases:  event.TotalUserPurchases.Uint64(),
        IsNewBuyer:          event.IsNewBuyer,
        TransactionHash:     event.Raw.TxHash.Hex(),
        BlockNumber:         event.Raw.BlockNumber,
    }
    
    log.Printf("🎉 New Purchase: %s bought %.2f MAGAX for %.2f USDT in stage %d",
        purchaseEvent.Buyer.Hex(),
        purchaseEvent.MAGAXAmount,
        purchaseEvent.USDTAmount,
        purchaseEvent.Stage,
    )
    
    // Handle large purchases
    if purchaseEvent.USDTAmount > 10000 {
        log.Printf("🚨 LARGE PURCHASE ALERT: %.2f USDT by %s",
            purchaseEvent.USDTAmount,
            purchaseEvent.Buyer.Hex(),
        )
    }
    
    // Handle new buyers
    if purchaseEvent.IsNewBuyer {
        log.Printf("👋 NEW BUYER: %s made their first purchase", purchaseEvent.Buyer.Hex())
    }
    
    // Store to database, send notifications, etc.
    // m.storePurchase(purchaseEvent)
    // m.sendNotification(purchaseEvent)
}

func (m *EventMonitor) handleStageActivatedEvent(event *contracts.MAGAXPresaleReceiptsStageActivated) {
    log.Printf("🚀 Stage %d activated at block %d", event.Stage, event.Raw.BlockNumber)
    
    // Update stage info in cache/database
    // m.updateStageCache(event.Stage)
}
```

### 8. HTTP API Handlers

```go
// handlers/handlers.go
package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    
    "github.com/gorilla/mux"
    
    "your-project/services"
)

type Handler struct {
    purchaseService *services.PurchaseService
    stageService    *services.StageService
}

func NewHandler(purchaseService *services.PurchaseService, stageService *services.StageService) *Handler {
    return &Handler{
        purchaseService: purchaseService,
        stageService:    stageService,
    }
}

func (h *Handler) RecordPurchase(w http.ResponseWriter, r *http.Request) {
    var req services.PurchaseRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }
    
    // Verify payment off-chain first
    // if !verifyPayment(req) {
    //     http.Error(w, "Payment verification failed", http.StatusBadRequest)
    //     return
    // }
    
    response, err := h.purchaseService.RecordPurchase(req)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func (h *Handler) GetCurrentStage(w http.ResponseWriter, r *http.Request) {
    stageInfo, err := h.stageService.GetCurrentStageInfo()
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(stageInfo)
}

func (h *Handler) GetStageInfo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    stageStr, ok := vars["stage"]
    if !ok {
        http.Error(w, "Stage parameter required", http.StatusBadRequest)
        return
    }
    
    stage, err := strconv.ParseUint(stageStr, 10, 8)
    if err != nil {
        http.Error(w, "Invalid stage number", http.StatusBadRequest)
        return
    }
    
    stageInfo, err := h.stageService.GetStageInfo(uint8(stage))
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(stageInfo)
}

func (h *Handler) ConfigureStage(w http.ResponseWriter, r *http.Request) {
    var config services.StageConfig
    if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }
    
    if err := h.stageService.ConfigureStage(config); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (h *Handler) ActivateStage(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    stageStr, ok := vars["stage"]
    if !ok {
        http.Error(w, "Stage parameter required", http.StatusBadRequest)
        return
    }
    
    stage, err := strconv.ParseUint(stageStr, 10, 8)
    if err != nil {
        http.Error(w, "Invalid stage number", http.StatusBadRequest)
        return
    }
    
    if err := h.stageService.ActivateStage(uint8(stage)); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
```

### 9. Main Application

```go
// main.go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    
    "github.com/gorilla/mux"
    
    "your-project/client"
    "your-project/config"
    "your-project/handlers"
    "your-project/services"
)

func main() {
    // Load configuration
    cfg := config.LoadConfig()
    
    // Initialize client
    presaleClient, err := client.NewPresaleClient(cfg)
    if err != nil {
        log.Fatal("Failed to initialize presale client:", err)
    }
    
    // Initialize services
    purchaseService := services.NewPurchaseService(presaleClient)
    stageService := services.NewStageService(presaleClient)
    
    // Initialize event monitor
    monitor := services.NewEventMonitor(presaleClient)
    
    // Start monitoring in background
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()
    
    go monitor.StartMonitoring(ctx)
    
    // Initialize handlers
    handler := handlers.NewHandler(purchaseService, stageService)
    
    // Setup routes
    r := mux.NewRouter()
    
    // API routes
    api := r.PathPrefix("/api").Subrouter()
    api.HandleFunc("/record-purchase", handler.RecordPurchase).Methods("POST")
    api.HandleFunc("/current-stage", handler.GetCurrentStage).Methods("GET")
    api.HandleFunc("/stage/{stage}", handler.GetStageInfo).Methods("GET")
    api.HandleFunc("/configure-stage", handler.ConfigureStage).Methods("POST")
    api.HandleFunc("/activate-stage/{stage}", handler.ActivateStage).Methods("POST")
    
    // Start HTTP server
    log.Println("Starting server on :8080")
    server := &http.Server{
        Addr:    ":8080",
        Handler: r,
    }
    
    // Graceful shutdown
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal("Server failed to start:", err)
        }
    }()
    
    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    log.Println("Shutting down server...")
    cancel() // Stop event monitoring
    
    if err := server.Shutdown(context.Background()); err != nil {
        log.Fatal("Server forced to shutdown:", err)
    }
    
    log.Println("Server exited")
}
```

### 10. Testing

```go
// tests/integration_test.go
package tests

import (
    "testing"
    "math/big"
    
    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/accounts/abi/bind/backends"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core"
    "github.com/ethereum/go-ethereum/crypto"
    
    "your-project/contracts"
    "your-project/services"
)

func TestPurchaseRecording(t *testing.T) {
    // Setup simulated backend for testing
    privateKey, _ := crypto.GenerateKey()
    auth, _ := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(1337))
    
    alloc := make(core.GenesisAlloc)
    alloc[auth.From] = core.GenesisAccount{Balance: big.NewInt(9000000000000000000)}
    
    backend := backends.NewSimulatedBackend(alloc, 8000000)
    
    // Deploy contract
    address, _, contract, err := contracts.DeployMAGAXPresaleReceipts(auth, backend, auth.From)
    if err != nil {
        t.Fatal("Failed to deploy contract:", err)
    }
    backend.Commit()
    
    // Setup and configure stage
    stagePrice := big.NewInt(1000) // 0.001 USDT (6 decimals)
    stageAllocation := new(big.Int).Mul(big.NewInt(1000000), big.NewInt(1e18)) // 1M tokens
    
    _, err = contract.ConfigureStage(auth, 1, stagePrice, stageAllocation)
    if err != nil {
        t.Fatal("Failed to configure stage:", err)
    }
    backend.Commit()
    
    _, err = contract.ActivateStage(auth, 1)
    if err != nil {
        t.Fatal("Failed to activate stage:", err)
    }
    backend.Commit()
    
    // Test purchase recording
    buyer := common.HexToAddress("0x1234567890123456789012345678901234567890")
    usdtAmount := big.NewInt(100000000) // 100 USDT (6 decimals)
    magaxAmount := new(big.Int).Mul(big.NewInt(100000), big.NewInt(1e18)) // 100K MAGAX
    
    _, err = contract.RecordPurchase(auth, buyer, usdtAmount, magaxAmount)
    if err != nil {
        t.Fatal("Failed to record purchase:", err)
    }
    backend.Commit()
    
    // Verify purchase was recorded
    receipts, err := contract.GetReceipts(nil, buyer)
    if err != nil {
        t.Fatal("Failed to get receipts:", err)
    }
    
    if len(receipts) != 1 {
        t.Fatalf("Expected 1 receipt, got %d", len(receipts))
    }
    
    if receipts[0].Stage != 1 {
        t.Fatalf("Expected stage 1, got %d", receipts[0].Stage)
    }
}
```

### Key Differences from JavaScript:

1. **Type Safety**: Go provides compile-time type checking
2. **Performance**: Generally faster execution than Node.js
3. **Concurrency**: Better handling of concurrent operations with goroutines
4. **Memory Management**: More efficient memory usage
5. **Contract Bindings**: Use `abigen` to generate type-safe contract bindings
6. **Error Handling**: Explicit error handling throughout

The core concepts remain the same - you're still calling the same contract functions and handling the same events, just using Go syntax and patterns instead of JavaScript.
