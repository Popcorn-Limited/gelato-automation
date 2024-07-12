import { encodeFunctionData, type Address, type PublicClient } from "viem";
import { ERC20_ABI } from "./abis/erc20_abi.js";
import type { Call } from "./types.js";

export class ERC20 {
    account: Address;
    publicClient: PublicClient;
    constructor(
        account: Address,
        publicClient: PublicClient,
    ) {
        this.account = account;
        this.publicClient = publicClient;
    }

    async getAllowance(token: Address, spender: Address): Promise<bigint> {
        return this.publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [this.account, spender]
        });
    };

    getApproveCall(token: Address, spender: Address, amount: bigint): Call {
        return {
            to: token,
            data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "approve",
                args: [spender, amount],
            }),
        };
    }
}

