import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { createPublicClient, http, maxUint256, zeroHash, type Address, type Hash, type Hex } from 'viem';
import { mainnet } from "viem/chains";
import { BALANCER_VAULT, BOT, POOL_ID, VCX, WETH } from "./constants.js";
import * as Cow from "./cow.js";
import { ERC20 } from "./erc20.js";
import { Balancer, SwapKind } from "./balancer.js";
import type { Call } from "./types.js";

type ProcessedOrder = {
  orderUid: Hex;
  // we ignore orders where the user doesn't sell VCX.
  ignored: boolean;
};

type ProcessedOrders = {
  [user: Address]: {
    [orderUid: Hex]: ProcessedOrder;
  };
};

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, storage } = context;

  const alchemyKey = await context.secrets.get("ALCHEMY_KEY");
  const account = await context.secrets.get("ACCOUNT") as Address;

  // Initialize viem client with the extracted URL
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(`https://eth-mainnet.alchemyapi.io/v2/${alchemyKey}`),
  });

  const erc20 = new ERC20(account, publicClient);
  const balancer = new Balancer(account, publicClient);

  const calldata: Call[] = [];

  // first time we execute this, we need to approve the Balancer Vault to spend our WETH
  const allowance = await erc20.getAllowance(WETH, BALANCER_VAULT);
  if (allowance === BigInt(0)) {
    calldata.push(erc20.getApproveCall(WETH, BALANCER_VAULT, maxUint256));
  }

  const processedOrders = JSON.parse((await storage.get("processedOrders")) ?? "{}") as ProcessedOrders;

  for (const user of userArgs.users as Address[]) {
    const userProcessedOrders = processedOrders[user] || {};
    // orders are sorted from most recent to oldest.
    const orders = await Cow.getOrders(user);

    for (const order of orders) {
    // order is already processed. Any order after this one is older
    // so we know that those are processed as well. We can stop the execution.
      if (userProcessedOrders[order.uid]) {
        break;
      }
      // we only care about orders where the user sells VCX
      if (order.sellToken !== VCX || order.status !== "fulfilled") {
        userProcessedOrders[order.uid] = {
          orderUid: order.uid,
          ignored: true,
        };
      }
      const swap = {
        poolId: POOL_ID,
        kind: SwapKind.GIVEN_OUT,
        assetIn: WETH,
        assetOut: VCX,
        amount: BigInt(order.sellAmount),
        userData: zeroHash,
      };

      calldata.push(await balancer.getSwapCall(swap, undefined));

      userProcessedOrders[order.uid] = {
        orderUid: order.uid,
        ignored: false,
      };
    }
    processedOrders[user] = userProcessedOrders;
  }

  await storage.set("processedOrders", JSON.stringify(processedOrders));
  // Return execution call data
  return {
    canExec: true,
    callData: calldata,
  };
});
