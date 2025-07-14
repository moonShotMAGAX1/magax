# Stage Management Guide

## Overview

The MAGAXPresaleReceipts contract implements a sophisticated 50-stage presale system where each stage can have different pricing, token allocations, and timing. This allows for flexible presale structures like early bird pricing, bulk discounts, or gradual price increases.

## Stage System Architecture

### Stage Lifecycle

Stage Configuration → Stage Activation → Purchase Recording → Stage Completion → Next Stage

### Stage States

1. **Unconfigured**: Stage exists but has no pricing or allocation set
2. **Configured**: Stage has pricing and allocation but is not active
3. **Active**: Stage is currently accepting purchases
4. **Completed**: Stage has sold all allocated tokens
5. **Deactivated**: Stage was manually deactivated by admin

## Stage Configuration

### Setting Up a Stage

Each stage must be configured with three key parameters:

```solidity
function configureStage(
    uint8 stage,           // Stage number (1-50)
    uint128 pricePerToken, // USDT price per MAGAX (6 decimals)
    uint128 tokensAllocated // Total MAGAX tokens for this stage (18 decimals)
) external onlyRole(DEFAULT_ADMIN_ROLE)
```

### Example Stage Configurations

```javascript
// Stage 1: Early Bird - Lowest price, limited allocation
await presaleContract.configureStage(
    1,
    ethers.parseUnits("0.001", 6),    // $0.001 per MAGAX
    ethers.parseUnits("1000000", 18)  // 1M MAGAX tokens
);

// Stage 2: Regular Sale - Higher price, larger allocation
await presaleContract.configureStage(
    2,
    ethers.parseUnits("0.002", 6),    // $0.002 per MAGAX
    ethers.parseUnits("5000000", 18)  // 5M MAGAX tokens
);

// Stage 50: Final Sale - Highest price
await presaleContract.configureStage(
    50,
    ethers.parseUnits("0.01", 6),     // $0.01 per MAGAX
    ethers.parseUnits("500000", 18)   // 500K MAGAX tokens
);
```

## Stage Activation

### Activating a Stage

Only one stage can be active at a time. Activating a new stage automatically deactivates the current stage:

```solidity
function activateStage(uint8 stage) external onlyRole(DEFAULT_ADMIN_ROLE)
```

### Stage Activation Flow

```bash
1. Admin calls activateStage(newStage)
2. Contract deactivates current stage (emits StageDeactivated event)
3. Contract activates new stage (emits StageActivated event)
4. Updates currentStage variable
5. All new purchases use new stage pricing and allocation
```

### Example Stage Activation

```javascript
// Activate stage 1 to start presale
await presaleContract.activateStage(1);

// Later, move to stage 2
await presaleContract.activateStage(2);
```

## Stage Information Retrieval

### Get Specific Stage Info

```solidity
function getStageInfo(uint8 stage) external view returns (
    uint128 pricePerToken,     // Current price per token
    uint128 tokensAllocated,   // Total tokens allocated
    uint128 tokensSold,        // Tokens already sold
    uint128 tokensRemaining,   // Tokens still available
    bool isActive              // Whether stage is active
)
```

### Get Current Active Stage

```solidity
function getCurrentStageInfo() external view returns (
    uint8 stage,               // Current stage number
    uint128 pricePerToken,     // Current price
    uint128 tokensAllocated,   // Total allocation
    uint128 tokensSold,        // Sold amount
    uint128 tokensRemaining,   // Remaining amount
    bool isActive              // Active status
)
```

## Stage-Based Purchase Recording

### How Purchases Work with Stages

When a purchase is recorded, the contract:

1. **Validates Active Stage**: Ensures current stage is active
2. **Checks Token Availability**: Verifies sufficient tokens remain in stage
3. **Records Stage Info**: Stores stage number and price in receipt
4. **Updates Stage Stats**: Increments tokensSold for the stage
5. **Emits Enhanced Event**: Includes stage information in PurchaseRecorded event

### Purchase Receipt with Stage Data

```solidity
struct Receipt {
    uint128 usdt;          // USDT amount paid
    uint128 magax;         // MAGAX tokens received
    uint40  time;          // Purchase timestamp
    uint8   stage;         // Stage when purchased
    uint128 pricePerToken; // Exact price paid per token
}
```

