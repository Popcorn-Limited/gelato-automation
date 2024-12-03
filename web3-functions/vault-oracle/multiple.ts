import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, Chain, createPublicClient, encodeFunctionData, erc20Abi, erc4626Abi, formatUnits, getAddress, http, parseEther, parseUnits, PublicClient, zeroAddress } from 'viem'
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

export const networkMap: { [key: number]: string } = {
  [1]: "Ethereum",
  [10]: "Optimism",
  [42161]: "Arbitrum",
  [137]: "Polygon",
  [56]: "BSC",
  [196]: "XLayer",
  [8453]: "Base",
  [252]: "Fraxtal",
  [43114]: "Avalanche"
};

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

const DEBANK_CHAIN_IDS: { [key: number]: string } = {
  [1]: `eth`,
  [10]: `op`,
  [42161]: `arb`,
  [137]: `matic`,
  [56]: `bsc`,
  [196]: `xlayer`,
  [8453]: `base`,
  [252]: `frax`,
  [43114]: `avax`
}

type Configuration = {
  vault: Address,
  asset: Address,
  safes: Address[],
  chainIds: number[],
  hyperliquid: HyperliquidConfig
}

type HyperliquidConfig = {
  spot: boolean,
  perp: boolean,
  vaults: Address[]
}

// @ts-ignore
Web3Function.onRun(async (context: Web3FunctionContext) => {
  const configurations = JSON.parse(await context.secrets.get("CONFIGURATION") || "[]") as Configuration[];

  const controller = getAddress(await context.secrets.get("CONTROLLER") || zeroAddress);
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY") || "";
  const debankKey = await context.secrets.get("DEBANK_KEY") || "";
  const defillamaKey = await context.secrets.get("DEFILLAMA_KEY") || "";

  console.log("INITIATING CLIENT")
  const { multiChainProvider } = context;
  const chainId = multiChainProvider.default()._network.chainId;
  const client = createPublicClient({
    chain: ChainById[chainId],
    transport: chainId === 196 ? http(RPC_URLS[chainId]) : http(`${RPC_URLS[chainId]}${alchemyKey}`),
  });

  console.log("GETTING SAFE VAULT PRICES")
  const vaultPrices = await Promise.all(configurations.map(configuration => getSafeVaultPrice({ configuration, chainId, client, debankKey, defillamaKey })))
  const priceUpdates = vaultPrices.filter(price => price.totalValueUSD > 0)

  // Return execution call data
  console.log("EXECUTING")
  return {
    canExec: true,
    callData: [
      {
        to: controller,
        data: encodeFunctionData({
          abi: oracleOwnerAbi,
          functionName: 'updatePrices',
          args: [
            priceUpdates.map(priceUpdate => (
              {
                vault: priceUpdate.vault,
                asset: priceUpdate.asset,
                shareValueInAssets: BigInt(priceUpdate.shareValueInAssets),
                assetValueInShares: BigInt(priceUpdate.assetValueInShares)
              }
            ))],
        })
      }
    ]
  }
})

async function getSafeVaultPrice({
  configuration,
  chainId,
  client,
  debankKey,
  defillamaKey
}: {
  configuration: Configuration,
  chainId: number,
  client: PublicClient,
  debankKey: string,
  defillamaKey: string
}) {
  const vaultData = await client.multicall({
    contracts: [
      {
        address: configuration.vault,
        abi: erc20Abi,
        functionName: "totalSupply"
      },
      {
        address: configuration.asset,
        abi: erc20Abi,
        functionName: "decimals"
      }],
    allowFailure: false
  })
  const totalSupply = vaultData[0]
  const decimals = vaultData[1]

  // Get Holdings
  const safeHoldings = await Promise.all(configuration.chainIds.map(async (chain) => await getSafeHoldings({ safes: configuration.safes, chainId: chain, debankKey })))
  const hyperliquidAccountValue = await getHyperliquidAccountValue({ user: configuration.safes[0], config: configuration.hyperliquid })
  const totalValueUSD = hyperliquidAccountValue + safeHoldings.reduce((acc, curr) => acc + curr, 0)

  if (totalValueUSD === 0) {
    return {
      vault: configuration.vault,
      asset: configuration.asset,
      shareValueInAssets: parseEther('1'),
      assetValueInShares: parseEther('1'),
      totalValueUSD,
      formattedTotalSupply: 0,
      vaultPriceUSD: 1,
    }
  }

  // Get Asset Price
  const { data: priceData } = await axios.get(
    `https://pro-api.llama.fi/${defillamaKey}/coins/prices/current/${networkMap[chainId]}:${configuration.asset}?searchWidth=4h`
  );
  const assetValueUSD = priceData.coins[`${networkMap[chainId]}:${configuration.asset}`].price

  const totalValueInAssets = totalValueUSD / assetValueUSD
  const formattedTotalSupply = Number(formatUnits(totalSupply, decimals))
  const vaultPrice = totalValueInAssets / formattedTotalSupply
  const newPrice = parseUnits(String(vaultPrice), 18)

  return {
    vault: configuration.vault,
    asset: configuration.asset,
    shareValueInAssets: newPrice,
    assetValueInShares: parseEther('1') * parseEther('1') / newPrice,
    totalValueUSD,
    formattedTotalSupply,
    vaultPriceUSD: vaultPrice,
  }
}


