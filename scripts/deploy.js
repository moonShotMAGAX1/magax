require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const treasury = process.env.TREASURY_ADDRESS;

  if (!treasury) {
    throw new Error("TREASURY_ADDRESS is not defined in .env");
  }

  const Token = await hre.ethers.getContractFactory("MoonShotMAGAX");
  const token = await Token.deploy(treasury);

  console.log(`MoonShot MAGAX deployed to: ${token.target}`);
  console.log(`Total supply minted to treasury: ${treasury}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
