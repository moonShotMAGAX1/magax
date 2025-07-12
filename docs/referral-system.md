# MAGAX Presale Referral System

## Overview

The MAGAX Presale system includes a comprehensive referral program that rewards both referrers and referees with bonus MAGAX tokens.

## Referral Bonuses

- **Referrer Bonus**: 7% of the purchased MAGAX amount
- **Referee Bonus**: 5% of the purchased MAGAX amount

## How It Works

### Setting a Referrer

1. A user can have a referrer set only on their **first purchase**
2. Once set, the referrer cannot be changed
3. Self-referral is not allowed
4. Zero address cannot be used as a referrer

### Bonus Calculation

When a purchase is made with a referrer:

```javascript
// Example: User purchases 1,000,000 MAGAX tokens
const basePurchase = 1000000; // MAGAX tokens

// Bonuses calculated
const referrerBonus = basePurchase * 0.07; // 70,000 MAGAX (7%)
const refereeBonus = basePurchase * 0.05;  // 50,000 MAGAX (5%)

// Total tokens distributed:
// - Buyer receives: 1,000,000 + 50,000 = 1,050,000 MAGAX
// - Referrer receives: 70,000 MAGAX bonus
```

### Receipt Tracking

The system creates separate receipts for:

1. **Base Purchase**: The actual purchase with USDT amount
2. **Referrer Bonus**: Bonus receipt for the referrer (0 USDT, bonus MAGAX)
3. **Referee Bonus**: Bonus receipt for the buyer (0 USDT, bonus MAGAX)

All receipts are marked with `isReferralBonus` flag for easy identification.

## Smart Contract Integration

### Recording Purchases with Referrals

```solidity
// Function to record a purchase with referral
function recordPurchaseWithReferral(
    address buyer,
    uint128 usdtAmount,
    uint128 magaxAmount,
    address referrer
) external onlyRole(PRESALE_MANAGER_ROLE) whenNotPaused
```

### Referral Data Queries

```solidity
// Get referral information for a user
function getReferralInfo(address user) external view returns (
    uint256 totalReferrals,
    uint128 totalBonusEarned
);

// Get the referrer of a user
function getUserReferrer(address user) external view returns (address);

// Check if a user has a referrer
function hasReferrer(address user) external view returns (bool);
```

## Events

The contract emits the following events for referral tracking:

```solidity
event ReferralBonusAwarded(
    address indexed referrer,
    address indexed referee,
    uint128 referrerBonus,
    uint128 refereeBonus,
    uint8 stage
);

event ReferrerSet(
    address indexed user,
    address indexed referrer
);
```

## JavaScript Integration Example

```javascript
const { ethers } = require('ethers');

// Connect to contract
const contract = new ethers.Contract(contractAddress, abi, signer);

// Record purchase with referral
async function recordPurchaseWithReferral(buyer, usdtAmount, magaxAmount, referrer) {
    try {
        const tx = await contract.recordPurchaseWithReferral(
            buyer,
            ethers.parseUnits(usdtAmount.toString(), 6), // USDT has 6 decimals
            ethers.parseUnits(magaxAmount.toString(), 18), // MAGAX has 18 decimals
            referrer
        );
        
        const receipt = await tx.wait();
        console.log('Purchase with referral recorded:', receipt.hash);
        
        // Listen for referral bonus event
        const bonusEvent = receipt.logs.find(log => 
            log.fragment?.name === 'ReferralBonusAwarded'
        );
        
        if (bonusEvent) {
            console.log('Referral bonuses awarded:', bonusEvent.args);
        }
        
        return receipt;
    } catch (error) {
        console.error('Error recording purchase with referral:', error);
        throw error;
    }
}

// Get referral information
async function getReferralInfo(userAddress) {
    try {
        const [totalReferrals, totalBonusEarned] = await contract.getReferralInfo(userAddress);
        const referrer = await contract.getUserReferrer(userAddress);
        const hasReferrer = await contract.hasReferrer(userAddress);
        
        return {
            totalReferrals: totalReferrals.toString(),
            totalBonusEarned: ethers.formatUnits(totalBonusEarned, 18),
            referrer: hasReferrer ? referrer : null,
            hasReferrer
        };
    } catch (error) {
        console.error('Error getting referral info:', error);
        throw error;
    }
}

// Example usage
async function main() {
    const buyer = '0x123...';
    const referrer = '0x456...';
    const usdtAmount = 1000; // 1000 USDT
    const magaxAmount = 1000000; // 1M MAGAX
    
    // Record purchase with referral
    await recordPurchaseWithReferral(buyer, usdtAmount, magaxAmount, referrer);
    
    // Get referral info for both users
    const buyerInfo = await getReferralInfo(buyer);
    const referrerInfo = await getReferralInfo(referrer);
    
    console.log('Buyer referral info:', buyerInfo);
    console.log('Referrer referral info:', referrerInfo);
}
```

## Golang Integration Example

