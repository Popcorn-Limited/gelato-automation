import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, getAddress, http, PublicClient, zeroAddress } from 'viem'
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  fraxtal,
  mainnet,
  optimism,
  polygon,
  xLayer,
} from "viem/chains";

export const ChainById: { [key: number]: Chain } = {
  1: mainnet,
  10: optimism,
  42161: arbitrum,
  137: polygon,
  56: bsc,
  196: xLayer,
  8453: base,
  252: fraxtal,
  43114: avalanche
}

export const RPC_URLS: { [key: number]: string } = {
  [1]: `https://eth-mainnet.alchemyapi.io/v2/`,
  [10]: `https://opt-mainnet.g.alchemy.com/v2/`,
  [42161]: `https://arb-mainnet.g.alchemy.com/v2/`,
  [137]: `https://polygon-mainnet.g.alchemy.com/v2/`,
  [56]: `https://bnb-mainnet.g.alchemy.com/v2/`,
  [196]: "https://rpc.xlayer.tech",
  [8453]: `https://base-mainnet.g.alchemy.com/v2/`,
  [252]: `https://frax-mainnet.g.alchemy.com/v2/`,
  [43114]: `https://avax-mainnet.g.alchemy.com/v2/`
};

async function fetchLTV(client: PublicClient, strategy: Address): Promise<{ max: bigint, target: bigint, current: bigint }> {
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

  const maxLTV = results[0].result ?? BigInt("0");
  const targetLTV = results[1].result ?? BigInt("0");
  const currentLTV = results[2].result ?? BigInt("0");
  console.log({ maxLTV, targetLTV, currentLTV })

  return { max: maxLTV, target: targetLTV, current: currentLTV }
}


Web3Function.onRun(async (context: Web3FunctionContext) => {
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");
  const strategy = getAddress(await context.secrets.get("STRATEGY") || zeroAddress);
  // const pool = getAddress(await context.secrets.get("POOL") || zeroAddress);
  // const asset = getAddress(await context.secrets.get("ASSET") || zeroAddress);

  const minLTV = BigInt(await context.secrets.get("MIN_LTV") || "0");
  const maxLTV = BigInt(await context.secrets.get("MAX_LTV") || "0");
  const maxInterestRate = BigInt(await context.secrets.get("MAX_INTEREST_RATE") || "0");

  // Should be the fixed gelato address for this task
  const maxGas = BigInt(await context.secrets.get("MAX_GAS") || "0");
  // comma seperated chainIds
  const legacyChainNumbers = await context.secrets.get("LEGACY_CHAINS");

  console.log({ strategy, minLTV, maxLTV, maxInterestRate, maxGas, legacyChainNumbers })

  // Check env variables set for typing
  if (strategy === zeroAddress || !legacyChainNumbers) {
    console.log("ERROR: ENV")
    return {
      canExec: false,
      callData: []
    }
  }
  const legacyChains = legacyChainNumbers.split(",").map(value => Number(value))

  // Initiate Client
  console.log("INITIATING CLIENT")
  const { multiChainProvider } = context;
  const chainId = multiChainProvider.default()._network.chainId;
  const client = createPublicClient({
    chain: ChainById[chainId],
    transport: http(`${RPC_URLS[chainId]}${alchemyKey}`),
    batch: {
      multicall: true,
    }
  });

  /// @dev No current way to lever the strategy down / up besides calling adjustLeverage
  // console.log("FETCHING INTEREST RATE")
  // const reserveData = await client.readContract({
  //   address: pool,
  //   abi: PoolAbi,
  //   functionName: "getReserveData",
  //   args: [asset]
  // })

  // if (reserveData[4] > maxInterestRate) {
  //   console.log("EXECUTING: currentInterestRate > maxInterestRate")
  //   return {
  //     canExec: true,
  //     callData: [
  //       {
  //         to: strategy,
  //         data: encodeFunctionData({
  //           abi: strategyAbi,
  //           functionName: 'adjustLeverage',
  //         }),
  //       },
  //     ],
  //   };
  // }

  console.log("Fetching LTV")
  // verify trigger conditions
  const { max, target, current } = await fetchLTV(client, strategy);

  if (current > maxLTV) {
    console.log("EXECUTING: current > maxLTV")
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
  }

  // no need to adjust
  if ((target <= current) && (current < max)) {
    console.log("ERROR: HEALTHY LTV")
    return {
      canExec: false,
      callData: [],
    }
  }

  // Check Gas Threshold
  console.log("CHECKING GAS THRESHOLD")
  let estimatedGasPrice = BigInt(0)
  if (legacyChains.includes(chainId)) {
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
  console.log("GAS PRICE: ", estimatedGasPrice)

  if (estimatedGasPrice > maxGas) {
    console.log("ERROR: maxGas")
    return {
      canExec: false,
      callData: []
    }
  }

  console.log("EXECUTING")
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


const PoolAbi = [{ "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }], "name": "getReserveData", "outputs": [{ "components": [{ "components": [{ "internalType": "uint256", "name": "data", "type": "uint256" }], "internalType": "struct DataTypes.ReserveConfigurationMap", "name": "configuration", "type": "tuple" }, { "internalType": "uint128", "name": "liquidityIndex", "type": "uint128" }, { "internalType": "uint128", "name": "currentLiquidityRate", "type": "uint128" }, { "internalType": "uint128", "name": "variableBorrowIndex", "type": "uint128" }, { "internalType": "uint128", "name": "currentVariableBorrowRate", "type": "uint128" }, { "internalType": "uint128", "name": "currentStableBorrowRate", "type": "uint128" }, { "internalType": "uint40", "name": "lastUpdateTimestamp", "type": "uint40" }, { "internalType": "uint16", "name": "id", "type": "uint16" }, { "internalType": "address", "name": "aTokenAddress", "type": "address" }, { "internalType": "address", "name": "stableDebtTokenAddress", "type": "address" }, { "internalType": "address", "name": "variableDebtTokenAddress", "type": "address" }, { "internalType": "address", "name": "interestRateStrategyAddress", "type": "address" }, { "internalType": "uint128", "name": "accruedToTreasury", "type": "uint128" }, { "internalType": "uint128", "name": "unbacked", "type": "uint128" }, { "internalType": "uint128", "name": "isolationModeTotalDebt", "type": "uint128" }], "internalType": "struct DataTypes.ReserveDataLegacy", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }] as const