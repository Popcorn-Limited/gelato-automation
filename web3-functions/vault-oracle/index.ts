import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, getAddress, http, zeroAddress } from 'viem'
import axios from "axios";
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

// @ts-ignore
Web3Function.onRun(async (context: Web3FunctionContext) => {
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");
  const llamaKey = await context.secrets.get("DEFILLAMA_KEY");
  const pushOracleOwner = getAddress(await context.secrets.get("PUSH_ORACLE_OWNER") || zeroAddress);
  const network = await context.secrets.get("NETWORK");

  // comma seperated addresses where the first address is the quote asset (asset) and the rest are the base assets (yieldToken)
  const addressString = await context.secrets.get("ADDRESSES");
  // spread object array as an inline-string [{bq:number,qb:number}] (spread can be positive or negative)
  const spreadString = await context.secrets.get("SPREADS");
  const maxGas = BigInt(await context.secrets.get("MAX_GAS") || "0");
  // comma seperated chainIds
  const legacyChainNumbers = await context.secrets.get("LEGACY_CHAINS");

  console.log({ network, pushOracleOwner, addressString, spreadString, maxGas, legacyChainNumbers })

  // Check env variables set for typing
  if (!addressString || !spreadString || !legacyChainNumbers) {
    console.log("ERROR: ENV")
    return {
      canExec: false,
      callData: []
    }
  }

  const addresses = addressString.split(",")
  const spreads = JSON.parse(spreadString.replace(/(\w+):([-]?\d+(?:\.\d+)?)/g, '"$1":$2'));
  const legacyChains = legacyChainNumbers.split(",").map(value => Number(value))

  console.log({ addresses, spreads, legacyChains })

  if (addresses.length - 1 !== spreads.length) {
    console.log("ERROR: LENGHT")
    return {
      canExec: false,
      callData: []
    }
  }

  // Initiate Client
  console.log("INITIATING CLIENT")
  const { multiChainProvider } = context;
  const chainId = multiChainProvider.default()._network.chainId;
  const client = createPublicClient({
    chain: ChainById[chainId],
    transport: chainId === 196 ? http(RPC_URLS[chainId]) : http(`${RPC_URLS[chainId]}${alchemyKey}`),
  });

  console.log("LOADING DEFILLAMA PRICES")
  console.log(`https://pro-api.llama.fi/${llamaKey}/coins/prices/current/${String(
    addresses.map(
      (address) => `${network}:${address}`
    )
  )}?searchWidth=4h`)
  const { data: priceData } = await axios.get(
    `https://pro-api.llama.fi/${llamaKey}/coins/prices/current/${String(
      addresses.map(
        (address) => `${network}:${address}`
      )
    )}?searchWidth=4h`
  );

  console.log("CALCULATING PRICES")
  const assetPrice = priceData.coins[`${network}:${addresses[0]}`].price
  const args: [Address, Address, bigint, bigint][] = addresses.slice(1).map((address, i) => {
    const tokenPrice = priceData.coins[`${network}:${address}`].price
    console.log({
      address,
      asset: assetPrice,
      price: tokenPrice,
      bq: tokenPrice / assetPrice,
      bqWithSpread: (tokenPrice / assetPrice) * (1 + spreads[i].bq),
      qb: assetPrice / tokenPrice,
      qbWithSpread: (assetPrice / tokenPrice) * (1 + spreads[i].qb),
      bqRaised: Math.floor(Number((tokenPrice / assetPrice) * 1e18)).toLocaleString("fullwide", { useGrouping: false }),
      bqRaisedWithSpread: Math.floor(Number(((tokenPrice / assetPrice) * (1 + spreads[i].bq)) * 1e18)).toLocaleString("fullwide", { useGrouping: false }),
      qbRaised: Math.floor(Number((assetPrice / tokenPrice) * 1e18)).toLocaleString("fullwide", { useGrouping: false }),
      qbRaisedWithSpread: Math.floor(Number(((assetPrice / tokenPrice) * (1 + spreads[i].qb)) * 1e18)).toLocaleString("fullwide", { useGrouping: false }),
    })
    return [
      getAddress(address), // base (yieldToken)
      getAddress(addresses[0]), // quote (asset)
      BigInt(Math.floor(Number(((tokenPrice / assetPrice) * (1 + spreads[i].bq)) * 1e18)).toLocaleString("fullwide", { useGrouping: false })), // bqPrice
      BigInt(Math.floor(Number(((assetPrice / tokenPrice) * (1 + spreads[i].qb)) * 1e18)).toLocaleString("fullwide", { useGrouping: false }))  // qbPrice
    ]
  })

  // Check Gas Threshold
  console.log("CHECKING GAS THRESHOLD")

  // Get owner of the push oracle to estimate gas price
  const owner = await client.readContract({
    address: pushOracleOwner,
    abi: oracleOwnerAbi,
    functionName: "owner",
  })
  
  let estimatedGasPrice = BigInt(0)
  if (legacyChains.includes(chainId)) {
    const { gasPrice } = await client.estimateFeesPerGas({ type: "legacy" })
    await Promise.all(args.map(async (arg) => {
      const estimation = await client.estimateContractGas({
        account: owner,
        address: pushOracleOwner,
        abi: oracleOwnerAbi,
        functionName: "setPrice",
        args: arg,
        gasPrice
      })
      estimatedGasPrice += estimation
    }))
  } else {
    const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas()
    await Promise.all(args.map(async (arg) => {
      const estimation = await client.estimateContractGas({
        account: owner,
        address: pushOracleOwner,
        abi: oracleOwnerAbi,
        functionName: "setPrice",
        args: arg,
        maxFeePerGas,
        maxPriorityFeePerGas
      })
      estimatedGasPrice += estimation
    }))
  }
  console.log({ estimatedGasPrice })

  if (estimatedGasPrice > maxGas) {
    console.log("GAS THRESHOLD EXCEEDED")
    return {
      canExec: false,
      callData: []
    }
  }

  // Return execution call data
  console.log("EXECUTING")
  return {
    canExec: true,
    callData: args.map(arg => {
      return {
        to: pushOracleOwner,
        data: encodeFunctionData({
          abi: oracleOwnerAbi,
          functionName: 'setPrice',
          args: arg
        }),
      }
    })
  }
})


const oracleOwnerAbi = [{ "inputs": [{ "internalType": "address", "name": "_oracle", "type": "address" }, { "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "NotKeeperNorOwner", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldOwner", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerChanged", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerNominated", "type": "event" }, { "inputs": [], "name": "acceptOracleOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "acceptOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "keeper", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "name": "nominateNewOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "nominatedOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "oracle", "outputs": [{ "internalType": "contract IPushOracle", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_keeper", "type": "address" }], "name": "setKeeper", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "base", "type": "address" }, { "internalType": "address", "name": "quote", "type": "address" }, { "internalType": "uint256", "name": "bqPrice", "type": "uint256" }, { "internalType": "uint256", "name": "qbPrice", "type": "uint256" }], "name": "setPrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const