async function getSafeHoldings({
  safes,
  chainId,
  debankKey,
}: {
  safes: Address[],
  chainId: number,
  debankKey: string
}): Promise<number> {
  const holdings = await Promise.all(safes.map(async (safe) => {
    const { data: holdingsData } = await axios.get(
      'https://pro-openapi.debank.com/v1/user/chain_balance',
      {
        params: {
          id: safe,
          chain_id: DEBANK_CHAIN_IDS[chainId]
        },
        headers: {
          'accept': 'application/json',
          'AccessKey': debankKey
        }
      }
    );
    return holdingsData.usd_value
  }))
  return holdings.reduce((acc, curr) => acc + curr, 0)
}

async function getHyperliquidAccountValue({
  user,
  config
}: {
  user: Address,
  config: HyperliquidConfig
}) {
  let perpValue = 0
  if (config.perp) {
    const { data: clearinghouseStateUser } = await axios.post("https://api.hyperliquid.xyz/info", {
      type: "clearinghouseState",
      user,
      headers: { "Content-Type": "application/json" },
    });
    perpValue = Number(clearinghouseStateUser.marginSummary.accountValue)
  }

  let vaultValue = 0;
  if (config.vaults.length > 0) {
    const vaultHoldings = await Promise.all(config.vaults.map(vaultAddress => getHyperliquidVaultHolding({ user, vaultAddress })))
    vaultValue = vaultHoldings.reduce((acc, curr) => acc + curr, 0)
  }

  return vaultValue + perpValue
}

async function getHyperliquidVaultHolding({
  user,
  vaultAddress
}: {
  user: Address,
  vaultAddress: Address
}): Promise<number> {
  const { data: vaultDetails } = await axios.post("https://api-ui.hyperliquid.xyz/info", {
    type: "vaultDetails",
    user,
    vaultAddress,
    headers: { "Content-Type": "application/json" },
  });
  return Number(vaultDetails.maxWithdrawable)
}

const oracleOwnerAbi = [{ "inputs": [{ "internalType": "address", "name": "_oracle", "type": "address" }, { "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "NotKeeperNorOwner", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }, { "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "indexed": false, "internalType": "struct Limit", "name": "previous", "type": "tuple" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "indexed": false, "internalType": "struct Limit", "name": "current", "type": "tuple" }], "name": "LimitUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldOwner", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerChanged", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnerNominated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "vault", "type": "address" }], "name": "VaultAdded", "type": "event" }, { "inputs": [], "name": "acceptOracleOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "acceptOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "vault", "type": "address" }], "name": "addVault", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "highWaterMarks", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "keepers", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "limits", "outputs": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "name": "nominateNewOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "nominatedOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "oracle", "outputs": [{ "internalType": "contract IPushOracle", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }, { "internalType": "address", "name": "_keeper", "type": "address" }], "name": "setKeeper", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "internalType": "struct Limit", "name": "_limit", "type": "tuple" }], "name": "setLimit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address[]", "name": "_vaults", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "jump", "type": "uint256" }, { "internalType": "uint256", "name": "drawdown", "type": "uint256" }], "internalType": "struct Limit[]", "name": "_limits", "type": "tuple[]" }], "name": "setLimits", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "vault", "type": "address" }, { "internalType": "address", "name": "asset", "type": "address" }, { "internalType": "uint256", "name": "shareValueInAssets", "type": "uint256" }, { "internalType": "uint256", "name": "assetValueInShares", "type": "uint256" }], "internalType": "struct OracleVaultController.PriceUpdate", "name": "priceUpdate", "type": "tuple" }], "name": "updatePrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "vault", "type": "address" }, { "internalType": "address", "name": "asset", "type": "address" }, { "internalType": "uint256", "name": "shareValueInAssets", "type": "uint256" }, { "internalType": "uint256", "name": "assetValueInShares", "type": "uint256" }], "internalType": "struct OracleVaultController.PriceUpdate[]", "name": "priceUpdates", "type": "tuple[]" }], "name": "updatePrices", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const