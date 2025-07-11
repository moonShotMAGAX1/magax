# Error Reference

## Custom Errors

The MoonShot MAGAX presale contracts use custom errors for gas efficiency and better error reporting. Here's a complete reference of all custom errors and their meanings.

## MAGAXPresaleReceipts Contract Errors

### Purchase Recording Errors

#### `InvalidBuyer()`

**When it occurs**: When attempting to record a purchase with a zero address buyer
**Resolution**: Ensure the buyer address is valid and not the zero address

#### `InvalidAmount()`

**When it occurs**: When either USDT amount or MAGAX amount is zero
**Resolution**: Provide valid amounts greater than zero for both parameters

#### `NoActiveStage()`

**When it occurs**: When trying to record a purchase but no stage is currently active
**Resolution**: Admin must activate a configured stage before purchases can be recorded

#### `PurchaseLimitExceeded()`

#### When it occurs: When a purchase would exceed the maximum allowed limits

- Single purchase limit: 10,000 USDT
- User total limit: 50,000 USDT
**Resolution**: Reduce purchase amount to stay within limits

#### `DuplicatePurchase()`

**When it occurs**: When attempting to record a purchase with an ID that already exists
**Resolution**: Use a unique purchase ID for each transaction

#### `StageAllocationExceeded()`

**When it occurs**: When a purchase would exceed the remaining token allocation for the current stage
**Resolution**

- Reduce purchase amount to fit within remaining allocation
- Admin may need to configure and activate the next stage

### Stage Management Errors

#### `InvalidStage()`

**When it occurs**: When trying to configure or activate a stage outside the valid range (1-50)
**Resolution**: Use a stage number between 1 and 50

#### `StageNotConfigured()`

**When it occurs**: When trying to activate a stage that hasn't been configured yet
**Resolution**: Configure the stage with pricing and allocation before activation

#### `StageAlreadyActive()`

**When it occurs**: When trying to activate a stage that is already active
**Resolution**: Check current active stage before attempting activation

#### `InvalidStageConfig()`

**When it occurs**: When trying to configure a stage with invalid parameters:

- Price per token is zero
- Token allocation is zero
**Resolution**: Provide valid non-zero values for both price and allocation

### Emergency and Admin Errors

#### `EmergencyWithdrawFailed()`

**When it occurs**: When emergency token withdrawal fails
**Resolution**: Check token contract state and try again, or contact technical support

#### `EthNotAccepted()`

**When it occurs**: When someone tries to send ETH directly to the contract
**Resolution**: The contract only accepts USDT payments through the proper purchase flow

## MoonShotMAGAX Token Contract Errors

### Minting Errors

#### `MaxSupplyExceeded()`

**When it occurs**: When trying to mint tokens that would exceed the maximum supply (1 trillion)
**Resolution**: Reduce mint amount to stay within max supply limits

#### `InvalidTreasuryAddress()`

**When it occurs**: When trying to set the treasury address to zero address
**Resolution**: Provide a valid non-zero address for the treasury

### Transfer Errors

#### `TransfersPaused()`

**When it occurs**: When trying to transfer tokens while the contract is paused
**Resolution**: Wait for admin to unpause the contract

## Common Error Handling Patterns

### Frontend Error Handling

```javascript
try {
    const tx = await presaleContract.recordPurchase(buyer, usdtAmount, magaxAmount);
    await tx.wait();
} catch (error) {
    if (error.message.includes('InvalidBuyer')) {
        alert('Invalid buyer address provided');
    } else if (error.message.includes('PurchaseLimitExceeded')) {
        alert('Purchase amount exceeds allowed limits');
    } else if (error.message.includes('NoActiveStage')) {
        alert('No presale stage is currently active');
    } else if (error.message.includes('StageAllocationExceeded')) {
        alert('Not enough tokens available in current stage');
    } else {
        alert('Transaction failed: ' + error.message);
    }
}
```

### Backend Error Handling

```javascript
const handlePurchaseError = (error) => {
    const errorMap = {
        'InvalidBuyer': { code: 'INVALID_BUYER', message: 'Invalid buyer address' },
        'InvalidAmount': { code: 'INVALID_AMOUNT', message: 'Invalid purchase amount' },
        'NoActiveStage': { code: 'NO_ACTIVE_STAGE', message: 'No active presale stage' },
        'PurchaseLimitExceeded': { code: 'LIMIT_EXCEEDED', message: 'Purchase limit exceeded' },
        'DuplicatePurchase': { code: 'DUPLICATE', message: 'Purchase already recorded' },
        'StageAllocationExceeded': { code: 'STAGE_FULL', message: 'Stage allocation exceeded' }
    };
    
    for (const [errorName, errorInfo] of Object.entries(errorMap)) {
        if (error.message.includes(errorName)) {
            return errorInfo;
        }
    }
    
    return { code: 'UNKNOWN_ERROR', message: 'Unexpected error occurred' };
};
```

## Error Prevention Best Practices

### For Developers

1. **Validate Input Data**: Always validate user inputs before sending transactions
2. **Check Stage Status**: Verify stage is active and has allocation before purchases
3. **Handle Limits**: Check user purchase history against limits
4. **Unique IDs**: Generate unique purchase IDs to prevent duplicates
5. **Gas Estimation**: Estimate gas before transactions to catch errors early

### For Admins

1. **Stage Configuration**: Always configure stages properly before activation
2. **Monitor Allocations**: Track stage progress to plan transitions
3. **Emergency Procedures**: Have procedures for handling emergency situations
4. **Role Management**: Regularly audit role assignments

## Debugging Tips

### Common Issues

1. **Transaction Reverts**: Check for custom error messages in transaction failure logs
2. **High Gas Costs**: May indicate complex operations or error conditions
3. **Failed Estimates**: Often means the transaction would revert
4. **Silent Failures**: Check event logs for successful operations

### Tools for Debugging

- **Hardhat Console**: For local testing and debugging
- **Etherscan**: For viewing transaction details on mainnet/testnet
- **Event Logs**: Monitor contract events for operation status
- **Gas Profiling**: Identify expensive operations

---

*This error reference covers all custom errors in the MoonShot MAGAX presale system. For additional support, refer to the test files for expected behavior examples.*
