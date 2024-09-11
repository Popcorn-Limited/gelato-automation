import path from "path";
import { Web3FunctionContextData } from "@gelatonetwork/web3-functions-sdk";
import { Web3FunctionLoader } from "@gelatonetwork/web3-functions-sdk/loader";
import { runWeb3Function } from "./utils";
import { parseUnits } from "@ethersproject/units";
import { AnvilServer } from "./utils/anvil-server";

const w3fName = "leveraging";
const w3fRootDir = path.join("web3-functions");
const w3fPath = path.join(w3fRootDir, w3fName, "index.ts");

describe("Manage leverage test", () => {
    let context: Web3FunctionContextData;
    let provider;

    beforeAll(async () => {
        const { secrets } = Web3FunctionLoader.load(w3fName, w3fRootDir);

        const polygonFork = await AnvilServer.fork({
            forkBlockNumber: 61692695,
            forkUrl: process.env.RPC,
        });

        provider = polygonFork.provider;

        context = {
            secrets,
            storage: {},
            gelatoArgs: {
                chainId: 137,
                gasPrice: parseUnits("50", "gwei").toString(),
            },
            userArgs: {},
        };
    }, 10000);

    it("canExec: true", async () => {
        const res = await runWeb3Function(w3fPath, context, [provider]);

        expect(res.result.canExec).toEqual(true);
    }, 10000);
});
