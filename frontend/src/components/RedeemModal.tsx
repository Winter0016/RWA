import React, { useState } from 'react';

interface RedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
  maxAmount: string;
  ticker: string;
}

export function RedeemModal({ isOpen, onClose, onConfirm, maxAmount, ticker }: RedeemModalProps) {
  const [amount, setAmount] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-8 bg-[#0B0F19] border border-[#1E293B] rounded-2xl shadow-2xl">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Redeem {ticker}</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Amount to Redeem
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow pr-20"
              />
              <button 
                onClick={() => setAmount(maxAmount)}
                className="absolute right-2 top-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs font-medium rounded-lg transition-colors"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-right">
              Available: {maxAmount} {ticker}
            </p>
          </div>

          <button
            onClick={() => {
              if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
                onConfirm(amount);
                setAmount('');
              }
            }}
            disabled={!amount || Number(amount) <= 0 || Number(amount) > Number(maxAmount)}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
          >
            Confirm Redeem
          </button>
        </div>
      </div>
    </div>
  );
}
