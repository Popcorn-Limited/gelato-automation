import axios from "axios";
import type { Address, Hash } from "viem";

const API_BASE = "https://api.cow.fi/mainnet/api/v1/";

type Order = {
    uid: Hash;
    sellToken: Address;
    buyToken: Address;
    receiver: Address;
    sellAmount: string;
    buyAmount: string;
    from: Address;
    creationDate: string;
    owner: Address;
    status: "presignaturePending" | "open" | "fulfilled" | "cancelled" | "expired";
    invalidated: boolean;
    executedSellAmount: string;
    executedBuyAmount: string;
};

/**
 * @param address the address for which to get the orders
 * @returns 100 most recent orders of the given address
 */
export async function getOrders(address: Address): Promise<Order[]> {
    const path = `account/${address}/orders?limit=100`;

    return (await axios.get(API_BASE + path)).data as Order[];
}