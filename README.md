# MoonShot MAGAX

## Token Details

- **Token Name:** MoonShot MAGAX

Complete ecosystem for the MoonShot MAGAX token, including the ERC-20 token contract and presale receipt tracking system. Built using Solidity and deployed via Hardhat with enhanced security features.

---

## Project Overview

This project consists of two main smart contracts:

### 1. **MoonShotMAGAX Token**

- ERC-20 token with fixed supply
- Standard token functionality

### 2. **MAGAXPresaleReceipts**

- On-chain presale tracking system with multi-signature security
- Records purchase receipts for transparency
- Advanced role-based access control
- Multi-signature protection for critical operations

---

## 🪙 Token Details

- **Token Name:** MoonShot MagaX
- **Symbol:** MAGAX
- **Decimals:** 18
- **Total Supply:** 1,000,000,000,000 MAGAX (1 Trillion)

---

## 🔐 Enhanced Security Features

### Multi-Signature Protection

- **2-of-N confirmation** system for sensitive functions
- **Operation proposal** and confirmation workflow
- **Transparent operation tracking** with events

### Role-Based Access Control

- **`RECORDER_ROLE`**: Purchase recording and promo/referral distributions
- **`STAGE_MANAGER_ROLE`**: Stage configuration and activation
- **`EMERGENCY_ROLE`**: Emergency token withdrawal functions
- **`FINALIZER_ROLE`**: Presale finalization (requires multi-sig)
- **`DEFAULT_ADMIN_ROLE`**: Core admin functions and role management

### Protected Operations

The following critical functions require multi-signature confirmation:

- `finalise()` - Finalizing the presale
- `setMaxPromoBps()` - Changing promotional bonus limits
- `emergencyTokenWithdraw()` - Emergency token recovery

---

## Presale System

The presale receipt system provides:

- **Transparent tracking** of all presale purchases
- **On-chain receipts** showing USDT paid and MAGAX allocated
- **Enhanced role-based security** with separated roles for different functions
- **Multi-signature protection** for critical administrative functions
- **Pausable functionality** for emergency control
- **Multi-purchase support** per buyer
- **50-stage presale system** with configurable pricing (stages configured as needed)
- **Referral program** with 7% referrer and 5% referee bonuses
- **Promotional bonus system** with configurable bonus percentages (up to 50%)
- **Manual stage transitions** for precise admin control
- **Comprehensive edge case handling** and audit-ready security

### Key Features

- Records USDT amount (6 decimals) and MAGAX amount (18 decimals)
- Timestamp tracking for each purchase
- Total supply tracking (totalUSDT & totalMAGAX)
- Enhanced multi-role access control system
- Multi-signature protection for critical operations
- Emergency pause/unpause functionality

---

## 🔒 Multi-Signature Workflow

### How Multi-Sig Operations Work

1. **Proposal Phase**: First authorized user calls the protected function
   - Operation is proposed and logged with `OperationProposed` event
   - Transaction reverts with "Operation proposed - requires additional confirmation"

2. **Confirmation Phase**: Second authorized user calls the same function
   - System confirms the operation and logs `OperationConfirmed` event
   - If enough confirmations (2), operation executes successfully

3. **Execution**: Operation runs and logs `OperationExecuted` event

### Example: Finalizing Presale

```javascript
// Admin 1 proposes finalization
await contract.connect(admin1).finalise();
// → Emits: OperationProposed(hash, admin1, "FINALIZE_PRESALE")
// → Reverts: "Operation proposed - requires additional confirmation"

// Admin 2 confirms and executes
await contract.connect(admin2).finalise();
// → Emits: OperationConfirmed(hash, admin2, 2)
// → Emits: OperationExecuted(hash, admin2)
// → Executes: Presale finalized successfully
```

### Checking Operation Status

```javascript
const operationHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encodePacked(
    ["string", "uint256"], 
    ["FINALIZE_PRESALE", Math.floor(Date.now() / 3600000)]
  )
);

const [confirmations, isConfirmed] = await contract.getOperationStatus(operationHash);
console.log(`Confirmations: ${confirmations}, You confirmed: ${isConfirmed}`);
```

---

