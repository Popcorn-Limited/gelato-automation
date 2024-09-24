import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, getAddress, http, PublicClient, zeroAddress } from 'viem'
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

async function verifyLTV(client: PublicClient, strategy: Address): Promise<boolean> {
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
  console.log("fetched ltv")

  const maxLTV = results[0].result ?? parseInt("0");
  const targetLTV = results[1].result ?? parseInt("0");
  const currentLTV = results[2].result ?? parseInt("0");
  console.log({ maxLTV, targetLTV, currentLTV })

  // ltv on track
  if ((targetLTV <= currentLTV) && (currentLTV < maxLTV))
    return true;

  return false;
}

Web3Function.onRun(async (context: Web3FunctionContext) => {
  console.log("LEVERAGE 5X ETHX")
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");
  const strategy = getAddress(await context.secrets.get("STRATEGY") || zeroAddress);

  // Should be the fixed gelato address for this task
  const maxGas = BigInt(await context.secrets.get("MAX_GAS") || "0");

  console.log({ alchemyKey, strategy, maxGas })

  // Check env variables set
  if (strategy === zeroAddress || maxGas === BigInt("0")) {
    console.log("ERROR: ENV")
    return {
      canExec: false,
      callData: []
    }
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
  console.log("Set up basics")

  // verify trigger conditions
  const goodLTV = await verifyLTV(client, strategy);

  // no need to adjust
  if (goodLTV) {
    console.log("ERROR: LTV")
    return {
      canExec: false,
      callData: [],
    }
  }

  // Check Gas Threshold
  let estimatedGasPrice = BigInt(0)
  if (LEGACY_CHAINS.includes(chainId)) {
    const { gasPrice } = await client.estimateFeesPerGas({ type: "legacy" })
    estimatedGasPrice = await client.estimateContractGas({
      address: strategy,
      abi: strategyAbi,
      functionName: "adjustLeverage",
      gasPrice
    })
  } else {
    const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas()
    estimatedGasPrice = await client.estimateContractGas({
      address: strategy,
      abi: strategyAbi,
      functionName: "adjustLeverage",
      maxFeePerGas,
      maxPriorityFeePerGas
    })
  }
  console.log("got gas price: ", estimatedGasPrice)

  if (estimatedGasPrice > maxGas) {
    console.log("ERROR: maxGas")
    return {
      canExec: false,
      callData: []
    }
  }

  console.log("run")
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