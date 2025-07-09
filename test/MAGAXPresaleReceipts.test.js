const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MAGAXPresaleReceipts - Enhanced Security", function () {
  let presaleReceipts;
  let mockToken;
  let owner, recorder, buyer1, buyer2, buyer3, unauthorized;

  // Constants from contract
  const MAX_PURCHASE_USDT = ethers.parseUnits("1000000", 6); // 1M USDT
  const MAX_TOTAL_USDT = ethers.parseUnits("10000000", 6);   // 10M USDT

  beforeEach(async function () {
    [owner, recorder, buyer1, buyer2, buyer3, unauthorized] = await ethers.getSigners();
    
    // Deploy mock ERC20 token for emergency withdrawal tests
    const MockToken = await ethers.getContractFactory("contracts/MoonShotMAGAX.sol:MoonShotMAGAX");
    mockToken = await MockToken.deploy(owner.address);
    await mockToken.waitForDeployment();
    
    const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
    presaleReceipts = await MAGAXPresaleReceipts.deploy(recorder.address);
    await presaleReceipts.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner and recorder", async function () {
      expect(await presaleReceipts.hasRole(await presaleReceipts.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await presaleReceipts.hasRole(await presaleReceipts.RECORDER_ROLE(), recorder.address)).to.be.true;
    });

    it("Should set correct constants", async function () {
      expect(await presaleReceipts.MAX_PURCHASE_USDT()).to.equal(MAX_PURCHASE_USDT);
      expect(await presaleReceipts.MAX_TOTAL_USDT()).to.equal(MAX_TOTAL_USDT);
    });

    it("Should start with zero counters", async function () {
      expect(await presaleReceipts.totalUSDT()).to.equal(0);
      expect(await presaleReceipts.totalMAGAX()).to.equal(0);
      expect(await presaleReceipts.totalBuyers()).to.equal(0);
      expect(await presaleReceipts.purchaseCounter()).to.equal(0);
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
        MAGAXPresaleReceipts.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(MAGAXPresaleReceipts, "InvalidAddress");
    });
  });

  describe("Recording Purchases", function () {
    it("Should record a purchase successfully", async function () {
      const usdtAmount = ethers.parseUnits("100", 6);
      const magaxAmount = ethers.parseUnits("1000", 18);

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, usdtAmount, magaxAmount)
      ).to.emit(presaleReceipts, "PurchaseRecorded");

      expect(await presaleReceipts.totalUSDT()).to.equal(usdtAmount);
      expect(await presaleReceipts.totalMAGAX()).to.equal(magaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1);
      expect(await presaleReceipts.purchaseCounter()).to.equal(1);
    });

    it("Should enforce maximum purchase limit", async function () {
      const exceedsMax = MAX_PURCHASE_USDT + ethers.parseUnits("1", 6);
      const magaxAmount = ethers.parseUnits("1000", 18);

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, exceedsMax, magaxAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "ExceedsMaxPurchase");
    });

    it("Should allow maximum purchase amount", async function () {
      const magaxAmount = ethers.parseUnits("10000000", 18); // 10M MAGAX

      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, MAX_PURCHASE_USDT, magaxAmount)
      ).to.not.be.reverted;

      expect(await presaleReceipts.totalUSDT()).to.equal(MAX_PURCHASE_USDT);
    });

    it("Should enforce total presale limit", async function () {
      // Record purchases totaling more than max (10M USDT total limit)
      // Using max individual purchase amount (1M USDT each)
      const purchaseAmount = ethers.parseUnits("1000000", 6); // 1M USDT (max individual)
      const magaxAmount = ethers.parseUnits("10000000", 18);

      // Make 10 purchases of 1M each to reach the 10M total limit
      for (let i = 0; i < 10; i++) {
        const buyer = await ethers.getSigners().then(signers => signers[i + 10]); // Use different buyers
        await presaleReceipts.connect(recorder).recordPurchase(buyer.address, purchaseAmount, magaxAmount);
      }
      
      // Next purchase should fail due to total limit
      await expect(
        presaleReceipts.connect(recorder).recordPurchase(buyer1.address, 1, magaxAmount)
      ).to.be.revertedWithCustomError(presaleReceipts, "ExceedsTotalLimit");

      expect(await presaleReceipts.totalUSDT()).to.equal(MAX_TOTAL_USDT);
    });

    it("Should handle multiple purchases from same buyer", async function () {
      const firstAmount = ethers.parseUnits("100", 6);
      const secondAmount = ethers.parseUnits("200", 6);
      const magaxAmount = ethers.parseUnits("1000", 18);

      // First purchase
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, firstAmount, magaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1);

      // Second purchase from same buyer
      await presaleReceipts.connect(recorder).recordPurchase(buyer1.address, secondAmount, magaxAmount);
      expect(await presaleReceipts.totalBuyers()).to.equal(1); // Should not increment
      expect(await presaleReceipts.userTotalUSDT(buyer1.address)).to.equal(firstAmount + secondAmount);
      expect(await presaleReceipts.purchaseCounter()).to.equal(2);
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
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await presaleReceipts.connect(recorder).recordPurchase(
        buyer1.address,
        ethers.parseUnits("100", 6),
        ethers.parseUnits("1000", 18)
      );
      await presaleReceipts.connect(recorder).recordPurchase(
        buyer1.address,
        ethers.parseUnits("200", 6),
        ethers.parseUnits("2000", 18)
      );
    });

    it("Should return correct user stats", async function () {
      const stats = await presaleReceipts.getUserStats(buyer1.address);
      
      expect(stats.totalPurchases).to.equal(2);
      expect(stats.totalUSDTSpent).to.equal(ethers.parseUnits("300", 6));
      expect(stats.totalMAGAXAllocated).to.equal(ethers.parseUnits("3000", 18));
      expect(stats.firstPurchaseTime).to.be.lessThanOrEqual(stats.lastPurchaseTime);
    });

    it("Should return paginated receipts correctly", async function () {
      // Get first receipt
      const firstPage = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 1);
      expect(firstPage.length).to.equal(1);
      expect(firstPage[0].usdt).to.equal(ethers.parseUnits("100", 6));

      // Get all receipts
      const allReceipts = await presaleReceipts.getReceiptsPaginated(buyer1.address, 0, 10);
      expect(allReceipts.length).to.equal(2);

      // Out of bounds
      const emptyPage = await presaleReceipts.getReceiptsPaginated(buyer1.address, 10, 5);
      expect(emptyPage.length).to.equal(0);
    });

    it("Should return correct presale stats", async function () {
      const stats = await presaleReceipts.getPresaleStats();
      
      expect(stats.totalUSDTRaised).to.equal(ethers.parseUnits("300", 6));
      expect(stats.totalMAGAXSold).to.equal(ethers.parseUnits("3000", 18));
      expect(stats.totalUniqueBuyers).to.equal(1);
    });
  });

  describe("Emergency Token Withdrawal", function () {
    beforeEach(async function () {
      // Send some tokens to the presale contract
      await mockToken.transfer(await presaleReceipts.getAddress(), ethers.parseUnits("1000", 18));
    });

    it("Should allow admin to withdraw accidentally sent tokens", async function () {
      const balanceBefore = await mockToken.balanceOf(owner.address);
      const contractBalance = await mockToken.balanceOf(await presaleReceipts.getAddress());

      await expect(
        presaleReceipts.connect(owner).emergencyTokenWithdraw(await mockToken.getAddress(), owner.address)
      ).to.emit(presaleReceipts, "EmergencyTokenWithdraw")
       .withArgs(await mockToken.getAddress(), owner.address, contractBalance);

      const balanceAfter = await mockToken.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + contractBalance);

      // Contract should have zero balance
      expect(await mockToken.balanceOf(await presaleReceipts.getAddress())).to.equal(0);
    });

    it("Should fail with zero withdrawal address", async function () {
      await expect(
        presaleReceipts.connect(owner).emergencyTokenWithdraw(await mockToken.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(presaleReceipts, "InvalidAddress");
    });

    it("Should fail when no tokens to withdraw", async function () {
      // First withdraw all tokens
      await presaleReceipts.connect(owner).emergencyTokenWithdraw(await mockToken.getAddress(), owner.address);

      // Try to withdraw again
      await expect(
        presaleReceipts.connect(owner).emergencyTokenWithdraw(await mockToken.getAddress(), owner.address)
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
      const usdtPerPurchase = ethers.parseUnits("10000", 6);
      const magaxPerPurchase = ethers.parseUnits("100000", 18);

      for (let i = 0; i < purchases; i++) {
        await presaleReceipts.connect(recorder).recordPurchase(
          buyer1.address,
          usdtPerPurchase,
          magaxPerPurchase
        );
      }

      expect(await presaleReceipts.totalBuyers()).to.equal(1);
      expect(await presaleReceipts.userTotalUSDT(buyer1.address)).to.equal(usdtPerPurchase * BigInt(purchases));
      expect(await presaleReceipts.purchaseCounter()).to.equal(purchases);

      const receipts = await presaleReceipts.getReceipts(buyer1.address);
      expect(receipts.length).to.equal(purchases);
    });
  });
});
