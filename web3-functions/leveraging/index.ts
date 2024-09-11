import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, getAddress, http, zeroAddress } from 'viem'
import { arbitrum, mainnet, optimism, polygon } from "viem/chains";

export const NetworkByChainId: { [key: number]: Chain } = {
  [mainnet.id]: mainnet,
  [polygon.id]: polygon,
  [optimism.id]: optimism,
  [arbitrum.id]: arbitrum,
}

const RPC_URLS: { [key: number]: string } = {
  [mainnet.id]: "https://eth-mainnet.alchemyapi.io/v2/",
  [polygon.id]: "https://polygon-mainnet.g.alchemy.com/v2/",
  [arbitrum.id]: "https://arb-mainnet.alchemyapi.io/v2/",
  [optimism.id]: "https://opt-mainnet.alchemyapi.io/v2/"
}

const LEGACY_CHAINS: number[] = [polygon.id]

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");
  const strategy = getAddress(await context.secrets.get("STRATEGY") || zeroAddress);

  // Should be the fixed gelato address for this task
  const maxGas = BigInt(await context.secrets.get("MAX_GAS") || "0");

  // Check env variables set
  if (strategy === zeroAddress || maxGas === BigInt("0")) return {
    canExec: false,
    callData: []
  }

  // Initiate Client
  const { multiChainProvider } = context;
  const chainId = multiChainProvider.default()._network.chainId;
  const client = createPublicClient({
    chain: NetworkByChainId[chainId],
    transport: http(`${RPC_URLS[chainId]}${alchemyKey}`),
    batch: {
      multicall: true,
    }
  });

  // verify trigger conditions
  const verifyLTV = async (): Promise<boolean> => {
    const results = await client.multicall({
      contracts: [
        {
          address: strategy,
          abi: strategyAbi,
          functionName: "maxLTV",
        },
        {
          address: strategy,
          abi: strategyAbi,
          functionName: "targetLTV",
        },
        {
          address: strategy,
          abi: strategyAbi,
          functionName: "getLTV",
        }
      ]
    });

    const maxLTV = results[0].result ?? parseInt("0");
    const targetLTV = results[1].result ?? parseInt("0");
    const currentLTV = results[2].result ?? parseInt("0");

    // ltv on track
    if ((targetLTV <= currentLTV) && (currentLTV < maxLTV))
      return true;

    return false;
  }

  const goodLTV = await verifyLTV();

  // no need to adjust
  if (goodLTV)
    return {
      canExec: false,
      callData: [],
    }

  // Check Gas Threshold
  const estimatedGas = await client.estimateContractGas({
    address: strategy,
    abi: strategyAbi,
    functionName: "adjustLeverage",
  })

  let estimatedGasPrice = BigInt(0)
  if (LEGACY_CHAINS.includes(chainId)) {
    const { gasPrice } = await client.estimateFeesPerGas({ type: "legacy" })
    estimatedGasPrice = estimatedGas * gasPrice!
  } else {
    const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas()
    estimatedGasPrice = (estimatedGas * maxFeePerGas!) + (estimatedGas * maxPriorityFeePerGas!)
  }

  if (estimatedGasPrice > maxGas) return {
    canExec: false,
    callData: []
  }


  // Return execution call data
  return {
    canExec: true,
    callData: [
      {
        to: strategy,
        data: encodeFunctionData({
          abi: strategyAbi,
          functionName: 'adjustLeverage',
        }),
      },
    ],
  };
});


const strategyAbi = [
  { "inputs": [], "name": "adjustLeverage", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "getLTV", "outputs": [{ "internalType": "uint256", "name": "ltv", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "maxLTV", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "targetLTV", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
] as const