## ⚙️ Setup & Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment template and fill in your values:

```bash
cp env.example .env
```

Required environment variables:

```env
# Ethereum (Token Deployment)
PRIVATE_KEY=your_ethereum_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id
TREASURY_ADDRESS=0xYourTreasuryWalletAddress

# Polygon (Presale Deployment)  
POLYGON_DEPLOYER_PRIVATE_KEY=your_polygon_private_key
POLYGON_RPC_URL=https://polygon-amoy.infura.io/v3/your_project_id
RECORDER_ADDRESS=0xYourRecorderWalletAddress

# Contract Verification
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

### 3. Compile Contracts

```bash
npx hardhat compile
```

### 4. Run Tests

```bash
# Run all tests (92 comprehensive tests)
npx hardhat test

# Run only referral system tests
npx hardhat test --grep "Referral System"

# Run stage rollover tests
npx hardhat test --grep "Stage Rollover"

# Run edge case tests
npx hardhat test --grep "Edge Cases"
```

### 5. Deploy Contracts

**Unified Deployment Script** - automatically detects network and deploys appropriate contract:

```bash
# Deploy Token on Ethereum networks
TREASURY_ADDRESS=0x... npx hardhat run scripts/deploy.js --network sepolia
TREASURY_ADDRESS=0x... npx hardhat run scripts/deploy.js --network mainnet

# Deploy Presale on Polygon networks  
RECORDER_ADDRESS=0x... npx hardhat run scripts/deploy.js --network amoy
RECORDER_ADDRESS=0x... npx hardhat run scripts/deploy.js --network polygon
```

**Features:**

- ✅ Auto-detects network type (Ethereum vs Polygon)
- ✅ Configures Stage 1 automatically (additional stages added as needed)
- ✅ Sets up roles and permissions
- ✅ Activates Stage 1 automatically
- ✅ Verifies contracts on block explorers
- ✅ Saves deployment artifacts

### 6. Contract Verification

Contracts are automatically verified during deployment. If verification fails, you can manually verify:

```bash
# Verify Token on Ethereum
npx hardhat verify --network sepolia <TOKEN_ADDRESS> "<TREASURY_ADDRESS>"

# Verify Presale on Polygon  
npx hardhat verify --network amoy <PRESALE_ADDRESS> "<RECORDER_ADDRESS>"
```

### 7. Configure Additional Stages (Optional)

The deployment script only configures Stage 1. To add more stages as your presale progresses:

```javascript
// Example: Configure Stage 2 (admin only)
await presaleContract.configureStage(
    2,                                    // Stage number
    ethers.parseUnits("0.000293", 6),    // $0.000293 per MAGAX (Stage 2 price)
    ethers.parseUnits("210400000", 18)   // 210.4M MAGAX allocation (Stage 2)
);

