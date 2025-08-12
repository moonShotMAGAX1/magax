const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MAGAX Timelock Integration", function () {
    let timelock, presale;
    let owner, recorder, stageManager, admin1, admin2, finalizer1, finalizer2;
    let timelockAddress, presaleAddress;
    
    const DELAY = 48 * 60 * 60; // 48 hours
    
    before(async function () {
        [owner, recorder, stageManager, admin1, admin2, finalizer1, finalizer2] = await ethers.getSigners();
        
        console.log("Deploying timelock and presale contracts...");
        
        // Deploy timelock
        const proposers = [admin1.address, admin2.address, finalizer1.address, finalizer2.address];
        const executors = proposers;
        const admin = ethers.ZeroAddress; // No admin
        
        const MAGAXTimelock = await ethers.getContractFactory("MAGAXTimelock");
        timelock = await MAGAXTimelock.deploy(DELAY, proposers, executors, admin);
        await timelock.waitForDeployment();
        timelockAddress = await timelock.getAddress();
        
        // Deploy presale with timelock
        const MAGAXPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
        presale = await MAGAXPresale.deploy(recorder.address, stageManager.address, timelockAddress);
        await presale.waitForDeployment();
        presaleAddress = await presale.getAddress();
        
        console.log("Timelock deployed to:", timelockAddress);
        console.log("Presale deployed to:", presaleAddress);
    });
    
    describe("Timelock Configuration", function () {
        it("Should have correct timelock configuration", async function () {
            // Verify timelock has admin role
            const DEFAULT_ADMIN_ROLE = await presale.DEFAULT_ADMIN_ROLE();
            expect(await presale.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress)).to.be.true;
        });
        
        it("Should have correct timelock delay", async function () {
            const minDelay = await timelock.getMinDelay();
            expect(minDelay).to.equal(DELAY);
            expect(minDelay).to.equal(172800); // Verify exactly 48 hours
        });
        
        it("Should enforce admin is zero address for decentralization", async function () {
            // Check that timelock does not have admin role
            const adminRole = await timelock.DEFAULT_ADMIN_ROLE();
            // Verify that no account (including zero address) has the admin role
            const hasAdmin = await timelock.hasRole(adminRole, ethers.ZeroAddress);
            expect(hasAdmin).to.be.false;
            
            // Also verify deployer doesn't have admin role
            const deployerHasAdmin = await timelock.hasRole(adminRole, owner.address);
            expect(deployerHasAdmin).to.be.false;
        });

        it("Should reject timelock deployment with wrong delay", async function () {
            const proposers = [admin1.address];
            const executors = [admin1.address];
            const admin = ethers.ZeroAddress;
            
            const MAGAXTimelock = await ethers.getContractFactory("MAGAXTimelock");
            
            // Try to deploy with wrong delay (24 hours instead of 48)
            await expect(
                MAGAXTimelock.deploy(86400, proposers, executors, admin)
            ).to.be.revertedWith("Timelock: delay must be exactly 48 hours");
        });

        it("Should reject timelock deployment with non-zero admin", async function () {
            const proposers = [admin1.address];
            const executors = [admin1.address];
            
            const MAGAXTimelock = await ethers.getContractFactory("MAGAXTimelock");
            
            // Try to deploy with non-zero admin
            await expect(
                MAGAXTimelock.deploy(DELAY, proposers, executors, admin1.address)
            ).to.be.revertedWith("Timelock: admin must be zero address for decentralization");
        });

        it("Should grant timelock critical roles", async function () {
            const ADMIN_ROLE = await presale.DEFAULT_ADMIN_ROLE();
            expect(await presale.hasRole(ADMIN_ROLE, timelockAddress)).to.be.true;
            
            // Verify deployer doesn't have admin role (timelock is sole admin)
            expect(await presale.hasRole(ADMIN_ROLE, owner.address)).to.be.false;
        });
    });
    
    describe("Timelock Operations", function () {
        it("Should reject direct calls to timelock-protected functions", async function () {
            // Since timelock is the only admin, other accounts should not have required roles
            await expect(
                presale.connect(finalizer1).finalise()
            ).to.be.reverted; // Access control error, not TimelockRequired
            
            await expect(
                presale.connect(admin1).setMaxPromoBps(1000)
            ).to.be.reverted; // Access control error, not TimelockRequired
        });
        
        it("Should allow scheduling and executing finalization through timelock", async function () {
            // Create a simple presale for testing where owner has admin role
            const TestPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
            const testPresale = await TestPresale.deploy(recorder.address, owner.address, owner.address);
            await testPresale.waitForDeployment();
            const testPresaleAddress = await testPresale.getAddress();
            
            // Grant finalizer role to timelock
            await testPresale.connect(owner).grantRole(await testPresale.FINALIZER_ROLE(), timelockAddress);
            
            // Now test timelock operation
            const data = testPresale.interface.encodeFunctionData("finalise");
            const target = testPresaleAddress;
            const value = 0;
            const salt = ethers.randomBytes(32);
            
            // Schedule operation
            const scheduleTx = await timelock.connect(finalizer1).schedule(
                target,
                value,
                data,
                ethers.ZeroHash,
                salt,
                DELAY
            );
            await scheduleTx.wait();
            
            // Check operation is pending
            const operationId = await timelock.hashOperation(target, value, data, ethers.ZeroHash, salt);
            
            expect(await timelock.isOperationPending(operationId)).to.be.true;
            expect(await timelock.isOperationReady(operationId)).to.be.false;
            
            // Fast forward 48 hours
            await time.increase(DELAY);
            
            // Now operation should be ready
            expect(await timelock.isOperationReady(operationId)).to.be.true;
            
            // Execute operation
            await expect(
                timelock.connect(finalizer2).execute(
                    target,
                    value,
                    data,
                    ethers.ZeroHash,
                    salt
                )
            ).to.emit(testPresale, "Finalised");
            
            // Verify presale is finalized
            expect(await testPresale.finalised()).to.be.true;
            expect(await testPresale.paused()).to.be.true;
        });
        
        it("Should allow scheduling max promo BPS update", async function () {
            // Deploy new presale for this test (previous one is finalized)
            const newPresale = await (await ethers.getContractFactory("MAGAXPresaleReceipts"))
                .deploy(recorder.address, owner.address, timelockAddress);
            await newPresale.waitForDeployment();
            const newPresaleAddress = await newPresale.getAddress();
            
            const newCap = 2000; // 20%
            const data = newPresale.interface.encodeFunctionData("setMaxPromoBps", [newCap]);
            const target = newPresaleAddress;
            const value = 0;
            const salt = ethers.randomBytes(32);
            
            // Schedule operation
            await timelock.connect(admin1).schedule(
                target,
                value,
                data,
                ethers.ZeroHash,
                salt,
                DELAY
            );
            
            // Fast forward and execute
            await time.increase(DELAY);
            
            await expect(
                timelock.connect(admin2).execute(
                    target,
                    value,
                    data,
                    ethers.ZeroHash,
                    salt
                )
            ).to.emit(newPresale, "MaxPromoBpsUpdated")
             .withArgs(5000, newCap, timelockAddress); // old cap, new cap, timelock address
            
            expect(await newPresale.maxPromoCapBps()).to.equal(newCap);
        });
    });
    
    describe("Emergency Operations", function () {
        it("Should require timelock for standard emergency withdrawal", async function () {
            // Since only timelock has emergency role, other accounts should not have access
            await expect(
                presale.connect(admin1).emergencyTokenWithdraw(
                    "0x0000000000000000000000000000000000000001", // dummy token
                    admin1.address
                )
            ).to.be.reverted; // Access control error, not TimelockRequired
        });
        
        it("Should verify emergency functions require proper authorization", async function () {
            // Emergency functions should only be available through timelock
            // Regular emergency withdrawal should fail for non-timelock users
            await expect(
                presale.connect(admin1).emergencyTokenWithdraw(
                    admin1.address, // mock token address
                    admin1.address
                )
            ).to.be.reverted; // Access control error, not TimelockRequired
        });
    });
    
    describe("Non-Critical Operations", function () {
        it("Should allow immediate execution of operational functions", async function () {
            // Create a test contract where owner has admin role for this test
            const TestPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
            const testPresale = await TestPresale.deploy(recorder.address, owner.address, owner.address);
            await testPresale.waitForDeployment();
            
            // Test pause/unpause functionality
            await expect(testPresale.connect(owner).pause()).to.not.be.reverted;
            await expect(testPresale.connect(owner).unpause()).to.not.be.reverted;
        });
    });
});
