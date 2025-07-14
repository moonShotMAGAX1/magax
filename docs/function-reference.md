# Function Reference

## MAGAXPresaleReceipts Contract Functions

Complete API reference for all public and external functions in the MAGAXPresaleReceipts contract.

## Purchase Recording Functions

### recordPurchase

Records a new purchase in the active presale stage.

```solidity
function recordPurchase(
    address buyer,
    uint128 usdtAmount,
    uint128 magaxAmount
) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant
```

**Parameters:**

- `buyer`: Address of the token purchaser
- `usdtAmount`: Amount of USDT paid (6 decimals)
- `magaxAmount`: Amount of MAGAX tokens allocated (18 decimals)

**Requirements:**

- Caller must have RECORDER_ROLE
- Contract must not be paused
- Buyer address cannot be zero
- Amounts must be greater than zero
- USDT amount cannot exceed MAX_PURCHASE_USDT (1M USDT)
- Total USDT cannot exceed MAX_TOTAL_USDT (10M USDT)
- Current stage must be active
- Stage must have sufficient tokens remaining
- Purchase must not be a duplicate

**Events Emitted:**

- `PurchaseRecorded(buyer, usdt, magax, time, stage, pricePerToken, totalUserPurchases, isNewBuyer)`

**Example:**

```javascript
await presaleContract.connect(recorderSigner).recordPurchase(
    "0x742d35C7C8D2eF3Ae4F42F31374c981eA2C47a5F",
    ethers.parseUnits("100", 6),    // 100 USDT
    ethers.parseUnits("1000", 18)   // 1000 MAGAX
);
```

## View Functions - User Data

### getReceipts

Returns all purchase receipts for a specific buyer.

```solidity
function getReceipts(address buyer) external view returns (Receipt[] memory)
```

**Parameters:**

- `buyer`: Address to get receipts for

**Returns:**

- Array of Receipt structs containing purchase history

**Example:**

```javascript
const receipts = await presaleContract.getReceipts("0x742d35C7C8D2eF3Ae4F42F31374c981eA2C47a5F");
console.log(`User has ${receipts.length} purchases`);
```

### getReceiptsPaginated

Returns paginated purchase receipts for users with many purchases.

```solidity
function getReceiptsPaginated(
    address buyer,
    uint256 offset,
    uint256 limit
) external view returns (Receipt[] memory)
```

**Parameters:**

- `buyer`: Address to get receipts for
- `offset`: Starting index (0-based)
- `limit`: Maximum number of receipts to return

**Returns:**

- Array of Receipt structs for the specified range

**Example:**

```javascript
// Get receipts 10-19 (10 receipts starting from index 10)
const receipts = await presaleContract.getReceiptsPaginated(
    "0x742d35C7C8D2eF3Ae4F42F31374c981eA2C47a5F",
    10,
    10
);
```

### getUserStats

Returns comprehensive statistics for a specific user.

```solidity
function getUserStats(address buyer) external view returns (
    uint256 totalPurchases,
    uint128 totalUSDTSpent,
    uint128 totalMAGAXAllocated,
    uint40 firstPurchaseTime,
    uint40 lastPurchaseTime
)
```

**Parameters:**

- `buyer`: Address to get statistics for

**Returns:**

- `totalPurchases`: Number of purchases made
- `totalUSDTSpent`: Total USDT spent
- `totalMAGAXAllocated`: Total MAGAX tokens allocated
- `firstPurchaseTime`: Timestamp of first purchase
- `lastPurchaseTime`: Timestamp of most recent purchase

**Example:**

```javascript
const stats = await presaleContract.getUserStats("0x742d35C7C8D2eF3Ae4F42F31374c981eA2C47a5F");
console.log(`Total spent: ${ethers.formatUnits(stats.totalUSDTSpent, 6)} USDT`);
console.log(`Total allocated: ${ethers.formatUnits(stats.totalMAGAXAllocated, 18)} MAGAX`);
```

## View Functions - Presale Data