// Activate Stage 2 when Stage 1 is complete
await presaleContract.activateStage(2);
```

**Benefits of this approach:**

- ✅ Lower deployment gas costs
- ✅ Flexible stage management
- ✅ Configure stages based on market conditions
- ✅ Reduced contract initialization complexity

**Verification Links:**

- Ethereum: Etherscan
- Polygon: PolygonScan + Sourcify

---

## 🧪 Testing

The project includes comprehensive tests covering:

- Contract deployment and initialization
- Purchase recording functionality  
- Access control and security
- Pause/unpause mechanisms
- Edge cases and error handling
- **Stage rollover functionality** with manual transitions
- **Referral system** with bonus calculations
- **Price validation** with rounding tolerance
- **Audit-ready security measures**

### Test Categories

#### Core Functionality (45+ tests)

- Contract deployment and configuration
- Purchase recording with validation
- Role-based access control
- Emergency pause/unpause

#### Referral System (8 tests)

- Referral bonus calculations (7% referrer, 5% referee)
- Referral relationship management
- Edge cases and validation

#### Promotional System (6 tests)

- Promotional bonus calculations with configurable rates
- Bonus percentage validation (0-50% limits)
- Promo purchase recording and verification
- Edge cases and security validation

#### Stage Management (11 tests)

- Manual stage transitions
- Stage completion detection
- Price enforcement across rollovers
- Multi-stage referral tracking

#### Edge Cases (20+ tests)

- Price tolerance validation
- Maximum purchase limit
- Stage allocation boundaries
- Overflow protection

#### Security & Audit (10+ tests)

- Reentrancy protection
- Overflow prevention
- Event emission verification
- Role security validation

Run all tests:

```bash
npx hardhat test
```

---

## 🔐 Security Features

### Access Control Roles

- **DEFAULT_ADMIN_ROLE**: Can pause/unpause contract, grant/revoke roles
- **RECORDER_ROLE**: Can record presale purchases (typically backend or multisig)

### Security Measures

- Role-based access control using OpenZeppelin
- Pausable functionality for emergency stops
- Input validation and proper event emission
- Comprehensive test coverage
- **Reentrancy protection** on all state-changing functions
- **Overflow-safe arithmetic** with 256-bit calculations
- **Price validation** with ±1 USDT tolerance for rounding
- **Manual stage transitions** for precise admin control
- **Enhanced finalization** with automatic pause protection
- **Audit-ready event emissions** with indexed fields

---

## 🛡️ Recent Security Enhancements

### Audit Fixes Implemented

1. **Enhanced Reentrancy Protection**
   - Added `nonReentrant` to `recordPurchaseWithReferral`
   - Symmetrical protection across all purchase methods

2. **Overflow Prevention**
   - Fixed price validation to use 256-bit arithmetic
   - Prevents silent overflow with large input values

3. **Enhanced Finalization**
   - `finalise()` now automatically pauses contract
   - Prevents accidental RECORDER_ROLE activity after finalization

4. **Improved Analytics**
   - Added indexed buyer field to `ReferralBonusAwarded` event
   - Better event filtering and tracking capabilities

5. **Gas Optimization**
   - Optimized `ReferralInfo.totalReferrals` from uint128 to uint32
   - Reduced storage costs while maintaining sufficient capacity

6. **Documentation Updates**
   - Updated price tolerance comments for clarity
   - Added NatSpec for manual stage management design

### Production Readiness

- ✅ **Comprehensive Testing**: 90+ tests covering all scenarios
- ✅ **Audit Fixes**: All security recommendations implemented
- ✅ **Gas Optimized**: Efficient storage and computation
- ✅ **Event Monitoring**: Complete audit trail with indexed events
- ✅ **Manual Control**: Intentional design for maximum admin flexibility
- ✅ **Edge Case Handling**: Robust validation and error handling

---

## 📁 Project Structure

```text
magax/
├── contracts/
│   ├── MoonShotMAGAX.sol            # ERC-20 token contract
│   └── PreSaleOnChain.sol           # Presale receipt tracking
├── scripts/
│   └── deploy.js                    # Unified deployment script
├── test/
│   └── MAGAXPresaleReceipts.test.js # Comprehensive test suite (90+ tests)
├── docs/
│   ├── deployment-guide.md          # Deployment documentation
│   └── DOCUMENTATION_SUMMARY.md     # Project documentation summary
├── deployments/                     # Auto-generated deployment artifacts
├── .github/workflows/               # CI/CD automation
├── hardhat.config.js                # Hardhat configuration
├── package.json                     # Dependencies and scripts
├── .env                             # Environment variables (not committed)
├── env.example                      # Environment template
```

---

## Usage Example

### Recording a Presale Purchase

```solidity
// Only addresses with RECORDER_ROLE can call this
presaleReceipts.recordPurchase(
    buyerAddress,           // Buyer's wallet address
    100000000,              // 100 USDT (6 decimals)
    1000000000000000000000  // 1000 MAGAX (18 decimals)
);
```

### Viewing Purchase History

```solidity
// Anyone can view receipts using the public mapping
Receipt[] memory receipts = presaleReceipts.userReceipts(buyerAddress);

// Paginated view for users with many purchases  
Receipt[] memory page = presaleReceipts.getReceiptsPaginated(buyerAddress, 0, 50);
```

### Stage Management

```solidity
// Configure a new stage (STAGE_MANAGER_ROLE only)
presaleReceipts.configureStage(
    2,                    // Stage number
    2000,                 // Price: 0.002 USDT per MAGAX (6 decimals)
    ethers.parseUnits("1000000", 18)  // 1M MAGAX allocation
);

