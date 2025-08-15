const { ethers } = require("hardhat");

async function main() {
    console.log("Activating Stage 1 using STAGE_MANAGER_ROLE");
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
    
    // Stage 1 configuration from deploy.js
    const stage1Config = {
        stage: 1,
        price: "0.000270", // USDT per MAGAX token
        tokens: "200000000" // Total tokens for stage 1
    };
    
    console.log("\nStage 1 Configuration:");
    console.log("  Stage:", stage1Config.stage);
    console.log("  Price per token:", stage1Config.price, "USDT");
    console.log("  Token allocation:", stage1Config.tokens, "MAGAX");
    
    // Convert to contract format
    const pricePerToken = ethers.parseUnits(stage1Config.price, 6); // 6 decimals for USDT
    const tokensAllocated = ethers.parseUnits(stage1Config.tokens, 18); // 18 decimals for MAGAX
    
    console.log("\nContract values:");
    console.log("  Price per token (wei):", pricePerToken.toString());
    console.log("  Tokens allocated (wei):", tokensAllocated.toString());
    
    try {
        // Check current stage state
        console.log("\nChecking current stage state...");
        const currentStage = await presale.currentStage();
        const stageInfo = await presale.stages(1);
        
        console.log("Current stage:", currentStage.toString());
        console.log("Stage 1 info:");
        console.log("  Price per token:", ethers.formatUnits(stageInfo.pricePerToken, 6), "USDT");
        console.log("  Tokens allocated:", ethers.formatUnits(stageInfo.tokensAllocated, 18), "MAGAX");
        console.log("  Tokens sold:", ethers.formatUnits(stageInfo.tokensSold, 18), "MAGAX");
        console.log("  Is active:", stageInfo.isActive);
        
        if (stageInfo.isActive) {
            console.log("✅ Stage 1 is already active!");
            return;
        }
        
        // Configure stage 1 if not already configured with correct values
        if (stageInfo.pricePerToken !== pricePerToken || stageInfo.tokensAllocated !== tokensAllocated) {
            console.log("\nConfiguring Stage 1...");
            const configureTx = await presale.configureStage(1, pricePerToken, tokensAllocated);
            console.log("Configure transaction hash:", configureTx.hash);
            await configureTx.wait();
            console.log("✅ Stage 1 configured successfully");
        } else {
            console.log("✅ Stage 1 already configured with correct values");
        }
        
        // Activate stage 1
        console.log("\nActivating Stage 1...");
        const activateTx = await presale.activateStage(1);
        console.log("Activate transaction hash:", activateTx.hash);
        const receipt = await activateTx.wait();
        console.log("✅ Stage 1 activated successfully!");
        console.log("Block number:", receipt.blockNumber);
        
        // Verify activation
        const updatedStageInfo = await presale.stages(1);
        const newCurrentStage = await presale.currentStage();
        
        console.log("\n🎉 Final verification:");
        console.log("Current stage:", newCurrentStage.toString());
        console.log("Stage 1 active:", updatedStageInfo.isActive);
        console.log("Price per token:", ethers.formatUnits(updatedStageInfo.pricePerToken, 6), "USDT");
        console.log("Tokens allocated:", ethers.formatUnits(updatedStageInfo.tokensAllocated, 18), "MAGAX");
        
        console.log("\n✅ Stage 1 is now ready for purchases!");
        
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
