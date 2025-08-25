const { ethers } = require("hardhat");

async function main() {
  console.log("Recording test purchases using RECORDER_ROLE");
  
  const contractAddress = process.env.POLYGON_PRESALE_ADDRESS;
  const recorderAddress = "0x6D34E78Aa7dE04d3B9Ae696b62d32D5a81930F48";
  
  console.log("Contract:", contractAddress);
  console.log("Recorder address:", recorderAddress);
  console.log("=".repeat(50));
  
  // Connect using deployer (who should have RECORDER_ROLE)
  // NOTE: This script will only work if the signer has RECORDER_ROLE
  const [deployer] = await ethers.getSigners();
  console.log("Signer address:", deployer.address);
  
  const presale = await ethers.getContractAt("MAGAXPresaleReceipts", contractAddress);
  
  // Verify the signer has RECORDER_ROLE before proceeding
  const RECORDER_ROLE = await presale.RECORDER_ROLE();
  const hasRecorderRole = await presale.hasRole(RECORDER_ROLE, deployer.address);
  
  console.log("RECORDER_ROLE verification:");
  console.log("  RECORDER_ROLE hash:", RECORDER_ROLE);
  console.log("  Signer has RECORDER_ROLE:", hasRecorderRole);
  
  if (!hasRecorderRole) {
    console.log("ERROR: Signer does not have RECORDER_ROLE!");
    console.log("Cannot proceed with recording purchases.");
    console.log("Only addresses with RECORDER_ROLE can call these functions.");
    return;
  }
  
  try {
    // Check current state
    const currentStage = await presale.currentStage();
    const isPaused = await presale.paused();
    const stageInfo = await presale.stages(currentStage);
    
    console.log("Current Contract State:");
    console.log("  Current stage:", currentStage.toString());
    console.log("  Contract paused:", isPaused);
    console.log("  Stage price per token (USDT):", ethers.formatUnits(stageInfo.pricePerToken, 6));
    console.log("  Tokens allocated:", ethers.formatUnits(stageInfo.tokensAllocated, 18));
    console.log("  USD target:", ethers.formatUnits(stageInfo.usdTarget, 6));
    console.log("  USD raised:", ethers.formatUnits(stageInfo.usdRaised, 6));
    console.log("  Tokens sold:", ethers.formatUnits(stageInfo.tokensSold, 18));
    console.log("  Stage active:", stageInfo.isActive);
    console.log("-".repeat(50));
    
    if (isPaused) {
      console.log("ERROR: Contract is paused - cannot record purchases");
      return;
    }
    
    if (!stageInfo.isActive) {
      console.log("ERROR: Current stage is not active");
      return;
    }
    
    // Test buyer addresses
    const buyer1 = "0x1234567890123456789012345678901234567890";
    const buyer2 = "0x2345678901234567890123456789012345678901";
    const buyer3 = "0x3456789012345678901234567890123456789012";
    const referrer = "0x4567890123456789012345678901234567890123";
    
    // Calculate amounts based on current stage price
    const pricePerToken = stageInfo.pricePerToken; // USDT per MAGAX (6 decimals)
    const usdtAmount = ethers.parseUnits("100", 6); // 100 USDT
    const magaxAmount = (usdtAmount * ethers.parseUnits("1", 18)) / pricePerToken; // Calculate MAGAX tokens
    
    console.log("Test Purchase Amounts:");
    console.log("  USDT Amount:", ethers.formatUnits(usdtAmount, 6), "USDT");
    console.log("  MAGAX Amount:", ethers.formatUnits(magaxAmount, 18), "MAGAX");
    console.log("-".repeat(50));
    
    // 1. Basic Record Purchase
    console.log("Test 1: Basic recordPurchase");
    try {
      const tx1 = await presale.recordPurchase(buyer1, usdtAmount, magaxAmount);
      console.log("  Transaction hash:", tx1.hash);
      const receipt1 = await tx1.wait();
      console.log("  SUCCESS: Basic purchase recorded - Block:", receipt1.blockNumber);
      
      // Check buyer's balances
      const buyerUSDT = await presale.userTotalUSDT(buyer1);
      const buyerMAGAX = await presale.userTotalMAGAX(buyer1);
      console.log("  Buyer USDT balance:", ethers.formatUnits(buyerUSDT, 6));
      console.log("  Buyer MAGAX balance:", ethers.formatUnits(buyerMAGAX, 18));
    } catch (error) {
      console.log("  ERROR:", error.message);
    }
    
    console.log();
    
    // 2. Record Purchase with Referral
    console.log("Test 2: recordPurchaseWithReferral");
    try {
      const tx2 = await presale.recordPurchaseWithReferral(
        buyer2, 
        usdtAmount, 
        magaxAmount, 
        referrer
      );
      console.log("  Transaction hash:", tx2.hash);
      const receipt2 = await tx2.wait();
      console.log("  SUCCESS: Referral purchase recorded - Block:", receipt2.blockNumber);
      
      // Check buyer's and referrer's balances
      const buyerUSDT2 = await presale.userTotalUSDT(buyer2);
      const buyerMAGAX2 = await presale.userTotalMAGAX(buyer2);
      const referrerMAGAX = await presale.userTotalMAGAX(referrer);
      console.log("  Buyer USDT:", ethers.formatUnits(buyerUSDT2, 6));
      console.log("  Buyer MAGAX:", ethers.formatUnits(buyerMAGAX2, 18));
      console.log("  Referrer MAGAX bonus:", ethers.formatUnits(referrerMAGAX, 18));
    } catch (error) {
      console.log("  ERROR:", error.message);
    }
    
    console.log();
    
    // 3. Record Purchase with Promo
    console.log("Test 3: recordPurchaseWithPromo");
    try {
      const promoBps = 1500; // 15% bonus
      const tx3 = await presale.recordPurchaseWithPromo(
        buyer3, 
        usdtAmount, 
        magaxAmount, 
        promoBps
      );
      console.log("  Transaction hash:", tx3.hash);
      const receipt3 = await tx3.wait();
      console.log("  SUCCESS: Promo purchase recorded - Block:", receipt3.blockNumber);
      console.log("  Promo bonus:", promoBps / 100, "%");
      
      // Check buyer's balances
      const buyerUSDT3 = await presale.userTotalUSDT(buyer3);
      const buyerMAGAX3 = await presale.userTotalMAGAX(buyer3);
      console.log("  Buyer USDT:", ethers.formatUnits(buyerUSDT3, 6));
      console.log("  Buyer MAGAX (with promo):", ethers.formatUnits(buyerMAGAX3, 18));
    } catch (error) {
      console.log("  ERROR:", error.message);
    }
    
    console.log();
    
    // Final stage info
    const finalStageInfo = await presale.stages(currentStage);
    console.log("Final Stage State:");
    console.log("  Tokens sold:", ethers.formatUnits(finalStageInfo.tokensSold, 18));
    if (finalStageInfo.tokensAllocated > 0n) {
      console.log("  Remaining tokens:", ethers.formatUnits(
        finalStageInfo.tokensAllocated - finalStageInfo.tokensSold, 18
      ));
    } else {
      console.log("  Remaining tokens: unlimited (stage token cap disabled)");
    }
    console.log("  USD target:", ethers.formatUnits(finalStageInfo.usdTarget, 6));
    console.log("  USD raised:", ethers.formatUnits(finalStageInfo.usdRaised, 6));
    
  } catch (error) {
    console.error("ERROR: Script error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
