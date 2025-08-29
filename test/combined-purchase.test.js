const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MAGAXPresaleReceipts - Promo and Referral Combined", function () {
    let presale, deployer, recorder, stageManager, admin, buyer, referrer;

    beforeEach(async function () {
        [deployer, recorder, stageManager, admin, buyer, referrer] = await ethers.getSigners();

        const Presale = await ethers.getContractFactory("MAGAXPresaleReceipts");
        presale = await Presale.deploy(recorder.address, stageManager.address, admin.address);

        // Configure stage 1
        const price = ethers.parseUnits("0.000270", 6); // 0.000270 USDT per token
    const allocation = ethers.parseUnits("200000000", 18); // 200M tokens
    const usdTarget = ethers.parseUnits("1000000", 6); // 1M USDT target
    await presale.connect(stageManager).configureStage(1, price, allocation, usdTarget);
        await presale.connect(stageManager).activateStage(1);
    });

    describe("recordPurchaseWithPromoAndReferral", function () {
        it("Should record purchase with both promo and referral bonuses", async function () {
            const usdtAmount = ethers.parseUnits("100", 6); // 100 USDT
            const magaxAmount = ethers.parseUnits("370370.370370370370370370", 18); // Base tokens
            const promoBps = 1500; // 15% promo bonus

            // Calculate expected bonuses
            const promoBonus = (magaxAmount * BigInt(promoBps)) / BigInt(10000);
            const referrerBonus = (magaxAmount * BigInt(700)) / BigInt(10000); // 7%
            const refereeBonus = (magaxAmount * BigInt(500)) / BigInt(10000); // 5%

            const totalBuyerTokens = magaxAmount + promoBonus + refereeBonus;
            const totalStageTokens = totalBuyerTokens + referrerBonus;

            // Record purchase
            const tx = await presale.connect(recorder).recordPurchaseWithPromoAndReferral(
                buyer.address,
                usdtAmount,
                magaxAmount,
                promoBps,
                referrer.address
            );

            // Get transaction receipt to check block timestamp
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const timestamp = block.timestamp;

            // Check events
            await expect(tx)
                .to.emit(presale, "PurchaseRecorded")
                .withArgs(buyer.address, usdtAmount, magaxAmount, timestamp, 1, 3, true); // 3 receipts total after adding main, promo, and referee receipts

            await expect(tx)
                .to.emit(presale, "PromoUsed")
                .withArgs(buyer.address, promoBps, promoBonus, 1, 1); // Index 1 for promo receipt

            await expect(tx)
                .to.emit(presale, "ReferralBonusAwarded")
                .withArgs(referrer.address, buyer.address, referrerBonus, refereeBonus, 1);

            // Check buyer totals
            expect(await presale.userTotalUSDT(buyer.address)).to.equal(usdtAmount);
            expect(await presale.userTotalMAGAX(buyer.address)).to.equal(totalBuyerTokens);

            // Check referrer totals
            expect(await presale.userTotalMAGAX(referrer.address)).to.equal(referrerBonus);

            // Check global totals
            expect(await presale.totalUSDT()).to.equal(usdtAmount);
            expect(await presale.totalMAGAX()).to.equal(totalStageTokens);
            expect(await presale.totalBuyers()).to.equal(1);

            // Check promo data
            expect(await presale.getUserPromoBonus(buyer.address)).to.equal(promoBonus);

            // Check referral data
            const [referrerReferrals, referrerTotalBonus] = await presale.getReferralInfo(referrer.address);
            expect(referrerReferrals).to.equal(1);
            expect(referrerTotalBonus).to.equal(referrerBonus);

            const [refereeReferrals, refereeTotalBonus] = await presale.getReferralInfo(buyer.address);
            expect(refereeTotalBonus).to.equal(refereeBonus);

            // Check receipts
            const buyerReceipts = await presale.getReceiptsPaginated(buyer.address, 0, 10);
            expect(buyerReceipts.length).to.equal(3); // Should have promo, referrer, and referee receipts

            expect(buyerReceipts[0].usdt).to.equal(usdtAmount);
            expect(buyerReceipts[0].magax).to.equal(magaxAmount);
            expect(buyerReceipts[0].isBonus).to.equal(false);

            expect(buyerReceipts[1].usdt).to.equal(0);
            expect(buyerReceipts[1].magax).to.equal(promoBonus);
            expect(buyerReceipts[1].isBonus).to.equal(true);

            expect(buyerReceipts[2].usdt).to.equal(0);
            expect(buyerReceipts[2].magax).to.equal(refereeBonus);
            expect(buyerReceipts[2].isBonus).to.equal(true);

            const referrerReceipts = await presale.getReceiptsPaginated(referrer.address, 0, 10);
            expect(referrerReceipts.length).to.equal(1); // Referrer bonus only

            expect(referrerReceipts[0].usdt).to.equal(0);
            expect(referrerReceipts[0].magax).to.equal(referrerBonus);
            expect(referrerReceipts[0].isBonus).to.equal(true);
        });

        it("Should revert if stage doesn't have enough tokens for all bonuses", async function () {
            // Use 900K USDT which stays under the 1M limit but should exceed stage capacity with bonuses
            const usdtAmount = ethers.parseUnits("900000", 6); // 900K USDT
            // At 0.000270 USDT per token: 900K / 0.000270 = ~3.33B base tokens
            const magaxAmount = ethers.parseUnits("3333333333", 18); // 3.33B tokens (base amount)
            const promoBps = 1500; // 15% bonus
            
            // With 15% promo + 10% referrer + 5% referee bonuses, total will be ~4.33B tokens
            // This should far exceed the 200M token stage allocation

            await expect(
                presale.connect(recorder).recordPurchaseWithPromoAndReferral(
                    buyer.address,
                    usdtAmount,
                    magaxAmount,
                    promoBps,
                    referrer.address
                )
            ).to.be.revertedWithCustomError(presale, "InsufficientStageTokens");
        });

        it("Should revert for invalid promo BPS", async function () {
            const usdtAmount = ethers.parseUnits("100", 6);
            const magaxAmount = ethers.parseUnits("370370", 18);
            const invalidPromoBps = 6000; // 60% - exceeds max

            await expect(
                presale.connect(recorder).recordPurchaseWithPromoAndReferral(
                    buyer.address,
                    usdtAmount,
                    magaxAmount,
                    invalidPromoBps,
                    referrer.address
                )
            ).to.be.revertedWithCustomError(presale, "InvalidPromoBps");
        });

        it("Should revert for self-referral", async function () {
            const usdtAmount = ethers.parseUnits("100", 6);
            const magaxAmount = ethers.parseUnits("370370", 18);
            const promoBps = 1500;

            await expect(
                presale.connect(recorder).recordPurchaseWithPromoAndReferral(
                    buyer.address,
                    usdtAmount,
                    magaxAmount,
                    promoBps,
                    buyer.address // Self-referral
                )
            ).to.be.revertedWithCustomError(presale, "SelfReferral");
        });
    });
});
