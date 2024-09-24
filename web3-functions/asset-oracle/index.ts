import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, encodeFunctionData, getAddress, http } from 'viem'
import axios from "axios";

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const llamaKey = await context.secrets.get("DEFILLAMA_KEY");
  const pushOracleOwner = await context.secrets.get("PUSH_ORACLE_OWNER");
  const network = await context.secrets.get("NETWORK");

  // comma seperated addresses where the first address is the quote asset (asset) and the rest are the base assets (yieldToken)
  const addressString = await context.secrets.get("ADDRESSES");
  // spread object array as an inline-string [{bq:number,qb:number}] (spread can be positive or negative)
  const spreadString = await context.secrets.get("SPREADS");

  console.log({ network, pushOracleOwner, addressString, spreadString })

  // Check env variables set
  if (!addressString || !spreadString) {
    console.log("ERROR: ENV")
    return {
      canExec: false,
      callData: []
    }
  }
  const addresses = addressString.split(",")
  const spreads = JSON.parse(spreadString.replace(/(\w+):([-]?\d+(?:\.\d+)?)/g, '"$1":$2'));

  if (addresses.length - 1 !== spreads.length) {
    console.log("ERROR: LENGHT")
    return {
      canExec: false,
      callData: []
    }
  }

  console.log("LOADING DEFILLAMA PRICES")
  const { data: priceData } = await axios.get(
    `https://pro-api.llama.fi/${llamaKey}/coins/prices/current/${String(
      addresses.map(
        (address) => `${network}:${address}`
      )
    )}`
  );

  const assetPrice = priceData.coins[`${network}:${addresses[0]}`].price
  const args: [Address, Address, bigint, bigint][] = addresses.slice(1).map((address, i) => {
    const tokenPrice = priceData.coins[`${network}:${address}`].price
    console.log({
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

  // Return execution call data
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