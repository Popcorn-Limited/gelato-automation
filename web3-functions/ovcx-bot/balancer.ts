import { type Account, type PublicClient, type Address, type Hash, type Hex, encodeFunctionData } from "viem";
import { BALANCER_VAULT_ABI } from "./abis/balancer_vault_abi.js";
import { BALANCER_VAULT, BALANCER_QUERIES } from "./constants.js";
import { BALANCER_QUERIES_ABI } from "./abis/balancer_queries_abi.js";
import type { Call } from "./types.js";

export class Balancer {
    publicClient: PublicClient;

    private defaultFundManagement: FundManagement;
    constructor(
        account: Address,
        publicClient: PublicClient,
    ) {
        this.publicClient = publicClient;

        this.defaultFundManagement = {
            sender: account,
            fromInternalBalance: false,
            recipient: account,
            toInternalBalance: false,
        };
    }

    async getSwapCall(swap: SingleSwap, fundManagement: FundManagement = this.defaultFundManagement): Promise<Call> {
        const block = await this.publicClient.getBlock();
        const minOut = (await this.querySwap(swap, fundManagement)) * BigInt(99) / BigInt(100);
        return {
            to: BALANCER_VAULT,
            data: encodeFunctionData({
                abi: BALANCER_VAULT_ABI,
                functionName: "swap",
                args: [swap, fundManagement, minOut, block.timestamp + BigInt(1200)]
            })
        };
    };

    async querySwap(swap: SingleSwap, fundManagement: FundManagement = this.defaultFundManagement): Promise<bigint> {
        return this.publicClient.readContract({
            address: BALANCER_QUERIES,
            abi: BALANCER_QUERIES_ABI,
            functionName: "querySwap",
            args: [swap, fundManagement],
        });
    };

}

export type SingleSwap = {
    poolId: Hash;
    kind: SwapKind;
    assetIn: Address;
    assetOut: Address;
    amount: bigint;
    userData: Hex;
};

export enum SwapKind {
    GIVEN_IN = 0,
    GIVEN_OUT,
}

export type FundManagement = {
    sender: Address;
    fromInternalBalance: boolean;
    recipient: Address;
    toInternalBalance: boolean;
};