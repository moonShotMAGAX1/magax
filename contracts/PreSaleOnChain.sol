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
error InvalidReferrer();
error SelfReferral();

contract MAGAXPresaleReceipts is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // Purchase limits for security
    uint128 public constant MAX_PURCHASE_USDT = 1000000 * 1e6; // 1M USDT max per purchase
    uint128 public constant MAX_TOTAL_USDT = 10000000 * 1e6;   // 10M USDT total presale limit
    uint8 public constant MAX_STAGES = 50; // Maximum number of presale stages

    // Referral system constants
    uint16 public constant REFERRER_BONUS_BPS = 700;  // 7% bonus for referrer
    uint16 public constant REFEREE_BONUS_BPS = 500;   // 5% bonus for referee
    uint16 public constant BASIS_POINTS = 10000; // 100% in basis points

    struct Receipt {
        uint128 usdt;     // 6-decimals
        uint128 magax;    // 18-decimals
        uint40  time;     // timestamp
        uint8   stage;    // presale stage (1-50)
        uint128 pricePerToken; // USDT price per MAGAX token (6 decimals)
        bool isReferralBonus; // true if this is a referral bonus receipt
    }

    // Stage management
    struct StageInfo {
        uint128 pricePerToken;    // USDT per MAGAX (6 decimals)
        uint128 tokensAllocated;  // Total MAGAX tokens for this stage
        uint128 tokensSold;       // MAGAX tokens sold in this stage
        bool isActive;            // Whether stage is currently active
    }

    // Referral system
    struct ReferralInfo {
        uint128 totalReferrals;      // Number of people referred
        uint128 totalBonusEarned;    // Total bonus MAGAX earned as referrer
        uint128 totalRefereeBonus;   // Total bonus MAGAX earned as referee
        bool hasReferred;            // Whether this address has made any referrals
    }

    // Core storage
    mapping(address => Receipt[]) public userReceipts;
    mapping(address => uint128) public userTotalUSDT; 
    mapping(address => uint128) public userTotalMAGAX;

    // Referral system storage
    mapping(address => ReferralInfo) public referralData;
    mapping(address => address) public userReferrer; // user -> their referrer

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
            Receipt(usdtAmount, magaxAmount, uint40(block.timestamp), currentStage, stagePrice, false)
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

    /**
     * @notice Record a purchase with referral bonus
     * @param buyer The address of the buyer
     * @param usdtAmount The amount of USDT spent
     * @param magaxAmount The amount of MAGAX received (base amount)
     * @param referrer The address of the referrer
     */
    function recordPurchaseWithReferral(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer
    ) external onlyRole(RECORDER_ROLE) whenNotPaused {
        if (buyer == address(0)) revert InvalidAddress();
        if (referrer == address(0)) revert InvalidReferrer();
        if (buyer == referrer) revert SelfReferral();
        if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
        if (currentStage == 0) revert InvalidStage();

        // Set referrer if this is the first purchase
        if (userReferrer[buyer] == address(0)) {
            userReferrer[buyer] = referrer;
            emit ReferrerSet(buyer, referrer);
        }

        // Calculate bonuses
        uint128 referrerBonus = (magaxAmount * REFERRER_BONUS_BPS) / BASIS_POINTS;
        uint128 refereeBonus = (magaxAmount * REFEREE_BONUS_BPS) / BASIS_POINTS;

        bool isNewBuyer = userReceipts[buyer].length == 0;
        uint8 stageForPurchase = currentStage;
        uint128 stagePrice = stages[currentStage].pricePerToken;
        
        // Record base purchase
        userReceipts[buyer].push(
            Receipt(usdtAmount, magaxAmount, uint40(block.timestamp), stageForPurchase, stagePrice, false)
        );

        // Record referrer bonus
        userReceipts[referrer].push(
            Receipt(0, referrerBonus, uint40(block.timestamp), stageForPurchase, stagePrice, true)
        );

        // Record referee bonus
        userReceipts[buyer].push(
            Receipt(0, refereeBonus, uint40(block.timestamp), stageForPurchase, stagePrice, true)
        );
        
        // Update totals
        userTotalUSDT[buyer] += usdtAmount;
        userTotalMAGAX[buyer] += magaxAmount + refereeBonus;
        userTotalMAGAX[referrer] += referrerBonus;
        
        totalUSDT += usdtAmount;
        totalMAGAX += magaxAmount + referrerBonus + refereeBonus;
        
        // Update referral data
        referralData[referrer].totalReferrals++;
        referralData[referrer].totalBonusEarned += referrerBonus;
        referralData[buyer].totalBonusEarned += refereeBonus;
        
        // Update stage tokens sold (including bonuses)
        stages[currentStage].tokensSold += magaxAmount + referrerBonus + refereeBonus;
        
        emit PurchaseRecorded(
            buyer,
            usdtAmount,
            magaxAmount,
            uint40(block.timestamp),
            stageForPurchase,
            stagePrice,
            userReceipts[buyer].length,
            isNewBuyer
        );

        emit ReferralBonusAwarded(referrer, buyer, referrerBonus, refereeBonus, stageForPurchase);
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

    /**
     * @notice Get referral information for a user
     * @param user The address to check
     * @return totalReferrals Number of successful referrals
     * @return totalBonusEarned Total bonus MAGAX earned
     */
    function getReferralInfo(address user) external view returns (uint256 totalReferrals, uint128 totalBonusEarned) {
        ReferralInfo memory info = referralData[user];
        return (info.totalReferrals, info.totalBonusEarned);
    }

    /**
     * @notice Get the referrer of a user
     * @param user The address to check
     * @return referrer The address of the referrer (address(0) if no referrer)
     */
    function getUserReferrer(address user) external view returns (address) {
        return userReferrer[user];
    }

    /**
     * @notice Check if a user has a referrer
     * @param user The address to check
     * @return hasReferrer True if user has a referrer
     */
    function hasReferrer(address user) external view returns (bool) {
        return userReferrer[user] != address(0);
    }
}