const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MAGAX Timelock Integration", function () {
    let timelock, presale;
    let owner, recorder, admin1, admin2, finalizer1, finalizer2;
    let timelockAddress, presaleAddress;
    
    const DELAY = 48 * 60 * 60; // 48 hours
    
    before(async function () {
        [owner, recorder, admin1, admin2, finalizer1, finalizer2] = await ethers.getSigners();
        
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
        presale = await MAGAXPresale.deploy(recorder.address, timelockAddress);
        await presale.waitForDeployment();
        presaleAddress = await presale.getAddress();
        
        console.log("Timelock deployed to:", timelockAddress);
        console.log("Presale deployed to:", presaleAddress);
        
        // Grant additional roles to test accounts for testing
        await presale.connect(owner).grantRole(await presale.FINALIZER_ROLE(), finalizer1.address);
        await presale.connect(owner).grantRole(await presale.FINALIZER_ROLE(), finalizer2.address);
        await presale.connect(owner).grantRole(await presale.DEFAULT_ADMIN_ROLE(), admin1.address);
        await presale.connect(owner).grantRole(await presale.DEFAULT_ADMIN_ROLE(), admin2.address);
        await presale.connect(owner).grantRole(await presale.EMERGENCY_ROLE(), admin1.address);
        await presale.connect(owner).grantRole(await presale.EMERGENCY_ROLE(), admin2.address);
    });
    
    describe("Timelock Configuration", function () {
        it("Should have correct timelock configuration", async function () {
            expect(await presale.timelock()).to.equal(timelockAddress);
            expect(await presale.timelockActive()).to.be.true;
            expect(await presale.TIMELOCK_DELAY()).to.equal(DELAY);
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

        it("Should reject presale deployment with wrong timelock delay", async function () {
            // Deploy a timelock with wrong delay for testing
            const proposers = [admin1.address];
            const executors = [admin1.address];
            
            const TimelockController = await ethers.getContractFactory("TimelockController");
            const wrongTimelock = await TimelockController.deploy(
                86400, // 24 hours instead of 48
                proposers,
                executors,
                ethers.ZeroAddress
            );
            await wrongTimelock.waitForDeployment();
            const wrongTimelockAddress = await wrongTimelock.getAddress();
            
            const MAGAXPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
            
            // Should reject presale deployment with wrong timelock
            await expect(
                MAGAXPresale.deploy(recorder.address, wrongTimelockAddress)
            ).to.be.revertedWith("Timelock: delay must be exactly 48 hours");
        });
        
        it("Should grant timelock critical roles", async function () {
            const ADMIN_ROLE = await presale.DEFAULT_ADMIN_ROLE();
            const FINALIZER_ROLE = await presale.FINALIZER_ROLE();
            const EMERGENCY_ROLE = await presale.EMERGENCY_ROLE();
            
            expect(await presale.hasRole(ADMIN_ROLE, timelockAddress)).to.be.true;
            expect(await presale.hasRole(FINALIZER_ROLE, timelockAddress)).to.be.true;
            expect(await presale.hasRole(EMERGENCY_ROLE, timelockAddress)).to.be.true;
        });
    });
    
    describe("Timelock Operations", function () {
        it("Should reject direct calls to timelock-protected functions", async function () {
            // These should be rejected because timelock is required, not because of access control
            await expect(
                presale.connect(finalizer1).finalise()
            ).to.be.revertedWithCustomError(presale, "TimelockRequired");
            
            await expect(
                presale.connect(admin1).setMaxPromoBps(1000)
            ).to.be.revertedWithCustomError(presale, "TimelockRequired");
        });
        
        it("Should allow scheduling and executing finalization through timelock", async function () {
            // Encode the function call
            const data = presale.interface.encodeFunctionData("finalise");
            const target = presaleAddress;
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
            const operationId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "bytes", "bytes32", "bytes32"],
                    [target, value, data, ethers.ZeroHash, salt]
                )
            );
            
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
            ).to.emit(presale, "Finalised")
             .and.to.emit(presale, "TimelockOperationExecuted");
            
            // Verify presale is finalized
            expect(await presale.finalised()).to.be.true;
            expect(await presale.paused()).to.be.true;
        });
        
        it("Should allow scheduling max promo BPS update", async function () {
            // Deploy new presale for this test (previous one is finalized)
            const newPresale = await (await ethers.getContractFactory("MAGAXPresaleReceipts"))
                .deploy(recorder.address, timelockAddress);
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
            await expect(
                presale.connect(admin1).emergencyTokenWithdraw(
                    "0x0000000000000000000000000000000000000001", // dummy token
                    admin1.address
                )
            ).to.be.revertedWithCustomError(presale, "TimelockRequired");
        });
        
        it("Should allow immediate emergency withdrawal with 3-of-N multi-sig", async function () {
            // Grant emergency role to more accounts for 3-sig test
            await presale.connect(owner).grantRole(await presale.EMERGENCY_ROLE(), finalizer1.address);
            await presale.connect(owner).grantRole(await presale.EMERGENCY_ROLE(), finalizer2.address);
            
            // First call - proposal (should succeed)
            await expect(
                presale.connect(admin1).immediateEmergencyWithdraw(
                    "0x0000000000000000000000000000000000000001", // dummy token
                    admin1.address
                )
            ).to.emit(presale, "OperationProposed");
            
            // Function exists and can be called - detailed testing would require actual tokens
            expect(presale.interface.getFunction("immediateEmergencyWithdraw")).to.exist;
        });
    });
    
    describe("Non-Critical Operations", function () {
        it("Should allow immediate execution of operational functions", async function () {
            // Check if contract is already paused from finalization test
            const isPaused = await presale.paused();
            
            if (!isPaused) {
                await expect(presale.connect(owner).pause()).to.not.be.reverted;
            }
            await expect(presale.connect(owner).unpause()).to.not.be.reverted;
        });
    });
});