// Manually activate stage (STAGE_MANAGER_ROLE only)
presaleReceipts.activateStage(2);

// Get current stage information
(uint8 stage, uint128 price, uint128 allocated, uint128 sold, uint128 remaining, bool active) 
    = presaleReceipts.getCurrentStageInfo();
```

### Referral Purchases

```solidity
// Record purchase with referral bonuses
presaleReceipts.recordPurchaseWithReferral(
    buyerAddress,    // Buyer (gets 5% bonus)
    usdtAmount,      // USDT paid
    magaxAmount,     // Base MAGAX amount
    referrerAddress  // Referrer (gets 7% bonus)
);
```

### Promotional Purchases

```solidity
// Record purchase with promotional bonus
presaleReceipts.recordPurchaseWithPromo(
    buyerAddress,    // Buyer
    usdtAmount,      // USDT paid
    magaxAmount,     // Base MAGAX amount
    promoBps         // Promo bonus in basis points (e.g., 1500 = 15%)
);
```

**Promo System Features:**

- **Configurable bonuses**: 0% to 50% (0-5000 basis points)
- **Flexible promotions**: Different bonus rates for different campaigns
- **Admin control**: Only RECORDER_ROLE can set promo rates
- **Validation**: Built-in limits prevent excessive bonuses

### Role Management

```solidity
// Grant roles (DEFAULT_ADMIN_ROLE required)
presaleReceipts.grantRole(RECORDER_ROLE, recorderAddress);
presaleReceipts.grantRole(STAGE_MANAGER_ROLE, stageManagerAddress);
presaleReceipts.grantRole(EMERGENCY_ROLE, emergencyAddress);
presaleReceipts.grantRole(FINALIZER_ROLE, finalizerAddress);

// Check role membership
bool hasRole = presaleReceipts.hasRole(RECORDER_ROLE, userAddress);

// Revoke roles
presaleReceipts.revokeRole(RECORDER_ROLE, oldRecorderAddress);
```

### Multi-Signature Operations

```solidity
// Example: Emergency token withdrawal (requires 2 confirmations)

// First admin proposes
await presaleReceipts.connect(admin1).emergencyTokenWithdraw(tokenAddress, recipientAddress);
// → Reverts with "Operation proposed - requires additional confirmation"

