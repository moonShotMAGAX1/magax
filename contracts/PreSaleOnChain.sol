// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Custom errors for gas efficiency
error NotRecorder();
error InvalidAddress();
error InvalidAmount();
error ExceedsMaxPurchase();
error ExceedsTotalLimit();
error DuplicatePurchase();
error NoTokensToWithdraw();
error EthNotAccepted();
error InvalidStage();
error StageNotActive();
error InsufficientStageTokens();
error InvalidPrice();
error StageAlreadyActive();

contract MAGAXPresaleReceipts is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // Purchase limits for security
    uint128 public constant MAX_PURCHASE_USDT = 1000000 * 1e6; // 1M USDT max per purchase
    uint128 public constant MAX_TOTAL_USDT = 10000000 * 1e6;   // 10M USDT total presale limit
    uint8 public constant MAX_STAGES = 50; // Maximum number of presale stages

    struct Receipt {
        uint128 usdt;     // 6-decimals
        uint128 magax;    // 18-decimals
        uint40  time;     // timestamp
        uint8   stage;    // presale stage (1-50)
        uint128 pricePerToken; // USDT price per MAGAX token (6 decimals)
    }

    // Stage management
    struct StageInfo {
        uint128 pricePerToken;    // USDT per MAGAX (6 decimals)
        uint128 tokensAllocated;  // Total MAGAX tokens for this stage
        uint128 tokensSold;       // MAGAX tokens sold in this stage
        bool isActive;            // Whether stage is currently active
    }

    // Core storage
    mapping(address => Receipt[]) public userReceipts;
    mapping(address => uint128) public userTotalUSDT; 
    mapping(address => uint128) public userTotalMAGAX;

    // Stage management
    mapping(uint8 => StageInfo) public stages;
    uint8 public currentStage = 1; // Start with stage 1

    // Duplicate prevention
    mapping(bytes32 => bool) public purchaseHashes;
    uint256 public purchaseCounter;

    uint128 public totalUSDT;
    uint128 public totalMAGAX;
    uint32 public totalBuyers;   // Track unique buyers

    event PurchaseRecorded(
        address indexed buyer,
        uint128 usdt,
        uint128 magax,
        uint40  time,
        uint8   stage,
        uint128 pricePerToken,
        uint256 totalUserPurchases,
        bool isNewBuyer
    );

    event StageConfigured(
        uint8 indexed stage,
        uint128 pricePerToken,
        uint128 tokensAllocated
    );

    event StageActivated(uint8 indexed stage);
    event StageDeactivated(uint8 indexed stage);

    event EmergencyTokenWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    constructor(address recorder) {
        if (recorder == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, recorder);
    }

    function recordPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount
    ) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant {
        if (buyer == address(0)) revert InvalidAddress();
        if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
        
        // Check purchase limits
        if (usdtAmount > MAX_PURCHASE_USDT) revert ExceedsMaxPurchase();
        if (totalUSDT + usdtAmount > MAX_TOTAL_USDT) revert ExceedsTotalLimit();
        
        // Validate current stage
        if (currentStage == 0 || currentStage > MAX_STAGES) revert InvalidStage();
        if (!stages[currentStage].isActive) revert StageNotActive();
        if (stages[currentStage].tokensSold + magaxAmount > stages[currentStage].tokensAllocated) {
            revert InsufficientStageTokens();
        }
        
        // Get stage price
        uint128 stagePrice = stages[currentStage].pricePerToken;
        
        // Prevent duplicate purchases
        bytes32 purchaseHash = keccak256(abi.encode(
            buyer, usdtAmount, magaxAmount, block.timestamp, purchaseCounter
        ));
        if (purchaseHashes[purchaseHash]) revert DuplicatePurchase();
        purchaseHashes[purchaseHash] = true;
        
        // Track if this is a new buyer (for totalBuyers counter)
        bool isNewBuyer = userTotalUSDT[buyer] == 0;
        
        // Update storage
        userReceipts[buyer].push(
            Receipt(usdtAmount, magaxAmount, uint40(block.timestamp), currentStage, stagePrice)
        );
        
        // Update totals efficiently
        userTotalUSDT[buyer] += usdtAmount;
        userTotalMAGAX[buyer] += magaxAmount;
        totalUSDT += usdtAmount;
        totalMAGAX += magaxAmount;
        
        // Update stage tokens sold
        stages[currentStage].tokensSold += magaxAmount;
        
        if (isNewBuyer) {
            totalBuyers++;
        }

        emit PurchaseRecorded(
            buyer, 
            usdtAmount, 
            magaxAmount, 
            uint40(block.timestamp),
            currentStage,
            stagePrice,
            userReceipts[buyer].length,
            isNewBuyer
        );
        
        purchaseCounter++;
    }

    function getReceipts(address buyer) external view returns (Receipt[] memory) {
        return userReceipts[buyer];
    }
    
    // Paginated receipts for users with many purchases
    function getReceiptsPaginated(
        address buyer, 
        uint256 offset, 
        uint256 limit
    ) external view returns (Receipt[] memory) {
        Receipt[] storage receipts = userReceipts[buyer];
        uint256 total = receipts.length;
        
        if (offset >= total) {
            return new Receipt[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        Receipt[] memory result = new Receipt[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = receipts[i];
        }
        
        return result;
    }
    
    function getUserStats(address buyer) external view returns (
        uint256 totalPurchases,
        uint128 totalUSDTSpent,
        uint128 totalMAGAXAllocated,
        uint40  firstPurchaseTime,
        uint40  lastPurchaseTime
    ) {
        Receipt[] memory receipts = userReceipts[buyer];
        totalPurchases = receipts.length;
        
        if (totalPurchases == 0) return (0, 0, 0, 0, 0);
        
        totalUSDTSpent = userTotalUSDT[buyer];
        totalMAGAXAllocated = userTotalMAGAX[buyer];
        
        firstPurchaseTime = receipts[0].time;
        lastPurchaseTime = receipts[totalPurchases - 1].time;
    }
    
    function getPresaleStats() external view returns (
        uint128 totalUSDTRaised,
        uint128 totalMAGAXSold,
        uint32  totalUniqueBuyers
    ) {
        return (totalUSDT, totalMAGAX, totalBuyers);
    }

    // Stage management functions
    function configureStage(
        uint8 stage,
        uint128 pricePerToken,
        uint128 tokensAllocated
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        if (pricePerToken == 0) revert InvalidPrice();
        if (tokensAllocated == 0) revert InvalidAmount();
        
        stages[stage] = StageInfo({
            pricePerToken: pricePerToken,
            tokensAllocated: tokensAllocated,
            tokensSold: 0,
            isActive: false
        });
        
        emit StageConfigured(stage, pricePerToken, tokensAllocated);
    }

    function activateStage(uint8 stage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        if (stages[stage].tokensAllocated == 0) revert InvalidAmount();
        
        // Check if stage is already active
        if (stages[stage].isActive) revert StageAlreadyActive();
        
        // Deactivate current stage
        if (currentStage > 0 && currentStage <= MAX_STAGES) {
            stages[currentStage].isActive = false;
            emit StageDeactivated(currentStage);
        }
        
        // Activate new stage
        stages[stage].isActive = true;
        currentStage = stage;
        emit StageActivated(stage);
    }

    function getStageInfo(uint8 stage) external view returns (
        uint128 pricePerToken,
        uint128 tokensAllocated,
        uint128 tokensSold,
        uint128 tokensRemaining,
        bool isActive
    ) {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        
        StageInfo memory stageInfo = stages[stage];
        return (
            stageInfo.pricePerToken,
            stageInfo.tokensAllocated,
            stageInfo.tokensSold,
            stageInfo.tokensAllocated - stageInfo.tokensSold,
            stageInfo.isActive
        );
    }

    function getCurrentStageInfo() external view returns (
        uint8 stage,
        uint128 pricePerToken,
        uint128 tokensAllocated,
        uint128 tokensSold,
        uint128 tokensRemaining,
        bool isActive
    ) {
        return (
            currentStage,
            stages[currentStage].pricePerToken,
            stages[currentStage].tokensAllocated,
            stages[currentStage].tokensSold,
            stages[currentStage].tokensAllocated - stages[currentStage].tokensSold,
            stages[currentStage].isActive
        );
    }

    // Admin functions
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { 
        _pause(); 
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { 
        _unpause(); 
    }

    // Emergency token withdrawal for accidentally sent tokens
    function emergencyTokenWithdraw(IERC20 token, address to) 
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert InvalidAddress();
        
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NoTokensToWithdraw();
        
        token.transfer(to, balance);
        emit EmergencyTokenWithdraw(address(token), to, balance);
    }

    // Prevent accidental ETH deposits
    receive() external payable {
        revert EthNotAccepted();
    }
    
    fallback() external payable {
        revert EthNotAccepted();
    }
}