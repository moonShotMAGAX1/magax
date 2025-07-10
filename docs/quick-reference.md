# Quick Reference Guide

## Contract Quick Reference

### MAGAXPresaleReceipts - Key Functions

```solidity
// Purchase Recording (RECORDER_ROLE)
recordPurchase(address buyer, uint128 usdtAmount, uint128 magaxAmount)

// Stage Management (ADMIN_ROLE)
configureStage(uint8 stage, uint128 pricePerToken, uint128 tokensAllocated)
activateStage(uint8 stage)

// View Functions (Anyone)
getUserReceipts(address buyer) → Receipt[]
getPresaleStats() → (totalUSDT, totalMAGAX, uniqueBuyers)
getCurrentStageInfo() → (stage, price, allocated, sold, remaining, active)
getStageInfo(uint8 stage) → (price, allocated, sold, remaining, active)
```

### MoonShotMAGAX Token - Key Functions

```solidity
// Standard ERC-20
transfer(address to, uint256 amount)
transferFrom(address from, address to, uint256 amount)
approve(address spender, uint256 amount)

// Minting (OWNER)
mint(uint256 amount) // Mints to treasury address

// Burning (TOKEN HOLDER)
burn(uint256 amount)
burnFrom(address account, uint256 amount)

// Admin (OWNER)
pause() / unpause()
setTreasuryAddress(address treasury)
```

## Constants & Limits

```javascript
// Purchase Limits
MAX_PURCHASE_USDT = 1,000,000 USDT  // Per transaction
MAX_TOTAL_USDT = 10,000,000 USDT    // Per user total

// Token Supply
MAX_SUPPLY = 1,000,000,000,000 MAGAX // 1 Trillion tokens

// Stage System
MAX_STAGES = 50                      // 50 presale stages
```

## Role Definitions

```javascript
// Admin role (0x00) - Full control
DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000"

// Recorder role - Purchase recording only
RECORDER_ROLE = keccak256("RECORDER_ROLE")
```

## Common Code Snippets

### Connect to Contracts

```javascript
// Using ethers.js v6
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const presaleContract = new ethers.Contract(
    PRESALE_ADDRESS,
    PRESALE_ABI,
    signer
);

const tokenContract = new ethers.Contract(
    TOKEN_ADDRESS,
    TOKEN_ABI,
    signer
);
```

### Record a Purchase

```javascript
// As RECORDER_ROLE
const tx = await presaleContract.recordPurchase(
    "0x742d35C7C8D2eF3Ae4F42F31374c981eA2C47a5F", // buyer
    ethers.parseUnits("100", 6),    // 100 USDT
    ethers.parseUnits("100000", 18) // 100,000 MAGAX
);
await tx.wait();
```

### Configure and Activate Stage

```javascript
// As admin - Configure stage
await presaleContract.configureStage(
    1,                               // Stage 1
    ethers.parseUnits("0.001", 6),  // $0.001 per MAGAX
    ethers.parseUnits("1000000", 18) // 1M MAGAX
);

// Activate the stage
await presaleContract.activateStage(1);
```

### Get User Data

```javascript
// Get user receipts
const receipts = await presaleContract.getUserReceipts(userAddress);

// Get user statistics
const stats = await presaleContract.getUserStats(userAddress);
console.log(`Total spent: ${ethers.formatUnits(stats.totalUSDTSpent, 6)} USDT`);

// Get paginated receipts
const page = await presaleContract.getReceiptsPaginated(userAddress, 0, 10);
```

### Monitor Events

```javascript
// Listen for purchase events
presaleContract.on("PurchaseRecorded", (purchaseId, buyer, usdt, magax, stage, price) => {
    console.log(`Purchase ${purchaseId}: ${buyer} bought ${ethers.formatUnits(magax, 18)} MAGAX`);
});

// Listen for stage changes
presaleContract.on("StageActivated", (stage, price, allocation) => {
    console.log(`Stage ${stage} activated at $${ethers.formatUnits(price, 6)} per token`);
});
```

## Error Handling

```javascript
try {
    const tx = await presaleContract.recordPurchase(buyer, usdtAmount, magaxAmount);
    await tx.wait();
} catch (error) {
    if (error.message.includes('PurchaseLimitExceeded')) {
        console.error('Purchase exceeds limits');
    } else if (error.message.includes('NoActiveStage')) {
        console.error('No presale stage is active');
    } else if (error.message.includes('StageAllocationExceeded')) {
        console.error('Not enough tokens in current stage');
    } else {
        console.error('Transaction failed:', error.message);
    }
}
```

## Gas Optimization Tips

```javascript
// Batch multiple operations
const tx = await presaleContract.connect(admin).multicall([
    presaleContract.interface.encodeFunctionData("configureStage", [1, price1, allocation1]),
    presaleContract.interface.encodeFunctionData("configureStage", [2, price2, allocation2]),
    presaleContract.interface.encodeFunctionData("activateStage", [1])
]);

// Use estimateGas before sending
const gasEstimate = await presaleContract.recordPurchase.estimateGas(buyer, usdt, magax);
const tx = await presaleContract.recordPurchase(buyer, usdt, magax, { gasLimit: gasEstimate });
```

## Security Checklist

### Pre-Transaction

- [ ] Validate all input parameters
- [ ] Check current stage status
- [ ] Verify user purchase limits
- [ ] Estimate gas costs

### Post-Transaction

- [ ] Wait for transaction confirmation
- [ ] Check transaction success
- [ ] Update local state/database
- [ ] Log transaction details

## Testing Snippets

```javascript
// Test environment setup
const [admin, recorder, user1, user2] = await ethers.getSigners();

// Deploy contracts
const Token = await ethers.getContractFactory("MoonShotMAGAX");
const token = await Token.deploy(treasury.address);

const Presale = await ethers.getContractFactory("MAGAXPresaleReceipts");
const presale = await Presale.deploy();

// Grant roles
await presale.grantRole(RECORDER_ROLE, recorder.address);

// Configure test stage
await presale.configureStage(1, ethers.parseUnits("0.001", 6), ethers.parseUnits("1000000", 18));
await presale.activateStage(1);
```

## Useful View Calls

```javascript
// Check if address has role
const hasRecorderRole = await presaleContract.hasRole(RECORDER_ROLE, address);

// Get current stage
const currentStage = await presaleContract.getCurrentStageInfo();

// Get presale statistics
const stats = await presaleContract.getPresaleStats();

// Check contract state
const isPaused = await presaleContract.paused();
```

---

*This quick reference covers the most commonly used functions and patterns for the MoonShot MAGAX presale system.*
