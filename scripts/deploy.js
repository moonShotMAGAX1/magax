const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const STAGES = [
  { stage: 1,  price: "0.000270", tokens: "200000000"       },
  { stage: 2,  price: "0.000293", tokens: "210400000"       },
  { stage: 3,  price: "0.000318", tokens: "221340800"       },
  { stage: 4,  price: "0.000345", tokens: "232850522"       },
  { stage: 5,  price: "0.000375", tokens: "244958749"       },
  { stage: 6,  price: "0.000407", tokens: "257696604"       },
  { stage: 7,  price: "0.000442", tokens: "271096827"       },
  { stage: 8,  price: "0.000479", tokens: "285193862"       },
  { stage: 9,  price: "0.000520", tokens: "300023943"       },
  { stage:10,  price: "0.000565", tokens: "315625188"       },
  { stage:11,  price: "0.000613", tokens: "332037698"       },
  { stage:12,  price: "0.000665", tokens: "349303658"       },
  { stage:13,  price: "0.000722", tokens: "367467448"       },
  { stage:14,  price: "0.000784", tokens: "386575755"       },
  { stage:15,  price: "0.000851", tokens: "406677695"       },
  { stage:16,  price: "0.000924", tokens: "427824935"       },
  { stage:17,  price: "0.001002", tokens: "450071832"       },
  { stage:18,  price: "0.001088", tokens: "473475567"       },
  { stage:19,  price: "0.001181", tokens: "498096296"       },
  { stage:20,  price: "0.001282", tokens: "523997304"       },
  { stage:21,  price: "0.001392", tokens: "551245163"       },
  { stage:22,  price: "0.001510", tokens: "579909912"       },
  { stage:23,  price: "0.001639", tokens: "610065227"       },
  { stage:24,  price: "0.001780", tokens: "641788619"       },
  { stage:25,  price: "0.001932", tokens: "675161627"       },
  { stage:26,  price: "0.002097", tokens: "710270032"       },
  { stage:27,  price: "0.002276", tokens: "747204074"       },
  { stage:28,  price: "0.002470", tokens: "786058685"       },
  { stage:29,  price: "0.002681", tokens: "826933737"       },
  { stage:30,  price: "0.002910", tokens: "869934291"       },
  { stage:31,  price: "0.003159", tokens: "915170875"       },
  { stage:32,  price: "0.003429", tokens: "962759760"       },
  { stage:33,  price: "0.003722", tokens: "1012823268"      },
  { stage:34,  price: "0.004040", tokens: "1065490077"      },
  { stage:35,  price: "0.004385", tokens: "1120895562"      },
  { stage:36,  price: "0.004760", tokens: "1179182131"      },
  { stage:37,  price: "0.005167", tokens: "1240499602"      },
  { stage:38,  price: "0.005608", tokens: "1305005581"      },
  { stage:39,  price: "0.006087", tokens: "1372865871"      },
  { stage:40,  price: "0.006607", tokens: "1444254896"      },
  { stage:41,  price: "0.007172", tokens: "1519356151"      },
  { stage:42,  price: "0.007785", tokens: "1598362671"      },
  { stage:43,  price: "0.008450", tokens: "1681477530"      },
  { stage:44,  price: "0.009172", tokens: "1768914361"      },
  { stage:45,  price: "0.009955", tokens: "1860897908"      },
  { stage:46,  price: "0.010806", tokens: "1957664599"      },
  { stage:47,  price: "0.011729", tokens: "2059463158"      },
  { stage:48,  price: "0.012731", tokens: "2166555243"      },
  { stage:49,  price: "0.013819", tokens: "2279216115"      },
  { stage:50,  price: "0.015000", tokens: "2397735353"      }
];

