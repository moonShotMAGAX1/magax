const { ethers } = require("hardhat");

// Constants for bonus calculations
const REF_BPS = 700;        // 7% referrer bonus
const REFEREE_BPS = 500;    // 5% referee bonus  
const MAX_PROMO_BPS = 2000; // 20% promo ceiling
const SAFETY_BPS = 300;     // 3% rounding/slippage safety margin

// Stage configurations (price in USDT, usdTarget in USDT)
const STAGE_CONFIGS = {
    1: { price: "0.000270", usdTarget: "54000" },
    2: { price: "0.000293", usdTarget: "61647.2" },
    3: { price: "0.000318", usdTarget: "70386.374" },
    4: { price: "0.000345", usdTarget: "80433.43" },
    5: { price: "0.000375", usdTarget: "91859.531" },
    // Add more stages as needed
};

/**
 * TokensAlloc18WithHeadroom calculates token allocation with headroom for bonuses and safety margins
 */
function tokensAlloc18WithHeadroom(usdTarget6d, price6d, bonusBps = 0, safetyBps = SAFETY_BPS) {
  if (price6d <= 0n) {
    return 0n; // invalid price guard
  }

  const num = usdTarget6d * BigInt(1e18);
  const base = num / price6d;
  const factorBps = BigInt(10000 + bonusBps + safetyBps);
  const tmp = base * factorBps;
  const den = 10000n;
  const result = (tmp + den - 1n) / den; // ceil

  return result > 0n ? result : 1n; // never zero per audit requirement
}

