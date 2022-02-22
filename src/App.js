import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import Domains from "./utils/Domains.json";
import { networks } from "./utils";
import { CONTRACT_ADDRESS } from "./constants";
import "./styles/App.css";
import twitterLogo from "./assets/twitter-logo.svg";
import polygonLogo from "./assets/polygonlogo.png";
import ethLogo from "./assets/ethlogo.png";

// Constants
const TWITTER_HANDLE = "ray_v101";
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
const tld = ".cyber";

const App = () => {
  const [currentAccount, setCurrentAccount] = useState(null);
  const [wrongChain, setWrongChain] = useState({});
  const [domain, setDomain] = useState("");
  const [record, setRecord] = useState("");
  const [network, setNetwork] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mints, setMints] = useState([]);

  const checkIfWalletisConnected = async () => {
    if (!window.ethereum) {
      console.log("Install MetaMask!");
    } else {
      if (!wrongChain.value) {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length !== 0) {
          setCurrentAccount(accounts[0]);
        } else {
          console.log("No authorized account found");
        }

        const chainId = await window.ethereum.request({
          method: "eth_chainId",
        });
        setNetwork(networks[chainId]);
        window.ethereum.on("chainChanged", handleChainChanged);
        function handleChainChanged(_chainId) {
          window.location.reload();
        }
      }
    }
  };

  const getContractInstance = async (ethereum) => {
    const provider = await new ethers.providers.Web3Provider(ethereum);
    const signer = await provider.getSigner();
    const contractInstance = await new ethers.Contract(
      CONTRACT_ADDRESS,
      Domains.abi,
      signer
    );

    console.log(contractInstance);
    return { provider, signer, contractInstance };
  };

  const mintDomain = async () => {
    try {
      if (!domain) return;
      if (domain.length < 3) {
        alert("Domain length should atleast be 3");
        return;
      }

      const domainPrice =
        domain.length === 3 ? "0.4" : domain.length === 2 ? "0.3" : "0.2";
      console.log(
        `minting domain ${domain}.${tld} of length ${domain.length} which is gonna cost ${domainPrice}`
      );

      const { contractInstance } = await getContractInstance(window.ethereum);
      const register = await contractInstance.registerDomain(domain, {
        value: ethers.utils.parseEther(domainPrice),
      });
      const reciept = await register.wait();
      if (reciept.status === 1) {
        console.log(
          `Domain ${domain}.${tld} has been successfully registered. https://mumbai.polygonscan.com/tx/${reciept.hash}`
        );

        if (record !== "") {
          const recordUpdate = await contractInstance.setRecord(domain, record);
          await recordUpdate.wait();
          if (record.status === 1) {
            console.log(
              `Record set! https://mumbai.polygonscan.com/tx/${recordUpdate.hash}`
            );
          }

          // Call fetchMints after 2 seconds
          setTimeout(() => {
            fetchMints();
          }, 2000);

          setDomain("");
          setRecord("");
        }
      } else {
        console.log(reciept);
        console.log("Failure occurred in mining the domain txn in block");
      }
    } catch (err) {
      console.log(err);
    }
  };

  const fetchMints = async () => {
    try {
      const { contractInstance } = await getContractInstance(window.ethereum);
      const names = await contractInstance.getAllNames();
      const mintRecords = await Promise.all(
        names.map(async (name) => {
          const mintRecord = await contractInstance.records(name);
          const owner = await contractInstance.domains(name);
          return {
            id: names.indexOf(name),
            name: name,
            record: mintRecord,
            owner: owner,
          };
        })
      );
      console.log("MINTS FETCHED ", mintRecords);
      setMints(mintRecords);
    } catch (error) {
      console.log(error);
    }
  };

  // Add this render function next to your other render functions
  const renderMints = () => {
    if (currentAccount && mints.length > 0) {
      return (
        <div className="mint-container">
          <p className="subtitle"> Recently minted domains!</p>
          <div className="mint-list">
            {mints.map((mint, index) => {
              return (
                <div className="mint-item" key={index}>
                  <div className="mint-row">
                    <a
                      className="link"
                      href={`https://testnets.opensea.io/assets/mumbai/${CONTRACT_ADDRESS}/${mint.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <p className="underlined">
                        {mint.name}
                        {tld}
                      </p>
                    </a>
                    {/* If mint.owner is currentAccount, add an "edit" button*/}
                    {mint.owner.toLowerCase() ===
                    currentAccount.toLowerCase() ? (
                      <button
                        className="edit-button"
                        onClick={() => editRecord(mint.name)}
                      >
                        <img
                          className="edit-icon"
                          src="https://img.icons8.com/metro/26/000000/pencil.png"
                          alt="Edit button"
                        />
                      </button>
                    ) : null}
                  </div>
                  <p> {mint.record} </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };

  // This will take us into edit mode and show us the edit buttons!
  const editRecord = (name) => {
    console.log("Editing record for", name);
    setEditing(true);
    setDomain(name);
  };

  // This will run any time currentAccount or network are changed
  useEffect(() => {
    if (network === "Polygon Mumbai Testnet") {
      fetchMints();
    }
  }, [currentAccount, network]);

  const updateDomain = async () => {
    if (!record && !domain) return;
    setLoading(true);
    console.log("Updating domain", domain, "with record", record);
    try {
      const { contractInstance } = await getContractInstance(window.ethereum);
      let tx = await contractInstance.setRecord(domain, record);
      await tx.wait();
      console.log(
        "Record updated https://mumbai.polygonscan.com/tx/" + tx.hash
      );
      fetchMints();
      setRecord("");
      setDomain("");
    } catch (err) {
      console.error("ERR, while updating the domain");
    }
    setLoading(false);
  };

  const switchNetwork = async () => {
    if (window.ethereum) {
      try {
        // Try to switch to the Mumbai testnet
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x13881" }],
        });
      } catch (error) {
        if (error.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0x13881",
                  chainName: "Polygon Mumbai Testnet",
                  rpcUrls: ["https://rpc-mumbai.maticvigil.com/"],
                  nativeCurrency: {
                    name: "Mumbai Matic",
                    symbol: "MATIC",
                    decimals: 18,
                  },
                  blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
                },
              ],
            });
          } catch (error) {
            console.log(error);
          }
        }
        console.log(error);
      }
    } else {
      alert(
        "MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html"
      );
    }
  };

  const renderInputForm = () => {
    if (network !== "Polygon Mumbai Testnet") {
      return (
        <div className="connect-wallet-container">
          <p>Please connect to the Polygon Mumbai Testnet</p>
          <button className="cta-button mint-button" onClick={switchNetwork}>
            Click here to switch
          </button>
        </div>
      );
    }

    return (
      <div className="form-container">
        <div className="first-row">
          <input
            type="text"
            value={domain}
            placeholder="domain"
            onChange={(e) => setDomain(e.target.value)}
          />
          <p className="tld"> {tld} </p>
        </div>

        <input
          type="text"
          value={record}
          placeholder="whats ur cyber power"
          onChange={(e) => setRecord(e.target.value)}
        />
        {editing ? (
          <div className="button-container">
            <button
              className="cta-button mint-button"
              disabled={loading}
              onClick={updateDomain}
            >
              Set record
            </button>
            <button
              className="cta-button mint-button"
              onClick={() => {
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          // If editing is not true, the mint button will be returned instead
          <button
            className="cta-button mint-button"
            disabled={loading}
            onClick={mintDomain}
          >
            Mint
          </button>
        )}
      </div>
    );
  };

  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("Get MetaMask -> https://metamask.io/");
        return;
      }

      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      console.log("Connected", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (error) {
      console.log(error);
    }
  };

  const renderNotConnectedContainer = () => (
    <div className="connect-wallet-container">
      <img
        src="https://media.giphy.com/media/3ohhwytHcusSCXXOUg/giphy.gif"
        alt="Ninja gif"
      />
      <button
        className="cta-button connect-wallet-button"
        onClick={connectWallet}
      >
        Connect Wallet
      </button>
    </div>
  );

  useEffect(() => {
    checkIfWalletisConnected();
  }, []);

  return (
    <div className="App">
      <div className="container">
        <div className="header-container">
          <header>
            <div className="left">
              <p className="title">Cyber Name Service</p>
              <p className="subtitle">
                Decentralized domain name system on blockchain
              </p>
            </div>
            <div className="right">
              <img
                alt="Network logo"
                className="logo"
                src={network.includes("Polygon") ? polygonLogo : ethLogo}
              />
              {currentAccount ? (
                <p>
                  {" "}
                  Wallet: {currentAccount.slice(0, 6)}...
                  {currentAccount.slice(-4)}{" "}
                </p>
              ) : (
                <p> Not connected </p>
              )}
            </div>
          </header>
        </div>
        {!currentAccount && renderNotConnectedContainer()}
        {currentAccount && renderInputForm()}
        {mints && renderMints()}
        <div className="footer-container">
          <img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
          <a
            className="footer-text"
            href={TWITTER_LINK}
            target="_blank"
            rel="noreferrer"
          >{`built by @${TWITTER_HANDLE}`}</a>
        </div>
      </div>
    </div>
  );
};

export default App;