async function main () {
  const [deployer] = await ethers.getSigners();
  const net          = await ethers.provider.getNetwork();
  const chainId      = Number(net.chainId);
  const pretty       = n => n.toLocaleString();
  const isEth        = [1, 11155111].includes(chainId);        // mainnet / sepolia
  const isPolygon    = [137, 80001, 80002].includes(chainId);  // main / mumbai / amoy
  if (!isEth && !isPolygon) throw new Error(`Unsupported chain ${chainId}`);


  const bal      = await ethers.provider.getBalance(deployer);
  const minNeed  = ethers.parseEther(isEth ? "0.05" : "0.3");
  if (bal < minNeed) {
    throw new Error(`Balance too low (${ethers.formatEther(bal)})`);
  }

  const env = process.env;
  const currency  = isEth ? "ETH" : "MATIC";
  const treasury  = env.TREASURY_ADDRESS;
  const recorder  = env.RECORDER_ADDRESS;
  const admin     = env.ADMIN_ADDRESS || treasury;

  console.log(`\nDeployer  : ${deployer.address}`);
  console.log(`Network   : ${net.name}  (chain ${chainId})`);
  console.log(`Balance   : ${ethers.formatEther(bal)} ${currency}\n`);

  if (isEth) {
    if (!ethers.isAddress(treasury)) throw new Error("TREASURY_ADDRESS missing / invalid");

    const Token = await ethers.getContractFactory("MoonShotMAGAX");
    const token = await deployWithPrettyGas("MoonShotMAGAX", Token, [treasury]);
    await dumpTokenInfo(token, treasury);

    // Verify contract on block explorer
    console.log("Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: await token.getAddress(),
        constructorArguments: [treasury],
      });
      console.log("Contract verified successfully\n");
    } catch (error) {
      console.log("Verification failed:", error.message);
      console.log("You can verify manually with:");
      console.log(`npx hardhat verify --network ${net.name} ${await token.getAddress()} "${treasury}"\n`);
    }

    await writeArtifact("token", net, token, { treasury });
    return;
  }

  if (!ethers.isAddress(recorder)) throw new Error("RECORDER_ADDRESS missing / invalid");

  const Presale = await ethers.getContractFactory("MAGAXPresaleReceipts");
  const presale = await deployWithPrettyGas("MAGAXPresaleReceipts", Presale, [recorder], { gasLimit: 4_000_000 });

  await setupRoles(presale, recorder, admin, deployer);
  await configureStage1(presale);
  
  // Ensure deployer can activate stage (check admin role)
  const ADMIN = await presale.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await presale.hasRole(ADMIN, deployer.address);
  if (!hasAdminRole) {
    console.log("⚠️  Deployer doesn't have admin role, cannot activate stage");
    console.log("You'll need to activate Stage 1 manually after deployment");
  } else {
    await presale.activateStage(1);
    console.log("Stage 1 activated\n");
  }

  await dumpPresaleInfo(presale);
  
  // Verify contract on block explorer
  console.log("Verifying contract on block explorer...");
  try {
    await hre.run("verify:verify", {
      address: await presale.getAddress(),
      constructorArguments: [recorder],
    });
    console.log("Contract verified successfully\n");
  } catch (error) {
    console.log("Verification failed:", error.message);
    console.log("You can verify manually with:");
    console.log(`npx hardhat verify --network ${net.name} ${await presale.getAddress()} "${recorder}"\n`);
  }
  
  await writeArtifact("presale", net, presale, { recorder, admin });
}

async function deployWithPrettyGas (contractName, Factory, args = [], extra = {}) {
  const fee = await ethers.provider.getFeeData();
  const opts = fee.maxFeePerGas
    ? { maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas }
    : { gasPrice: fee.gasPrice };
  const contract = await Factory.deploy(...args, { ...opts, ...extra });
  console.log(`Deploying ${contractName}…`);
  const receipt = await contract.deploymentTransaction().wait();
  console.log(`${contractName} at ${await contract.getAddress()}`);
  console.log(`gas used ${receipt.gasUsed.toString()}  @  ${ethers.formatUnits(receipt.gasPrice, "gwei")} gwei\n`);
  return contract;
}

async function setupRoles (presale, recorder, admin, deployer) {
  console.log("Checking roles…");
  const ADMIN    = await presale.DEFAULT_ADMIN_ROLE();
  const RECORDER = await presale.RECORDER_ROLE();

  if (!(await presale.hasRole(RECORDER, recorder))) {
    await (await presale.grantRole(RECORDER, recorder)).wait();
    console.log(`recorder ${recorder}`);
  }
  if (admin && admin.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await presale.grantRole(ADMIN, admin)).wait();
    console.log(`admin    ${admin}`);
  }
}

async function configureStage1 (presale) {
  console.log("\nConfiguring Stage 1 …");
  // Stage 1: $0.000270 per token, 200,000,000 tokens allocation
  const stage1 = STAGES.find(cfg => cfg.stage === 1);
  const price = ethers.parseUnits(stage1.price, 6);
  const alloc = ethers.parseUnits(stage1.tokens, 18);
  await presale.configureStage(1, price, alloc);
  console.log(`Stage 1 configured @ $${stage1.price} with ${stage1.tokens} tokens\n`);
}

async function dumpTokenInfo (token, treasury) {
  console.log("\nℹToken summary");
  console.log(`   name       : ${await token.name()}`);
  console.log(`   symbol     : ${await token.symbol()}`);
  console.log(`   totalSupply: ${ethers.formatUnits(await token.totalSupply(), 18)}`);
  console.log(`   treasury   : ${treasury}\n`);
}

async function dumpPresaleInfo (presale) {
  console.log("ℹPresale constants");
  console.log(`   MAX_PURCHASE_USDT : ${ethers.formatUnits(await presale.MAX_PURCHASE_USDT(), 6)}`);
  console.log(`   MAX_TOTAL_USDT    : ${ethers.formatUnits(await presale.MAX_TOTAL_USDT(), 6)}`);
  const referrerBps = await presale.REFERRER_BONUS_BPS();
  const refereeBps = await presale.REFEREE_BONUS_BPS();
  console.log(`   REFERRER_BONUS    : ${Number(referrerBps) / 100}% (${referrerBps} BPS)`);
  console.log(`   REFEREE_BONUS     : ${Number(refereeBps) / 100}% (${refereeBps} BPS)`);
  console.log(`   BASIS_POINTS      : ${await presale.BASIS_POINTS()}\n`);
}

async function writeArtifact (type, net, contract, extra) {
  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const file = path.join(outDir, `${type}-${net.name}-${Date.now()}.json`);
  const data = {
    type,
    network  : net.name,
    chainId  : Number(net.chainId),
    address  : await contract.getAddress(),
    txHash   : contract.deploymentTransaction().hash,
    block    : (await contract.deploymentTransaction().wait()).blockNumber,
    ...extra,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Deployment artifact saved → ${file}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
