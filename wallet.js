/* ============================================================
   wallet.js — MetaMask / Polygon wallet integratie
   Polymarket draait op Polygon, handelt in USDC.e.
   Vereist ethers.js (via CDN in index.html geladen).
   ============================================================ */
const Wallet = (() => {
  const POLYGON_CHAIN_ID = '0x89'; // 137
  const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e Polygon
  const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];

  let provider = null;
  let signer = null;
  let address = null;

  async function connect() {
    if (!window.ethereum) {
      throw new Error('Geen wallet gevonden. Installeer MetaMask (metamask.io).');
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send('eth_requestAccounts', []);

    // Zorg dat we op Polygon zitten
    const network = await provider.getNetwork();
    if (network.chainId !== 137) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: POLYGON_CHAIN_ID }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: POLYGON_CHAIN_ID,
              chainName: 'Polygon',
              nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com'],
              blockExplorerUrls: ['https://polygonscan.com']
            }]
          });
        } else {
          throw switchError;
        }
      }
      provider = new ethers.providers.Web3Provider(window.ethereum);
    }

    signer = provider.getSigner();
    address = await signer.getAddress();

    Storage.setWallet({ address, connectedAt: new Date().toISOString() });
    return address;
  }

  async function connectAddressOnly(addr) {
    // Alleen adres invoeren = read-only, geen live trading mogelijk
    address = addr;
    provider = null;
    signer = null;
    Storage.setWallet({ address: addr, readOnly: true, connectedAt: new Date().toISOString() });
    return addr;
  }

  function disconnect() {
    provider = null; signer = null; address = null;
    Storage.clearWallet();
  }

  function isConnected() { return !!address; }
  function isLiveCapable() { return !!signer; }
  function getAddress() { return address; }
  function getSigner() { return signer; }

  async function getUsdcBalance() {
    if (!address) return 0;
    if (!provider) {
      // read-only adres: gebruik publieke RPC
      const roProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, roProvider);
      const bal = await usdc.balanceOf(address);
      return Number(ethers.utils.formatUnits(bal, 6));
    }
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const bal = await usdc.balanceOf(address);
    return Number(ethers.utils.formatUnits(bal, 6));
  }

  // Probeert eerder verbonden wallet te herstellen (adres, niet de signer —
  // die vereist altijd een nieuwe verbinding met MetaMask voor live trading)
  function restoreFromStorage() {
    const w = Storage.getWallet();
    if (w) { address = w.address; return w; }
    return null;
  }

  return {
    connect, connectAddressOnly, disconnect,
    isConnected, isLiveCapable, getAddress, getSigner,
    getUsdcBalance, restoreFromStorage
  };
})();