async function main() {
    // Get stage number from command line args, default to 1
    const targetStage = parseInt(process.argv[2]) || 1;
    
    console.log(`Activating Stage ${targetStage} using STAGE_MANAGER_ROLE`);
    console.log("=".repeat(50));
    
    const contractAddress = process.env.POLYGON_PRESALE_ADDRESS;
    const stageManagerPrivateKey = process.env.STAGE_MANAGER_PRIVATE_KEY;
    
    if (!contractAddress) {
        throw new Error("POLYGON_PRESALE_ADDRESS not set in .env");
    }
    
    if (!stageManagerPrivateKey) {
        throw new Error("STAGE_MANAGER_PRIVATE_KEY not set in .env");
    }
    
    // Create signer from private key
    const provider = ethers.provider;
    const stageManagerSigner = new ethers.Wallet(stageManagerPrivateKey, provider);
    
    console.log("Contract Address:", contractAddress);
    console.log("Stage Manager Address:", stageManagerSigner.address);
    
    // Connect to presale contract with stage manager signer
    const presale = await ethers.getContractAt("MAGAXPresaleReceipts", contractAddress, stageManagerSigner);
    
    // Verify the signer has STAGE_MANAGER_ROLE
    const STAGE_MANAGER_ROLE = await presale.STAGE_MANAGER_ROLE();
    const hasStageManagerRole = await presale.hasRole(STAGE_MANAGER_ROLE, stageManagerSigner.address);
    
    console.log("STAGE_MANAGER_ROLE verification:");
    console.log("  STAGE_MANAGER_ROLE hash:", STAGE_MANAGER_ROLE);
    console.log("  Signer has STAGE_MANAGER_ROLE:", hasStageManagerRole);
    
    if (!hasStageManagerRole) {
        throw new Error("Signer does not have STAGE_MANAGER_ROLE!");
    }
    
    // Get stage configuration
    const stageConfig = STAGE_CONFIGS[targetStage];
    if (!stageConfig) {
        throw new Error(`Stage ${targetStage} configuration not found! Available stages: ${Object.keys(STAGE_CONFIGS).join(', ')}`);
    }
    
    console.log(`\nStage ${targetStage} Configuration:`);
    console.log("  Stage:", targetStage);
    console.log("  Price per token:", stageConfig.price, "USDT");
    console.log("  USD Target:", stageConfig.usdTarget, "USDT");
    
    // Convert to contract format
    const pricePerToken = ethers.parseUnits(stageConfig.price, 6); // 6 decimals for USDT
    const usdTarget = ethers.parseUnits(stageConfig.usdTarget, 6); // 6 decimals for USDT
    
    // Calculate allocation with headroom for referral + promo bonuses + safety margin
    const maxBonusBps = REF_BPS + REFEREE_BPS + MAX_PROMO_BPS; // 7% + 5% + 20% = 32%
    const tokensAllocated = tokensAlloc18WithHeadroom(usdTarget, pricePerToken, maxBonusBps, SAFETY_BPS);
    
    console.log("\nContract values:");
    console.log("  Price per token (wei):", pricePerToken.toString());
    console.log("  USD Target (wei):", usdTarget.toString());
    console.log("  Tokens allocated (wei):", tokensAllocated.toString());
    console.log(`  Allocation with headroom: ${ethers.formatUnits(tokensAllocated, 18)} tokens (${(maxBonusBps + SAFETY_BPS)/100}% headroom)`);
    
    try {
        // Check current stage state
        console.log("\nChecking current stage state...");
        const currentStage = await presale.currentStage();
        const stageInfo = await presale.stages(targetStage);
        
        console.log("Current active stage:", currentStage.toString());
        console.log(`Stage ${targetStage} info:`);
        console.log("  Price per token:", ethers.formatUnits(stageInfo.pricePerToken, 6), "USDT");
        console.log("  Tokens allocated:", ethers.formatUnits(stageInfo.tokensAllocated, 18), "MAGAX");
        console.log("  Tokens sold:", ethers.formatUnits(stageInfo.tokensSold, 18), "MAGAX");
        console.log("  USD Target:", ethers.formatUnits(stageInfo.usdTarget, 6), "USDT");
        console.log("  USD Raised:", ethers.formatUnits(stageInfo.usdRaised, 6), "USDT");
        console.log("  Is active:", stageInfo.isActive);
        
        if (stageInfo.isActive) {
            console.log(`✅ Stage ${targetStage} is already active!`);
            return;
        }
        
        // Compute usdTarget from allocation (should be ~54,000)
        const expectedUsdTarget = usdTarget;
        if (stageInfo.pricePerToken !== pricePerToken || stageInfo.tokensAllocated !== tokensAllocated || stageInfo.usdTarget !== expectedUsdTarget) {
            console.log(`\nConfiguring Stage ${targetStage}...`);
            const configureTx = await presale.configureStage(targetStage, pricePerToken, tokensAllocated, expectedUsdTarget);
            console.log("Configure transaction hash:", configureTx.hash);
            await configureTx.wait();
            console.log(`✅ Stage ${targetStage} configured successfully`);
        } else {
            console.log(`✅ Stage ${targetStage} already configured with correct values`);
        }
        
        // Activate stage
        console.log(`\nActivating Stage ${targetStage}...`);
        const activateTx = await presale.activateStage(targetStage);
        console.log("Activate transaction hash:", activateTx.hash);
        const receipt = await activateTx.wait();
        console.log(`✅ Stage ${targetStage} activated successfully!`);
        console.log("Block number:", receipt.blockNumber);
        
        // Verify activation
        const updatedStageInfo = await presale.stages(targetStage);
        const newCurrentStage = await presale.currentStage();
        
        console.log("\n🎉 Final verification:");
        console.log("Current stage:", newCurrentStage.toString());
        console.log(`Stage ${targetStage} active:`, updatedStageInfo.isActive);
        console.log("Price per token:", ethers.formatUnits(updatedStageInfo.pricePerToken, 6), "USDT");
        console.log("Tokens allocated:", ethers.formatUnits(updatedStageInfo.tokensAllocated, 18), "MAGAX");
        console.log("USD Target:", ethers.formatUnits(updatedStageInfo.usdTarget, 6), "USDT");
        
        console.log(`\n✅ Stage ${targetStage} is now ready for purchases!`);
        
    } catch (error) {
        console.error("❌ Error activating stage:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
