import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, erc20Abi, erc4626Abi, getAddress, http, parseEther, zeroAddress } from 'viem'
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

const legacyChains = [196]

// @ts-ignore
Web3Function.onRun(async (context: Web3FunctionContext) => {
  const vault = getAddress(await context.secrets.get("VAULT") || zeroAddress);
  const owner = getAddress(await context.secrets.get("OWNER") || zeroAddress);
  // const maxGas = BigInt(await context.secrets.get("MAX_GAS") || "0");
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");

  console.log("INITIATING CLIENT")
  const { multiChainProvider } = context;
  const chainId = multiChainProvider.default()._network.chainId;
  const client = createPublicClient({
    chain: ChainById[chainId],
    transport: chainId === 196 ? http(RPC_URLS[chainId]) : http(`${RPC_URLS[chainId]}${alchemyKey}`),
  });

  console.log(vault, chainId)

  console.log("GETTING VAULT PRICE")
  const { data: priceData } = await axios.get(`https://app.vaultcraft.io/api/vaultPrice/${vault}?chainId=${chainId}`)

  console.log("GETTING VARIOUS DATA")
  const mixRes = await client.multicall({
    contracts: [{
      address: owner,
      abi: oracleOwnerAbi,
      functionName: "keepers",
      args: [vault]
    },
    {
      address: vault,
      abi: erc4626Abi,
      functionName: "asset",
    }]
  })
  const keeper = mixRes[0].result as Address
  const asset = mixRes[1].result as Address

  // TODO readd later
  // Check Gas Threshold
  // console.log("CHECKING GAS THRESHOLD")
  // let estimatedGasPrice = BigInt(0)
  // if (legacyChains.includes(chainId)) {
  //   const { gasPrice } = await client.estimateFeesPerGas({ type: "legacy" })
  //   estimatedGasPrice = await client.estimateContractGas({
  //     account: keeper,
  //     address: owner,
  //     abi: oracleOwnerAbi,
  //     functionName: 'updatePrice',
  //     args: [{
  //       vault,
  //       asset,
  //       shareValueInAssets: BigInt(priceData.shareValueInAssets),
  //       assetValueInShares: BigInt(priceData.assetValueInShares)
  //     }],
  //     gasPrice
  //   })
  // } else {
  //   const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas()
  //   estimatedGasPrice = await client.estimateContractGas({
  //     account: keeper,
  //     address: owner,
  //     abi: oracleOwnerAbi,
  //     functionName: 'updatePrice',
  //     args: [{
  //       vault,
  //       asset,
  //       shareValueInAssets: BigInt(priceData.shareValueInAssets),
  //       assetValueInShares: BigInt(priceData.assetValueInShares)
  //     }], maxFeePerGas,
  //     maxPriorityFeePerGas
  //   })
  // }

  // if (estimatedGasPrice > maxGas) {
  //   console.log("GAS THRESHOLD EXCEEDED")
  //   return {
  //     canExec: false,
  //     callData: []
  //   }
  // }

  console.log(BigInt(priceData.shareValueInAssets), BigInt(priceData.assetValueInShares))

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
          args: [{
            vault,
            asset,
            shareValueInAssets: BigInt(priceData.shareValueInAssets),
            assetValueInShares: BigInt(priceData.assetValueInShares)
          }],
        })
      }
    ]
  }
})


const oracleOwnerAbi = [{ "inputs": [{ "internalType": "address", "name": "_oracle", "type": "address" }, { "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "NotKeeperNorOwner", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }, { "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "indexed": false, "internalType": "struct Limit", "name": "previous", "type": "tuple" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "indexed": false, "internalType": "struct Limit", "name": "current", "type": "tuple" }], "name": "LimitUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldOwner", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerChanged", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerNominated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }], "name": "VaultAdded", "type": "event" }, { "inputs": [], "name": "acceptOracleOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "acceptOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "vault", "type": "address" }], "name": "addVault", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "highWaterMarks", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "keepers", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "limits", "outputs": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "name": "nominateNewOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "nominatedOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "oracle", "outputs": [{ "internalType": "contract IPushOracle", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }, { "internalType": "address", "name": "_keeper", "type": "address" }], "name": "setKeeper", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "internalType": "struct Limit", "name": "_limit", "type": "tuple" }], "name": "setLimit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address[]", "name": "_vaults", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "internalType": "struct Limit[]", "name": "_limits", "type": "tuple[]" }], "name": "setLimits", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "vault", "type": "address" }, { "internalType": "address", "name": "asset", "type": "address" }, { "internalType": "uint256", "name": "shareValueInAssets", "type": "uint256" }, { "internalType": "uint256", "name": "assetValueInShares", "type": "uint256" }], "internalType": "struct OracleVaultController.PriceUpdate", "name": "priceUpdate", "type": "tuple" }], "name": "updatePrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "vault", "type": "address" }, { "internalType": "address", "name": "asset", "type": "address" }, { "internalType": "uint256", "name": "shareValueInAssets", "type": "uint256" }, { "internalType": "uint256", "name": "assetValueInShares", "type": "uint256" }], "internalType": "struct OracleVaultController.PriceUpdate[]", "name": "priceUpdates", "type": "tuple[]" }], "name": "updatePrices", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const