```go
package main

import (
    "context"
    "fmt"
    "log"
    "math/big"
    
    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/ethclient"
)

// ReferralInfo represents referral data
type ReferralInfo struct {
    TotalReferrals   *big.Int
    TotalBonusEarned *big.Int
    Referrer         common.Address
    HasReferrer      bool
}

// RecordPurchaseWithReferral records a purchase with referral bonus
func RecordPurchaseWithReferral(
    client *ethclient.Client,
    contract *MAGAXPresaleReceipts,
    auth *bind.TransactOpts,
    buyer common.Address,
    usdtAmount *big.Int,
    magaxAmount *big.Int,
    referrer common.Address,
) error {
    // Convert amounts to proper units
    // USDT: 6 decimals, MAGAX: 18 decimals
    usdtWei := new(big.Int).Mul(usdtAmount, big.NewInt(1e6))
    magaxWei := new(big.Int).Mul(magaxAmount, big.NewInt(1e18))
    
    tx, err := contract.RecordPurchaseWithReferral(auth, buyer, usdtWei, magaxWei, referrer)
    if err != nil {
        return fmt.Errorf("failed to record purchase with referral: %w", err)
    }
    
    // Wait for transaction confirmation
    receipt, err := bind.WaitMined(context.Background(), client, tx)
    if err != nil {
        return fmt.Errorf("failed to wait for transaction: %w", err)
    }
    
    fmt.Printf("Purchase with referral recorded: %s\n", receipt.TxHash.Hex())
    return nil
}

// GetReferralInfo retrieves referral information for a user
func GetReferralInfo(contract *MAGAXPresaleReceipts, userAddress common.Address) (*ReferralInfo, error) {
    // Get referral data
    totalReferrals, totalBonusEarned, err := contract.GetReferralInfo(&bind.CallOpts{}, userAddress)
    if err != nil {
        return nil, fmt.Errorf("failed to get referral info: %w", err)
    }
    
    // Get referrer
    referrer, err := contract.GetUserReferrer(&bind.CallOpts{}, userAddress)
    if err != nil {
        return nil, fmt.Errorf("failed to get user referrer: %w", err)
    }
    
    // Check if has referrer
    hasReferrer, err := contract.HasReferrer(&bind.CallOpts{}, userAddress)
    if err != nil {
        return nil, fmt.Errorf("failed to check if user has referrer: %w", err)
    }
    
    return &ReferralInfo{
        TotalReferrals:   totalReferrals,
        TotalBonusEarned: totalBonusEarned,
        Referrer:         referrer,
        HasReferrer:      hasReferrer,
    }, nil
}

// Example usage
func main() {
    // Connect to Ethereum client
    client, err := ethclient.Dial("https://sepolia.infura.io/v3/YOUR-PROJECT-ID")
    if err != nil {
        log.Fatal(err)
    }
    
    // Contract address and ABI setup
    contractAddress := common.HexToAddress("0x...")
    contract, err := NewMAGAXPresaleReceipts(contractAddress, client)
    if err != nil {
        log.Fatal(err)
    }
    
    // Setup transaction auth (replace with your private key handling)
    auth := getTransactionAuth() // Your auth setup function
    
    // Example addresses
    buyer := common.HexToAddress("0x123...")
    referrer := common.HexToAddress("0x456...")
    
    // Record purchase with referral
    usdtAmount := big.NewInt(1000)    // 1000 USDT
    magaxAmount := big.NewInt(1000000) // 1M MAGAX
    
    err = RecordPurchaseWithReferral(client, contract, auth, buyer, usdtAmount, magaxAmount, referrer)
    if err != nil {
        log.Printf("Error recording purchase: %v", err)
        return
    }
    
    // Get referral info
    buyerInfo, err := GetReferralInfo(contract, buyer)
    if err != nil {
        log.Printf("Error getting buyer referral info: %v", err)
        return
    }
    
    referrerInfo, err := GetReferralInfo(contract, referrer)
    if err != nil {
        log.Printf("Error getting referrer referral info: %v", err)
        return
    }
    
    fmt.Printf("Buyer referral info: %+v\n", buyerInfo)
    fmt.Printf("Referrer referral info: %+v\n", referrerInfo)
}
```

## Security Considerations

1. **Role-Based Access**: Only accounts with `PRESALE_MANAGER_ROLE` can record purchases
2. **Input Validation**: All inputs are validated for zero values and invalid addresses
3. **Self-Referral Prevention**: Users cannot refer themselves
4. **Immutable Referrer**: Once set, a user's referrer cannot be changed
5. **Pause Functionality**: Contract can be paused to stop all referral operations

## Testing

The referral system includes comprehensive tests covering:

- ✅ Successful referral purchase recording
- ✅ Bonus calculation and distribution
- ✅ Self-referral prevention
- ✅ Invalid referrer prevention
- ✅ Referrer immutability
- ✅ Multiple referrals tracking
- ✅ Receipt creation for bonuses
- ✅ Stage token tracking with bonuses
- ✅ Role-based access control

Run tests with:

```bash
npx hardhat test --grep "Referral System"
```

## Gas Optimization

The referral system is optimized for gas efficiency:

- Uses `uint128` for token amounts (adequate for token supply)
- Efficient storage layout with packed structs
- Minimal storage reads/writes
- Event-based tracking for off-chain analytics

## Integration Checklist

When integrating the referral system:

1. ✅ Ensure proper role assignment for purchase recording
2. ✅ Validate referrer addresses before calling contract
3. ✅ Handle referral events for tracking and analytics
4. ✅ Implement proper error handling for referral operations
5. ✅ Test with various scenarios (first purchase, existing referrer, etc.)
6. ✅ Monitor gas costs for referral vs non-referral purchases
7. ✅ Implement UI for referral link generation and tracking
