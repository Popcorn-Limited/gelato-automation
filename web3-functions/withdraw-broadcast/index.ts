import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Chain, createPublicClient, encodeFunctionData, erc20Abi, http } from 'viem'
import { arbitrum, mainnet, optimism } from "viem/chains";

const BROADCAST_NETWORKS: Chain[] = [arbitrum, optimism]

const RPC_URLS = {
  [mainnet.id]: "https://eth-mainnet.alchemyapi.io/v2/",
  [arbitrum.id]: "https://arb-mainnet.alchemyapi.io/v2/",
  [optimism.id]: "https://opt-mainnet.alchemyapi.io/v2/"
}

const GAS_LIMIT = BigInt(500_000)
const MAX_FEE_PER_GAS = BigInt(100_000_000);

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");

  // Initialize viem client with the extracted URL
  const ethereumRpc = createPublicClient({
    chain: mainnet,
    transport: http(`${RPC_URLS[mainnet.id]}${alchemyKey}`),
  });

  const logs = await ethereumRpc.getContractEvents({
    address: "0x0aB4bC35Ef33089B9082Ca7BB8657D7c4E819a1A",
    abi: veAbi,
    eventName: "Penalty",
    fromBlock: "earliest",
    toBlock: "latest"
  })
  const user = logs[logs.length - 1].args.provider

  const l2s: bigint[] = []
  BROADCAST_NETWORKS.forEach(async (network) => {
    const veBal = await createPublicClient({
      chain: network,
      transport: http(`${RPC_URLS[network.id]}${alchemyKey}`),
    }).readContract({
      address: "0xC1A6Db6793967Ff7fb7f211E044A4c285A0eB7FB",
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [user!],
    });

    if (veBal > 0) l2s.push(BigInt(network.id));
  })

  if (l2s.length === 0) return {
    canExec: false,
    callData: []
  }

  // Return execution call data
  return {
    canExec: true,
    callData: [
      {
        to: "0x6e220Be8511ACc1db8ACD4e2e66f987CF7529Af6",
        data: encodeFunctionData({
          abi: veBeaconAbi,
          functionName: 'broadcastVeBalanceMultiple',
          args: [user, l2s, GAS_LIMIT, MAX_FEE_PER_GAS],
        }),
      },
    ],
  };
});

