const { ethers } = require("hardhat");

async function deployTimelock() {
    console.log("Deploying MAGAX Timelock with 48-hour delay...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // 48-hour delay (172800 seconds)
    const minDelay = 48 * 60 * 60;
    console.log("Timelock delay:", minDelay, "seconds (48 hours)");
    
    // Multi-sig addresses that can propose/execute
    const proposers = [
        process.env.ADMIN_ADDRESS || deployer.address,
        process.env.ADMIN_2_ADDRESS || deployer.address,
        process.env.FINALIZER_ROLE_ADDRESS || deployer.address,
        process.env.FINALIZER_2_ADDRESS || deployer.address,
        process.env.EMERGENCY_ROLE_ADDRESS || deployer.address,
        process.env.EMERGENCY_2_ADDRESS || deployer.address
    ].filter((addr, index, arr) => arr.indexOf(addr) === index); // Remove duplicates
    
    const executors = proposers; // Same addresses can execute
    const admin = ethers.ZeroAddress; // No admin role for full decentralization
    
    console.log("Proposers/Executors:", proposers);
    
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
        console.log("3. Configure multi-sig wallets as proposers/executors");
        console.log("4. Update frontend to use timelock for critical operations");
        
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