### getPresaleStats

Returns overall presale statistics.

```solidity
function getPresaleStats() external view returns (
    uint128 totalUSDTRaised,
    uint128 totalMAGAXSold,
    uint32 totalUniqueBuyers
)
```

**Returns:**

- `totalUSDTRaised`: Total USDT raised across all purchases
- `totalMAGAXSold`: Total MAGAX tokens sold
- `totalUniqueBuyers`: Number of unique buyer addresses

**Example:**

```javascript
const stats = await presaleContract.getPresaleStats();
console.log(`Total raised: $${ethers.formatUnits(stats.totalUSDTRaised, 6)}`);
console.log(`Unique buyers: ${stats.totalUniqueBuyers}`);
```

## Stage Management Functions

### configureStage

Configures a presale stage with pricing and allocation.

```solidity
function configureStage(
    uint8 stage,
    uint128 pricePerToken,
    uint128 tokensAllocated
) external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Parameters:**

- `stage`: Stage number (1-50)
- `pricePerToken`: USDT price per MAGAX token (6 decimals)
- `tokensAllocated`: Total MAGAX tokens for this stage (18 decimals)

**Requirements:**

- Caller must have DEFAULT_ADMIN_ROLE
- Stage must be between 1 and 50
- Price must be greater than 0
- Token allocation must be greater than 0

**Events Emitted:**

- `StageConfigured(stage, pricePerToken, tokensAllocated)`

**Example:**

```javascript
await presaleContract.connect(adminSigner).configureStage(
    1,                                    // Stage 1
    ethers.parseUnits("0.001", 6),       // $0.001 per MAGAX
    ethers.parseUnits("1000000", 18)     // 1M MAGAX tokens
);
```

### activateStage

Activates a specific stage, deactivating the current stage.

```solidity
function activateStage(uint8 stage) external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Parameters:**

- `stage`: Stage number to activate (1-50)

**Requirements:**

- Caller must have DEFAULT_ADMIN_ROLE
- Stage must be between 1 and 50
- Stage must be configured (have token allocation > 0)

**Events Emitted:**

- `StageDeactivated(previousStage)` (if there was an active stage)
- `StageActivated(stage)`

**Example:**

```javascript
await presaleContract.connect(adminSigner).activateStage(2);
```

### getStageInfo

Returns detailed information about a specific stage.

```solidity
function getStageInfo(uint8 stage) external view returns (
    uint128 pricePerToken,
    uint128 tokensAllocated,
    uint128 tokensSold,
    uint128 tokensRemaining,
    bool isActive
)
```

**Parameters:**

- `stage`: Stage number (1-50)

**Returns:**

- `pricePerToken`: USDT price per MAGAX token
- `tokensAllocated`: Total tokens allocated to stage
- `tokensSold`: Tokens sold from this stage
- `tokensRemaining`: Tokens still available in stage
- `isActive`: Whether this stage is currently active

**Example:**

```javascript
const stageInfo = await presaleContract.getStageInfo(1);
console.log(`Stage 1 price: $${ethers.formatUnits(stageInfo.pricePerToken, 6)}`);
console.log(`Remaining: ${ethers.formatUnits(stageInfo.tokensRemaining, 18)} MAGAX`);
```

### getCurrentStageInfo

Returns information about the currently active stage.

```solidity
function getCurrentStageInfo() external view returns (
    uint8 stage,
    uint128 pricePerToken,
    uint128 tokensAllocated,
    uint128 tokensSold,
    uint128 tokensRemaining,
    bool isActive
)
```

**Returns:**

- `stage`: Current stage number
- `pricePerToken`: Current price per token
- `tokensAllocated`: Total tokens allocated to current stage
- `tokensSold`: Tokens sold from current stage
- `tokensRemaining`: Tokens remaining in current stage
- `isActive`: Whether current stage is active

**Example:**

