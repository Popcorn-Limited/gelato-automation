import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, getAddress, http, parseEther, zeroAddress } from 'viem'
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
  const owner = getAddress(await context.secrets.get("OWNER") || zeroAddress);
  const vault = getAddress(await context.secrets.get("VAULT") || zeroAddress);
  const asset = getAddress(await context.secrets.get("ASSET") || zeroAddress);
  const oracle = getAddress(await context.secrets.get("ORACLE") || zeroAddress);
  const dailyRate = BigInt(await context.secrets.get("DAILY_RATE") || 0) // 18 decimal precision
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");

  const { multiChainProvider } = context;
  const chainId = multiChainProvider.default()._network.chainId;

  const client = createPublicClient({
    chain: ChainById[chainId],
    transport: chainId === 196 ? http(RPC_URLS[chainId]) : http(`${RPC_URLS[chainId]}${alchemyKey}`),
  });

  const price = await client.readContract({
    address: oracle,
    abi: oracleAbi,
    functionName: 'prices',
    args: [vault, asset]
  })
  const newPrice = (price * dailyRate) / parseEther('1')

  console.log({ owner, vault, asset, newPrice, reversePrice: parseEther('1') * parseEther('1') / newPrice })

  // Return execution call data
  console.log("EXECUTING")
  return {
    canExec: true,
    callData: [
      {
        to: owner,
        data: encodeFunctionData({
          abi: oracleOwnerAbi,
          functionName: 'updatePrice',
          args: [{ vault, asset, shareValueInAssets: newPrice, assetValueInShares: parseEther('1') * parseEther('1') / newPrice }]
        })
      }
    ]
  }
})


const oracleOwnerAbi = [{ "inputs": [{ "internalType": "address", "name": "_oracle", "type": "address" }, { "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "NotKeeperNorOwner", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }, { "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "indexed": false, "internalType": "struct Limit", "name": "previous", "type": "tuple" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "indexed": false, "internalType": "struct Limit", "name": "current", "type": "tuple" }], "name": "LimitUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldOwner", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerChanged", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerNominated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }], "name": "VaultAdded", "type": "event" }, { "inputs": [], "name": "acceptOracleOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "acceptOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "vault", "type": "address" }], "name": "addVault", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "highWaterMarks", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "keepers", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "limits", "outputs": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "name": "nominateNewOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "nominatedOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "oracle", "outputs": [{ "internalType": "contract IPushOracle", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }, { "internalType": "address", "name": "_keeper", "type": "address" }], "name": "setKeeper", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "internalType": "struct Limit", "name": "_limit", "type": "tuple" }], "name": "setLimit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address[]", "name": "_vaults", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "internalType": "struct Limit[]", "name": "_limits", "type": "tuple[]" }], "name": "setLimits", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "vault", "type": "address" }, { "internalType": "address", "name": "asset", "type": "address" }, { "internalType": "uint256", "name": "shareValueInAssets", "type": "uint256" }, { "internalType": "uint256", "name": "assetValueInShares", "type": "uint256" }], "internalType": "struct OracleVaultController.PriceUpdate", "name": "priceUpdate", "type": "tuple" }], "name": "updatePrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "vault", "type": "address" }, { "internalType": "address", "name": "asset", "type": "address" }, { "internalType": "uint256", "name": "shareValueInAssets", "type": "uint256" }, { "internalType": "uint256", "name": "assetValueInShares", "type": "uint256" }], "internalType": "struct OracleVaultController.PriceUpdate[]", "name": "priceUpdates", "type": "tuple[]" }], "name": "updatePrices", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const

const oracleAbi = [{ "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "Misconfigured", "type": "error" }, { "inputs": [{ "internalType": "address", "name": "base", "type": "address" }, { "internalType": "address", "name": "quote", "type": "address" }], "name": "PriceOracle_NotSupported", "type": "error" }, { "inputs": [], "name": "PriceOracle_Overflow", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldOwner", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerChanged", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerNominated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "base", "type": "address" }, { "indexed": false, "internalType": "address", "name": "quote", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "bqPrice", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "qbPrice", "type": "uint256" }], "name": "PriceUpdated", "type": "event" }, { "inputs": [], "name": "acceptOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "inAmount", "type": "uint256" }, { "internalType": "address", "name": "base", "type": "address" }, { "internalType": "address", "name": "quote", "type": "address" }], "name": "getQuote", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "inAmount", "type": "uint256" }, { "internalType": "address", "name": "base", "type": "address" }, { "internalType": "address", "name": "quote", "type": "address" }], "name": "getQuotes", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "name": "nominateNewOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "nominatedOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "address", "name": "", "type": "address" }], "name": "prices", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "base", "type": "address" }, { "internalType": "address", "name": "quote", "type": "address" }, { "internalType": "uint256", "name": "bqPrice", "type": "uint256" }, { "internalType": "uint256", "name": "qbPrice", "type": "uint256" }], "name": "setPrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address[]", "name": "bases", "type": "address[]" }, { "internalType": "address[]", "name": "quotes", "type": "address[]" }, { "internalType": "uint256[]", "name": "bqPrices", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "qbPrices", "type": "uint256[]" }], "name": "setPrices", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const