"use client";

import { useQuery } from '@apollo/client/react';
import { usePrivy } from '@privy-io/react-auth';
import { GET_USER_TRANSACTIONS } from '@/graphql/queries';
import { useTransactionFlow } from '@/hooks/useTransactionFlow';
import { TransactionModal } from '@/components/TransactionModal';

// Arbitrum Sepolia Arbiscan URL
// Arbitrum Sepolia Arbiscan URL
const ARBISCAN_URL = "https://sepolia.arbiscan.io/tx/";

const truncateDecimals = (val: number | string, decimals: number = 6) => {
  if (!val) return '0';
  // Force javascript to expand scientific notation out to 18 decimals
  let str = Number(val).toFixed(18); 
  // Strip off all the useless trailing zeroes at the very end
  str = str.replace(/\.?0+$/, ''); 
  return str === '' ? '0' : str;
};

export default function TransactionsPage() {
  const { ready, authenticated, user, login } = usePrivy();
  const { state: txState, setState: setTxState, resumeClaim, resumeRedeem, resumeRefund, txType } = useTransactionFlow();

  // Fetch transactions for the user securely via backend context
  const { data, loading, error, refetch } = useQuery<any>(GET_USER_TRANSACTIONS, {
    skip: !authenticated,
    fetchPolicy: 'cache-and-network', // Ensure we get fresh data but show cache fast
  });

  const transactions = data?.getUserTransactions || [];

  // Helper to shorten tx hash
  const shortenHash = (hash: string) => {
    if (!hash) return "N/A";
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Helper to format date nicely
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(Number(dateString)); // Assuming timestamp from backend, if not adjust
    // If backend returns a postgres ISO string, new Date(dateString) works too!
    const dateObj = isNaN(Number(dateString)) ? new Date(dateString) : new Date(Number(dateString));

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(dateObj);
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center relative">
      <main className="max-w-[1440px] w-full mx-auto px-6 py-12">

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-medium text-white mb-2">Transaction History</h1>
          <p className="text-slate-400">View your deposits, withdrawals, and smart contract executions.</p>
        </div>

        {!ready ? (
          <div className="w-full h-64 bg-[#1E293B]/50 rounded-xl animate-pulse"></div>
        ) : !authenticated ? (
          <div className="w-full bg-[#1E293B]/50 border border-[#334155] rounded-xl p-12 text-center">
            <h2 className="text-xl font-medium text-white mb-4">Connect to View Transactions</h2>
            <p className="text-slate-400 mb-6">You need to connect your wallet to view your transaction history.</p>
            <button
              onClick={login}
              className="py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl overflow-hidden">
            {loading && transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                Loading transactions...
              </div>
            ) : error ? (
              <div className="p-12 text-center text-red-400">
                Failed to load transactions. Please try again.
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center">
                <h3 className="text-lg font-medium text-white mb-2">No Transactions Found</h3>
                <p className="text-slate-400">When you mint or redeem dTSLA, your history will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#1E293B]/30 border-b border-[#1E293B]">
                    <tr>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Type</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Amount (USD)</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Asset Received</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Date</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400 text-right">Blockchain Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-[#1E293B]/20 transition-colors">

                        {/* Type (MINT/REDEEM) */}
                        <td className="px-6 py-4">
                          {tx.type === 'MINT' ? (
                            <span className="inline-flex items-center gap-1.5 text-blue-400 font-medium">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16v-2a2 2 0 012-2h14a2 2 0 012 2v2m-10 4V8m0 0l3 3m-3-3l-3 3" />
                              </svg>
                              Deposit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-purple-400 font-medium">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                              Withdraw
                            </span>
                          )}
                        </td>

                        {/* USDC Amount */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-white">
                            ${truncateDecimals(tx.usdc_amount)}
                          </span>
                        </td>

                        {/* dTSLA Amount */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-slate-300">
                            {truncateDecimals(tx.dtsla_amount)} dTSLA
                          </span>
                        </td>

                        {/* Status Badge / Action */}
                        <td className="px-6 py-4">
                          {tx.status === 'COMPLETED' ? (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Completed
                            </span>
                          ) : tx.status === 'READY_TO_CLAIM' ? (
                            <button
                              onClick={() => resumeClaim(tx.blockchain_tx)}
                              className="px-3 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                            >
                              CLAIM TSLA
                            </button>
                          ) : tx.status === 'READY_TO_CLAIM_USDC' ? (
                            <button
                              onClick={() => resumeRedeem(tx.blockchain_tx)}
                              className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            >
                              CLAIM USDC
                            </button>
                          ) : (tx.status === 'FAILED' || tx.status === 'CANCELED_BY_ADMIN') ? (
                            <button
                              onClick={() => resumeRefund(tx.blockchain_tx)}
                              className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-600 hover:bg-red-500 text-white transition-colors shadow-[0_0_10px_rgba(220,38,38,0.4)]"
                            >
                              REFUND FAILED TX
                            </button>
                          ) : tx.status === 'REFUNDED' ? (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              Refunded
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              Pending Alpaca Settlement
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {formatDate(tx.created_at)}
                        </td>

                        {/* Blockchain Tx */}
                        <td className="px-6 py-4 text-right">
                          {tx.blockchain_tx ? (
                            <a
                              href={`${ARBISCAN_URL}${tx.blockchain_tx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors font-mono"
                            >
                              {shortenHash(tx.blockchain_tx)}
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-sm text-slate-500 font-mono">Pending</span>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Transaction Modal (for resuming claims) */}
      <TransactionModal
        isOpen={txState !== 'IDLE'}
        onClose={() => setTxState('IDLE')}
        state={txState}
        type={txType}
      />
    </div>
  );
}