```javascript
const currentStage = await presaleContract.getCurrentStageInfo();
console.log(`Current stage: ${currentStage.stage}`);
console.log(`Current price: $${ethers.formatUnits(currentStage.pricePerToken, 6)}`);
```

## Admin Functions

### pause

Pauses all purchase recording operations.

```solidity
function pause() external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Requirements:**

- Caller must have DEFAULT_ADMIN_ROLE

**Effect:**

- Blocks all calls to `recordPurchase()`
- Other view functions remain available

**Example:**

```javascript
await presaleContract.connect(adminSigner).pause();
```

### unpause

Resumes purchase recording operations.

```solidity
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Requirements:**

- Caller must have DEFAULT_ADMIN_ROLE

**Example:**

```javascript
await presaleContract.connect(adminSigner).unpause();
```

### emergencyTokenWithdraw

Withdraws accidentally sent ERC-20 tokens from the contract.

```solidity
function emergencyTokenWithdraw(IERC20 token, address to) external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Parameters:**

- `token`: ERC-20 token contract address
- `to`: Recipient address for withdrawn tokens

**Requirements:**

- Caller must have DEFAULT_ADMIN_ROLE
- Recipient address cannot be zero
- Contract must have token balance > 0

**Events Emitted:**

- `EmergencyTokenWithdraw(token, to, amount)`

**Example:**

```javascript
await presaleContract.connect(adminSigner).emergencyTokenWithdraw(
    "0xA0b86a33E6472e9E79584ac24f02e5cA6DC35D67", // Token address
    "0x742d35C7C8D2eF3Ae4F42F31374c981eA2C47a5F"  // Recovery address
);
```

## Access Control Functions

The contract inherits from OpenZeppelin's AccessControl, providing standard role management functions:

### hasRole

```solidity
function hasRole(bytes32 role, address account) public view returns (bool)
```

### grantRole

```solidity
function grantRole(bytes32 role, address account) public onlyRole(getRoleAdmin(role))
```

### revokeRole

```solidity
function revokeRole(bytes32 role, address account) public onlyRole(getRoleAdmin(role))
```

### renounceRole

```solidity
function renounceRole(bytes32 role, address account) public
```

## Constants

### Role Identifiers

```solidity
bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00; // Inherited from AccessControl
```

### Purchase Limits

```solidity
uint128 public constant MAX_PURCHASE_USDT = 1000000 * 1e6; // 1M USDT
uint128 public constant MAX_TOTAL_USDT = 10000000 * 1e6;   // 10M USDT
uint8 public constant MAX_STAGES = 50;                     // 50 stages
```

## Public State Variables

### User Data

```solidity
mapping(address => Receipt[]) public userReceipts;
mapping(address => uint128) public userTotalUSDT;
mapping(address => uint128) public userTotalMAGAX;
```

### Stage Data

```solidity
mapping(uint8 => StageInfo) public stages;
uint8 public currentStage;
```

### Global Statistics

```solidity
uint128 public totalUSDT;
uint128 public totalMAGAX;
uint32 public totalBuyers;
uint256 public purchaseCounter;
```

### Security

```solidity
mapping(bytes32 => bool) public purchaseHashes;
```

## Data Structures

### Receipt

```solidity
struct Receipt {
    uint128 usdt;          // USDT amount (6 decimals)
    uint128 magax;         // MAGAX amount (18 decimals)
    uint40  time;          // Timestamp
    uint8   stage;         // Stage number (1-50)
    uint128 pricePerToken; // Price per token (6 decimals)
}
```

### StageInfo

```solidity
struct StageInfo {
    uint128 pricePerToken;    // USDT per MAGAX (6 decimals)
    uint128 tokensAllocated;  // Total tokens for stage
    uint128 tokensSold;       // Tokens sold from stage
    bool isActive;            // Whether stage is active
}
```

## Next Steps

- **[Event Reference](./event-reference.md)** - All contract events
- **[Error Reference](./error-reference.md)** - Custom errors and troubleshooting
- **[Integration Guide](./integration-guide.md)** - Implementation examples
