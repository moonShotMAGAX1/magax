# Security Features

The MoonShot MAGAX presale system implements multiple layers of security to protect against common smart contract vulnerabilities and ensure safe operation.

## Access Control Architecture

### Role-Based Access Control (RBAC)

The contract uses OpenZeppelin's AccessControl for secure permission management:

```solidity
bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
```

**Role Separation:**

- **DEFAULT_ADMIN_ROLE**: Full administrative control
  - Configure presale stages
  - Activate/deactivate stages
  - Pause/unpause contract
  - Emergency token withdrawal
  - Manage other roles

- **RECORDER_ROLE**: Limited purchase recording access
  - Record validated purchases only
  - Cannot modify contract settings
  - Typically assigned to backend service

### Best Practices for Role Management

```javascript
// Secure role assignment
async function setupRoles(contract, adminSigner) {
    // Use multisig wallet for admin role in production
    const multisigAddress = "0x...";
    
    // Grant admin role to multisig
    await contract.connect(adminSigner).grantRole(
        await contract.DEFAULT_ADMIN_ROLE(),
        multisigAddress
    );
    
    // Assign recorder role to backend service
    const backendAddress = "0x...";
    await contract.connect(adminSigner).grantRole(
        await contract.RECORDER_ROLE(),
        backendAddress
    );
    
    // Revoke admin role from deployer (optional)
    await contract.connect(adminSigner).renounceRole(
        await contract.DEFAULT_ADMIN_ROLE(),
        adminSigner.address
    );
}
```

## Purchase Limits and Validation

### Multi-Layer Limit System

The contract enforces three types of limits to prevent abuse:

#### 1. Individual Purchase Limits

```solidity
uint128 public constant MAX_PURCHASE_USDT = 1000000 * 1e6; // 1M USDT max per transaction
```

#### 2. Total Presale Limits

```solidity
uint128 public constant MAX_TOTAL_USDT = 10000000 * 1e6; // 10M USDT total cap
```

#### 3. Stage Token Limits

```solidity
if (stages[currentStage].tokensSold + magaxAmount > stages[currentStage].tokensAllocated) {
    revert InsufficientStageTokens();
}
```

### Input Validation

All user inputs are thoroughly validated:

```solidity
function recordPurchase(
    address buyer,
    uint128 usdtAmount, 
    uint128 magaxAmount
) external {
    // Address validation
    if (buyer == address(0)) revert InvalidAddress();
    
    // Amount validation
    if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
    
    // Purchase limits
    if (usdtAmount > MAX_PURCHASE_USDT) revert ExceedsMaxPurchase();
    if (totalUSDT + usdtAmount > MAX_TOTAL_USDT) revert ExceedsTotalLimit();
    
    // Stage validation
    if (currentStage == 0 || currentStage > MAX_STAGES) revert InvalidStage();
    if (!stages[currentStage].isActive) revert StageNotActive();
}
```

## Anti-Fraud Mechanisms

### Duplicate Purchase Prevention

The contract prevents duplicate purchases using cryptographic hashing:

```solidity
// Generate unique purchase hash
bytes32 purchaseHash = keccak256(abi.encode(
    buyer, 
    usdtAmount, 
    magaxAmount, 
    block.timestamp, 
    purchaseCounter
));

// Check for duplicates
if (purchaseHashes[purchaseHash]) revert DuplicatePurchase();
purchaseHashes[purchaseHash] = true;
```

**Hash Components:**

- Buyer address
- USDT amount
- MAGAX amount
- Block timestamp
- Purchase counter (unique incrementing ID)

### Purchase Counter System

Each purchase gets a unique ID to prevent replay attacks:

```solidity
uint256 public purchaseCounter;

// Incremented after each successful purchase
purchaseCounter++;
```

## Reentrancy Protection

### OpenZeppelin ReentrancyGuard

All state-changing functions are protected against reentrancy attacks:

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MAGAXPresaleReceipts is ReentrancyGuard {
    function recordPurchase(...) external nonReentrant {
        // Safe from reentrancy attacks
    }
}
```

### State Update Patterns

The contract follows the "Checks-Effects-Interactions" pattern:

```solidity
function recordPurchase(...) external {
    // 1. CHECKS: Validate all inputs and conditions
    if (buyer == address(0)) revert InvalidAddress();
    if (!stages[currentStage].isActive) revert StageNotActive();
    
    // 2. EFFECTS: Update contract state
    userReceipts[buyer].push(Receipt(...));
    totalUSDT += usdtAmount;
    stages[currentStage].tokensSold += magaxAmount;
    
    // 3. INTERACTIONS: Emit events (external notifications)
    emit PurchaseRecorded(...);
}
```

## Emergency Controls

### Pausable Operations

The contract can be paused in emergency situations:

```solidity
import "@openzeppelin/contracts/utils/Pausable.sol";

