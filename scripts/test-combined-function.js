const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Testing new recordPurchaseWithPromoAndReferral function");
  console.log("=".repeat(60));

  // Contract address from environment
  const contractAddress = process.env.POLYGON_PRESALE_ADDRESS;
  if (!contractAddress) {
    throw new Error("POLYGON_PRESALE_ADDRESS not set in .env");
  }

  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Signer address: ${deployer.address}`);

  // Connect to contract
  const Presale = await ethers.getContractFactory("MAGAXPresaleReceipts");
  const presale = await Presale.attach(contractAddress);
  console.log(`Contract: ${contractAddress}`);

  // Verify RECORDER_ROLE
  const RECORDER_ROLE = await presale.RECORDER_ROLE();
  const hasRecorderRole = await presale.hasRole(RECORDER_ROLE, deployer.address);
  console.log(`RECORDER_ROLE verification: ${hasRecorderRole}`);

  if (!hasRecorderRole) {
    throw new Error("Signer does not have RECORDER_ROLE");
  }

  // Test addresses
  const buyer = "0x1234567890123456789012345678901234567890"; // Test buyer
  const referrer = "0x2345678901234567890123456789012345678901"; // Test referrer

  // Purchase parameters
  const usdtAmount = ethers.parseUnits("100", 6); // 100 USDT
  const stagePrice = ethers.parseUnits("0.000270", 6); // 0.000270 USDT per token
  const magaxAmount = (usdtAmount * ethers.parseUnits("1", 18)) / stagePrice; // Calculate MAGAX amount
  const promoBps = 1500; // 15% promo bonus

  console.log(`\nTest Purchase Parameters:`);
  console.log(`  Buyer: ${buyer}`);
  console.log(`  Referrer: ${referrer}`);
  console.log(`  USDT Amount: ${ethers.formatUnits(usdtAmount, 6)} USDT`);
  console.log(`  MAGAX Amount: ${ethers.formatUnits(magaxAmount, 18)} MAGAX`);
  console.log(`  Promo BPS: ${promoBps} (${promoBps/100}%)`);

  // Calculate expected bonuses
  const promoBonus = (magaxAmount * BigInt(promoBps)) / BigInt(10000);
  const referrerBonus = (magaxAmount * BigInt(700)) / BigInt(10000); // 7%
  const refereeBonus = (magaxAmount * BigInt(500)) / BigInt(10000); // 5%

  console.log(`\nExpected Bonuses:`);
  console.log(`  Promo bonus: ${ethers.formatUnits(promoBonus, 18)} MAGAX`);
  console.log(`  Referrer bonus: ${ethers.formatUnits(referrerBonus, 18)} MAGAX`);
  console.log(`  Referee bonus: ${ethers.formatUnits(refereeBonus, 18)} MAGAX`);

  const totalBuyerTokens = magaxAmount + promoBonus + refereeBonus;
  const totalStageTokens = totalBuyerTokens + referrerBonus;

  console.log(`\nTotal Tokens:`);
  console.log(`  Buyer total: ${ethers.formatUnits(totalBuyerTokens, 18)} MAGAX`);
  console.log(`  Stage consumption: ${ethers.formatUnits(totalStageTokens, 18)} MAGAX`);

  // Get current state before purchase
  console.log(`\nBefore Purchase:`);
  const beforeStats = await presale.getPresaleStats();
  console.log(`  Total USDT: ${ethers.formatUnits(beforeStats[0], 6)}`);
  console.log(`  Total MAGAX: ${ethers.formatUnits(beforeStats[1], 18)}`);
  console.log(`  Total Buyers: ${beforeStats[2]}`);

  // Execute the combined purchase
  console.log(`\n${"=".repeat(40)}`);
  console.log("EXECUTING COMBINED PROMO + REFERRAL PURCHASE");
  console.log(`${"=".repeat(40)}`);

  try {
    const tx = await presale.recordPurchaseWithPromoAndReferral(
      buyer,
      usdtAmount,
      magaxAmount,
      promoBps,
      referrer
    );

    console.log(`Transaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`SUCCESS: Combined purchase recorded - Block: ${receipt.blockNumber}`);

    // Check events
    console.log(`\nEvents emitted:`);
    for (const event of receipt.logs) {
      try {
        const parsed = presale.interface.parseLog(event);
        if (parsed) {
          console.log(`  ${parsed.name}:`);
          if (parsed.name === "PurchaseRecorded") {
            console.log(`    Buyer: ${parsed.args[0]}`);
            console.log(`    USDT: ${ethers.formatUnits(parsed.args[1], 6)}`);
            console.log(`    MAGAX: ${ethers.formatUnits(parsed.args[2], 18)}`);
            console.log(`    Stage: ${parsed.args[4]}`);
            console.log(`    Total Receipts: ${parsed.args[5]}`);
            console.log(`    Is New Buyer: ${parsed.args[6]}`);
          } else if (parsed.name === "PromoUsed") {
            console.log(`    User: ${parsed.args[0]}`);
            console.log(`    Promo BPS: ${parsed.args[1]}`);
            console.log(`    Bonus Tokens: ${ethers.formatUnits(parsed.args[2], 18)}`);
            console.log(`    Receipt Index: ${parsed.args[4]}`);
          } else if (parsed.name === "ReferralBonusAwarded") {
            console.log(`    Referrer: ${parsed.args[0]}`);
            console.log(`    Referee: ${parsed.args[1]}`);
            console.log(`    Referrer Bonus: ${ethers.formatUnits(parsed.args[2], 18)}`);
            console.log(`    Referee Bonus: ${ethers.formatUnits(parsed.args[3], 18)}`);
          }
        }
      } catch (e) {
        // Skip unparseable events
      }
    }

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    if (error.data) {
      console.error(`Error data: ${error.data}`);
    }
    return;
  }

  // Get state after purchase
  console.log(`\n${"=".repeat(40)}`);
  console.log("VERIFICATION RESULTS");
  console.log(`${"=".repeat(40)}`);

  const afterStats = await presale.getPresaleStats();
  console.log(`\nContract Totals After Purchase:`);
  console.log(`  Total USDT: ${ethers.formatUnits(afterStats[0], 6)}`);
  console.log(`  Total MAGAX: ${ethers.formatUnits(afterStats[1], 18)}`);
  console.log(`  Total Buyers: ${afterStats[2]}`);

  // Check user balances
  const buyerUSDT = await presale.userTotalUSDT(buyer);
  const buyerMAGAX = await presale.userTotalMAGAX(buyer);
  const referrerMAGAX = await presale.userTotalMAGAX(referrer);

  console.log(`\nUser Balances:`);
  console.log(`  Buyer USDT: ${ethers.formatUnits(buyerUSDT, 6)}`);
  console.log(`  Buyer MAGAX: ${ethers.formatUnits(buyerMAGAX, 18)}`);
  console.log(`  Referrer MAGAX: ${ethers.formatUnits(referrerMAGAX, 18)}`);

  // Check referral info
  const [buyerReferrals, buyerTotalBonus] = await presale.getReferralInfo(buyer);
  const [referrerReferrals, referrerTotalBonus] = await presale.getReferralInfo(referrer);

  console.log(`\nReferral Information:`);
  console.log(`  Buyer referrals: ${buyerReferrals}, total bonus: ${ethers.formatUnits(buyerTotalBonus, 18)}`);
  console.log(`  Referrer referrals: ${referrerReferrals}, total bonus: ${ethers.formatUnits(referrerTotalBonus, 18)}`);

  // Check promo bonus
  const buyerPromoBonus = await presale.getUserPromoBonus(buyer);
  console.log(`  Buyer promo bonus: ${ethers.formatUnits(buyerPromoBonus, 18)}`);

  // Check receipts
  const buyerReceipts = await presale.getReceiptsPaginated(buyer, 0, 10);
  const referrerReceipts = await presale.getReceiptsPaginated(referrer, 0, 10);

  console.log(`\nReceipts:`);
  console.log(`  Buyer receipts: ${buyerReceipts.length}`);
  console.log(`  Referrer receipts: ${referrerReceipts.length}`);

  for (let i = 0; i < buyerReceipts.length; i++) {
    const receipt = buyerReceipts[i];
    console.log(`    Buyer Receipt ${i + 1}: ${ethers.formatUnits(receipt.usdt, 6)} USDT, ${ethers.formatUnits(receipt.magax, 18)} MAGAX, isBonus: ${receipt.isBonus}`);
  }

  for (let i = 0; i < referrerReceipts.length; i++) {
    const receipt = referrerReceipts[i];
    console.log(`    Referrer Receipt ${i + 1}: ${ethers.formatUnits(receipt.usdt, 6)} USDT, ${ethers.formatUnits(receipt.magax, 18)} MAGAX, isBonus: ${receipt.isBonus}`);
  }

  console.log(`\n✅ Combined promo+referral function test completed successfully!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
