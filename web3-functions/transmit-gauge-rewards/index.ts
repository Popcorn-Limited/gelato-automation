import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { encodeFunctionData, parseEther } from 'viem'

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const rootGauges = await context.secrets.get("ROOT_GAUGES");
  const gasValue = await context.secrets.get("GAS_VALUE");

  console.log(
    {
      gauges: rootGauges.split(","),
      value: parseEther(gasValue).toString()
    }
  )

  return {
    canExec: true,
    callData: [
      {
        to: "0x6aa03ebAb1e9CB8d44Fd79153d3a258FFd48169A",
        data: encodeFunctionData({
          abi: RootGaugeFactoryAbi,
          functionName: 'transmit_emissions_multiple',
          args: [rootGauges.split(",")],
        }),
        value: parseEther(gasValue).toString()
      },
    ],
  };
});

const RootGaugeFactoryAbi = [{ "name": "BridgerUpdated", "inputs": [{ "name": "_chain_id", "type": "uint256", "indexed": true }, { "name": "_old_bridger", "type": "address", "indexed": false }, { "name": "_new_bridger", "type": "address", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "DeployedGauge", "inputs": [{ "name": "_implementation", "type": "address", "indexed": true }, { "name": "_chain_id", "type": "uint256", "indexed": true }, { "name": "_vault", "type": "address", "indexed": false }, { "name": "_gauge", "type": "address", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "TransferOwnership", "inputs": [{ "name": "_old_owner", "type": "address", "indexed": false }, { "name": "_new_owner", "type": "address", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "UpdateImplementation", "inputs": [{ "name": "_old_implementation", "type": "address", "indexed": false }, { "name": "_new_implementation", "type": "address", "indexed": false }], "anonymous": false, "type": "event" }, { "stateMutability": "nonpayable", "type": "constructor", "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_implementation", "type": "address" }], "outputs": [] }, { "stateMutability": "payable", "type": "function", "name": "transmit_emissions", "inputs": [{ "name": "_gauge", "type": "address" }], "outputs": [] }, { "stateMutability": "payable", "type": "function", "name": "transmit_emissions_multiple", "inputs": [{ "name": "_gauge_list", "type": "address[]" }], "outputs": [] }, { "stateMutability": "payable", "type": "function", "name": "deploy_gauge", "inputs": [{ "name": "_chain_id", "type": "uint256" }, { "name": "_vault", "type": "address" }, { "name": "_relative_weight_cap", "type": "uint256" }], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "nonpayable", "type": "function", "name": "set_bridger", "inputs": [{ "name": "_chain_id", "type": "uint256" }, { "name": "_bridger", "type": "address" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "set_implementation", "inputs": [{ "name": "_implementation", "type": "address" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "commit_transfer_ownership", "inputs": [{ "name": "_future_owner", "type": "address" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "accept_transfer_ownership", "inputs": [], "outputs": [] }, { "stateMutability": "view", "type": "function", "name": "get_bridger", "inputs": [{ "name": "arg0", "type": "uint256" }], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "get_implementation", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "get_gauge", "inputs": [{ "name": "arg0", "type": "uint256" }, { "name": "arg1", "type": "uint256" }], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "get_gauge_count", "inputs": [{ "name": "arg0", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "is_valid_gauge", "inputs": [{ "name": "arg0", "type": "address" }], "outputs": [{ "name": "", "type": "bool" }] }, { "stateMutability": "view", "type": "function", "name": "owner", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "future_owner", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }] as const;