function recordPurchase(...) external whenNotPaused {
    // Function blocked when contract is paused
}

function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
}

function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
}
```

**Pause Scenarios:**

- Security vulnerability discovered
- Suspicious activity detected
- Emergency maintenance required
- Regulatory compliance needs

### Emergency Token Recovery

Accidentally sent tokens can be recovered by admin:

```solidity
function emergencyTokenWithdraw(IERC20 token, address to) 
    external onlyRole(DEFAULT_ADMIN_ROLE) {
    
    if (to == address(0)) revert InvalidAddress();
    
    uint256 balance = token.balanceOf(address(this));
    if (balance == 0) revert NoTokensToWithdraw();
    
    token.transfer(to, balance);
    emit EmergencyTokenWithdraw(address(token), to, balance);
}
```

## Gas Optimization Security

### Custom Errors for Efficiency

Gas-efficient error handling reduces attack surface:

```solidity
// Custom errors instead of string reverts
error InvalidAddress();
error InvalidAmount(); 
error ExceedsMaxPurchase();
error InsufficientStageTokens();

// Usage
if (buyer == address(0)) revert InvalidAddress();
```

**Benefits:**

- Lower gas costs reduce economic attack vectors
- Consistent error handling across contract
- Better developer experience

### Storage Optimization

Efficient storage patterns prevent gas griefing:

```solidity
// Packed struct saves storage slots
struct Receipt {
    uint128 usdt;          // 16 bytes
    uint128 magax;         // 16 bytes  
    uint40  time;          // 5 bytes
    uint8   stage;         // 1 byte
    uint128 pricePerToken; // 16 bytes
}
// Total: 58 bytes (2 storage slots)
```

## Denial of Service Protection

### Bounded Operations

All loops and operations have clear bounds:

```solidity
// Maximum 50 stages prevents infinite loops
uint8 public constant MAX_STAGES = 50;

// Paginated receipt retrieval prevents gas limit issues
function getReceiptsPaginated(
    address buyer,
    uint256 offset, 
    uint256 limit
) external view returns (Receipt[] memory) {
    // Bounded operation with offset and limit
}
```

### Event Log Protection

Events are designed to prevent log spam:

```solidity
event PurchaseRecorded(
    address indexed buyer,     // Indexed for efficient filtering
    uint128 usdt,             // Essential data only
    uint128 magax,
    uint40  time,
    uint8   stage,
    uint128 pricePerToken,
    uint256 totalUserPurchases,
    bool isNewBuyer
);
// No unbounded arrays or large data structures
```

## Frontend Security Integration

### Secure Contract Interaction

```javascript
class SecurePresaleInterface {
    constructor(contractAddress, abi, provider) {
        this.contract = new ethers.Contract(contractAddress, abi, provider);
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }
    
    async safeContractCall(methodName, params = [], retries = 0) {
        try {
            return await this.contract[methodName](...params);
        } catch (error) {
            console.error(`Contract call failed: ${methodName}`, error);
            
            // Retry logic for network issues
            if (retries < this.maxRetries && this.isRetryableError(error)) {
                await this.delay(this.retryDelay * (retries + 1));
                return this.safeContractCall(methodName, params, retries + 1);
            }
            
            throw this.handleContractError(error);
        }
    }
    
    isRetryableError(error) {
        const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'];
        return retryableCodes.includes(error.code);
    }
    
