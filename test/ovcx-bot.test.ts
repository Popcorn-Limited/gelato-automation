import path from "path";
import { Web3FunctionContextData } from "@gelatonetwork/web3-functions-sdk";
import { Web3FunctionLoader } from "@gelatonetwork/web3-functions-sdk/loader";
import { runWeb3Function } from "./utils";
import { parseUnits } from "@ethersproject/units";
import { AnvilServer } from "./utils/anvil-server";

const w3fName = "ovcx-bot";
const w3fRootDir = path.join("web3-functions");
const w3fPath = path.join(w3fRootDir, w3fName, "index.ts");

describe("ovcx-bot test", () => {
    let context: Web3FunctionContextData;
    let provider;

    beforeAll(async () => {
        const { secrets } = Web3FunctionLoader.load(w3fName, w3fRootDir);


        const mainnetFork = await AnvilServer.fork({
            forkBlockNumber: 20074294,
            forkUrl: process.env.RPC,
        });

        provider = mainnetFork.provider;

        context = {
            secrets,
            storage: {
                "processedOrders": "{}",
            },
            gelatoArgs: {
                chainId: 1,
                gasPrice: parseUnits("100", "gwei").toString(),
            },
            userArgs: {
                users: [
                    "0xeEc0AF29301d99e2b63E52e3a6Ad72c62908d380"
                ],
                account: "0x770F4e38615e24E9E438b30CFaBf411ec499f9B6",
                recipient: "0x770F4e38615e24E9E438b30CFaBf411ec499f9B6",
            },
        };
    }, 10000);

    it("canExec: true", async () => {
        const res = await runWeb3Function(w3fPath, context, [provider]);

        expect(res.result.canExec).toEqual(true);
    }, 10000);
});
