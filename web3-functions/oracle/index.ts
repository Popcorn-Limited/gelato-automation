import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { createPublicClient, encodeFunctionData, http } from 'viem'
import { mainnet } from "viem/chains";

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");
  const pushOracleOwner = await context.secrets.get("PUSH_ORACLE_OWNER");

  // Initialize viem client with the extracted URL
  const ethereumRpc = createPublicClient({
    chain: mainnet,
    transport: http(`https://eth-mainnet.alchemyapi.io/v2/${alchemyKey}`),
  });

  // Get current price on coingecko
  const price = await ethereumRpc.readContract({
    address: "0xe2871224b413F55c5a2Fd21E49bD63A52e339b03",
    abi: oracleAbi,
    functionName: "getPrice",
  });

  // Return execution call data
  return {
    canExec: true,
    callData: [
      {
        to: pushOracleOwner,
        data: encodeFunctionData({
          abi: oracleOwnerAbi,
          functionName: 'setPrice',
          args: [price]
        }),
      },
    ],
  };
});


const oracleAbi = [{ "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "oldPrice", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newPrice", "type": "uint256" }], "name": "PriceUpdate", "type": "event" }, { "inputs": [], "name": "getPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "_price", "type": "uint256" }], "name": "setPrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const

const oracleOwnerAbi = [{ "inputs": [{ "internalType": "address", "name": "_oracle", "type": "address" }, { "internalType": "address", "name": "_owner", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "NotKeeperNorOwner", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "previous", "type": "address" }, { "indexed": false, "internalType": "address", "name": "current", "type": "address" }], "name": "KeeperUpdated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "inputs": [], "name": "keeper", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "oracle", "outputs": [{ "internalType": "contract IPushOracle", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_keeper", "type": "address" }], "name": "setKeeper", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "_price", "type": "uint256" }], "name": "setPrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }] as const