    handleContractError(error) {
        // Convert contract errors to user-friendly messages
        const errorMap = {
            'ExceedsMaxPurchase()': 'Purchase amount too large',
            'InsufficientStageTokens()': 'Not enough tokens in current stage',
            'StageNotActive()': 'Current stage is not active'
        };
        
        const friendlyMessage = errorMap[error.reason] || error.message;
        return new Error(friendlyMessage);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Input Sanitization

```javascript
function validatePurchaseInputs(buyerAddress, usdtAmount, magaxAmount) {
    // Address validation
    if (!ethers.isAddress(buyerAddress)) {
        throw new Error('Invalid buyer address');
    }
    
    // Amount validation
    if (isNaN(usdtAmount) || usdtAmount <= 0) {
        throw new Error('Invalid USDT amount');
    }
    
    if (isNaN(magaxAmount) || magaxAmount <= 0) {
        throw new Error('Invalid MAGAX amount');
    }
    
    // Reasonable limits check
    const maxUSDT = 1000000; // 1M USDT
    if (usdtAmount > maxUSDT) {
        throw new Error(`USDT amount exceeds maximum of ${maxUSDT}`);
    }
    
    return true;
}
```

## Monitoring and Alerting

### Security Event Monitoring

```javascript
class SecurityMonitor {
    constructor(contract) {
        this.contract = contract;
        this.alertThresholds = {
            largePurchase: ethers.parseUnits("100000", 6), // 100K USDT
            rapidPurchases: 5, // 5 purchases in 1 minute
            suspiciousPatterns: 10 // 10 similar purchases
        };
    }
    
    startMonitoring() {
        // Monitor large purchases
        this.contract.on('PurchaseRecorded', (buyer, usdt, magax, time, stage, price, total, isNew, event) => {
            if (usdt >= this.alertThresholds.largePurchase) {
                this.sendAlert('LARGE_PURCHASE', {
                    buyer,
                    amount: ethers.formatUnits(usdt, 6),
                    txHash: event.transactionHash
                });
            }
        });
        
        // Monitor stage changes
        this.contract.on('StageActivated', (stage, event) => {
            this.sendAlert('STAGE_CHANGE', {
                newStage: stage,
                txHash: event.transactionHash
            });
        });
        
        // Monitor emergency actions
        this.contract.on('EmergencyTokenWithdraw', (token, to, amount, event) => {
            this.sendAlert('EMERGENCY_WITHDRAWAL', {
                token,
                recipient: to,
                amount: amount.toString(),
                txHash: event.transactionHash
            });
        });
    }
    
    sendAlert(type, data) {
        console.log(`SECURITY ALERT: ${type}`, data);
        // Integrate with monitoring system (Slack, Discord, email, etc.)
    }
}
```

## Audit Preparation

### Security Checklist

- [ ] **Access Control**: Roles properly configured and tested
- [ ] **Input Validation**: All inputs validated and sanitized
- [ ] **Reentrancy**: All state changes protected with nonReentrant
- [ ] **Integer Overflow**: Using Solidity 0.8+ built-in protection
- [ ] **Gas Limits**: All operations bounded and efficient
- [ ] **Emergency Controls**: Pause and recovery mechanisms tested
- [ ] **Event Logging**: Comprehensive event coverage for monitoring
- [ ] **Error Handling**: Consistent custom error usage
- [ ] **Documentation**: Complete documentation and comments

### Common Vulnerability Checks

#### 1. Reentrancy

```solidity
// ✅ GOOD: Protected with nonReentrant
function recordPurchase(...) external nonReentrant {
    // State changes before external calls
}

// ❌ BAD: No reentrancy protection
function badFunction() external {
    externalContract.call();
    balance += amount; // Vulnerable to reentrancy
}
```

#### 2. Access Control

```solidity
// ✅ GOOD: Role-based access control
function configureStage(...) external onlyRole(DEFAULT_ADMIN_ROLE) {
    // Only admin can configure stages
}

// ❌ BAD: Missing access control
function badConfigureStage(...) external {
    // Anyone can call this function
}
```

#### 3. Input Validation

```solidity
// ✅ GOOD: Comprehensive validation
function recordPurchase(address buyer, uint128 amount) external {
    if (buyer == address(0)) revert InvalidAddress();
    if (amount == 0) revert InvalidAmount();
    // Function logic
}

// ❌ BAD: No input validation
function badRecordPurchase(address buyer, uint128 amount) external {
    // No validation - vulnerable to invalid inputs
}
```

## Production Security Practices

### Deployment Security

```javascript
// Secure deployment script
async function deploySecurely() {
    // Use hardware wallet or secure key management
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
    
    // Deploy with constructor validation
    const presaleContract = await deployContract("MAGAXPresaleReceipts", [
        recorderAddress  // Validate this address
    ]);
    
    // Verify deployment
    await verifyContract(presaleContract.address);
    
    // Setup initial security configuration
    await setupInitialSecurity(presaleContract);
    
    return presaleContract;
}
```

### Ongoing Security Maintenance

1. **Regular Monitoring**: Continuous event monitoring and alerting
2. **Access Review**: Periodic review of role assignments
3. **Upgrade Planning**: Prepare for potential security upgrades
4. **Incident Response**: Clear procedures for security incidents
5. **Community Reporting**: Bug bounty program for vulnerability disclosure

## Next Steps

- **[Event Reference](./event-reference.md)** - All contract events for monitoring
- **[Error Reference](./error-reference.md)** - Error handling and troubleshooting
- **[Integration Guide](./integration-guide.md)** - Secure integration practices
