import { Chains, RiseWallet } from "rise-wallet";
import { riseWallet } from "rise-wallet/wagmi";
import { createConfig, http } from "wagmi";

export const rwConnector = riseWallet(RiseWallet.defaultConfig);

// Create wagmi config
export const config = createConfig({
  chains: [Chains.riseTestnet],
  connectors: [rwConnector],
  transports: {
    [Chains.riseTestnet.id]: http("https://testnet.riselabs.xyz"),
  },
});