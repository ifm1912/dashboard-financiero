'use client';

import { useState, useEffect } from 'react';
import { VCPeriod, VCPeriodType } from '@/types';

interface VCReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (period: VCPeriod, customText: string, manualMRR: number, manualARR: number) => void;
  availableYears: number[];
  availableQuarters: { year: number; quarter: number; label: string }[];
  mrrDefault: number;
  arrDefault: number;
}

export function VCReportModal({
  isOpen,
  onClose,
  onGenerate,
  availableYears,
  availableQuarters,
  mrrDefault,
  arrDefault,
}: VCReportModalProps) {
  const [periodType, setPeriodType] = useState<VCPeriodType>('year');
  const [selectedYear, setSelectedYear] = useState(
    availableYears.length > 0 ? availableYears[0] : new Date().getFullYear()
  );
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(0);
  const [customText, setCustomText] = useState('');
  const [mrr, setMrr] = useState<string>('');
  const [arr, setArr] = useState<string>('');

  // Pre-fill with defaults when they become available
  useEffect(() => {
    if (mrrDefault > 0 && !mrr) setMrr(String(Math.round(mrrDefault)));
  }, [mrrDefault]);

  useEffect(() => {
    if (arrDefault > 0 && !arr) setArr(String(Math.round(arrDefault)));
  }, [arrDefault]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const period: VCPeriod =
      periodType === 'year'
        ? { type: 'year', year: selectedYear }
        : {
            type: 'quarter',
            year: availableQuarters[selectedQuarterIdx]?.year ?? new Date().getFullYear(),
            quarter: availableQuarters[selectedQuarterIdx]?.quarter as 1 | 2 | 3 | 4 ?? 1,
          };
    const mrrValue = parseFloat(mrr) || mrrDefault;
    const arrValue = parseFloat(arr) || arrDefault;
    onGenerate(period, customText, mrrValue, arrValue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-none sm:rounded-xl border-0 sm:border border-border-subtle bg-bg-base p-4 sm:p-6 shadow-2xl h-full sm:h-auto overflow-y-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Generate VC Report
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Period Type Selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Period type
          </label>
          <div className="flex rounded-lg border border-border-subtle overflow-hidden">
            <button
              onClick={() => setPeriodType('year')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                periodType === 'year'
                  ? 'bg-accent text-white'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              }`}
            >
              Full Year
            </button>
            <button
              onClick={() => setPeriodType('quarter')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                periodType === 'quarter'
                  ? 'bg-accent text-white'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              }`}
            >
              Quarter
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            {periodType === 'year' ? 'Year' : 'Quarter'}
          </label>
          {periodType === 'year' ? (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  FY {year}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedQuarterIdx}
              onChange={(e) => setSelectedQuarterIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {availableQuarters.map((q, idx) => (
                <option key={q.label} value={idx}>
                  {q.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* MRR / ARR Manual Inputs */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Current MRR <span className="text-text-muted font-normal">(&euro;)</span>
            </label>
            <input
              type="number"
              value={mrr}
              onChange={(e) => setMrr(e.target.value)}
              placeholder={String(Math.round(mrrDefault))}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Current ARR <span className="text-text-muted font-normal">(&euro;)</span>
            </label>
            <input
              type="number"
              value={arr}
              onChange={(e) => setArr(e.target.value)}
              placeholder={String(Math.round(arrDefault))}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Custom Text */}
        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Add a note <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="e.g. Company update, fundraising status, key milestones..."
            rows={4}
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
