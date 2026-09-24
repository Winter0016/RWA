'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { encodeFunctionData, createPublicClient, http, formatUnits } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { io } from 'socket.io-client';
import { GET_ALL_USERS, GET_ALL_TRANSACTIONS, GET_ALL_CONTRACTS } from '@/graphql/queries';
import { UPSERT_CONTRACT, UPDATE_USER_WHITELIST } from '@/graphql/mutations';
import { DTSLA_ADDRESS, DTSLA_ABI, USDC_ADDRESS, USDC_ABI } from '@/constants/contracts';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'transactions' | 'contracts'>('users');
  const [whitelisting, setWhitelisting] = useState<string | null>(null);
  const [whitelistModal, setWhitelistModal] = useState<{ targetAddress: string, name: string } | null>(null);

  const [newContractAddress, setNewContractAddress] = useState('');
  const [newContractName, setNewContractName] = useState('');
  const [addingContract, setAddingContract] = useState(false);

  const { data: usersData, loading: usersLoading, error: usersError } = useQuery<any>(GET_ALL_USERS, {
    fetchPolicy: 'network-only' // Always fetch fresh data for admin
  });

  const { data: txData, loading: txLoading, error: txError, refetch: refetchTxs } = useQuery<any>(GET_ALL_TRANSACTIONS, {
    fetchPolicy: 'network-only'
  });

  const { data: contractsData, loading: contractsLoading, error: contractsError, refetch: refetchContracts } = useQuery<any>(GET_ALL_CONTRACTS, {
    fetchPolicy: 'network-only'
  });

  const [upsertContract] = useMutation(UPSERT_CONTRACT);
  const [updateUserWhitelist] = useMutation(UPDATE_USER_WHITELIST);

  // Listen for real-time global transaction updates
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000');
    
    socket.on('global_transaction_update', (data) => {
      console.log('Global transaction update received:', data);
      refetchTxs(); // Silently refetch the transactions list!
    });

    return () => {
      socket.disconnect();
    };
  }, [refetchTxs]);

  // Fetch true on-chain supply and USDC vault balance for Reconciliation
  const [chainSupply, setChainSupply] = useState<number | null>(null);
  const [chainUsdcBalance, setChainUsdcBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetchChainMetrics = async () => {
      try {
        const publicClient = createPublicClient({
          chain: arbitrumSepolia,
          transport: http('https://sepolia-rollup.arbitrum.io/rpc')
        });
        
        const [supply, usdcBal] = await Promise.all([
          publicClient.readContract({
            address: DTSLA_ADDRESS as `0x${string}`,
            abi: DTSLA_ABI,
            functionName: 'totalSupply'
          }),
          publicClient.readContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [DTSLA_ADDRESS]
          })
        ]);
        
        setChainSupply(Number(formatUnits(supply as bigint, 18)));
        setChainUsdcBalance(Number(formatUnits(usdcBal as bigint, 6))); // USDC uses 6 decimals
      } catch (err) {
        console.error("Failed to fetch chain metrics:", err);
      }
    };
    fetchChainMetrics();
  }, []);

  const { sendTransaction } = usePrivy();
  const { wallets } = useWallets();

  const executeWhitelist = async (targetAddress: string, status: boolean, isContract: boolean = false, name: string = '') => {
    try {
      setWhitelisting(targetAddress);

      if (!wallets || wallets.length === 0) {
        alert("Error: You do not have a connected wallet. Please connect your admin wallet to sign transactions.");
        return;
      }

      const activeWallet = wallets[0];

      const data = encodeFunctionData({
        abi: DTSLA_ABI,
        functionName: 'setWhitelist',
        args: [targetAddress as `0x${string}`, status]
      });

      console.log(`Executing whitelist for ${targetAddress} (Status: ${status})`);

      // Use the active wallet's provider directly to bypass Privy's ambiguity
      const provider = await activeWallet.getEthereumProvider();
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: DTSLA_ADDRESS,
          data,
          chainId: '0x66EE6' // 421614 in hex
        }]
      });

      console.log("Whitelist tx hash:", txHash);
      
      if (isContract) {
        await upsertContract({
          variables: {
            contractAddress: targetAddress,
            name: name,
            isWhitelisted: status
          },
          refetchQueries: [{ query: GET_ALL_CONTRACTS }]
        });
      } else {
        await updateUserWhitelist({
          variables: {
            walletAddress: targetAddress,
            isWhitelisted: status
          },
          refetchQueries: [{ query: GET_ALL_USERS }]
        });
      }

      alert(`Successfully submitted whitelist transaction!\nTx Hash: ${txHash}`);
      setWhitelistModal(null);
    } catch (err: any) {
      console.error("Whitelist failed:", err);
      alert(`Whitelist failed: ${err.message || err}`);
    } finally {
      setWhitelisting(null);
    }
  };

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractAddress || !newContractName) return;
    setAddingContract(true);
    await executeWhitelist(newContractAddress, true, true, newContractName);
    setNewContractAddress('');
    setNewContractName('');
    setAddingContract(false);
  };

  if (usersError?.message === 'UNAUTHORIZED' || txError?.message === 'UNAUTHORIZED') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 pt-24">
        <div className="bg-red-950/30 border border-red-900 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⛔</span>
          </div>
          <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
          <p className="text-red-400/70">You do not have administrative privileges to view this page.</p>
        </div>
      </div>
    );
  }

  // Calculate Metrics from global transaction history
  const allTx = txData?.getAllTransactions || [];
  
  const totalMintedDTSLA = allTx
    .filter((tx: any) => tx.type === 'MINT' && tx.status === 'COMPLETED')
    .reduce((sum: number, tx: any) => sum + Number(tx.dtsla_amount || 0), 0);
    
  const totalRedeemedDTSLA = allTx
    .filter((tx: any) => tx.type === 'REDEEM' && tx.status === 'COMPLETED')
    .reduce((sum: number, tx: any) => sum + Number(tx.dtsla_amount || 0), 0);
    
  const currentDTSLASupply = totalMintedDTSLA - totalRedeemedDTSLA;

  const totalUSDCVolume = allTx
    .filter((tx: any) => tx.status === 'COMPLETED')
    .reduce((sum: number, tx: any) => sum + Number(tx.usdc_amount || 0), 0);

  return (
    <div className="flex-1 w-full flex flex-col items-center relative ">
      <main className="max-w-360 w-full mx-auto px-6 py-12 space-y-8 ">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Admin Dashboard</h1>
          <p className="text-zinc-400">Manage users, transactions, and smart contract whitelists.</p>
        </div>

        {/* Global Metrics - Proof of Reserves */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Total dTSLA Supply</h3>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Database (Indexer)</div>
                <div className="text-2xl font-bold text-white font-mono">{currentDTSLASupply.toFixed(4)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-blue-400/80 mb-1">Blockchain (Arbitrum)</div>
                <div className="text-2xl font-bold text-blue-400 font-mono">
                  {chainSupply !== null ? chainSupply.toFixed(4) : '...'}
                </div>
              </div>
            </div>
            {/* Reconciliation Status Indicator */}
            {chainSupply !== null && (
              <div className={`absolute top-0 right-0 w-full h-1 ${Math.abs(currentDTSLASupply - chainSupply) < 0.001 ? 'bg-emerald-500' : 'bg-red-500'}`} />
            )}
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Total USDC Vault Balance</h3>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Database (Indexer)</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">${totalUSDCVolume.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-blue-400/80 mb-1">Blockchain (Arbitrum)</div>
                <div className="text-2xl font-bold text-blue-400 font-mono">
                  {chainUsdcBalance !== null ? `$${chainUsdcBalance.toLocaleString()}` : '...'}
                </div>
              </div>
            </div>
            {/* Reconciliation Status Indicator */}
            {chainUsdcBalance !== null && (
              <div className={`absolute top-0 right-0 w-full h-1 ${Math.abs(totalUSDCVolume - chainUsdcBalance) < 0.001 ? 'bg-emerald-500' : 'bg-red-500'}`} />
            )}
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Total Transactions</h3>
            <div className="text-3xl font-bold text-white font-mono">{allTx.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'users'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            Users Registry
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'transactions'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            Global Transactions
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'contracts'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            Protocol Contracts
          </button>
        </div>

        {/* Users Tab Content */}
        {activeTab === 'users' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {usersLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Signer (EOA)</th>
                      <th className="px-6 py-4 font-medium">Smart Account</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Whitelisted</th>
                      <th className="px-6 py-4 font-medium">Whitelist Date</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {usersData?.getAllUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{u.name || 'Anonymous'}</div>
                          <div className="text-xs text-zinc-500">{u.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-zinc-300">
                          {u.signer_address ? `${u.signer_address.slice(0, 6)}...${u.signer_address.slice(-4)}` : '-'}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-zinc-300">
                          {u.wallet_address ? `${u.wallet_address.slice(0, 6)}...${u.wallet_address.slice(-4)}` : 'Pending...'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'
                            }`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${u.is_whitelisted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {u.is_whitelisted ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-400">
                          {u.whitelist_updated_at ? new Date(Number(u.whitelist_updated_at)).toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            disabled={!u.wallet_address || whitelisting === u.wallet_address}
                            onClick={() => setWhitelistModal({ targetAddress: u.wallet_address, name: u.name || 'User' })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${whitelisting === u.wallet_address
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : !u.wallet_address
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                          >
                            {whitelisting === u.wallet_address ? 'Processing...' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab Content */}
        {activeTab === 'transactions' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {txLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading transactions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">User Wallet</th>
                      <th className="px-6 py-4 font-medium">USDC</th>
                      <th className="px-6 py-4 font-medium">dTSLA</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {txData?.getAllTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`font-medium ${tx.type === 'MINT' ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-zinc-300">
                          {tx.wallet_address ? `${tx.wallet_address.slice(0, 6)}...${tx.wallet_address.slice(-4)}` : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 font-mono text-white">${tx.usdc_amount}</td>
                        <td className="px-6 py-4 font-mono text-zinc-300">
                          {tx.dtsla_amount ? tx.dtsla_amount : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-500">
                          {new Date(Number(tx.created_at)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Contracts Tab Content */}
        {activeTab === 'contracts' && (
          <div className="space-y-6 w-full">
            {/* Add Contract Form */}
            <form onSubmit={handleAddContract} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Protocol Name</label>
                <input 
                  type="text" 
                  value={newContractName}
                  onChange={(e) => setNewContractName(e.target.value)}
                  placeholder="e.g. Uniswap V3 Router"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Contract Address</label>
                <input 
                  type="text" 
                  value={newContractAddress}
                  onChange={(e) => setNewContractAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-mono text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={addingContract || whitelisting !== null}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 h-11.5"
              >
                {addingContract ? 'Adding...' : 'Add & Whitelist'}
              </button>
            </form>

            {/* Contracts Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
              {contractsLoading ? (
                <div className="p-8 text-center text-zinc-500">Loading contracts...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-medium">Protocol Name</th>
                        <th className="px-6 py-4 font-medium">Contract Address</th>
                        <th className="px-6 py-4 font-medium">Whitelisted</th>
                        <th className="px-6 py-4 font-medium">Date Added</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {contractsData?.getAllContracts.map((c: any) => (
                        <tr key={c.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                          <td className="px-6 py-4 font-mono text-sm text-zinc-300">
                            {c.contract_address}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${c.is_whitelisted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {c.is_whitelisted ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-400">
                            {c.created_at ? new Date(Number(c.created_at)).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              disabled={whitelisting === c.contract_address}
                              onClick={() => executeWhitelist(c.contract_address, !c.is_whitelisted, true, c.name)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${whitelisting === c.contract_address
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                : c.is_whitelisted
                                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                                }`}
                            >
                              {whitelisting === c.contract_address 
                                ? 'Processing...' 
                                : c.is_whitelisted ? 'Revoke' : 'Approve'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!contractsData?.getAllContracts || contractsData.getAllContracts.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                            No protocol contracts tracked yet. Add one above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Whitelist Modal */}
      {whitelistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setWhitelistModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            <h2 className="text-xl font-semibold text-white mb-2">Manage Whitelist</h2>
            <p className="text-slate-400 text-sm mb-6">
              Update whitelist status for <strong>{whitelistModal.name}</strong> ({whitelistModal.targetAddress.slice(0, 6)}...{whitelistModal.targetAddress.slice(-4)}).
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => executeWhitelist(whitelistModal.targetAddress, true, false, '')}
                disabled={whitelisting === whitelistModal.targetAddress}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Approve (True)
              </button>
              <button 
                onClick={() => executeWhitelist(whitelistModal.targetAddress, false, false, '')}
                disabled={whitelisting === whitelistModal.targetAddress}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Revoke (False)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
