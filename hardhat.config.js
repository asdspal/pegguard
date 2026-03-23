require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const RSK_TESTNET_RPC_URL =
  process.env.RSK_TESTNET_RPC_URL || "https://public-node.testnet.rsk.co";
const RSK_MAINNET_RPC_URL =
  process.env.RSK_MAINNET_RPC_URL || "https://public-node.rsk.co";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    rskTestnet: {
      url: RSK_TESTNET_RPC_URL,
      chainId: 31,
      gasPrice: 60000000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    rskMainnet: {
      url: RSK_MAINNET_RPC_URL,
      chainId: 30,
      gasPrice: 60000000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      rskTestnet: process.env.VERIFY_API_KEY || "",
      rskMainnet: process.env.VERIFY_API_KEY || "",
    },
    customChains: [
      {
        network: "rskTestnet",
        chainId: 31,
        urls: {
          apiURL: "https://rootstock-testnet.blockscout.com/api",
          browserURL: "https://rootstock-testnet.blockscout.com",
        },
      },
      {
        network: "rskMainnet",
        chainId: 30,
        urls: {
          apiURL: "https://rootstock.blockscout.com/api",
          browserURL: "https://rootstock.blockscout.com",
        },
      },
    ],
  },
};