// Second admin confirms and executes
await presaleReceipts.connect(admin2).emergencyTokenWithdraw(tokenAddress, recipientAddress);
// → Executes successfully
```

---

## Gas Usage

| Function | Gas Usage | Notes |
|----------|-----------|-------|
| Deploy Token | ~1.2M gas | MoonShotMAGAX on Ethereum |
| Deploy Presale | ~2.1M gas | MAGAXPresaleReceipts on Polygon |
| Record Purchase | ~85k-170k gas | Varies with stage configuration |
| Record Referral Purchase | ~120k-200k gas | Includes bonus calculations |
| Record Promo Purchase | ~90k-180k gas | Includes promotional bonus |
| Configure Stage | ~45k gas | One-time per stage |
| Activate Stage | ~30k gas | Manual stage transitions |
| Pause/Unpause | ~25k-47k gas | Emergency controls |

### ⚠️ Gas Considerations for Dynamic Arrays

The `userReceipts` mapping stores dynamic arrays that can grow without bound as users make multiple purchases. Key considerations:

- **Pagination**: Use `getReceiptsPaginated()` for users with many purchases to avoid gas limit issues
- **Recommended Limits**: Consider implementing per-user purchase frequency limits in your frontend/backend
- **Gas Cost Growth**: Each additional receipt increases gas costs for array operations
- **Best Practice**: For high-frequency users, consider batching multiple small purchases into larger ones

**Frontend Integration**: Always use pagination when displaying user purchase history for accounts with >100 purchases.

---

## 📊 Event Monitoring for Auditors

### Role Management Events

The contract emits automatic OpenZeppelin events for role management that auditors should monitor:

#### `RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)`

- **Purpose**: Tracks when the admin role for a specific role is changed
- **Monitoring**: Critical for security audits - watch for unexpected admin role changes
- **Tools**: View in Tenderly, PolygonScan, or Ethereum explorers
- **Security**: Ensures transparency in role hierarchy modifications

#### `RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)`

- **Purpose**: Tracks when roles are granted to addresses
- **Monitoring**: Monitor RECORDER_ROLE and DEFAULT_ADMIN_ROLE grants

#### `RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)`  

- **Purpose**: Tracks when roles are revoked from addresses
- **Monitoring**: Important for access control audit trail

### Presale Stage Events

#### `StageActivated(uint8 indexed stage, address indexed operator)`

- **Purpose**: Tracks presale stage transitions with the operator who made the change
- **Monitoring**: Critical for post-mortems and stage management audit
- **Parameters**:
  - `stage`: The stage number that was activated (1-50)
  - `operator`: The address that activated the stage (must have DEFAULT_ADMIN_ROLE)
- **Use Cases**:
  - Verify proper stage progression
  - Identify who activated each stage for accountability
  - Timeline analysis for presale phases

#### `StageConfigured(uint8 indexed stage, uint128 pricePerToken, uint128 tokensAllocated)`

- **Purpose**: Tracks when stages are configured with pricing and allocation
- **Monitoring**: Verify stage parameters match intended presale design

#### `StageCompleted(uint8 indexed stage, uint128 tokensSold)`

- **Purpose**: Automatic event when a stage sells out completely
- **Monitoring**: Track presale progression and success metrics

### Purchase Tracking Events

#### `PurchaseRecorded(address indexed buyer, uint128 usdt, uint128 magax, uint40 time, uint8 indexed stage, uint256 totalUserPurchases, bool isNewBuyer)`

- **Purpose**: Comprehensive purchase tracking
- **Monitoring**: Primary event for purchase analytics and verification

#### `ReferralBonusAwarded(address indexed referrer, address indexed referee, uint128 referrerBonus, uint128 refereeBonus, uint8 stage)`

- **Purpose**: Tracks referral bonus distributions
- **Edge Case Handling**: Referrer subsequent purchases don't double-count bonuses

#### `PromoBonusAwarded(address indexed buyer, uint128 baseAmount, uint128 bonusAmount, uint16 promoBps, uint8 stage)`

- **Purpose**: Tracks promotional bonus distributions
- **Monitoring**: Verify promotional bonuses are correctly calculated and awarded
- **Parameters**:
  - `buyer`: Address receiving the promotional bonus
  - `baseAmount`: Original MAGAX amount purchased
  - `bonusAmount`: Additional MAGAX tokens from promotion
  - `promoBps`: Promotional bonus percentage in basis points
  - `stage`: Stage where the promotional purchase occurred

### Emergency Events

#### `Paused(address account)` / `Unpaused(address account)`

- **Purpose**: OpenZeppelin pausable events
- **Monitoring**: Track emergency pause/unpause actions

### Audit Monitoring Setup

```solidity
// Example event filter for Tenderly/Ethers.js monitoring
const eventFilters = {
  roleChanges: contract.filters.RoleAdminChanged(),
  roleGrants: contract.filters.RoleGranted(),
  stageActivations: contract.filters.StageActivated(),
  purchases: contract.filters.PurchaseRecorded(),
  referralBonuses: contract.filters.ReferralBonusAwarded(),
  promoBonuses: contract.filters.PromoBonusAwarded(),
  emergencyPause: contract.filters.Paused()
};
```

### Critical Monitoring Points

1. **Role Security**: Monitor all role-related events for unauthorized changes
2. **Stage Progression**: Verify stage activations follow expected timeline
3. **Purchase Validation**: Cross-reference purchase events with off-chain records
4. **Emergency Actions**: Alert on pause/unpause events
5. **Referral Integrity**: Verify referral bonuses are not double-counted
6. **Promotional Compliance**: Monitor promo bonus rates and ensure they stay within limits (0-50%)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

## ⚠️ Important Notes

- **Never commit your `.env` file** - it contains sensitive private keys
- **Test thoroughly on testnets** before mainnet deployment
- **Use a multisig wallet** for the RECORDER_ROLE in production
- **Keep your private keys secure** and never share them
