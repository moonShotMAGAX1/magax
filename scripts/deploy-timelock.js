const { ethers } = require("hardhat");

/**
 * Deploy MAGAX Timelock with Multi-Sig Governance
 * 
 * Architecture:
 * - Multi-sig contracts (Gnosis Safe, SimpleMultiSig) act as proposers/executors
 * - Timelock enforces 48-hour delays on all operations
 * - Presale contract receives admin commands only from timelock
 * - No individual EOAs have direct timelock control in production
 */

async function deployTimelock() {
    console.log("Deploying MAGAX Timelock with 48-hour delay...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // 48-hour delay (172800 seconds)
    const minDelay = 48 * 60 * 60;
    console.log("Timelock delay:", minDelay, "seconds (48 hours)");
    
    // Multi-sig contract addresses that can propose/execute
    // Use actual multi-sig contract addresses (e.g., Gnosis Safe, SimpleMultiSig)
    const proposers = [
        process.env.MULTISIG_PROPOSER_1_ADDRESS,  // Primary multi-sig contract
        process.env.MULTISIG_PROPOSER_2_ADDRESS,  // Secondary multi-sig contract
        process.env.GNOSIS_SAFE_ADDRESS,         // Gnosis Safe contract
        process.env.SIMPLE_MULTISIG_ADDRESS      // SimpleMultiSig contract
    ].filter(addr => addr && addr !== ""); // Remove empty addresses
    
    // Validate that we have at least one multi-sig address
    if (proposers.length === 0) {
        console.warn("⚠️  No multi-sig addresses configured, using deployer as fallback");
        proposers.push(deployer.address);
    }
    
    const executors = proposers; // Same multi-sig contracts can execute
    const admin = ethers.ZeroAddress; // No admin role for full decentralization
    
    console.log("Multi-sig Proposers/Executors:", proposers);
    console.log("Expected contract types: Gnosis Safe, SimpleMultiSig, or similar");
    
    // Deploy timelock
    const MAGAXTimelock = await ethers.getContractFactory("MAGAXTimelock");
    const timelock = await MAGAXTimelock.deploy(minDelay, proposers, executors, admin);
    await timelock.waitForDeployment();
    
    const timelockAddress = await timelock.getAddress();
    console.log("✅ Timelock deployed to:", timelockAddress);
    
    // Verify deployment
    const deployedDelay = await timelock.getMinDelay();
    console.log("✅ Verified delay:", deployedDelay.toString(), "seconds");
    
    return {
        timelock,
        address: timelockAddress,
        delay: deployedDelay.toString()
    };
}

async function deployPresaleWithTimelock() {
    console.log("Deploying MAGAX Presale with Timelock integration...");
    
    // Deploy timelock first
    const { timelock, address: timelockAddress } = await deployTimelock();
    
    console.log("\nDeploying presale contract...");
    
    const recorder = process.env.RECORDER_ADDRESS;
    const stageManager = process.env.STAGE_MANAGER_ADDRESS;
    
    if (!recorder) {
        throw new Error("RECORDER_ADDRESS must be set in environment");
    }
    if (!stageManager) {
        throw new Error("STAGE_MANAGER_ADDRESS must be set in environment");
    }
    
    // Deploy presale with timelock as admin
    const MAGAXPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
    const presale = await MAGAXPresale.deploy(recorder, stageManager, timelockAddress);
    await presale.waitForDeployment();
    
    const presaleAddress = await presale.getAddress();
    console.log("✅ Presale deployed to:", presaleAddress);
    
    // Verify admin role assignment
    const DEFAULT_ADMIN_ROLE = await presale.DEFAULT_ADMIN_ROLE();
    const isTimelockAdmin = await presale.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress);
    
    console.log("✅ Timelock has admin role:", isTimelockAdmin);
    
    // Remove references to timelock-specific properties that no longer exist
    // const isTimelockActive = await presale.timelockActive();
    // const contractTimelock = await presale.timelock();
    
    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        timelock: {
            address: timelockAddress,
            delay: "172800", // 48 hours
        },
        presale: {
            address: presaleAddress,
            timelockIsAdmin: isTimelockAdmin,
        },
        timestamp: new Date().toISOString(),
        deployer: (await ethers.getSigners())[0].address
    };
    
    const fs = require('fs');
    const deploymentPath = `./deployments/timelock-${hre.network.name}-${Date.now()}.json`;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("✅ Deployment info saved to:", deploymentPath);
    
    return deploymentInfo;
}

async function main() {
    try {
        const deployment = await deployPresaleWithTimelock();
        
        console.log("\n🎉 Deployment Summary:");
        console.log("=".repeat(50));
        console.log("Network:", deployment.network);
        console.log("Timelock Address:", deployment.timelock.address);
        console.log("Timelock Delay:", deployment.timelock.delay, "seconds (48 hours)");
        console.log("Presale Address:", deployment.presale.address);
        console.log("Timelock Active:", deployment.presale.timelockActive);
        console.log("Deployer:", deployment.deployer);
        console.log("=".repeat(50));
        
        console.log("\n📋 Next Steps:");
        console.log("1. Verify contracts on block explorer");
        console.log("2. Test timelock operations on testnet");
        console.log("3. Ensure multi-sig contracts are properly configured as proposers/executors");
        console.log("4. Test multi-sig → timelock → presale operation flow");
        console.log("5. Update frontend to use timelock for critical operations");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }
}

// Allow running specific functions
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    deployTimelock,
    deployPresaleWithTimelock,
    main
};