const veAbi = [{ "name": "Deposit", "inputs": [{ "name": "provider", "type": "address", "indexed": true }, { "name": "value", "type": "uint256", "indexed": false }, { "name": "locktime", "type": "uint256", "indexed": true }, { "name": "type", "type": "int128", "indexed": false }, { "name": "ts", "type": "uint256", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "Withdraw", "inputs": [{ "name": "provider", "type": "address", "indexed": true }, { "name": "value", "type": "uint256", "indexed": false }, { "name": "ts", "type": "uint256", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "Penalty", "inputs": [{ "name": "provider", "type": "address", "indexed": true }, { "name": "value", "type": "uint256", "indexed": false }, { "name": "ts", "type": "uint256", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "Supply", "inputs": [{ "name": "prevSupply", "type": "uint256", "indexed": false }, { "name": "supply", "type": "uint256", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "NewPendingAdmin", "inputs": [{ "name": "new_pending_admin", "type": "address", "indexed": false }], "anonymous": false, "type": "event" }, { "name": "NewAdmin", "inputs": [{ "name": "new_admin", "type": "address", "indexed": false }], "anonymous": false, "type": "event" }, { "stateMutability": "nonpayable", "type": "constructor", "inputs": [{ "name": "token_addr", "type": "address" }, { "name": "_name", "type": "string" }, { "name": "_symbol", "type": "string" }, { "name": "_admin", "type": "address" }], "outputs": [] }, { "stateMutability": "view", "type": "function", "name": "token", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "name", "inputs": [], "outputs": [{ "name": "", "type": "string" }] }, { "stateMutability": "view", "type": "function", "name": "symbol", "inputs": [], "outputs": [{ "name": "", "type": "string" }] }, { "stateMutability": "view", "type": "function", "name": "decimals", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "nonpayable", "type": "function", "name": "commit_smart_wallet_checker", "inputs": [{ "name": "addr", "type": "address" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "apply_smart_wallet_checker", "inputs": [], "outputs": [] }, { "stateMutability": "view", "type": "function", "name": "get_last_user_slope", "inputs": [{ "name": "addr", "type": "address" }], "outputs": [{ "name": "", "type": "int128" }] }, { "stateMutability": "view", "type": "function", "name": "user_point_history__ts", "inputs": [{ "name": "_addr", "type": "address" }, { "name": "_idx", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "locked__end", "inputs": [{ "name": "_addr", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "nonpayable", "type": "function", "name": "checkpoint", "inputs": [], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "deposit_for", "inputs": [{ "name": "_addr", "type": "address" }, { "name": "_value", "type": "uint256" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "create_lock", "inputs": [{ "name": "_value", "type": "uint256" }, { "name": "_unlock_time", "type": "uint256" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "increase_amount", "inputs": [{ "name": "_value", "type": "uint256" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "increase_unlock_time", "inputs": [{ "name": "_unlock_time", "type": "uint256" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "withdraw", "inputs": [], "outputs": [] }, { "stateMutability": "view", "type": "function", "name": "balanceOf", "inputs": [{ "name": "addr", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "balanceOf", "inputs": [{ "name": "addr", "type": "address" }, { "name": "_t", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "balanceOfAt", "inputs": [{ "name": "addr", "type": "address" }, { "name": "_block", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "totalSupply", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "totalSupply", "inputs": [{ "name": "t", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "totalSupplyAt", "inputs": [{ "name": "_block", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "nonpayable", "type": "function", "name": "change_pending_admin", "inputs": [{ "name": "new_pending_admin", "type": "address" }], "outputs": [] }, { "stateMutability": "nonpayable", "type": "function", "name": "claim_admin", "inputs": [], "outputs": [] }, { "stateMutability": "view", "type": "function", "name": "pending_admin", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "admin", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "supply", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "locked", "inputs": [{ "name": "arg0", "type": "address" }], "outputs": [{ "name": "", "type": "tuple", "components": [{ "name": "amount", "type": "int128" }, { "name": "end", "type": "uint256" }] }] }, { "stateMutability": "view", "type": "function", "name": "epoch", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "point_history", "inputs": [{ "name": "arg0", "type": "uint256" }], "outputs": [{ "name": "", "type": "tuple", "components": [{ "name": "bias", "type": "int128" }, { "name": "slope", "type": "int128" }, { "name": "ts", "type": "uint256" }, { "name": "blk", "type": "uint256" }] }] }, { "stateMutability": "view", "type": "function", "name": "user_point_history", "inputs": [{ "name": "arg0", "type": "address" }, { "name": "arg1", "type": "uint256" }], "outputs": [{ "name": "", "type": "tuple", "components": [{ "name": "bias", "type": "int128" }, { "name": "slope", "type": "int128" }, { "name": "ts", "type": "uint256" }, { "name": "blk", "type": "uint256" }] }] }, { "stateMutability": "view", "type": "function", "name": "user_point_epoch", "inputs": [{ "name": "arg0", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }] }, { "stateMutability": "view", "type": "function", "name": "slope_changes", "inputs": [{ "name": "arg0", "type": "uint256" }], "outputs": [{ "name": "", "type": "int128" }] }, { "stateMutability": "view", "type": "function", "name": "future_smart_wallet_checker", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }, { "stateMutability": "view", "type": "function", "name": "smart_wallet_checker", "inputs": [], "outputs": [{ "name": "", "type": "address" }] }] as const

const veBeaconAbi = [{ "inputs": [{ "internalType": "contract IVotingEscrow", "name": "votingEscrow_", "type": "address" }, { "internalType": "address", "name": "recipientAddress_", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "UniversalBridgeLib__ChainIdNotSupported", "type": "error" }, { "inputs": [], "name": "UniversalBridgeLib__GasLimitTooLarge", "type": "error" }, { "inputs": [], "name": "UniversalBridgeLib__MsgValueNotSupported", "type": "error" }, { "inputs": [], "name": "VeBeacon__UserNotInitialized", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "chainId", "type": "uint256" }], "name": "BroadcastVeBalance", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }, { "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "uint256", "name": "gasLimit", "type": "uint256" }, { "internalType": "uint256", "name": "maxFeePerGas", "type": "uint256" }], "name": "broadcastVeBalance", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }, { "internalType": "uint256[]", "name": "chainIdList", "type": "uint256[]" }, { "internalType": "uint256", "name": "gasLimit", "type": "uint256" }, { "internalType": "uint256", "name": "maxFeePerGas", "type": "uint256" }], "name": "broadcastVeBalanceMultiple", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "address[]", "name": "userList", "type": "address[]" }, { "internalType": "uint256[]", "name": "chainIdList", "type": "uint256[]" }, { "internalType": "uint256", "name": "gasLimit", "type": "uint256" }, { "internalType": "uint256", "name": "maxFeePerGas", "type": "uint256" }], "name": "broadcastVeBalanceMultiple", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "uint256", "name": "gasLimit", "type": "uint256" }, { "internalType": "uint256", "name": "maxFeePerGas", "type": "uint256" }], "name": "getRequiredMessageValue", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "recipientAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "votingEscrow", "outputs": [{ "internalType": "contract IVotingEscrow", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }] as const