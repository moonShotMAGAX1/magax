// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Custom errors for gas efficiency
error InvalidAddress();
error InvalidAmount();
error ExceedsMaxPurchase();
error ExceedsTotalLimit();
error NoTokensToWithdraw();
error EthNotAccepted();
error FallbackNotAllowed();
error InvalidStage();
error StageNotActive();
error InsufficientStageTokens();
error InvalidPrice();
error StageAlreadyActive();
error InvalidReferrer();
error SelfReferral();
error PresaleFinalised();
error PriceMismatch();
error InvalidPromoBps();

contract MAGAXPresaleReceipts is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    bytes32 public constant STAGE_MANAGER_ROLE = keccak256("STAGE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant FINALIZER_ROLE = keccak256("FINALIZER_ROLE");

    // Purchase limits for security
    uint128 public constant MAX_PURCHASE_USDT = 1_000_000 * 1e6; // 1M USDT max per purchase
    uint128 public constant MAX_TOTAL_USDT = 10_000_000 * 1e6;   // 10M USDT total presale limit
    uint8 public constant MAX_STAGES = 50; // Maximum number of presale stages

    // Referral system constants
    uint16 public constant REFERRER_BONUS_BPS = 700;  // 7% bonus for referrer
    uint16 public constant REFEREE_BONUS_BPS = 500;   // 5% bonus for referee
    uint16 public constant BASIS_POINTS = 10_000; // 100% in basis points
    
    // Promo system constants
    uint16 public constant MAX_PROMO_BONUS_BPS = 5_000; // 50% max promo bonus

    uint16 public maxPromoCapBps = MAX_PROMO_BONUS_BPS;

    struct Receipt {
        uint128 usdt;             // 6-decimals (128 bits)
        uint128 magax;            // 18-decimals (128 bits)
        uint40  time;             // timestamp (40 bits)
        uint8   stage;            // presale stage 1-50 (8 bits)
        bool    isBonus;          // ANY bonus (referral or promo) (8 bits)
        // Total: 312 bits = 2 storage slots (removed pricePerToken for gas savings)
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
        uint32  totalReferrals;      // Number of people referred (4B+ capacity)
        uint128 totalBonusEarned;    // Total bonus MAGAX earned as referrer
        uint128 totalRefereeBonus;   // Total bonus MAGAX earned as referee
    }
    
    // Promo system - simplified
    struct UserPromoUsage {
        uint128 totalPromoBonus;    // Total bonus tokens earned from promos
    }

    // Core storage
    mapping(address => Receipt[]) public userReceipts;
    mapping(address => uint128) public userTotalUSDT; 
    mapping(address => uint128) public userTotalMAGAX;

    // Referral system storage
    mapping(address => ReferralInfo) public referralData;
    mapping(address => address) public userReferrer; // user -> their referrer

    // Promo system storage - simplified
    mapping(address => UserPromoUsage) public userPromoData;

    // Stage management
    mapping(uint8 => StageInfo) public stages;
    uint8 public currentStage = 1; // Start with stage 1

    // Finalization flag - prevents new receipts after presale closes
    bool public finalised;

    uint128 public totalUSDT;
    uint128 public totalMAGAX;
    uint32 public totalBuyers;   // Track unique buyers

    event PurchaseRecorded(
        address indexed buyer,
        uint128 usdt,
        uint128 magax,
        uint40  time,
        uint8   indexed stage,
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

    event PromoUsed(
        address indexed user,
        uint16 promoBps,
        uint128 bonusTokens,
        uint8 stage,
        uint256 receiptIndex
    );

    event StageConfigured(
        uint8 indexed stage,
        uint128 pricePerToken,
        uint128 tokensAllocated
    );

    event StageActivated(uint8 indexed stage, address indexed operator);
    event StageDeactivated(uint8 indexed stage);
    event StageCompleted(uint8 indexed stage, uint128 tokensSold);

    event Finalised(uint40 time);

    event EmergencyTokenWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    event MaxPromoBpsUpdated(
        uint16 oldCap,
        uint16 newCap,
        address indexed updatedBy
    );

    event OperationProposed(
        bytes32 indexed operationHash,
        address indexed proposer,
        string operationType
    );

    event OperationConfirmed(
        bytes32 indexed operationHash,
        address indexed confirmer,
        uint8 confirmations
    );

    event OperationExecuted(
        bytes32 indexed operationHash,
        address indexed executor
    );

    constructor(address recorder, address stageManager, address admin) {
        if (recorder == address(0)) revert InvalidAddress();
        if (stageManager == address(0)) revert InvalidAddress();
        if (admin == address(0)) revert InvalidAddress();
        
        // Only the admin (timelock) gets all critical roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(STAGE_MANAGER_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, admin);
        _grantRole(FINALIZER_ROLE, admin);
        
        // Grant operational roles to specified addresses
        _grantRole(RECORDER_ROLE, recorder);
        _grantRole(STAGE_MANAGER_ROLE, stageManager);
    }

    /**
     * @notice Record a new purchase receipt
     * @param buyer The address of the buyer
     * @param usdtAmount Amount of USDT paid
     * @param magaxAmount Amount of MAGAX tokens received
     */
    function recordPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount
    ) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant {
        if (finalised) revert PresaleFinalised();
        
        _validatePurchase(buyer, usdtAmount, magaxAmount);
        
        uint8 stage = currentStage;
        StageInfo storage stageInfo = stages[stage];
        _validateStage(stage, magaxAmount, stageInfo);
        _validatePrice(usdtAmount, magaxAmount, stageInfo.pricePerToken);
        
        uint40 timestamp = uint40(block.timestamp);
        _processPurchase(buyer, usdtAmount, magaxAmount, stage, stageInfo, timestamp);
    }

    function _validatePurchase(address buyer, uint128 usdtAmount, uint128 magaxAmount) internal view {
        if (buyer == address(0)) revert InvalidAddress();
        if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
        if (usdtAmount > MAX_PURCHASE_USDT) revert ExceedsMaxPurchase();
        
        // Edge case: Check if purchase exactly hits MAX_TOTAL_USDT (should be allowed)
        if (totalUSDT + usdtAmount > MAX_TOTAL_USDT) revert ExceedsTotalLimit();
    }

    function _validateStage(uint8 stage, uint128 magaxAmount, StageInfo storage stageInfo) internal view {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        if (!stageInfo.isActive) revert StageNotActive();
        if (stageInfo.tokensSold + magaxAmount > stageInfo.tokensAllocated) {
            revert InsufficientStageTokens();
        }
    }

    /**
     * @notice Validates price consistency between USDT amount and MAGAX amount
     * @dev Handles rounding edge case when decimal conversions don't divide evenly.
     *      Uses 256-bit arithmetic to prevent overflow, then allows ±1 USDT tolerance
     *      for precision rounding. This prevents price manipulation while accommodating
     *      legitimate rounding differences from decimal conversions.
     * @param usdtAmount The USDT amount (6 decimals)
     * @param magaxAmount The MAGAX amount (18 decimals) 
     * @param pricePerToken The price per token (6 decimals, USDT per MAGAX)
     */
    function _validatePrice(uint128 usdtAmount, uint128 magaxAmount, uint128 pricePerToken) internal pure {
        // Price validation: usdtAmount should equal (magaxAmount * pricePerToken) / 1e18
        // Since USDT has 6 decimals and MAGAX has 18 decimals, and pricePerToken is in 6 decimals
        uint256 expectedUSDT = (uint256(magaxAmount) * pricePerToken) / 1e18;
        
        // Edge case: Allow ±1 USDT tolerance for rounding when decimal conversions don't divide evenly
        // This handles cases where 256-bit arithmetic precision still results in minor rounding differences
        if (usdtAmount > expectedUSDT) {
            if (usdtAmount - expectedUSDT > 1e6) revert PriceMismatch(); // More than 1 USDT over
        } else {
            if (expectedUSDT - usdtAmount > 1e6) revert PriceMismatch(); // More than 1 USDT under
        }
    }

    function _processPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint8 stage,
        StageInfo storage stageInfo,
        uint40 timestamp
    ) internal {
        bool isNewBuyer = userTotalUSDT[buyer] == 0;
        
        userReceipts[buyer].push(
            Receipt(usdtAmount, magaxAmount, timestamp, stage, false)
        );
        
        _updateTotals(buyer, usdtAmount, magaxAmount, isNewBuyer);
        
        unchecked {
            stageInfo.tokensSold += magaxAmount;
        }
        
        _emitPurchaseEvent(buyer, usdtAmount, magaxAmount, timestamp, stage, isNewBuyer);
        
        if (stageInfo.tokensSold == stageInfo.tokensAllocated) {
            emit StageCompleted(stage, stageInfo.tokensSold);
        }
    }

    function _updateTotals(address buyer, uint128 usdtAmount, uint128 magaxAmount, bool isNewBuyer) internal {
        userTotalUSDT[buyer] += usdtAmount;
        userTotalMAGAX[buyer] += magaxAmount;
        totalUSDT += usdtAmount;
        totalMAGAX += magaxAmount;
        
        if (isNewBuyer) {
            unchecked { 
                totalBuyers++; 
            }
        }
    }

    function _emitPurchaseEvent(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint40 timestamp,
        uint8 stage,
        bool isNewBuyer
    ) internal {
        emit PurchaseRecorded(
            buyer, 
            usdtAmount, 
            magaxAmount, 
            timestamp,
            stage,
            userReceipts[buyer].length,
            isNewBuyer
        );
    }

    function recordPurchaseWithReferral(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer
    ) external onlyRole(RECORDER_ROLE) whenNotPaused nonReentrant {
        if (finalised) revert PresaleFinalised();
        
        _validateReferralPurchase(buyer, usdtAmount, magaxAmount, referrer);
        
        uint8 stage = currentStage;
        if (stage == 0) revert InvalidStage();
        
        StageInfo storage stageInfo = stages[stage];
        if (!stageInfo.isActive) revert StageNotActive();
        
        // Validate price consistency
        _validatePrice(usdtAmount, magaxAmount, stageInfo.pricePerToken);
        
        (uint128 referrerBonus, uint128 refereeBonus, uint128 totalTokens) = _calculateBonuses(magaxAmount);
        
        if (stageInfo.tokensSold + totalTokens > stageInfo.tokensAllocated) {
            revert InsufficientStageTokens();
        }
        
        uint40 timestamp = uint40(block.timestamp);
        _processReferralPurchase(buyer, usdtAmount, magaxAmount, referrer, referrerBonus, refereeBonus, totalTokens, stage, stageInfo, timestamp);
    }

    function _validateReferralPurchase(address buyer, uint128 usdtAmount, uint128 magaxAmount, address referrer) internal view {
        if (buyer == address(0)) revert InvalidAddress();
        if (referrer == address(0)) revert InvalidReferrer();
        if (buyer == referrer) revert SelfReferral();
        if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
        if (usdtAmount > MAX_PURCHASE_USDT) revert ExceedsMaxPurchase();
        
        // Edge case: Check total limit including potential bonuses
        if (totalUSDT + usdtAmount > MAX_TOTAL_USDT) revert ExceedsTotalLimit();
    }

    function _calculateBonuses(uint128 magaxAmount) internal pure returns (uint128 referrerBonus, uint128 refereeBonus, uint128 totalTokens) {
        referrerBonus = (magaxAmount * REFERRER_BONUS_BPS) / BASIS_POINTS;
        refereeBonus = (magaxAmount * REFEREE_BONUS_BPS) / BASIS_POINTS;
        totalTokens = magaxAmount + referrerBonus + refereeBonus;
    }

    function _processReferralPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer,
        uint128 referrerBonus,
        uint128 refereeBonus,
        uint128 totalTokensRequired,
        uint8 stage,
        StageInfo storage stageInfo,
        uint40 timestamp
    ) internal {
        _setReferrerIfNeeded(buyer, referrer);
        
        bool isNewBuyer = userReceipts[buyer].length == 0;
        
        // Record main purchase receipt for buyer
        userReceipts[buyer].push(Receipt(usdtAmount, magaxAmount, timestamp, stage, false));
        
        // Record referee bonus receipt for buyer (5% bonus)
        userReceipts[buyer].push(Receipt(0, refereeBonus, timestamp, stage, true));
        
        // Record referral bonus receipt for referrer (7% bonus)
        userReceipts[referrer].push(Receipt(0, referrerBonus, timestamp, stage, true));
        
        // Update totals
        _updateReferralTotals(buyer, usdtAmount, magaxAmount, referrer, referrerBonus, refereeBonus, totalTokensRequired, isNewBuyer);
        
        unchecked {
            stageInfo.tokensSold += totalTokensRequired;
        }
        
        _emitReferralEvents(buyer, usdtAmount, magaxAmount, referrer, referrerBonus, refereeBonus, timestamp, stage, isNewBuyer);
        
        if (stageInfo.tokensSold == stageInfo.tokensAllocated) {
            emit StageCompleted(stage, stageInfo.tokensSold);
        }
    }

    function _setReferrerIfNeeded(address buyer, address referrer) internal {
        if (userReferrer[buyer] == address(0)) {
            userReferrer[buyer] = referrer;
            emit ReferrerSet(buyer, referrer);
        }
    }

    function _updateReferralTotals(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer,
        uint128 referrerBonus,
        uint128 refereeBonus,
        uint128 totalTokensRequired,
        bool isNewBuyer
    ) internal {
        userTotalUSDT[buyer] += usdtAmount;
        userTotalMAGAX[buyer] += magaxAmount + refereeBonus;
        
        // Edge case: When referrer makes subsequent normal purchases, 
        // only count their own purchase, not double-count as referral bonus
        userTotalMAGAX[referrer] += referrerBonus;
        
        totalUSDT += usdtAmount;
        totalMAGAX += totalTokensRequired;
        
        // Update referral statistics (bonuses are tracked separately from purchases)
        unchecked { referralData[referrer].totalReferrals++; }
        referralData[referrer].totalBonusEarned += referrerBonus;
        referralData[buyer].totalRefereeBonus += refereeBonus;
        
        if (isNewBuyer) {
            unchecked { 
                totalBuyers++; 
            }
        }
    }

    function _emitReferralEvents(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer,
        uint128 referrerBonus,
        uint128 refereeBonus,
        uint40 timestamp,
        uint8 stage,
        bool isNewBuyer
    ) internal {
        emit PurchaseRecorded(buyer, usdtAmount, magaxAmount, timestamp, stage, userReceipts[buyer].length, isNewBuyer);
        emit ReferralBonusAwarded(referrer, buyer, referrerBonus, refereeBonus, stage);
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
        
        totalUSDTSpent = userTotalUSDT[buyer];
        totalMAGAXAllocated = userTotalMAGAX[buyer];
        
        if (totalPurchases == 0) return (totalPurchases, totalUSDTSpent, totalMAGAXAllocated, 0, 0);
        
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
    ) external onlyRole(STAGE_MANAGER_ROLE) {
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

    /**
     * @notice Activates a specific presale stage and deactivates the current one
     * @dev Stage transitions are intentionally manual for admin control and flexibility.
     *      This allows for precise timing of stage changes and emergency adjustments.
     * @param stage The stage number to activate (1-50)
     */
    function activateStage(uint8 stage) external onlyRole(STAGE_MANAGER_ROLE) {
        if (finalised) revert PresaleFinalised();
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
        emit StageActivated(stage, msg.sender);
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

    function finalise() external onlyRole(FINALIZER_ROLE) {
        finalised = true;
        _pause(); // Automatically pause to prevent accidental RECORDER_ROLE activity
        emit Finalised(uint40(block.timestamp));
    }

    function setMaxPromoBps(uint16 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCap == 0 || newCap > BASIS_POINTS) revert InvalidPromoBps();
        
        uint16 oldCap = maxPromoCapBps;
        maxPromoCapBps = newCap;
        
        emit MaxPromoBpsUpdated(oldCap, newCap, msg.sender);
    }

    /**
     * @notice Emergency token withdrawal for accidentally sent tokens
     * @dev Controlled by emergency role for security
     * @param token The token contract to withdraw from
     * @param to The address to send tokens to
     */
    function emergencyTokenWithdraw(IERC20 token, address to) external onlyRole(EMERGENCY_ROLE) nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NoTokensToWithdraw();
        
        token.safeTransfer(to, balance);
        emit EmergencyTokenWithdraw(address(token), to, balance);
    }

    // Prevent accidental ETH deposits
    receive() external payable {
        revert EthNotAccepted();
    }
    
    // Prevent unsupported function calls
    fallback() external payable {
        revert FallbackNotAllowed();
    }

    /**
     * @notice Get referral information for a user
     * @param user The address to check
     * @return totalReferrals Number of successful referrals
     * @return totalBonusEarned Total bonus MAGAX earned (as referrer + as referee)
     */
    function getReferralInfo(address user) external view returns (uint32 totalReferrals, uint128 totalBonusEarned) {
        ReferralInfo memory info = referralData[user];
        return (info.totalReferrals, info.totalBonusEarned + info.totalRefereeBonus);
    }

    /**
     * @notice Check if a user has a referrer
     * @param user The address to check
     * @return hasReferrer True if user has a referrer
     */
    function hasReferrer(address user) external view returns (bool) {
        return userReferrer[user] != address(0);
    }

    /**
     * @notice Record a purchase with promo bonus percentage
     * @param buyer The address of the buyer
     * @param usdtAmount Amount of USDT spent (6 decimals)
     * @param magaxAmount Amount of MAGAX tokens purchased (18 decimals)
     * @param promoBps Promo bonus percentage in basis points (e.g., 1000 = 10%)
     */
    function recordPurchaseWithPromo(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint16 promoBps
    ) external onlyRole(RECORDER_ROLE) whenNotPaused nonReentrant {
        if (finalised) revert PresaleFinalised();
        
        _validatePurchase(buyer, usdtAmount, magaxAmount);
        _validatePromoBps(promoBps);
        
        uint8 stage = currentStage;
        StageInfo storage stageInfo = stages[stage];
        _validateStage(stage, magaxAmount, stageInfo);
        _validatePrice(usdtAmount, magaxAmount, stageInfo.pricePerToken);
        
        uint128 promoBonus = _calculatePromoBonus(magaxAmount, promoBps);
        uint128 totalTokens = magaxAmount + promoBonus;
        
        // Check if stage has enough tokens for purchase + bonus
        if (stageInfo.tokensSold + totalTokens > stageInfo.tokensAllocated) {
            revert InsufficientStageTokens();
        }
        
        uint40 timestamp = uint40(block.timestamp);
        _processPromoLaunch(buyer, usdtAmount, magaxAmount, promoBps, promoBonus, totalTokens, stage, stageInfo, timestamp);
    }

    function _validatePromoBps(uint16 promoBps) internal view {
        if (promoBps == 0 || promoBps > maxPromoCapBps) revert InvalidPromoBps();
    }

    function _calculatePromoBonus(uint128 magaxAmount, uint16 promoBps) internal pure returns (uint128) {
        return (magaxAmount * promoBps) / BASIS_POINTS;
    }

    function _processPromoLaunch(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint16 promoBps,
        uint128 promoBonus,
        uint128 totalTokens,
        uint8 stage,
        StageInfo storage stageInfo,
        uint40 timestamp
    ) internal {
        bool isNewBuyer = userTotalUSDT[buyer] == 0;
        
        // Record main purchase receipt
        userReceipts[buyer].push(Receipt(usdtAmount, magaxAmount, timestamp, stage, false));
        
        // Record promo bonus receipt and keep its index
        userReceipts[buyer].push(Receipt(0, promoBonus, timestamp, stage, true));
        uint256 bonusReceiptIdx = userReceipts[buyer].length - 1;
        
        // Update totals
        _updatePromoTotals(buyer, usdtAmount, promoBonus, totalTokens, isNewBuyer);
        
        // Update stage tokens sold
        unchecked {
            stageInfo.tokensSold += totalTokens;
        }
        
        _emitPromoEvents(buyer, usdtAmount, magaxAmount, promoBps, promoBonus, timestamp, stage, isNewBuyer, bonusReceiptIdx);
        
        if (stageInfo.tokensSold == stageInfo.tokensAllocated) {
            emit StageCompleted(stage, stageInfo.tokensSold);
        }
    }

    function _updatePromoTotals(
        address buyer,
        uint128 usdtAmount,
        uint128 promoBonus,
        uint128 totalTokens,
        bool isNewBuyer
    ) internal {
        userTotalUSDT[buyer] += usdtAmount;
        userTotalMAGAX[buyer] += totalTokens; // Include bonus in user's total
        userPromoData[buyer].totalPromoBonus += promoBonus;
        
        totalUSDT += usdtAmount;
        totalMAGAX += totalTokens;
        
        if (isNewBuyer) {
            unchecked { 
                totalBuyers++; 
            }
        }
    }

    function _emitPromoEvents(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint16 promoBps,
        uint128 promoBonus,
        uint40 timestamp,
        uint8 stage,
        bool isNewBuyer,
        uint256 bonusReceiptIdx
    ) internal {
        emit PurchaseRecorded(buyer, usdtAmount, magaxAmount, timestamp, stage, userReceipts[buyer].length, isNewBuyer);
        emit PromoUsed(buyer, promoBps, promoBonus, stage, bonusReceiptIdx);
    }

    /**
     * @notice Get user's total promo bonus earned
     * @param user The user address
     * @return totalPromoBonus Total bonus tokens earned from all promos
     */
    function getUserPromoBonus(address user) external view returns (uint128) {
        return userPromoData[user].totalPromoBonus;
    }
}