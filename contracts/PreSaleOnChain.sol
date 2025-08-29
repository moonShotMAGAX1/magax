// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
error InvalidUsdTarget();
error PresaleTokenCapExceeded();
error StageAlreadyUsed();
error StageUsdOverTarget();

contract MAGAXPresaleReceipts is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant RECORDER_ROLE      = keccak256("RECORDER_ROLE");
    bytes32 public constant STAGE_MANAGER_ROLE = keccak256("STAGE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE     = keccak256("EMERGENCY_ROLE");
    bytes32 public constant FINALIZER_ROLE     = keccak256("FINALIZER_ROLE");

    // Limits
    uint128 public constant MAX_PURCHASE_USDT = 1_000_000 * 1e6; // 1M USDT max per purchase
    uint128 public constant MAX_TOTAL_USDT    = 10_000_000 * 1e6; // 10M USDT total presale limit
    uint8   public constant MAX_STAGES        = 50;

    // Referral constants
    uint16 public constant REFERRER_BONUS_BPS = 700;  // 7%
    uint16 public constant REFEREE_BONUS_BPS  = 500;  // 5%
    uint16 public constant BASIS_POINTS       = 10_000;

    // Promo constants
    uint16 public constant MAX_PROMO_BONUS_BPS = 5_000; // 50% cap
    uint16 public maxPromoCapBps = MAX_PROMO_BONUS_BPS;

    struct Receipt {
        uint128 usdt;     // 6-dec
        uint128 magax;    // 18-dec
        uint40  time;
        uint8   stage;
        bool    isBonus;
    }

    struct StageInfo {
        uint128 pricePerToken;    // 6-dec USDT per 1 MAGAX
        uint128 tokensAllocated;  // 18-dec (0 => no cap)
        uint128 tokensSold;       // 18-dec (includes bonuses for analytics/cap)
        uint128 usdTarget;        // 6-dec total USDT target for the stage
        uint128 usdRaised;        // 6-dec actual USDT raised (base usdt in receipt ONLY)
        bool isActive;
    }

    struct ReferralInfo {
        uint32  totalReferrals;      // count of successful referred purchases
        uint128 totalBonusEarned;    // referrer MAGAX bonus total
        uint128 totalRefereeBonus;   // referee MAGAX bonus total
    }

    struct UserPromoUsage {
        uint128 totalPromoBonus;     // user’s cumulative promo MAGAX
    }

    mapping(address => Receipt[]) public userReceipts;
    mapping(address => uint128)   public userTotalUSDT;
    mapping(address => uint128)   public userTotalMAGAX;

    mapping(address => ReferralInfo) public referralData;
    mapping(address => address)      public userReferrer;

    mapping(address => UserPromoUsage) public userPromoData;

    mapping(uint8 => StageInfo) public stages;
    uint8  public currentStage = 1;
    bool   public finalised;

    uint128 public totalUSDT;   // base USDT only
    uint128 public totalMAGAX;  // includes bonuses
    uint32  public totalBuyers;

    // Global presale token cap (10% of 1T supply = 100B * 1e18)
    uint256 public constant PRESALE_TOKEN_CAP = 100_000_000_000 * 1e18;

    event PurchaseRecorded(
        address indexed buyer,
        uint128 usdt,
        uint128 magax,
        uint40  time,
        uint8   indexed stage,
        uint256 totalUserReceipts,
        bool    isNewBuyer
    );

    event ReferralBonusAwarded(
        address indexed referrer,
        address indexed referee,
        uint128 referrerBonus,
        uint128 refereeBonus,
        uint8   stage
    );

    event ReferrerSet(address indexed user, address indexed referrer);

    event PromoUsed(
        address indexed user,
        uint16 promoBps,
        uint128 bonusTokens,
        uint8  stage,
        uint256 receiptIndex
    );

    event StageConfigured(
        uint8   indexed stage,
        uint128 pricePerToken,
        uint128 tokensAllocated,
        uint128 usdTarget
    );

    event StageActivated(uint8 indexed stage, address indexed operator);
    event StageDeactivated(uint8 indexed stage);

    event StageCompleted(uint8 indexed stage, uint128 tokensSold);

    event StageUSDProgress(uint8 indexed stage, uint128 usdRaised, uint128 usdTarget);

    event Finalised(uint40 time);

    event EmergencyTokenWithdraw(address indexed token, address indexed to, uint256 amount);

    event MaxPromoBpsUpdated(uint16 oldCap, uint16 newCap, address indexed updatedBy);

    constructor(address recorder, address stageManager, address admin) {
        if (recorder == address(0))     revert InvalidAddress();
        if (stageManager == address(0)) revert InvalidAddress();
        if (admin == address(0))        revert InvalidAddress();

        // Admin (e.g., Timelock)
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(STAGE_MANAGER_ROLE, admin);
        _grantRole(EMERGENCY_ROLE,     admin);
        _grantRole(FINALIZER_ROLE,     admin);

        // Operators
        _grantRole(RECORDER_ROLE,      recorder);
        _grantRole(STAGE_MANAGER_ROLE, stageManager);
    }

    function recordPurchase(
        address buyer,
        uint128 usdtAmount,   // 6-dec
        uint128 magaxAmount   // 18-dec
    ) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant {
        if (finalised) revert PresaleFinalised();
        _validatePurchase(buyer, usdtAmount, magaxAmount);

        uint8 stage = currentStage;
        StageInfo storage s = stages[stage];
        _validateStageAndPrice(stage, s, usdtAmount, magaxAmount);

        uint40 t = uint40(block.timestamp);
        _processPurchase(buyer, usdtAmount, magaxAmount, stage, s, t);
    }

    function recordPurchaseWithReferral(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer
    ) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant {
        if (finalised) revert PresaleFinalised();
        _validateReferralPurchase(buyer, usdtAmount, magaxAmount, referrer);

        uint8 stage = currentStage;
        StageInfo storage s = stages[stage];
        _validateStageAndPrice(stage, s, usdtAmount, magaxAmount);

        (uint128 refBonus, uint128 refEEBonus, /* total */) = _calculateBonuses(magaxAmount);
        uint128 totalTokensRequired = magaxAmount + refBonus + refEEBonus;
        if (s.tokensAllocated > 0 && s.tokensSold + totalTokensRequired > s.tokensAllocated) {
            revert InsufficientStageTokens();
        }

        uint40 t = uint40(block.timestamp);
        _processReferralPurchase(
            buyer, usdtAmount, magaxAmount,
            referrer, refBonus, refEEBonus, totalTokensRequired,
            stage, s, t
        );
    }

    function recordPurchaseWithPromo(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint16  promoBps
    ) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant {
        if (finalised) revert PresaleFinalised();
        _validatePurchase(buyer, usdtAmount, magaxAmount);
        _validatePromoBps(promoBps);

        uint8 stage = currentStage;
        StageInfo storage s = stages[stage];
        _validateStageAndPrice(stage, s, usdtAmount, magaxAmount);

        uint128 promoBonus = _calculatePromoBonus(magaxAmount, promoBps);
        uint128 totalTokens = magaxAmount + promoBonus;
        if (s.tokensAllocated > 0 && s.tokensSold + totalTokens > s.tokensAllocated) {
            revert InsufficientStageTokens();
        }

        uint40 t = uint40(block.timestamp);
        _processPromoLaunch(buyer, usdtAmount, magaxAmount, promoBps, promoBonus, totalTokens, stage, s, t);
    }

    function recordPurchaseWithPromoAndReferral(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,   // base, before bonuses
        uint16  promoBps,
        address referrer
    ) external whenNotPaused onlyRole(RECORDER_ROLE) nonReentrant {
        if (finalised) revert PresaleFinalised();
        _validatePromoBps(promoBps);
        _validateReferralPurchase(buyer, usdtAmount, magaxAmount, referrer);

        uint8 stage = currentStage;
        StageInfo storage s = stages[stage];
        _validateStageAndPrice(stage, s, usdtAmount, magaxAmount);

        _processPromoAndReferralPurchase(
            buyer, usdtAmount, magaxAmount, promoBps, referrer,
            uint40(block.timestamp), stage, s
        );
    }

    function _validatePurchase(address buyer, uint128 usdtAmount, uint128 magaxAmount) internal view {
        if (buyer == address(0)) revert InvalidAddress();
        if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
        if (usdtAmount > MAX_PURCHASE_USDT) revert ExceedsMaxPurchase();
        if (totalUSDT + usdtAmount > MAX_TOTAL_USDT) revert ExceedsTotalLimit();
    }

    function _validateReferralPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer
    ) internal view {
        if (buyer == address(0))    revert InvalidAddress();
        if (referrer == address(0)) revert InvalidReferrer();
        if (buyer == referrer)      revert SelfReferral();
        if (usdtAmount == 0 || magaxAmount == 0) revert InvalidAmount();
        if (usdtAmount > MAX_PURCHASE_USDT)      revert ExceedsMaxPurchase();
        if (totalUSDT + usdtAmount > MAX_TOTAL_USDT) revert ExceedsTotalLimit();
    }

    function _validateStageAndPrice(
        uint8 stage,
        StageInfo storage s,
        uint128 usdtAmount,
        uint128 magaxAmount
    ) internal view {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        if (!s.isActive) revert StageNotActive();
        // token cap only if configured
        if (s.tokensAllocated > 0 && s.tokensSold + magaxAmount > s.tokensAllocated) {
            revert InsufficientStageTokens();
        }
        _validatePrice(usdtAmount, magaxAmount, s.pricePerToken);
    }

    function _validatePromoBps(uint16 promoBps) internal view {
        if (promoBps == 0 || promoBps > maxPromoCapBps) revert InvalidPromoBps();
    }

    function _calculateBonuses(uint128 magaxAmount)
        internal
        pure
        returns (uint128 referrerBonus, uint128 refereeBonus, uint128 totalTokens)
    {
        referrerBonus = (magaxAmount * REFERRER_BONUS_BPS) / BASIS_POINTS;
        refereeBonus  = (magaxAmount * REFEREE_BONUS_BPS)  / BASIS_POINTS;
        totalTokens   = magaxAmount + referrerBonus + refereeBonus;
    }

    function _calculatePromoBonus(uint128 magaxAmount, uint16 promoBps) internal pure returns (uint128) {
        return (magaxAmount * promoBps) / BASIS_POINTS;
    }

    /**
     * @dev Validates price: usdtAmount ≈ magaxAmount * pricePerToken / 1e18 with ±1 USDT tolerance
     */
    function _validatePrice(uint128 usdtAmount, uint128 magaxAmount, uint128 pricePerToken) internal pure {
        uint256 expectedUSDT = (uint256(magaxAmount) * pricePerToken) / 1e18;
        if (usdtAmount > expectedUSDT) {
            if (usdtAmount - expectedUSDT > 1e6) revert PriceMismatch(); // > 1 USDT over
        } else {
            if (expectedUSDT - usdtAmount > 1e6) revert PriceMismatch(); // > 1 USDT under
        }
    }

    function _setReferrerIfNeeded(address buyer, address referrer) internal returns (bool setNow) {
        if (userReferrer[buyer] == address(0)) {
            userReferrer[buyer] = referrer;
            emit ReferrerSet(buyer, referrer);
            return true;
        }
        return false;
    }

    function _processPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint8   stage,
        StageInfo storage s,
        uint40  timestamp
    ) internal {
        bool isNewBuyer = (userReceipts[buyer].length == 0);

        // main receipt
        userReceipts[buyer].push(Receipt(usdtAmount, magaxAmount, timestamp, stage, false));

        // totals
        // enforce global cap before modifying totals
    if (uint256(totalMAGAX) + uint256(magaxAmount) > PRESALE_TOKEN_CAP) revert PresaleTokenCapExceeded();
        userTotalUSDT[buyer]  += usdtAmount;
        userTotalMAGAX[buyer] += magaxAmount;
        totalUSDT  += usdtAmount;   // base only
        totalMAGAX += magaxAmount;

        // soft per-stage USD overshoot guard (allow up to 1 USDT over target)
        if (s.usdTarget > 0) {
            uint256 afterUsd = uint256(s.usdRaised) + uint256(usdtAmount);
            if (afterUsd > uint256(s.usdTarget) && afterUsd - uint256(s.usdTarget) > 1e6) {
                revert StageUsdOverTarget();
            }
        }

        uint128 prevUsd  = s.usdRaised;
        uint128 prevSold = s.tokensSold;
        unchecked {
            s.usdRaised  = prevUsd + usdtAmount; // primary completion metric
            s.tokensSold = prevSold + magaxAmount;
        }

        emit PurchaseRecorded(buyer, usdtAmount, magaxAmount, timestamp, stage, userReceipts[buyer].length, isNewBuyer);
        emit StageUSDProgress(stage, s.usdRaised, s.usdTarget);

        if (isNewBuyer) { unchecked { totalBuyers++; } }

        // emit StageCompleted only on threshold crossing
        bool hitUsd = _crossed(prevUsd, s.usdRaised, s.usdTarget);
        bool hitCap = (s.tokensAllocated > 0 && prevSold < s.tokensAllocated && s.tokensSold >= s.tokensAllocated);
        if (hitUsd || hitCap) emit StageCompleted(stage, s.tokensSold);
    }

    function _processReferralPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        address referrer,
        uint128 referrerBonus,
        uint128 refereeBonus,
        uint128 totalTokensRequired,
        uint8   stage,
        StageInfo storage s,
        uint40  timestamp
    ) internal {
    bool newlyReferred = _setReferrerIfNeeded(buyer, referrer);

        bool isNewBuyer = (userReceipts[buyer].length == 0);

        // receipts
        userReceipts[buyer].push(Receipt(usdtAmount, magaxAmount, timestamp, stage, false));
        userReceipts[buyer].push(Receipt(0,         refereeBonus, timestamp, stage, true));
        userReceipts[referrer].push(Receipt(0,      referrerBonus, timestamp, stage, true));

        // totals
    if (uint256(totalMAGAX) + uint256(totalTokensRequired) > PRESALE_TOKEN_CAP) revert PresaleTokenCapExceeded();
        userTotalUSDT[buyer]   += usdtAmount;
        userTotalMAGAX[buyer]  += (magaxAmount + refereeBonus);
        userTotalMAGAX[referrer] += referrerBonus;

        totalUSDT  += usdtAmount;
        totalMAGAX += totalTokensRequired;

        // soft per-stage USD overshoot guard
        if (s.usdTarget > 0) {
            uint256 afterUsd = uint256(s.usdRaised) + uint256(usdtAmount);
            if (afterUsd > uint256(s.usdTarget) && afterUsd - uint256(s.usdTarget) > 1e6) {
                revert StageUsdOverTarget();
            }
        }

        uint128 prevUsd  = s.usdRaised;
        uint128 prevSold = s.tokensSold;
        unchecked {
            s.usdRaised  = prevUsd + usdtAmount;
            s.tokensSold = prevSold + totalTokensRequired;
            if (newlyReferred) { referralData[referrer].totalReferrals++; }
        }
        referralData[referrer].totalBonusEarned += referrerBonus;
        referralData[buyer].totalRefereeBonus   += refereeBonus;

        emit PurchaseRecorded(buyer, usdtAmount, magaxAmount, timestamp, stage, userReceipts[buyer].length, isNewBuyer);
        emit ReferralBonusAwarded(referrer, buyer, referrerBonus, refereeBonus, stage);
        emit StageUSDProgress(stage, s.usdRaised, s.usdTarget);

        if (isNewBuyer) { unchecked { totalBuyers++; } }

        bool hitUsd = _crossed(prevUsd, s.usdRaised, s.usdTarget);
        bool hitCap = (s.tokensAllocated > 0 && prevSold < s.tokensAllocated && s.tokensSold >= s.tokensAllocated);
        if (hitUsd || hitCap) emit StageCompleted(stage, s.tokensSold);
    }

    function _processPromoLaunch(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint16  promoBps,
        uint128 promoBonus,
        uint128 totalTokens,
        uint8   stage,
        StageInfo storage s,
        uint40  timestamp
    ) internal {
        bool isNewBuyer = (userReceipts[buyer].length == 0);

        // receipts
        userReceipts[buyer].push(Receipt(usdtAmount, magaxAmount, timestamp, stage, false));
        userReceipts[buyer].push(Receipt(0,         promoBonus,   timestamp, stage, true));
        uint256 bonusReceiptIdx = userReceipts[buyer].length - 1;

        // totals
    if (uint256(totalMAGAX) + uint256(totalTokens) > PRESALE_TOKEN_CAP) revert PresaleTokenCapExceeded();
        userTotalUSDT[buyer]  += usdtAmount;
        userTotalMAGAX[buyer] += totalTokens;
        userPromoData[buyer].totalPromoBonus += promoBonus;

        totalUSDT  += usdtAmount;
        totalMAGAX += totalTokens;

        if (s.usdTarget > 0) {
            uint256 afterUsd = uint256(s.usdRaised) + uint256(usdtAmount);
            if (afterUsd > uint256(s.usdTarget) && afterUsd - uint256(s.usdTarget) > 1e6) {
                revert StageUsdOverTarget();
            }
        }

        uint128 prevUsd  = s.usdRaised;
        uint128 prevSold = s.tokensSold;
        unchecked {
            s.usdRaised  = prevUsd + usdtAmount;
            s.tokensSold = prevSold + totalTokens;
        }

        emit PurchaseRecorded(buyer, usdtAmount, magaxAmount, timestamp, stage, userReceipts[buyer].length, isNewBuyer);
        emit PromoUsed(buyer, promoBps, promoBonus, stage, bonusReceiptIdx);
        emit StageUSDProgress(stage, s.usdRaised, s.usdTarget);

        if (isNewBuyer) { unchecked { totalBuyers++; } }

        bool hitUsd = _crossed(prevUsd, s.usdRaised, s.usdTarget);
        bool hitCap = (s.tokensAllocated > 0 && prevSold < s.tokensAllocated && s.tokensSold >= s.tokensAllocated);
        if (hitUsd || hitCap) emit StageCompleted(stage, s.tokensSold);
    }

    function _processPromoAndReferralPurchase(
        address buyer,
        uint128 usdtAmount,
        uint128 magaxAmount,
        uint16  promoBps,
        address referrer,
        uint40  timestamp,
        uint8   stage,
        StageInfo storage s
    ) internal {
    bool newlyReferred = _setReferrerIfNeeded(buyer, referrer);

        uint128 promoBonus = _calculatePromoBonus(magaxAmount, promoBps);
        (uint128 refBonus, uint128 refEEBonus, ) = _calculateBonuses(magaxAmount);

        uint128 totalBuyerTokens = magaxAmount + promoBonus + refEEBonus;
        uint128 totalStageTokens = totalBuyerTokens + refBonus;

        if (s.tokensAllocated > 0 && s.tokensSold + totalStageTokens > s.tokensAllocated) {
            revert InsufficientStageTokens();
        }

        bool isNewBuyer = (userReceipts[buyer].length == 0);

        // receipts
        userReceipts[buyer].push(Receipt(usdtAmount, magaxAmount, timestamp, stage, false));
        userReceipts[buyer].push(Receipt(0,         promoBonus,   timestamp, stage, true));
        userReceipts[buyer].push(Receipt(0,         refEEBonus,   timestamp, stage, true));
        userReceipts[referrer].push(Receipt(0,      refBonus,     timestamp, stage, true));

        // totals
    if (uint256(totalMAGAX) + uint256(totalStageTokens) > PRESALE_TOKEN_CAP) revert PresaleTokenCapExceeded();
        userTotalUSDT[buyer]  += usdtAmount;
        userTotalMAGAX[buyer] += totalBuyerTokens;
        userTotalMAGAX[referrer] += refBonus;
        userPromoData[buyer].totalPromoBonus += promoBonus;

        totalUSDT  += usdtAmount;
        totalMAGAX += totalStageTokens;

        if (s.usdTarget > 0) {
            uint256 afterUsd = uint256(s.usdRaised) + uint256(usdtAmount);
            if (afterUsd > uint256(s.usdTarget) && afterUsd - uint256(s.usdTarget) > 1e6) {
                revert StageUsdOverTarget();
            }
        }

        uint128 prevUsd  = s.usdRaised;
        uint128 prevSold = s.tokensSold;
        unchecked {
            s.usdRaised  = prevUsd + usdtAmount;
            s.tokensSold = prevSold + totalStageTokens;
            if (newlyReferred) { referralData[referrer].totalReferrals++; }
        }
        referralData[referrer].totalBonusEarned += refBonus;
        referralData[buyer].totalRefereeBonus   += refEEBonus;

        emit PurchaseRecorded(buyer, usdtAmount, magaxAmount, timestamp, stage, userReceipts[buyer].length, isNewBuyer);
        emit PromoUsed(buyer, promoBps, promoBonus, stage, userReceipts[buyer].length - 2);
        emit ReferralBonusAwarded(referrer, buyer, refBonus, refEEBonus, stage);
        emit StageUSDProgress(stage, s.usdRaised, s.usdTarget);

        if (isNewBuyer) { unchecked { totalBuyers++; } }

        bool hitUsd = _crossed(prevUsd, s.usdRaised, s.usdTarget);
        bool hitCap = (s.tokensAllocated > 0 && prevSold < s.tokensAllocated && s.tokensSold >= s.tokensAllocated);
        if (hitUsd || hitCap) emit StageCompleted(stage, s.tokensSold);
    }

    function _crossed(uint128 before, uint128 after_, uint128 target) private pure returns (bool) {
        return target > 0 && before < target && after_ >= target;
    }

    function getStageTokenInfo(uint8 stage) external view returns (
        uint128 tokensAllocated,
        uint128 tokensSold,
        uint128 tokensRemaining,
        bool    isActive
    ) {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        StageInfo memory s = stages[stage];
        uint128 rem = (s.tokensAllocated > s.tokensSold) ? (s.tokensAllocated - s.tokensSold) : 0;
        return (s.tokensAllocated, s.tokensSold, rem, s.isActive);
    }

    function getReceiptsPaginated(address buyer, uint256 offset, uint256 limit)
        external
        view
        returns (Receipt[] memory)
    {
        Receipt[] storage receipts = userReceipts[buyer];
        uint256 total = receipts.length;
        if (offset >= total) return new Receipt[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

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
        totalPurchases      = receipts.length;
        totalUSDTSpent      = userTotalUSDT[buyer];
        totalMAGAXAllocated = userTotalMAGAX[buyer];
        if (totalPurchases == 0) return (0, totalUSDTSpent, totalMAGAXAllocated, 0, 0);
        firstPurchaseTime = receipts[0].time;
        lastPurchaseTime  = receipts[totalPurchases - 1].time;
    }

    function getPresaleStats() external view returns (
        uint128 totalUSDTRaised,
        uint128 totalMAGAXSold,
        uint32  totalUniqueBuyers
    ) {
        return (totalUSDT, totalMAGAX, totalBuyers);
    }

    /// USD-centric getters (primary)
    function getStageUsdInfo(uint8 stage) external view returns (
        uint128 usdTarget,
        uint128 usdRaised,
        uint128 usdRemaining,
        bool    isActive
    ) {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        StageInfo memory s = stages[stage];
        uint128 rem = s.usdTarget > s.usdRaised ? s.usdTarget - s.usdRaised : 0;
        return (s.usdTarget, s.usdRaised, rem, s.isActive);
    }

    function getCurrentStageUsdInfo() external view returns (
        uint8   stage,
        uint128 pricePerToken,
        uint128 usdTarget,
        uint128 usdRaised,
        uint128 usdRemaining,
        bool    isActive
    ) {
        StageInfo memory s = stages[currentStage];
        uint128 rem = s.usdTarget > s.usdRaised ? s.usdTarget - s.usdRaised : 0;
        return (currentStage, s.pricePerToken, s.usdTarget, s.usdRaised, rem, s.isActive);
    }

    function getReferralInfo(address user) external view returns (uint32 totalReferrals, uint128 totalBonusEarned) {
        ReferralInfo memory info = referralData[user];
        return (info.totalReferrals, info.totalBonusEarned + info.totalRefereeBonus);
    }

    function hasReferrer(address user) external view returns (bool) {
        return userReferrer[user] != address(0);
    }

    function getUserPromoBonus(address user) external view returns (uint128) {
        return userPromoData[user].totalPromoBonus;
    }

    function configureStage(
        uint8   stage,
        uint128 pricePerToken,     // 6-dec (required)
        uint128 tokensAllocated,   // 18-dec (0 => no token cap)
        uint128 usdTarget          // 6-dec (required)
    ) external onlyRole(STAGE_MANAGER_ROLE) {
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        if (pricePerToken == 0) revert InvalidPrice();
        if (usdTarget == 0)     revert InvalidUsdTarget();
        StageInfo storage s = stages[stage];
        // Guard against reconfiguring active or used stages
        if (s.isActive) revert StageAlreadyActive();
        if (s.tokensSold > 0 || s.usdRaised > 0) revert StageAlreadyUsed();
        // First-time or unused configuration
        s.pricePerToken   = pricePerToken;
        s.tokensAllocated = tokensAllocated; // 0 => unlimited (bounded by global cap)
        s.tokensSold      = 0;
        s.usdTarget       = usdTarget;
        s.usdRaised       = 0;
        emit StageConfigured(stage, pricePerToken, tokensAllocated, usdTarget);
    }

    /**
     * @notice Activates a specific presale stage and deactivates the current one (manual control)
     */
    function activateStage(uint8 stage) external onlyRole(STAGE_MANAGER_ROLE) {
        if (finalised) revert PresaleFinalised();
        if (stage == 0 || stage > MAX_STAGES) revert InvalidStage();
        if (stages[stage].pricePerToken == 0) revert InvalidPrice(); // ensure configured
        if (stages[stage].usdTarget == 0)     revert InvalidUsdTarget();
        if (stages[stage].isActive)           revert StageAlreadyActive();

        if (currentStage > 0 && currentStage <= MAX_STAGES && stages[currentStage].isActive) {
            stages[currentStage].isActive = false;
            emit StageDeactivated(currentStage);
        }

        stages[stage].isActive = true;
        currentStage = stage;
        emit StageActivated(stage, msg.sender);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function finalise() external onlyRole(FINALIZER_ROLE) {
        finalised = true;
        _pause();
        emit Finalised(uint40(block.timestamp));
    }

    function setMaxPromoBps(uint16 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCap == 0 || newCap > BASIS_POINTS) revert InvalidPromoBps();
        uint16 oldCap = maxPromoCapBps;
        maxPromoCapBps = newCap;
        emit MaxPromoBpsUpdated(oldCap, newCap, msg.sender);
    }

    function emergencyTokenWithdraw(IERC20 token, address to) external onlyRole(EMERGENCY_ROLE) nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0) revert NoTokensToWithdraw();
        token.safeTransfer(to, bal);
        emit EmergencyTokenWithdraw(address(token), to, bal);
    }

    receive() external payable { revert EthNotAccepted(); }
    fallback() external payable { revert FallbackNotAllowed(); }
}