## Stage Management Strategies

### Progressive Pricing Strategy

```javascript
// Early stages: Lower prices to attract early adopters
stages 1-10:  $0.001 - $0.002 per MAGAX
stages 11-25: $0.003 - $0.005 per MAGAX
stages 26-40: $0.006 - $0.008 per MAGAX
stages 41-50: $0.009 - $0.01 per MAGAX
```

### Time-Based Stage Management

```javascript
// Week 1: Activate stages 1-5
// Week 2: Activate stages 6-15
// Week 3: Activate stages 16-30
// Week 4: Activate stages 31-50
```

### Demand-Based Stage Management

```javascript
// Activate next stage when current stage is 80% sold
const stageInfo = await contract.getCurrentStageInfo();
const soldPercentage = (stageInfo.tokensSold * 100) / stageInfo.tokensAllocated;

if (soldPercentage >= 80 && currentStage < 50) {
    await contract.activateStage(currentStage + 1);
}
```

## Events and Monitoring

### Stage-Related Events

```solidity
event StageConfigured(uint8 indexed stage, uint128 pricePerToken, uint128 tokensAllocated);
event StageActivated(uint8 indexed stage);
event StageDeactivated(uint8 indexed stage);
```

### Enhanced Purchase Events

```solidity
event PurchaseRecorded(
    address indexed buyer,
    uint128 usdt,
    uint128 magax,
    uint40 time,
    uint8 stage,              // Stage information
    uint128 pricePerToken,    // Price information
    uint256 totalUserPurchases,
    bool isNewBuyer
);
```

## Security Considerations

### Stage Validation

- **Stage Range**: Only stages 1-50 are valid
- **Configuration Required**: Stages must be configured before activation
- **Token Allocation**: Cannot sell more tokens than allocated to stage
- **Price Validation**: Price must be greater than 0

### Protection Against Manipulation

- **Admin Only**: Only DEFAULT_ADMIN_ROLE can manage stages
- **Atomic Operations**: Stage changes are atomic and emit events
- **Historical Data**: All stage changes are logged and auditable
- **Purchase Integrity**: Stage info in receipts cannot be modified

## Best Practices

### Stage Planning

1. **Plan All Stages**: Configure multiple stages in advance
2. **Monitor Progress**: Track stage completion and user demand
3. **Flexible Activation**: Don't activate too many stages at once
4. **Price Consistency**: Ensure logical price progression

### Operational Guidelines

1. **Test on Testnet**: Always test stage configurations first
2. **Event Monitoring**: Set up monitoring for stage events
3. **User Communication**: Notify users of stage changes
4. **Emergency Planning**: Have plans for emergency stage deactivation

### Integration Tips

1. **Cache Stage Info**: Cache current stage info to reduce RPC calls
2. **Event Listening**: Listen for stage events to update UI immediately
3. **Error Handling**: Handle stage-related errors gracefully
4. **User Experience**: Show stage progress and upcoming changes

## Common Operations

### Complete Stage Setup Flow

```javascript
// 1. Configure multiple stages
for (let i = 1; i <= 10; i++) {
    const price = ethers.parseUnits((0.001 * i).toString(), 6);
    const allocation = ethers.parseUnits("1000000", 18);
    await contract.configureStage(i, price, allocation);
}

// 2. Activate first stage
await contract.activateStage(1);

// 3. Monitor and progress stages as needed
const stageInfo = await contract.getCurrentStageInfo();
console.log(`Current stage: ${stageInfo.stage}, Price: ${stageInfo.pricePerToken}`);
```

### Stage Progression Automation

```javascript
// Example: Auto-progress when stage is 90% complete
async function checkStageProgress() {
    const stageInfo = await contract.getCurrentStageInfo();
    const progressPercentage = (stageInfo.tokensSold * 100n) / stageInfo.tokensAllocated;
    
    if (progressPercentage >= 90n && stageInfo.stage < 50) {
        await contract.activateStage(stageInfo.stage + 1);
        console.log(`Advanced to stage ${stageInfo.stage + 1}`);
    }
}
```

## Next Steps

- **[Function Reference](./function-reference.md)** - Detailed API documentation
- **[Integration Guide](./integration-guide.md)** - Step-by-step integration
- **[Security Features](./security-features.md)** - Security mechanisms and best practices
