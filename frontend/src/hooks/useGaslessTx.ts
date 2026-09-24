import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { http, createPublicClient, parseAbi, maxUint256, Hex, encodeFunctionData } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { useState, useEffect } from 'react';
import { USDC_ADDRESS, USDC_ABI } from '../constants/contracts';

// Contract Addresses
const ENTRYPOINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // v0.7 EntryPoint

// Next.js uses process.env.NEXT_PUBLIC_ instead of import.meta.env.VITE_
const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;

const chain = arbitrumSepolia;
const pimlicoRpcUrl = `https://api.pimlico.io/v2/arbitrum-sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

// Create Public Client for blockchain querying
const publicClient = createPublicClient({
  chain,
  transport: http(),
});

// 1. Create the unified Pimlico Client (v0.2 standard)
const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoRpcUrl),
  entryPoint: {
    address: ENTRYPOINT_ADDRESS,
    version: "0.7",
  },
});

export function useGaslessTx() {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const [smartAccount, setSmartAccount] = useState<any>(null);

  // Initialize the Smart Account once when the wallet is connected
  useEffect(() => {
    const initSmartAccount = async () => {
      try {
        // Only initialize when Privy is fully authenticated and ready to avoid RPC collisions
        if (!ready || !authenticated || !wallets.length) {
          setSmartAccount(null); // Clear the smart account if the user logs out!
          return;
        }
        
        // Use the active connected wallet (supports MetaMask, Coinbase Wallet, Privy Embedded, etc.)
        const activeWallet = wallets[0];

        const provider = await activeWallet.getEthereumProvider();

        const account = await toSimpleSmartAccount({
          client: publicClient,
          owner: provider as any,
          entryPoint: {
            address: ENTRYPOINT_ADDRESS,
            version: "0.7"
          },
        });

        setSmartAccount(account);
      } catch (error) {
        console.error("Error initializing Smart Account:", error);
      }
    };

    initSmartAccount();
  }, [wallets, authenticated, ready]);

  const sendGaslessTransaction = async (targets: string[], values: (number | bigint | string)[], callDatas: Hex[]) => {
    if (!smartAccount) {
      alert("Smart Account not initialized yet!");
      return;
    }

    try {
      console.log("Creating Smart Account Client (ERC-20 Paymaster)...");
      // Create the Smart Account Client 
      const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain,
        bundlerTransport: http(pimlicoRpcUrl),
        paymaster: pimlicoClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            return (await pimlicoClient.getUserOperationGasPrice()).fast;
          },
        },
      });

      console.log("Fetching ERC-20 Paymaster quotes...");
      // Ask Pimlico for the Paymaster address for USDC
      const quotes = await pimlicoClient.getTokenQuotes({
        chain,
        tokens: [USDC_ADDRESS as Hex]
      });
      const paymasterAddress = quotes[0].paymaster;

      console.log("Sending Transaction via Pimlico...");

      // Step 1: Manually approve the Paymaster to spend the user's USDC
      const approveCall = {
        to: USDC_ADDRESS as Hex,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: USDC_ABI,
          functionName: "approve",
          args: [paymasterAddress, maxUint256],
        })
      };

      // Step 2: Map the actual user transactions
      const userTransactions = targets.map((target, index) => ({
        to: target as Hex,
        value: BigInt(values[index]),
        data: callDatas[index]
      }));

      // Submit both the Approve call and the User calls as one batch!
      const userOpHash = await smartAccountClient.sendTransaction({
        calls: [approveCall, ...userTransactions],
        paymasterContext: {
          token: USDC_ADDRESS
        }
      });

      console.log("UserOp Hash:", userOpHash);
      alert(`Success! Transaction Sent to Pimlico (Gas Paid in USDC!).\n\nUserOpHash: ${userOpHash}\n\nCheck the console and Pimlico Dashboard!`);

    } catch (error: any) {
      console.error("Error sending transaction:", error);

      // Attempt to decode the custom error selector (e.g., 0xeea732ab) from the Bundler's simulation
      const hexMatch = error.message.match(/0x[a-fA-F0-9]{8,}/);
      if (hexMatch) {
        const errorData = hexMatch[0];
        try {
          const { decodeErrorResult, erc20Abi } = await import('viem');
          const { DTSLA_ABI } = await import('../constants/contracts');

          const decoded = decodeErrorResult({
            abi: [...DTSLA_ABI, ...erc20Abi],
            data: errorData as `0x${string}`
          });

          console.error("Decoded Custom Error:", decoded);

          if (decoded.errorName === 'Error' && decoded.args) {
            throw new Error(`Transaction failed in smart contract: ${decoded.args[0]}`);
          }

          throw new Error(`Transaction failed: ${decoded.errorName}`);
        } catch (decodeErr) {
          alert(decodeErr);
          console.log("Could not decode error with DTSLA_ABI:", decodeErr);
        }
      }

      throw new Error(error.message);
    }
  };

  return { smartAccount, sendGaslessTransaction };
}
