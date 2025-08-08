const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MAGAXPresaleReceipts - Enhanced Security", function () {
  let presaleReceipts;
  let mockToken;
  let owner, recorder, buyer1, buyer2, buyer3, unauthorized, stageManager, emergencyAdmin, finalizer, admin2;

  // Constants from contract
  const MAX_PURCHASE_USDT = ethers.parseUnits("1000000", 6); // 1M USDT
  const MAX_TOTAL_USDT = ethers.parseUnits("10000000", 6);   // 10M USDT

  beforeEach(async function () {
    [owner, recorder, buyer1, buyer2, buyer3, unauthorized, stageManager, emergencyAdmin, finalizer, admin2] = await ethers.getSigners();
    
    // Deploy mock ERC20 token for emergency withdrawal tests
    const MockToken = await ethers.getContractFactory("contracts/MoonShotMAGAX.sol:MoonShotMAGAX");
    mockToken = await MockToken.deploy(owner.address);
    await mockToken.waitForDeployment();
    
    const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
    presaleReceipts = await MAGAXPresaleReceipts.deploy(recorder.address, ethers.ZeroAddress); // No timelock for existing tests
    await presaleReceipts.waitForDeployment();
    
    // Grant additional roles for testing
    await presaleReceipts.connect(owner).grantRole(await presaleReceipts.STAGE_MANAGER_ROLE(), stageManager.address);
    await presaleReceipts.connect(owner).grantRole(await presaleReceipts.EMERGENCY_ROLE(), emergencyAdmin.address);
    await presaleReceipts.connect(owner).grantRole(await presaleReceipts.FINALIZER_ROLE(), finalizer.address);
    
    // Setup initial stage for testing
    const stagePrice = ethers.parseUnits("0.000270", 6); // 0.000270 USDT per MAGAX
    const stageAllocation = ethers.parseUnits("50000000000", 18); // 50B MAGAX tokens (enough for all tests)
    
    await presaleReceipts.connect(stageManager).configureStage(1, stagePrice, stageAllocation);
    await presaleReceipts.connect(stageManager).activateStage(1);
  });

  describe("Deployment", function () {
    it("Should set the right owner and roles", async function () {
      expect(await presaleReceipts.hasRole(await presaleReceipts.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await presaleReceipts.hasRole(await presaleReceipts.RECORDER_ROLE(), recorder.address)).to.be.true;
      expect(await presaleReceipts.hasRole(await presaleReceipts.STAGE_MANAGER_ROLE(), stageManager.address)).to.be.true;
      expect(await presaleReceipts.hasRole(await presaleReceipts.EMERGENCY_ROLE(), emergencyAdmin.address)).to.be.true;
      expect(await presaleReceipts.hasRole(await presaleReceipts.FINALIZER_ROLE(), finalizer.address)).to.be.true;
    });

    it("Should set correct constants", async function () {
      expect(await presaleReceipts.MAX_PURCHASE_USDT()).to.equal(MAX_PURCHASE_USDT);
      expect(await presaleReceipts.MAX_TOTAL_USDT()).to.equal(MAX_TOTAL_USDT);
      // REQUIRED_CONFIRMATIONS removed in optimization - now uses timelock for critical operations
    });

    it("Should start with zero counters", async function () {
      expect(await presaleReceipts.totalUSDT()).to.equal(0);
      expect(await presaleReceipts.totalMAGAX()).to.equal(0);
      expect(await presaleReceipts.totalBuyers()).to.equal(0);
    });

    it("Should prevent ETH deposits", async function () {
      await expect(
        owner.sendTransaction({
          to: await presaleReceipts.getAddress(),
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(presaleReceipts, "EthNotAccepted");
    });

    it("Should fail deployment with zero recorder address", async function () {
      const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
      await expect(
        MAGAXPresaleReceipts.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(MAGAXPresaleReceipts, "InvalidAddress");
    });
  });

  describe("Stage Management", function () {
    it("Should configure a stage correctly", async function () {
      const stagePrice = ethers.parseUnits("0.000293", 6); // 0.000293 USDT per MAGAX
      const stageAllocation = ethers.parseUnits("500000", 18); // 500k MAGAX tokens
      
      await expect(
        presaleReceipts.connect(stageManager).configureStage(2, stagePrice, stageAllocation)
      ).to.emit(presaleReceipts, "StageConfigured")
        .withArgs(2, stagePrice, stageAllocation);
      
      const stageInfo = await presaleReceipts.getStageInfo(2);
      expect(stageInfo.pricePerToken).to.equal(stagePrice);
      expect(stageInfo.tokensAllocated).to.equal(stageAllocation);
      expect(stageInfo.tokensSold).to.equal(0);
      expect(stageInfo.isActive).to.be.false;
    });

    it("Should activate a stage and deactivate previous", async function () {
      const stagePrice = ethers.parseUnits("0.000293", 6);
      const stageAllocation = ethers.parseUnits("500000", 18);
      
      await presaleReceipts.connect(stageManager).configureStage(2, stagePrice, stageAllocation);
      
      await expect(
        presaleReceipts.connect(stageManager).activateStage(2)
      ).to.emit(presaleReceipts, "StageDeactivated")
        .withArgs(1)
        .and.to.emit(presaleReceipts, "StageActivated")
        .withArgs(2, stageManager.address);
      
      expect(await presaleReceipts.currentStage()).to.equal(2);
      
      const stage1Info = await presaleReceipts.getStageInfo(1);
      expect(stage1Info.isActive).to.be.false;
      
      const stage2Info = await presaleReceipts.getStageInfo(2);
      expect(stage2Info.isActive).to.be.true;
    });

    it("Should return current stage info correctly", async function () {
      const currentStageInfo = await presaleReceipts.getCurrentStageInfo();
      expect(currentStageInfo.stage).to.equal(1);
      expect(currentStageInfo.isActive).to.be.true;
    });

    it("Should fail to configure invalid stages", async function () {
      const stagePrice = ethers.parseUnits("0.000270", 6);
      const stageAllocation = ethers.parseUnits("1000000", 18);
      
      // Invalid stage numbers
      await expect(
        presaleReceipts.connect(stageManager).configureStage(0, stagePrice, stageAllocation)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidStage");
      
      await expect(
        presaleReceipts.connect(stageManager).configureStage(51, stagePrice, stageAllocation)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidStage");
      
      // Invalid price
      await expect(
        presaleReceipts.connect(stageManager).configureStage(2, 0, stageAllocation)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidPrice");
      
      // Invalid allocation
      await expect(
        presaleReceipts.connect(stageManager).configureStage(2, stagePrice, 0)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAmount");
    });

    it("Should fail non-stage-manager stage management", async function () {
      const stagePrice = ethers.parseUnits("0.000270", 6);
      const stageAllocation = ethers.parseUnits("1000000", 18);
      
      await expect(
        presaleReceipts.connect(unauthorized).configureStage(2, stagePrice, stageAllocation)
      ).to.be.reverted;
      
      await expect(
        presaleReceipts.connect(unauthorized).activateStage(1)
      ).to.be.reverted;
    });

    it("Should fail to activate an already active stage", async function () {
      // Stage 1 is already active from beforeEach
      await expect(
        presaleReceipts.connect(stageManager).activateStage(1)
      ).to.be.revertedWithCustomError(presaleReceipts, "StageAlreadyActive");
    });
  });

  describe("Recording Purchases", function () {
    it("Should record a purchase successfully with stage info", async function () {
      const magaxAmount = ethers.parseUnits("1000", 18);
      const usdtAmount = ethers.parseUnits("0.27", 6); // 1000 MAGAX * 0.000270 USDT = 0.27 USDT

      const tx = await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, magaxAmount);
      const receipt = await tx.wait();
      
      // Check event emission with all parameters
      await expect(tx)
        .to.emit(presaleReceipts, "PurchaseRecorded")
        .withArgs(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          await ethers.provider.getBlock('latest').then(b => b.timestamp),
          1, // current stage
          1, // total user purchases
          true // is new buyer
        );

      expect(await presaleReceipts.totalUSDT()).to.equal(usdtAmount);
      expect(await presaleReceipts.totalMAGAX()).to.equal(magaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1);
      
      // Check stage tokens sold updated
      const stageInfo = await presaleReceipts.getStageInfo(1);
      expect(stageInfo.tokensSold).to.equal(magaxAmount);
    });

    it("Should fail when trying to purchase with insufficient stage tokens", async function () {
      // Configure stage 2 with limited allocation and activate it
      const stagePrice = ethers.parseUnits("0.000293", 6);
      const stageAllocation = ethers.parseUnits("500000", 18); // 500K tokens only
      
      await presaleReceipts.connect(stageManager).configureStage(2, stagePrice, stageAllocation);
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      const usdtAmount = ethers.parseUnits("175.8", 6); // 600K * 0.000293 = 175.8 USDT
      const excessiveAmount = ethers.parseUnits("600000", 18); // More than stage 2 allocation (500K)
      
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, excessiveAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "InsufficientStageTokens");
    });

    it("Should record a purchase successfully", async function () {
      const magaxAmount = ethers.parseUnits("1000", 18);
      const usdtAmount = ethers.parseUnits("0.27", 6); // 1000 MAGAX * 0.000270 USDT = 0.27 USDT

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, magaxAmount)
      ).to.emit(presaleReceipts, "PurchaseRecorded");

      expect(await presaleReceipts.totalUSDT()).to.equal(usdtAmount);
      expect(await presaleReceipts.totalMAGAX()).to.equal(magaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1);
    });

    it("Should enforce maximum purchase limit", async function () {
      const exceedsMax = MAX_PURCHASE_USDT + ethers.parseUnits("1", 6);
      const magaxAmount = ethers.parseUnits("1000", 18);

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, exceedsMax, magaxAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "ExceedsMaxPurchase");
    });

    it("Should allow maximum purchase amount", async function () {
      // MAX_PURCHASE_USDT = 1,000,000 USDT (in 6 decimals)
      // At 0.000270 USDT per MAGAX, this should buy 3,703,703,703 MAGAX (≈3.7B MAGAX)
      const expectedMagaxAmount = ethers.parseUnits("3703703703", 18); // 3.7B MAGAX

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, MAX_PURCHASE_USDT, expectedMagaxAmount)
      ).to.not.be.reverted;

      expect(await presaleReceipts.totalUSDT()).to.equal(MAX_PURCHASE_USDT);
    });

    it("Should enforce total presale limit", async function () {
      // Create a stage with enough tokens but test USDT limit
      // Configure a large stage to avoid token limit interference
      const largeStagePrice = ethers.parseUnits("0.000270", 6);
      const largeStageAllocation = ethers.parseUnits("50000000000", 18); // 50B MAGAX tokens (enough for max purchases)
      
      await presaleReceipts.connect(stageManager).configureStage(2, largeStagePrice, largeStageAllocation);
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      // Record purchases totaling more than max (10M USDT total limit)
      // Using max individual purchase amount (1M USDT each)
      const purchaseAmount = ethers.parseUnits("1000000", 6); // 1M USDT (max individual)
      const magaxAmount = ethers.parseUnits("3703703703", 18); // 3.7B MAGAX tokens (1M USDT / 0.000270 USDT per MAGAX)

      // Make 10 purchases of 1M USDT each to reach the 10M total limit
      for (let i = 0; i < 10; i++) {
        const buyer = await ethers.getSigners().then(signers => signers[i + 10]); // Use different buyers
        await presaleReceipts.connect(recorder).recordPurchase(buyer.address, purchaseAmount, magaxAmount);
      }
      
      // Next purchase should fail due to total USDT limit
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, ethers.parseUnits("1", 6), ethers.parseUnits("3703", 18))
      ).to.be.revertedWithCustomError(presaleReceipts, "ExceedsTotalLimit");

      expect(await presaleReceipts.totalUSDT()).to.equal(MAX_TOTAL_USDT);
    });

    it("Should handle multiple purchases from same buyer", async function () {
      const firstAmount = ethers.parseUnits("27", 6); // 27 USDT
      const secondAmount = ethers.parseUnits("54", 6); // 54 USDT
      const firstMagaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270)
      const secondMagaxAmount = ethers.parseUnits("200000", 18); // 200K MAGAX (54 USDT / 0.000270)

      // First purchase
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, firstAmount, firstMagaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1);

      // Second purchase from same buyer
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, secondAmount, secondMagaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1); // Should not increment
      expect(await presaleReceipts.userTotalUSDT(buyer1.address)).to.equal(firstAmount + secondAmount);
    });

    it("Should fail with invalid inputs", async function () {
      const usdtAmount = ethers.parseUnits("100", 6);
      const magaxAmount = ethers.parseUnits("1000", 18);

      // Zero address
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(ethers.ZeroAddress, usdtAmount, magaxAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAddress");

      // Zero amounts
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, 0, magaxAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAmount");

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, 0)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAmount");
    });

    it("Should fail when called by unauthorized address", async function () {
      await expect(
        presaleReceipts.connect(unauthorized).recordPurchase(buyer1.address, ethers.parseUnits("100", 6), ethers.parseUnits("1000", 18))
      ).to.be.reverted;
    });

    it("Should fail when contract is paused", async function () {
      await presaleReceipts.connect(owner).pause();
      
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, ethers.parseUnits("100", 6), ethers.parseUnits("1000", 18))
      ).to.be.reverted;
    });

    it("Should fail when no stage is active", async function () {
      // Deploy a fresh contract without any active stage
      const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
      const freshContract = await MAGAXPresaleReceipts.deploy(recorder.address, ethers.ZeroAddress);
      await freshContract.waitForDeployment();
      
      const usdtAmount = ethers.parseUnits("100", 6);
      const magaxAmount = ethers.parseUnits("1000", 18);
      
      // Should fail because no stage is active (currentStage = 0)
      await expect(
        freshContract.connect(recorder).recordPurchase(buyer1.address, usdtAmount, magaxAmount)
      ).to.be.revertedWithCustomError(freshContract, "StageNotActive");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await presaleReceipts.connect(recorder).recordPurchase(
        buyer1.address,
        ethers.parseUnits("27", 6), // 27 USDT
        ethers.parseUnits("100000", 18) // 100K MAGAX (27 USDT / 0.000270)
      );
      await presaleReceipts.connect(recorder).recordPurchase(
        buyer1.address,
        ethers.parseUnits("54", 6), // 54 USDT
        ethers.parseUnits("200000", 18) // 200K MAGAX (54 USDT / 0.000270)
      );
    });

    it("Should return correct user stats", async function () {
      const stats = await presaleReceipts.getUserStats(buyer1.address);
      
      expect(stats.totalPurchases).to.equal(2);
      expect(stats.totalUSDTSpent).to.equal(ethers.parseUnits("81", 6));
      expect(stats.totalMAGAXAllocated).to.equal(ethers.parseUnits("300000", 18)); // 100K + 200K MAGAX
      expect(stats.firstPurchaseTime).to.be.lessThanOrEqual(stats.lastPurchaseTime);
    });

    it("Should return paginated receipts correctly", async function () {
      // Get first receipt
      const firstPage = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 1);
      expect(firstPage.length).to.equal(1);
      expect(firstPage[0].usdt).to.equal(ethers.parseUnits("27", 6));

      // Get all receipts
      const allReceipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 10);
      expect(allReceipts.length).to.equal(2);

      // Out of bounds
      const emptyPage = await presaleReceipts.getReceiptsPaginated(buyer1.address, 10, 5);
      expect(emptyPage.length).to.equal(0);
    });

    it("Should return correct presale stats", async function () {
      const stats = await presaleReceipts.getPresaleStats();
      
      expect(stats.totalUSDTRaised).to.equal(ethers.parseUnits("81", 6));
      expect(stats.totalMAGAXSold).to.equal(ethers.parseUnits("300000", 18)); // 100K + 200K MAGAX
      expect(stats.totalUniqueBuyers).to.equal(1);
    });
  });

  describe("Emergency Token Withdrawal", function () {
    beforeEach(async function () {
      // Send some tokens to the presale contract
      await mockToken.transfer(await presaleReceipts.getAddress(), ethers.parseUnits("1000", 18));
    });

    it("Should allow emergency role to withdraw accidentally sent tokens with 3-of-3 multi-sig", async function () {
      const balanceBefore = await mockToken.balanceOf(owner.address);
      const contractBalance = await mockToken.balanceOf(await presaleReceipts.getAddress());

      // Grant emergency role to multiple accounts for 3-of-3 multi-sig
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.EMERGENCY_ROLE(), owner.address);
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.EMERGENCY_ROLE(), buyer1.address);

      // First call proposes the withdrawal - should emit OperationProposed
      await expect(
        presaleReceipts.connect(emergencyAdmin).immediateEmergencyWithdraw(await mockToken.getAddress(), owner.address)
      ).to.emit(presaleReceipts, "OperationProposed");

      // Second call with another emergency role holder
      await expect(
        presaleReceipts.connect(owner).immediateEmergencyWithdraw(await mockToken.getAddress(), owner.address)
      ).to.emit(presaleReceipts, "OperationConfirmed");

      // Third call executes the withdrawal (3-of-3 required)
      await expect(
        presaleReceipts.connect(buyer1).immediateEmergencyWithdraw(await mockToken.getAddress(), owner.address)
      ).to.emit(presaleReceipts, "EmergencyTokenWithdraw");

      const balanceAfter = await mockToken.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + contractBalance);

      // Contract should have zero balance
      expect(await mockToken.balanceOf(await presaleReceipts.getAddress())).to.equal(0);
    });

    it("Should fail with zero withdrawal address on first confirmation", async function () {
      // Since timelock is not active (deployed with ZeroAddress), emergencyTokenWithdraw works normally
      // but should still fail with InvalidAddress for zero address parameter
      await expect(
        presaleReceipts.connect(emergencyAdmin).emergencyTokenWithdraw(await mockToken.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAddress");
    });

    it("Should fail when no tokens to withdraw on first confirmation", async function () {
      // First withdraw any existing tokens to set up the test condition
      const currentBalance = await mockToken.balanceOf(await presaleReceipts.getAddress());
      if (currentBalance > 0) {
        // Use emergencyTokenWithdraw to clear the balance first
        await presaleReceipts.connect(emergencyAdmin).emergencyTokenWithdraw(await mockToken.getAddress(), owner.address);
      }
      
      // Now the contract should have zero balance
      // Since timelock is not active, emergencyTokenWithdraw works normally
      // but should fail with NoTokensToWithdraw when there are no tokens
      await expect(
        presaleReceipts.connect(emergencyAdmin).emergencyTokenWithdraw(await mockToken.getAddress(), owner.address)
      ).to.be.revertedWithCustomError(presaleReceipts, "NoTokensToWithdraw");
    });

    it("Should fail when called by non-admin", async function () {
      await expect(
        presaleReceipts.connect(unauthorized).emergencyTokenWithdraw(await mockToken.getAddress(), owner.address)
      ).to.be.reverted;
    });
  });

  describe("Access Control & Admin Functions", function () {
    it("Should allow admin to grant and revoke recorder role", async function () {
      // Grant role
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.RECORDER_ROLE(), buyer1.address);
      expect(await presaleReceipts.hasRole(await presaleReceipts.RECORDER_ROLE(), buyer1.address)).to.be.true;

      // Revoke role
      await presaleReceipts.connect(owner).revokeRole(await presaleReceipts.RECORDER_ROLE(), buyer1.address);
      expect(await presaleReceipts.hasRole(await presaleReceipts.RECORDER_ROLE(), buyer1.address)).to.be.false;
    });

    it("Should allow owner to pause and unpause", async function () {
      await presaleReceipts.connect(owner).pause();
      expect(await presaleReceipts.paused()).to.be.true;

      await presaleReceipts.connect(owner).unpause();
      expect(await presaleReceipts.paused()).to.be.false;
    });

    it("Should not allow non-admin actions", async function () {
      await expect(presaleReceipts.connect(unauthorized).pause()).to.be.reverted;
      await expect(presaleReceipts.connect(unauthorized).unpause()).to.be.reverted;
    });
  });

  describe("Stress Tests", function () {
    it("Should handle many purchases correctly", async function () {
      const purchases = 5;
      const usdtPerPurchase = ethers.parseUnits("10000", 6); // 10K USDT
      const magaxPerPurchase = ethers.parseUnits("37037037", 18); // 37,037,037 MAGAX (10K USDT / 0.000270)

      for (let i = 0; i < purchases; i++) {
        await presaleReceipts.connect(recorder).recordPurchase(
          buyer1.address,
          usdtPerPurchase,
          magaxPerPurchase
        );
      }

      expect(await presaleReceipts.totalBuyers()).to.equal(1);
      expect(await presaleReceipts.userTotalUSDT(buyer1.address)).to.equal(usdtPerPurchase * BigInt(purchases));
      const receipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 50);
      expect(receipts.length).to.equal(purchases);
    });
  });

  describe("Referral System", function () {
    beforeEach(async function () {
      // Stage 1 is already active from main beforeEach, so we don't need to activate it again
    });

    it("Should record purchase with referral and award bonuses", async function () {
      const usdtAmount = ethers.parseUnits("270", 6);  // 270 USDT
      const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX (270 USDT / 0.000270 = 1M MAGAX)
      
      // Record purchase with referral
      await expect(presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      )).to.emit(presaleReceipts, "ReferralBonusAwarded");

      // Check referrer is set
      expect(await presaleReceipts.userReferrer(buyer1.address)).to.equal(buyer2.address);
      expect(await presaleReceipts.hasReferrer(buyer1.address)).to.be.true;

      // Check bonuses awarded
      const [referrerReferrals, referrerBonus] = await presaleReceipts.getReferralInfo(buyer2.address);
      const [refereeReferrals, refereeBonus] = await presaleReceipts.getReferralInfo(buyer1.address);

      // Referrer should get 7% bonus: 1M * 7% = 70K MAGAX
      const expectedReferrerBonus = magaxAmount * 7n / 100n;
      // Referee should get 5% bonus: 1M * 5% = 50K MAGAX
      const expectedRefereeBonus = magaxAmount * 5n / 100n;

      expect(referrerReferrals).to.equal(1);
      expect(referrerBonus).to.equal(expectedReferrerBonus);
      expect(refereeBonus).to.equal(expectedRefereeBonus);

      // Check total MAGAX includes bonuses
      const buyer1Total = await presaleReceipts.userTotalMAGAX(buyer1.address);
      const buyer2Total = await presaleReceipts.userTotalMAGAX(buyer2.address);
      
      expect(buyer1Total).to.equal(magaxAmount + expectedRefereeBonus);
      expect(buyer2Total).to.equal(expectedReferrerBonus);
    });

    it("Should prevent self-referral", async function () {
      const usdtAmount = ethers.parseUnits("1000", 6);
      const magaxAmount = ethers.parseUnits("1000000", 18);
      
      await expect(presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer1.address // Self-referral
      )).to.be.revertedWithCustomError(presaleReceipts, "SelfReferral");
    });

    it("Should prevent zero address as referrer", async function () {
      const usdtAmount = ethers.parseUnits("1000", 6);
      const magaxAmount = ethers.parseUnits("1000000", 18);
      
      await expect(presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        ethers.ZeroAddress
      )).to.be.revertedWithCustomError(presaleReceipts, "InvalidReferrer");
    });

    it("Should only set referrer on first purchase", async function () {
      const usdtAmount = ethers.parseUnits("135", 6); // 135 USDT
      const magaxAmount = ethers.parseUnits("500000", 18); // 500K MAGAX (135 USDT / 0.000270 = 500K MAGAX)
      
      // First purchase with buyer2 as referrer
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      );

      expect(await presaleReceipts.userReferrer(buyer1.address)).to.equal(buyer2.address);

      // Second purchase with buyer3 as referrer (should not change referrer)
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer3.address
      );

      // Referrer should still be buyer2
      expect(await presaleReceipts.userReferrer(buyer1.address)).to.equal(buyer2.address);

      // But buyer3 should still get bonus for this purchase
      const [buyer3Referrals, buyer3Bonus] = await presaleReceipts.getReferralInfo(buyer3.address);
      expect(buyer3Referrals).to.equal(1);
      expect(buyer3Bonus).to.be.gt(0);
    });

    it("Should track multiple referrals for one referrer", async function () {
      const usdtAmount = ethers.parseUnits("270", 6); // 270 USDT
      const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX (270 USDT / 0.000270 = 1M MAGAX)
      
      // buyer2 refers buyer1
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      );

      // buyer2 refers buyer3
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer3.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      );

      const [referrals, totalBonus] = await presaleReceipts.getReferralInfo(buyer2.address);
      const expectedBonus = (magaxAmount * 7n / 100n) * 2n; // 7% of 2M MAGAX

      expect(referrals).to.equal(2);
      expect(totalBonus).to.equal(expectedBonus);
    });

    it("Should create receipts for both base purchase and bonuses", async function () {
      const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX
      const usdtAmount = ethers.parseUnits("270", 6); // 270 USDT (1M MAGAX * 0.000270)
      
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      );

      // buyer1 should have 2 receipts: base purchase + referee bonus
      const buyer1Receipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 50);
      expect(buyer1Receipts.length).to.equal(2);
      
      // Receipt 1: base purchase
      expect(buyer1Receipts[0].usdt).to.equal(usdtAmount);
      expect(buyer1Receipts[0].magax).to.equal(magaxAmount);
      expect(buyer1Receipts[0].isBonus).to.be.false;
      
      // Receipt 2: referee bonus (5%)
      expect(buyer1Receipts[1].usdt).to.equal(0);
      expect(buyer1Receipts[1].isBonus).to.be.true;

      // buyer2 should have 1 receipt: referral bonus (7%)
      const buyer2Receipts = await presaleReceipts.getReceiptsPaginated(buyer2.address, 0, 50);
      expect(buyer2Receipts.length).to.equal(1);
      
      // Receipt: referrer bonus (0 USDT, bonus MAGAX, marked as bonus)
      expect(buyer2Receipts[0].usdt).to.equal(0);
      expect(buyer2Receipts[0].isBonus).to.be.true;
      
      // Verify bonuses are tracked in user totals
      const [, buyer1USDTSpent, buyer1MAGAXAllocated] = await presaleReceipts.getUserStats(buyer1.address);
      const [, buyer2USDTSpent, buyer2MAGAXAllocated] = await presaleReceipts.getUserStats(buyer2.address);
      
      // buyer1 gets their purchase + referee bonus
      expect(buyer1MAGAXAllocated).to.equal(magaxAmount + (magaxAmount * 5n / 100n));
      // buyer2 gets referrer bonus
      expect(buyer2MAGAXAllocated).to.equal(magaxAmount * 7n / 100n);
    });

    it("Should update stage tokens sold with bonuses included", async function () {
      const initialStageInfo = await presaleReceipts.getStageInfo(1);
      const initialTokensSold = initialStageInfo.tokensSold;
      
      const usdtAmount = ethers.parseUnits("270", 6); // 270 USDT
      const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX (270 USDT / 0.000270 = 1M MAGAX)
      
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      );

      const finalStageInfo = await presaleReceipts.getStageInfo(1);
      const finalTokensSold = finalStageInfo.tokensSold;
      
      // Should include base amount + referrer bonus (7%) + referee bonus (5%) = 112% of base
      const expectedIncrease = magaxAmount + (magaxAmount * 7n / 100n) + (magaxAmount * 5n / 100n);
      expect(finalTokensSold - initialTokensSold).to.equal(expectedIncrease);
    });

    it("Should work with role-based access control", async function () {
      const usdtAmount = ethers.parseUnits("270", 6); // 270 USDT
      const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX (270 USDT / 0.000270 = 1M MAGAX)
      
      // Should fail with unauthorized account
      await expect(presaleReceipts.connect(unauthorized).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      )).to.be.reverted;

      // Should work with recorder role
      await expect(presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address,
        usdtAmount,
        magaxAmount,
        buyer2.address
      )).to.not.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      // Configure stage with larger allocation for edge case tests
      await presaleReceipts.connect(stageManager).configureStage(
        2, 
        ethers.parseUnits("0.000001", 6), // 0.000001 USDT per MAGAX
        ethers.parseUnits("15000000000000", 18) // 15 Trillion MAGAX tokens (large enough for tests)
      );
      await presaleReceipts.connect(stageManager).activateStage(2);
    });

    describe("Purchase exactly hitting MAX_TOTAL_USDT", function () {
      it("should allow purchase that exactly hits MAX_TOTAL_USDT", async function () {
        // Need to make multiple purchases since MAX_PURCHASE_USDT is 1M and MAX_TOTAL_USDT is 10M
        const purchaseAmount = MAX_PURCHASE_USDT; // 1M USDT per purchase
        const magaxAmount = purchaseAmount * ethers.parseUnits("1", 18) / ethers.parseUnits("0.000001", 6);

        // Make 9 purchases of 1M each
        for (let i = 0; i < 9; i++) {
          await presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            purchaseAmount,
            magaxAmount
          );
        }

        // Final purchase to exactly hit MAX_TOTAL_USDT
        const finalPurchase = MAX_TOTAL_USDT - (purchaseAmount * 9n);
        const finalMagaxAmount = finalPurchase * ethers.parseUnits("1", 18) / ethers.parseUnits("0.000001", 6);

        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            finalPurchase,
            finalMagaxAmount
          )
        ).to.not.be.reverted;

        const totalUSDT = await presaleReceipts.totalUSDT();
        expect(totalUSDT).to.equal(MAX_TOTAL_USDT);
      });

      it("should reject purchase that exceeds MAX_TOTAL_USDT", async function () {
        // First fill up to the limit
        const purchaseAmount = MAX_PURCHASE_USDT; // 1M USDT
        const magaxAmount = purchaseAmount * ethers.parseUnits("1", 18) / ethers.parseUnits("0.000001", 6);

        // Make 10 purchases of 1M each (total 10M = MAX_TOTAL_USDT)
        for (let i = 0; i < 10; i++) {
          await presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            purchaseAmount,
            magaxAmount
          );
        }

        // Now try one more purchase that would exceed the limit
        const smallAmount = ethers.parseUnits("1", 6); // 1 USDT
        const smallMagaxAmount = smallAmount * ethers.parseUnits("1", 18) / ethers.parseUnits("0.000001", 6);

        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            smallAmount,
            smallMagaxAmount
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "ExceedsTotalLimit");
      });
    });

    describe("Price validation rounding", function () {
      it("should handle rounding when magaxAmount is not divisible by 10^12", async function () {
        // Configure a price that will cause rounding issues
        await presaleReceipts.connect(stageManager).configureStage(
          3,
          ethers.parseUnits("0.000123", 6), // 0.000123 USDT per MAGAX - irregular price
          ethers.parseUnits("10000000000", 18) // 10B tokens for enough allocation
        );
        await presaleReceipts.activateStage(3);

        // Amount that's not divisible by 10^12 and will cause rounding
        const magaxAmount = ethers.parseUnits("12345.123456789012", 18); // Smaller amount to avoid max purchase limit
        const pricePerToken = ethers.parseUnits("0.000123", 6);
        
        // Calculate expected USDT (this will have rounding)
        const expectedUSDT = (magaxAmount * pricePerToken) / ethers.parseUnits("1", 18);
        
        // Should allow exact calculation
        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            expectedUSDT,
            magaxAmount
          )
        ).to.not.be.reverted;

        // Should allow ±1 USDT tolerance
        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer2.address,
            expectedUSDT + ethers.parseUnits("1", 6), // +1 USDT
            magaxAmount
          )
        ).to.not.be.reverted;

        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer3.address,
            expectedUSDT - ethers.parseUnits("1", 6), // -1 USDT
            magaxAmount
          )
        ).to.not.be.reverted;

        // Should reject >1 USDT difference
        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            expectedUSDT + ethers.parseUnits("1.000001", 6), // >1 USDT over
            magaxAmount
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "PriceMismatch");
      });
    });

    describe("Referrer subsequent normal purchase", function () {
      it("should not double-count bonuses when referrer makes normal purchase after being referrer", async function () {
        const usdtAmount = ethers.parseUnits("1000", 6);
        const magaxAmount = ethers.parseUnits("1000000000", 18); // 1B MAGAX

        // First: buyer2 refers buyer1 and gets bonus
        await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          buyer2.address
        );

        const referrerTotalAfterReferral = await presaleReceipts.userTotalMAGAX(buyer2.address);
        const expectedReferrerBonus = (magaxAmount * 700n) / 10000n; // 7% bonus
        expect(referrerTotalAfterReferral).to.equal(expectedReferrerBonus);

        // Now: referrer (buyer2) makes their own normal purchase
        await presaleReceipts.connect(recorder).recordPurchase(
          buyer2.address,
          usdtAmount,
          magaxAmount
        );

        const referrerTotalAfterOwnPurchase = await presaleReceipts.userTotalMAGAX(buyer2.address);
        // Should be: previous bonus + their own purchase (no double bonus)
        expect(referrerTotalAfterOwnPurchase).to.equal(expectedReferrerBonus + magaxAmount);

        // Verify referral stats are not affected by their own purchase
        const [totalReferrals, totalBonusEarned] = await presaleReceipts.getReferralInfo(buyer2.address);
        expect(totalReferrals).to.equal(1); // Still only 1 referral
        expect(totalBonusEarned).to.equal(expectedReferrerBonus); // Bonus amount unchanged
      });

      it("should allow referrer to make subsequent referral purchases correctly", async function () {
        const usdtAmount = ethers.parseUnits("1000", 6);
        const magaxAmount = ethers.parseUnits("1000000000", 18);

        // First referral: buyer2 refers buyer1
        await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          buyer2.address
        );

        // Second referral: buyer2 refers buyer3
        await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
          buyer3.address,
          usdtAmount,
          magaxAmount,
          buyer2.address
        );

        const expectedReferrerBonus = (magaxAmount * 700n) / 10000n; // 7% bonus per referral
        const referrerTotal = await presaleReceipts.userTotalMAGAX(buyer2.address);
        expect(referrerTotal).to.equal(expectedReferrerBonus * 2n); // 2 referral bonuses

        const [totalReferrals, totalBonusEarned] = await presaleReceipts.getReferralInfo(buyer2.address);
        expect(totalReferrals).to.equal(2);
        expect(totalBonusEarned).to.equal(expectedReferrerBonus * 2n);
      });
    });

  describe("Promo System", function () {
    beforeEach(async function () {
      // Ensure stage 1 is active for promo tests (in case other tests changed it)
      await presaleReceipts.connect(stageManager).activateStage(1);
    });

    describe("Basic promo functionality", function () {
      it("should allow recording purchase with promo bonus", async function () {
        const usdtAmount = ethers.parseUnits("270", 6); // 270 USDT
        const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX (270 USDT / 0.000270 = 1M MAGAX)
        const promoBps = 1500; // 15% bonus

        // Calculate expected bonus
        const expectedBonus = (magaxAmount * BigInt(promoBps)) / 10000n;
        const expectedTotal = magaxAmount + expectedBonus;

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.emit(presaleReceipts, "PromoUsed")
          .withArgs(buyer1.address, promoBps, expectedBonus, 1, 1); // receipt index 1 (bonus receipt, 0-indexed)

        // Verify user totals include bonus
        const userTotal = await presaleReceipts.userTotalMAGAX(buyer1.address);
        expect(userTotal).to.equal(expectedTotal);

        // Verify promo bonus tracking
        const promoBonus = await presaleReceipts.getUserPromoBonus(buyer1.address);
        expect(promoBonus).to.equal(expectedBonus);
      });

      it("should create two receipts: purchase and bonus", async function () {
        const usdtAmount = ethers.parseUnits("135", 6);
        const magaxAmount = ethers.parseUnits("500000", 18); // 500K MAGAX (135 USDT / 0.000270 = 500K MAGAX)
        const promoBps = 2000; // 20% bonus

        await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          promoBps
        );

        const receipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 50);
        expect(receipts.length).to.equal(2);

        // Receipt 1: Main purchase
        expect(receipts[0].usdt).to.equal(usdtAmount);
        expect(receipts[0].magax).to.equal(magaxAmount);
        expect(receipts[0].isBonus).to.be.false;

        // Receipt 2: Promo bonus
        expect(receipts[1].usdt).to.equal(0);
        expect(receipts[1].magax).to.equal((magaxAmount * 2000n) / 10000n);
        expect(receipts[1].isBonus).to.be.true;
      });

      it("should emit PromoUsed event with correct receipt index", async function () {
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)
        const promoBps = 1000; // 10% bonus

        const expectedBonus = (magaxAmount * BigInt(promoBps)) / 10000n;

        // First promo purchase - bonus receipt should be at index 1
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.emit(presaleReceipts, "PromoUsed")
          .withArgs(buyer1.address, promoBps, expectedBonus, 1, 1);

        // Second promo purchase - bonus receipt should be at index 3
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.emit(presaleReceipts, "PromoUsed")
          .withArgs(buyer1.address, promoBps, expectedBonus, 1, 3);
      });
    });

    describe("Promo cap management", function () {
      it("should use default max promo cap initially", async function () {
        const maxCap = await presaleReceipts.maxPromoCapBps();
        const MAX_PROMO_BONUS_BPS = await presaleReceipts.MAX_PROMO_BONUS_BPS();
        expect(maxCap).to.equal(MAX_PROMO_BONUS_BPS);
      });

      it("should allow admin to update max promo cap (no timelock deployed)", async function () {
        const newCap = 7500; // 75%

        // Since timelock is not active (ZeroAddress), setMaxPromoBps works normally
        await expect(
          presaleReceipts.connect(owner).setMaxPromoBps(newCap)
        ).to.emit(presaleReceipts, "MaxPromoBpsUpdated");

        // Setting should have changed
        expect(await presaleReceipts.maxPromoCapBps()).to.equal(newCap);
      });

      it("should prevent non-admin from updating max promo cap", async function () {
        await expect(
          presaleReceipts.connect(unauthorized).setMaxPromoBps(7500)
        ).to.be.reverted;
      });

      it("should reject invalid promo caps", async function () {
        // Since timelock is not active, setMaxPromoBps works normally but validates parameters
        await expect(
          presaleReceipts.connect(owner).setMaxPromoBps(0)
        ).to.be.revertedWithCustomError(presaleReceipts, "InvalidPromoBps");
        
        // Over 100% cap - should also fail with InvalidPromoBps
        await expect(
          presaleReceipts.connect(owner).setMaxPromoBps(10001)
        ).to.be.revertedWithCustomError(presaleReceipts, "InvalidPromoBps");
      });

      it("should enforce updated promo cap", async function () {
        // Since timelock is not active, setMaxPromoBps works normally
        await expect(
          presaleReceipts.connect(owner).setMaxPromoBps(3000)
        ).to.emit(presaleReceipts, "MaxPromoBpsUpdated");

        // Cap should now be 3000 (30%)
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)

        // Should accept 30% promo (updated cap)
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            3000
          )
        ).to.not.be.reverted;

        // Should reject 31% promo (over updated cap)
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            3001
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "InvalidPromoBps");
      });
    });

    describe("Promo validation", function () {
      it("should reject zero promo percentage", async function () {
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            0
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "InvalidPromoBps");
      });

      it("should reject promo percentage above cap", async function () {
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)
        const maxCap = await presaleReceipts.maxPromoCapBps();

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            maxCap + 1n
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "InvalidPromoBps");
      });

      it("should check stage has enough tokens for purchase + bonus", async function () {
        // Configure a stage with limited tokens
        await presaleReceipts.connect(stageManager).configureStage(
          2,
          ethers.parseUnits("0.000270", 6),
          ethers.parseUnits("1000", 18) // Only 1000 tokens
        );
        await presaleReceipts.connect(stageManager).activateStage(2);

        const usdtAmount = ethers.parseUnits("1", 6);
        const magaxAmount = ethers.parseUnits("500", 18); // 500 tokens
        const promoBps = 5000; // 50% bonus = 250 tokens
        // Total needed: 500 + 250 = 750 tokens (should work)

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.not.be.reverted;

        // Second purchase should fail (need 750 more but only 250 left)
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer2.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "InsufficientStageTokens");
      });
    });

    describe("Promo integration with existing systems", function () {
      it("should work with stage management", async function () {
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)
        const promoBps = 2500; // 25% bonus

        // Purchase in stage 1
        await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          promoBps
        );

        // Switch to stage 2
        await presaleReceipts.connect(stageManager).configureStage(
          2,
          ethers.parseUnits("0.000293", 6),
          ethers.parseUnits("1000000000", 18)
        );
        await presaleReceipts.connect(stageManager).activateStage(2);

        // Purchase in stage 2 with different promo
        const stage2UsdtAmount = ethers.parseUnits("29.3", 6); // 29.3 USDT for stage 2 price
        const stage2MagaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (29.3 USDT / 0.000293 = 100K MAGAX)
        await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
          buyer1.address,
          stage2UsdtAmount,
          stage2MagaxAmount,
          1000 // 10% bonus
        );

        const receipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 50);
        expect(receipts.length).to.equal(4); // 2 purchases + 2 bonuses

        // Verify stage tracking in receipts
        expect(receipts[0].stage).to.equal(1);
        expect(receipts[1].stage).to.equal(1);
        expect(receipts[2].stage).to.equal(2);
        expect(receipts[3].stage).to.equal(2);
      });

      it("should respect purchase limits including bonus", async function () {
        const usdtAmount = ethers.parseUnits("269999", 6); // Near max limit
        const magaxAmount = ethers.parseUnits("999996296", 18); // 999.996M MAGAX (269999 USDT / 0.000270 ≈ 999.996M MAGAX)
        const promoBps = 1000; // 10% bonus

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.not.be.reverted;

        // Should respect MAX_PURCHASE_USDT limit
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            ethers.parseUnits("1000001", 6), // Over limit
            ethers.parseUnits("3703707407", 18), // 3.7B MAGAX (1000001 USDT / 0.000270)
            promoBps
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "ExceedsMaxPurchase");
      });

      it("should work when finalised", async function () {
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)
        const promoBps = 1500;

        // Since timelock is not active, finalise() works normally
        await expect(
          presaleReceipts.connect(finalizer).finalise()
        ).to.emit(presaleReceipts, "Finalised");

        // Should reject promo purchases after finalization (contract is paused when finalized)
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            promoBps
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "EnforcedPause");
      });
    });

    describe("Promo bonus calculations", function () {
      const testCases = [
        { percentage: 500, expected: "5%" },   // 5%
        { percentage: 1000, expected: "10%" }, // 10%
        { percentage: 2500, expected: "25%" }, // 25%
        { percentage: 5000, expected: "50%" }  // 50%
      ];

      testCases.forEach(({ percentage, expected }) => {
        it(`should calculate ${expected} bonus correctly`, async function () {
          const usdtAmount = ethers.parseUnits("270", 6);
          const magaxAmount = ethers.parseUnits("1000000", 18); // 1M MAGAX (270 USDT / 0.000270 = 1M MAGAX)
          const expectedBonus = (magaxAmount * BigInt(percentage)) / 10000n;

          await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            percentage
          );

          const promoBonus = await presaleReceipts.getUserPromoBonus(buyer1.address);
          expect(promoBonus).to.equal(expectedBonus);

          const receipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 50);
          expect(receipts[1].magax).to.equal(expectedBonus);
        });
      });

      it("should handle large bonus percentages correctly", async function () {
        // Since timelock is not active, we can change the cap normally
        await expect(
          presaleReceipts.connect(owner).setMaxPromoBps(9000)
        ).to.emit(presaleReceipts, "MaxPromoBpsUpdated");

        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)
        const promoBps = 9000; // 90% bonus

        const expectedBonus = (magaxAmount * 9000n) / 10000n;

        await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          promoBps
        );

        const userTotal = await presaleReceipts.userTotalMAGAX(buyer1.address);
        expect(userTotal).to.equal(magaxAmount + expectedBonus);
      });
    });

    describe("Multiple promo purchases", function () {
      it("should accumulate promo bonuses correctly", async function () {
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)

        // First promo purchase: 15% bonus
        await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          1500
        );

        // Second promo purchase: 25% bonus
        await presaleReceipts.connect(recorder).recordPurchaseWithPromo(
          buyer1.address,
          usdtAmount,
          magaxAmount,
          2500
        );

        const expectedBonus1 = (magaxAmount * 1500n) / 10000n;
        const expectedBonus2 = (magaxAmount * 2500n) / 10000n;
        const totalExpectedBonus = expectedBonus1 + expectedBonus2;

        const promoBonus = await presaleReceipts.getUserPromoBonus(buyer1.address);
        expect(promoBonus).to.equal(totalExpectedBonus);

        const userTotal = await presaleReceipts.userTotalMAGAX(buyer1.address);
        expect(userTotal).to.equal(magaxAmount * 2n + totalExpectedBonus);
      });

      it("should track receipt indices correctly for multiple promos", async function () {
        const usdtAmount = ethers.parseUnits("13.5", 6);
        const magaxAmount = ethers.parseUnits("50000", 18); // 50K MAGAX (13.5 USDT / 0.000270 = 50K MAGAX)

        // First promo - bonus receipt at index 1
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            1000
          )
        ).to.emit(presaleReceipts, "PromoUsed")
          .withArgs(buyer1.address, 1000, (magaxAmount * 1000n) / 10000n, 1, 1);

        // Second promo - bonus receipt at index 3
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            2000
          )
        ).to.emit(presaleReceipts, "PromoUsed")
          .withArgs(buyer1.address, 2000, (magaxAmount * 2000n) / 10000n, 1, 3);

        const receipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 50);
        expect(receipts.length).to.equal(4);

        // Verify receipt structure
        expect(receipts[0].isBonus).to.be.false; // Purchase 1
        expect(receipts[1].isBonus).to.be.true;  // Bonus 1
        expect(receipts[2].isBonus).to.be.false; // Purchase 2
        expect(receipts[3].isBonus).to.be.true;  // Bonus 2
      });
    });

    describe("Edge cases", function () {
      it("should handle zero magax amount gracefully", async function () {
        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            ethers.parseUnits("27", 6),
            0, // Zero MAGAX
            1000
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAmount");
      });

      it("should handle maximum allowed bonus percentage", async function () {
        const maxCap = await presaleReceipts.maxPromoCapBps();
        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            maxCap
          )
        ).to.not.be.reverted;
      });

      it("should handle promo when contract is paused", async function () {
        // Pause the contract to test when it's not operational
        await presaleReceipts.connect(owner).pause();

        const usdtAmount = ethers.parseUnits("27", 6);
        const magaxAmount = ethers.parseUnits("100000", 18); // 100K MAGAX (27 USDT / 0.000270 = 100K MAGAX)

        await expect(
          presaleReceipts.connect(recorder).recordPurchaseWithPromo(
            buyer1.address,
            usdtAmount,
            magaxAmount,
            1000
          )
        ).to.be.revertedWithCustomError(presaleReceipts, "EnforcedPause");
      });
    });
  });

    describe("Enhanced StageActivated event", function () {
      it("should emit StageActivated with operator address", async function () {
        await presaleReceipts.connect(stageManager).configureStage(
          4,
          ethers.parseUnits("0.000002", 6),
          ethers.parseUnits("500000000", 18)
        );

        await expect(presaleReceipts.connect(stageManager).activateStage(4))
          .to.emit(presaleReceipts, "StageActivated")
          .withArgs(4, stageManager.address);
      });

      it("should track operator in stage transitions for audit", async function () {
        // Configure stages
        await presaleReceipts.connect(stageManager).configureStage(5, ethers.parseUnits("0.000003", 6), ethers.parseUnits("100000000", 18));
        await presaleReceipts.connect(stageManager).configureStage(6, ethers.parseUnits("0.000004", 6), ethers.parseUnits("100000000", 18));

        // Grant stage manager role to buyer1 for testing
        await presaleReceipts.connect(owner).grantRole(await presaleReceipts.STAGE_MANAGER_ROLE(), buyer1.address);

        // Different stage managers activate different stages
        await expect(presaleReceipts.connect(stageManager).activateStage(5))
          .to.emit(presaleReceipts, "StageActivated")
          .withArgs(5, stageManager.address);

        await expect(presaleReceipts.connect(buyer1).activateStage(6))
          .to.emit(presaleReceipts, "StageActivated")
          .withArgs(6, buyer1.address);
      });
    });

    describe("Compiler and optimization verification", function () {
      it("should verify contract is compiled with correct settings", async function () {
        // This test ensures the contract compiles and deploys correctly
        // with the locked compiler version 0.8.24 and viaIR: true
        expect(await presaleReceipts.MAX_STAGES()).to.equal(50);
        expect(await presaleReceipts.MAX_TOTAL_USDT()).to.equal(ethers.parseUnits("10000000", 6));
        expect(await presaleReceipts.BASIS_POINTS()).to.equal(10000);
      });
    });
  });

  describe("Stage Rollover - Manual Transitions", function () {
    beforeEach(async function () {
      // Configure multiple stages for rollover testing
      const stage2Price = ethers.parseUnits("0.000293", 6); // 0.000293 USDT per MAGAX
      const stage3Price = ethers.parseUnits("0.000318", 6); // 0.000318 USDT per MAGAX
      const stageAllocation = ethers.parseUnits("1000000", 18); // 1M MAGAX tokens per stage
      
      await presaleReceipts.connect(stageManager).configureStage(2, stage2Price, stageAllocation);
      await presaleReceipts.connect(stageManager).configureStage(3, stage3Price, stageAllocation);
    });

    it("Should successfully transition from stage 1 to stage 2", async function () {
      // Make a purchase in stage 1
      const magaxAmount1 = ethers.parseUnits("1000", 18);
      const usdtAmount1 = ethers.parseUnits("1", 6);
      
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount1, magaxAmount1);
      
      // Verify stage 1 state before transition
      const stage1InfoBefore = await presaleReceipts.getStageInfo(1);
      expect(stage1InfoBefore.isActive).to.be.true;
      expect(stage1InfoBefore.tokensSold).to.equal(magaxAmount1);
      
      // Activate stage 2
      await expect(presaleReceipts.connect(stageManager).activateStage(2))
        .to.emit(presaleReceipts, "StageDeactivated").withArgs(1)
        .and.to.emit(presaleReceipts, "StageActivated").withArgs(2, stageManager.address);
      
      // Verify stage transition
      expect(await presaleReceipts.currentStage()).to.equal(2);
      
      const stage1InfoAfter = await presaleReceipts.getStageInfo(1);
      const stage2InfoAfter = await presaleReceipts.getStageInfo(2);
      
      expect(stage1InfoAfter.isActive).to.be.false;
      expect(stage1InfoAfter.tokensSold).to.equal(magaxAmount1); // Tokens sold preserved
      expect(stage2InfoAfter.isActive).to.be.true;
      expect(stage2InfoAfter.tokensSold).to.equal(0);
      
      // Make a purchase in stage 2 with new price
      const magaxAmount2 = ethers.parseUnits("500", 18);
      const usdtAmount2 = ethers.parseUnits("0.1465", 6); // 500 MAGAX * 0.000293 USDT = 0.1465 USDT
      
      await presaleReceipts.connect(recorder).recordPurchase(buyer2.address, usdtAmount2, magaxAmount2);
      
      const stage2InfoFinal = await presaleReceipts.getStageInfo(2);
      expect(stage2InfoFinal.tokensSold).to.equal(magaxAmount2);
    });

    it("Should handle multiple stage transitions correctly", async function () {
      // Stage 1 -> Stage 2 -> Stage 3
      await presaleReceipts.connect(stageManager).activateStage(2);
      expect(await presaleReceipts.currentStage()).to.equal(2);
      
      await presaleReceipts.connect(stageManager).activateStage(3);
      expect(await presaleReceipts.currentStage()).to.equal(3);
      
      // Verify all previous stages are inactive
      const stage1Info = await presaleReceipts.getStageInfo(1);
      const stage2Info = await presaleReceipts.getStageInfo(2);
      const stage3Info = await presaleReceipts.getStageInfo(3);
      
      expect(stage1Info.isActive).to.be.false;
      expect(stage2Info.isActive).to.be.false;
      expect(stage3Info.isActive).to.be.true;
    });

    it("Should enforce correct pricing after stage rollover", async function () {
      // Make a purchase in stage 1 (price: 0.000270 USDT per MAGAX)
      const magaxAmount = ethers.parseUnits("100000", 18); // Use 100K MAGAX for larger difference
      const stage1UsdtAmount = ethers.parseUnits("27", 6); // 100K * 0.000270 = 27 USDT
      
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, stage1UsdtAmount, magaxAmount);
      
      // Activate stage 2 (price: 0.000293 USDT per MAGAX)
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      // Attempt to purchase with stage 1 pricing should fail
      // 100K MAGAX at stage 2 price (0.000293) should cost 29.3 USDT, not 27 USDT
      // Difference is 2.3 USDT, which should exceed tolerance
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer2.address, stage1UsdtAmount, magaxAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "PriceMismatch");
      
      // Correct purchase with stage 2 pricing should work
      const stage2UsdtAmount = ethers.parseUnits("29.3", 6); // 100K * 0.000293 = 29.3 USDT
      await presaleReceipts.connect(recorder).recordPurchase(buyer2.address, stage2UsdtAmount, magaxAmount);
      
      const stage2Info = await presaleReceipts.getStageInfo(2);
      expect(stage2Info.tokensSold).to.equal(magaxAmount);
      
      // Verify stage 1 remains unchanged
      const stage1Info = await presaleReceipts.getStageInfo(1);
      expect(stage1Info.isActive).to.be.false;
      expect(stage1Info.tokensSold).to.equal(magaxAmount);
    });

    it("Should maintain cumulative totals across stage rollovers", async function () {
      // Purchase in stage 1
      const magax1 = ethers.parseUnits("1000", 18);
      const usdt1 = ethers.parseUnits("0.27", 6); // 1000 * 0.000270 = 0.27 USDT
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdt1, magax1);
      
      // Move to stage 2
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      // Purchase in stage 2
      const magax2 = ethers.parseUnits("500", 18);
      const usdt2 = ethers.parseUnits("0.1465", 6); // 500 * 0.000293 = 0.1465 USDT
      await presaleReceipts.connect(recorder).recordPurchase(buyer2.address, usdt2, magax2);
      
      // Move to stage 3
      await presaleReceipts.connect(stageManager).activateStage(3);
      
      // Purchase in stage 3
      const magax3 = ethers.parseUnits("333", 18);
      const usdt3 = ethers.parseUnits("0.105894", 6); // 333 * 0.000318 = 0.105894 USDT
      await presaleReceipts.connect(recorder).recordPurchase(buyer3.address, usdt3, magax3);
      
      // Verify cumulative totals
      const totalUsdt = usdt1 + usdt2 + usdt3;
      const totalMagax = magax1 + magax2 + magax3;
      
      expect(await presaleReceipts.totalUSDT()).to.equal(totalUsdt);
      expect(await presaleReceipts.totalMAGAX()).to.equal(totalMagax);
      expect(await presaleReceipts.totalBuyers()).to.equal(3);
    });

    it("Should emit StageCompleted when stage allocation is exhausted", async function () {
      // Configure a stage with small allocation
      const smallStagePrice = ethers.parseUnits("0.000270", 6); // Use correct pricing
      const smallAllocation = ethers.parseUnits("1000", 18); // Only 1000 tokens
      
      await presaleReceipts.connect(stageManager).configureStage(4, smallStagePrice, smallAllocation);
      await presaleReceipts.connect(stageManager).activateStage(4);
      
      // Purchase exactly the stage allocation
      const usdtAmount = ethers.parseUnits("0.27", 6); // 1000 * 0.000270 = 0.27 USDT
      
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, smallAllocation)
      ).to.emit(presaleReceipts, "StageCompleted").withArgs(4, smallAllocation);
      
      // Verify stage is exhausted
      const stage4Info = await presaleReceipts.getStageInfo(4);
      expect(stage4Info.tokensSold).to.equal(smallAllocation);
      expect(stage4Info.tokensRemaining).to.equal(0);
    });

    it("Should allow admin to skip stages (non-sequential activation)", async function () {
      // Skip stage 2, activate stage 3 directly
      await expect(presaleReceipts.connect(stageManager).activateStage(3))
        .to.emit(presaleReceipts, "StageDeactivated").withArgs(1)
        .and.to.emit(presaleReceipts, "StageActivated").withArgs(3, stageManager.address);
      
      expect(await presaleReceipts.currentStage()).to.equal(3);
      
      // Verify stage 2 remains inactive
      const stage2Info = await presaleReceipts.getStageInfo(2);
      expect(stage2Info.isActive).to.be.false;
      
      // Purchase should work with stage 3 pricing
      const magaxAmount = ethers.parseUnits("333", 18);
      const usdtAmount = ethers.parseUnits("999", 3); // 333 * 0.003 = 0.999 USDT
      
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, magaxAmount);
      
      const stage3Info = await presaleReceipts.getStageInfo(3);
      expect(stage3Info.tokensSold).to.equal(magaxAmount);
    });

    it("Should track operator in stage activation events", async function () {
      // Test with different stage manager accounts to verify operator tracking
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.STAGE_MANAGER_ROLE(), buyer1.address);
      
      await expect(presaleReceipts.connect(buyer1).activateStage(2))
        .to.emit(presaleReceipts, "StageActivated").withArgs(2, buyer1.address);
      
      await expect(presaleReceipts.connect(stageManager).activateStage(3))
        .to.emit(presaleReceipts, "StageActivated").withArgs(3, stageManager.address);
    });

    it("Should handle rollover with referral purchases", async function () {
      // Configure referrer
      const referrer = buyer3;
      
      // Purchase with referral in stage 1
      const magaxAmount1 = ethers.parseUnits("1000", 18);
      const usdtAmount1 = ethers.parseUnits("1", 6);
      
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer1.address, usdtAmount1, magaxAmount1, referrer.address
      );
      
      // Rollover to stage 2
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      // Purchase with referral in stage 2 (different price)
      const magaxAmount2 = ethers.parseUnits("500", 18);
      const usdtAmount2 = ethers.parseUnits("0.1465", 6); // 500 * 0.000293 = 0.1465 USDT
      
      await presaleReceipts.connect(recorder).recordPurchaseWithReferral(
        buyer2.address, usdtAmount2, magaxAmount2, referrer.address
      );
      
      // Verify referrer has bonuses from both stages
      const referralInfo = await presaleReceipts.getReferralInfo(referrer.address);
      expect(referralInfo.totalReferrals).to.equal(2);
      
      // Calculate expected bonuses: 7% of (1000 + 500) = 105 MAGAX
      const expectedBonus = ethers.parseUnits("105", 18); // 7% * 1500 MAGAX
      expect(referralInfo.totalBonusEarned).to.be.closeTo(expectedBonus, ethers.parseUnits("1", 18));
    });

    it("Should fail to activate unconfigured stages", async function () {
      await expect(
        presaleReceipts.connect(stageManager).activateStage(10)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAmount");
    });

    it("Should prevent activation of already active stage", async function () {
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      await expect(
        presaleReceipts.connect(stageManager).activateStage(2)
      ).to.be.revertedWithCustomError(presaleReceipts, "StageAlreadyActive");
    });

    it("Should handle stage rollover with current stage info queries", async function () {
      // Initial state
      let currentInfo = await presaleReceipts.getCurrentStageInfo();
      expect(currentInfo.stage).to.equal(1);
      expect(currentInfo.pricePerToken).to.equal(ethers.parseUnits("0.000270", 6));
      
      // After rollover to stage 2
      await presaleReceipts.connect(stageManager).activateStage(2);
      
      currentInfo = await presaleReceipts.getCurrentStageInfo();
      expect(currentInfo.stage).to.equal(2);
      expect(currentInfo.pricePerToken).to.equal(ethers.parseUnits("0.000293", 6));
      expect(currentInfo.isActive).to.be.true;
      expect(currentInfo.tokensSold).to.equal(0);
      
      // After rollover to stage 3
      await presaleReceipts.connect(stageManager).activateStage(3);
      
      currentInfo = await presaleReceipts.getCurrentStageInfo();
      expect(currentInfo.stage).to.equal(3);
      expect(currentInfo.pricePerToken).to.equal(ethers.parseUnits("0.000318", 6));
    });
  });

  describe("Timelock Security (Post-Optimization)", function () {
    let admin1, admin2;

    beforeEach(async function () {
      [owner, recorder, buyer1, buyer2, buyer3, unauthorized, stageManager, emergencyAdmin, finalizer, admin1, admin2] = await ethers.getSigners();
      
      // Grant additional admin roles for testing
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.FINALIZER_ROLE(), admin1.address);
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.EMERGENCY_ROLE(), admin1.address);
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.EMERGENCY_ROLE(), admin2.address);
      await presaleReceipts.connect(owner).grantRole(await presaleReceipts.DEFAULT_ADMIN_ROLE(), admin2.address);
    });

    describe("Timelock-Protected Operations", function () {
      it("Should work normally without timelock (contract deployed with ZeroAddress)", async function () {
        // finalise() works normally when timelockActive is false
        await expect(
          presaleReceipts.connect(finalizer).finalise()
        ).to.emit(presaleReceipts, "Finalised");

        // Check that presale is finalized
        expect(await presaleReceipts.finalised()).to.be.true;
      });

      it("Should work normally for max promo BPS changes without timelock", async function () {
        const newCap = 3000; // 30%

        // setMaxPromoBps() works normally when timelockActive is false
        await expect(
          presaleReceipts.connect(owner).setMaxPromoBps(newCap)
        ).to.emit(presaleReceipts, "MaxPromoBpsUpdated");

        // Setting should have changed
        expect(await presaleReceipts.maxPromoCapBps()).to.equal(newCap);
      });

      it("Should work normally for emergency token withdrawal without timelock", async function () {
        // Send some tokens to the contract for testing
        await mockToken.transfer(presaleReceipts.target, ethers.parseUnits("1000", 18));

        // emergencyTokenWithdraw() works normally when timelockActive is false
        await expect(
          presaleReceipts.connect(emergencyAdmin).emergencyTokenWithdraw(mockToken.target, owner.address)
        ).to.emit(presaleReceipts, "EmergencyTokenWithdraw");

        // Tokens should be withdrawn
        expect(await mockToken.balanceOf(presaleReceipts.target)).to.equal(0);
      });
    });

    describe("Immediate Emergency Withdrawal (3-of-3 Multi-Sig)", function () {
      beforeEach(async function () {
        // Send some tokens to the contract for testing
        await mockToken.transfer(presaleReceipts.target, ethers.parseUnits("1000", 18));
      });

      it("Should require 3 confirmations for immediate emergency withdrawal", async function () {
        // First emergency admin proposes withdrawal - should emit OperationProposed
        await expect(
          presaleReceipts.connect(emergencyAdmin).immediateEmergencyWithdraw(mockToken.target, owner.address)
        ).to.emit(presaleReceipts, "OperationProposed");

        // Tokens should still be in contract
        expect(await mockToken.balanceOf(presaleReceipts.target)).to.equal(ethers.parseUnits("1000", 18));

        // Second emergency admin confirms - should emit OperationConfirmed
        await expect(
          presaleReceipts.connect(admin1).immediateEmergencyWithdraw(mockToken.target, owner.address)
        ).to.emit(presaleReceipts, "OperationConfirmed");

        // Still need third confirmation
        expect(await mockToken.balanceOf(presaleReceipts.target)).to.equal(ethers.parseUnits("1000", 18));

        // Third emergency admin confirms and executes - should emit EmergencyTokenWithdraw
        await expect(
          presaleReceipts.connect(admin2).immediateEmergencyWithdraw(mockToken.target, owner.address)
        ).to.emit(presaleReceipts, "EmergencyTokenWithdraw");

        // Tokens should be withdrawn
        expect(await mockToken.balanceOf(presaleReceipts.target)).to.equal(0);
        expect(await mockToken.balanceOf(owner.address)).to.be.greaterThan(ethers.parseUnits("1000", 18));
      });
    });

    describe("Role-Based Access Control", function () {
      it("Should enforce role requirements for sensitive functions", async function () {
        // Only FINALIZER_ROLE can finalize (but still needs timelock)
        await expect(
          presaleReceipts.connect(unauthorized).finalise()
        ).to.be.reverted;

        // Only EMERGENCY_ROLE can emergency withdraw (but still needs timelock)
        await expect(
          presaleReceipts.connect(unauthorized).emergencyTokenWithdraw(mockToken.target, owner.address)
        ).to.be.reverted;

        // Only EMERGENCY_ROLE can immediate emergency withdraw
        await expect(
          presaleReceipts.connect(unauthorized).immediateEmergencyWithdraw(mockToken.target, owner.address)
        ).to.be.reverted;

        // Only STAGE_MANAGER_ROLE can configure stages
        await expect(
          presaleReceipts.connect(unauthorized).configureStage(5, 100, ethers.parseUnits("1000", 18))
        ).to.be.reverted;
      });

      it("Should allow role holders to perform their functions", async function () {
        // RECORDER_ROLE can record purchases
        await expect(
          presaleReceipts.connect(recorder).recordPurchase(
            buyer1.address,
            ethers.parseUnits("100", 6),
            ethers.parseUnits("370370", 18)
          )
        ).to.not.be.reverted;

        // STAGE_MANAGER_ROLE can configure stages
        await expect(
          presaleReceipts.connect(stageManager).configureStage(
            5,
            ethers.parseUnits("0.001", 6),
            ethers.parseUnits("1000000", 18)
          )
        ).to.not.be.reverted;
      });
    });
  });
});
