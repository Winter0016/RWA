const { SecretsManager } = require("@chainlink/functions-toolkit");
const ethers = require("ethers");
require("dotenv").config();

async function main() {
  // 1. Setup ethers provider and signer
  // We use Arbitrum Sepolia RPC for this example
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error("Missing ARBITRUM_SEPOLIA_RPC_URL or PRIVATE_KEY in .env");
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  // 2. Setup Chainlink Functions variables for Arbitrum Sepolia
  // You can find these addresses in the Chainlink Docs
  const functionsRouterAddress = "0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C";
  const donId = "fun-arbitrum-sepolia-1";

  // 3. Initialize the SecretsManager
  console.log("Initializing SecretsManager...");
  const secretsManager = new SecretsManager({
    signer: signer,
    functionsRouterAddress: functionsRouterAddress,
    donId: donId,
  });

  await secretsManager.initialize();

  // 4. Define the secrets to upload
  if (!process.env.ALPACA_API_KEY_ID || !process.env.ALPACA_API_SECRET_KEY) {
    throw new Error("Missing Alpaca API keys in .env");
  }

  const secrets = {
    alpacaKey: process.env.ALPACA_API_KEY_ID,
    alpacaSecret: process.env.ALPACA_API_SECRET_KEY,
  };

  // 5. Encrypt the secrets
  console.log("Encrypting secrets...");
  const encryptedSecretsObj = await secretsManager.encryptSecrets(secrets);

  // 6. Upload to the DON
  console.log("Uploading encrypted secrets to the DON...");
  const slotId = 0; // You can pick a slot from 0 to 255
  const minutesUntilExpiration = 10000; // How long until the keys expire

  // DON Gateway URLs for Arbitrum Sepolia
  const gatewayUrls = [
    "https://01.functions-gateway.testnet.chain.link/",
    "https://02.functions-gateway.testnet.chain.link/"
  ];

  const uploadResult = await secretsManager.uploadEncryptedSecretsToDON({
    encryptedSecretsHexstring: encryptedSecretsObj.encryptedSecrets,
    gatewayUrls: gatewayUrls,
    slotId: slotId,
    minutesUntilExpiration: minutesUntilExpiration,
  });

  if (!uploadResult.success) {
    throw new Error(`Upload failed: ${uploadResult.errorMessage}`);
  }
  console.log(uploadResult);

  console.log(`\n✅ Success!`);
  console.log(`Secret Slot: ${slotId}`);
  console.log(`Secret Version: ${uploadResult.version}`);
  console.log(`\nPlease pass these values into your dTSLA constructor!`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
