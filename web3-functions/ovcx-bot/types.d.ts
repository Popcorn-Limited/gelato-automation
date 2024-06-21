import type { Address, Hex } from "viem";

export type Call = {
    to: Address;
    data: Hex;
};