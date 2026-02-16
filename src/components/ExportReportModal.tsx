'use client';

import { useState, useEffect, useMemo } from 'react';
import { VCPeriod, VCPeriodType } from '@/types';
import { ReportBlock, ALL_BLOCKS, PRESET_BLOCKS, BLOCK_LABELS, estimatePages } from '@/lib/pdf-blocks';

export type ReportPreset = 'investors' | 'management' | 'full';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (preset: ReportPreset, options: ReportOptions) => void;
  // For Investors Report period selector
  availableYears: number[];
  availableQuarters: { year: number; quarter: number; label: string }[];
  mrrDefault: number;
  arrDefault: number;
  generating: boolean;
}

export interface ReportOptions {
  // Investors-specific
  period?: VCPeriod;
  manualMRR?: number;
  manualARR?: number;
  // Shared
  customNote: string;
  // Custom blocks (Fase 2)
  blocks?: ReportBlock[];
}

const PRESETS: {
  id: ReportPreset;
  title: string;
  subtitle: string;
  pages: string;
  icon: string;
  description: string;
}[] = [
  {
    id: 'investors',
    title: 'Investors Report',
    subtitle: 'Para inversores',
    pages: '2 pgs',
    icon: '📊',
    description: 'Revenue, Clients, Pipeline, Cash & Financing',
  },
  {
    id: 'management',
    title: 'Management Report',
    subtitle: 'Para el equipo',
    pages: '2-3 pgs',
    icon: '📋',
    description: 'Revenue, Clients, Usage, Cash, Expenses & Efficiency',
  },
  {
    id: 'full',
    title: 'Full Report',
    subtitle: 'Informe completo',
    pages: '4 pgs',
    icon: '📑',
    description: 'Todas las secciones: Revenue, Growth, Cash Flow, Contracts',
  },
];

export function ExportReportModal({
  isOpen,
  onClose,
  onGenerate,
  availableYears,
  availableQuarters,
  mrrDefault,
  arrDefault,
  generating,
}: ExportReportModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<ReportPreset>('investors');
  const [customNote, setCustomNote] = useState('');

  // Investors-specific state
  const [periodType, setPeriodType] = useState<VCPeriodType>('year');
  const [selectedYear, setSelectedYear] = useState(
    availableYears.length > 0 ? availableYears[0] : new Date().getFullYear()
  );
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(0);
  const [mrr, setMrr] = useState<string>('');
  const [arr, setArr] = useState<string>('');

  // Customization state (Fase 2)
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<ReportBlock>>(
    new Set(PRESET_BLOCKS['investors'])
  );
  const [isCustomized, setIsCustomized] = useState(false);

  // Sync blocks when preset changes
  useEffect(() => {
    const presetBlocks = PRESET_BLOCKS[selectedPreset];
    setSelectedBlocks(new Set(presetBlocks));
    setIsCustomized(false);
  }, [selectedPreset]);

  // Check if blocks differ from preset
  const blocksMatchPreset = useMemo(() => {
    const presetBlocks = PRESET_BLOCKS[selectedPreset];
    if (selectedBlocks.size !== presetBlocks.length) return false;
    return presetBlocks.every(b => selectedBlocks.has(b));
  }, [selectedPreset, selectedBlocks]);

  const pageEstimate = useMemo(() => {
    const blocks = ALL_BLOCKS.filter(b => selectedBlocks.has(b));
    return estimatePages(blocks);
  }, [selectedBlocks]);

  if (!isOpen) return null;

  const toggleBlock = (block: ReportBlock) => {
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(block)) {
        next.delete(block);
      } else {
        next.add(block);
      }
      return next;
    });
    setIsCustomized(true);
  };

  const handleGenerate = () => {
    const options: ReportOptions = {
      customNote,
    };

    // If user has customized blocks, pass them
    if (isCustomized && !blocksMatchPreset) {
      options.blocks = ALL_BLOCKS.filter(b => selectedBlocks.has(b));
    }

    if (selectedPreset === 'investors' && !options.blocks) {
      options.period =
        periodType === 'year'
          ? { type: 'year', year: selectedYear }
          : {
              type: 'quarter',
              year: availableQuarters[selectedQuarterIdx]?.year ?? new Date().getFullYear(),
              quarter: (availableQuarters[selectedQuarterIdx]?.quarter as 1 | 2 | 3 | 4) ?? 1,
            };
      options.manualMRR = parseFloat(mrr) || mrrDefault;
      options.manualARR = parseFloat(arr) || arrDefault;
    }

    onGenerate(selectedPreset, options);
  };

  const selectedCount = selectedBlocks.size;
  const canGenerate = selectedCount >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-none sm:rounded-xl border-0 sm:border border-border-subtle bg-bg-base p-4 sm:p-6 shadow-2xl h-full sm:h-auto overflow-y-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Exportar informe PDF
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preset Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              className={`relative rounded-lg border p-3 text-left transition-all ${
                selectedPreset === preset.id
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                  : 'border-border-subtle bg-bg-surface hover:border-accent/30 hover:bg-bg-hover'
              }`}
            >
              <div className="text-xl mb-1.5">{preset.icon}</div>
              <div className="text-xs sm:text-sm font-semibold text-text-primary leading-tight">
                {preset.title}
              </div>
              <div className="text-[10px] text-text-dimmed mt-0.5">{preset.pages}</div>
              {selectedPreset === preset.id && (
                <div className="absolute top-2 right-2">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preset description */}
        <div className="mb-4 rounded-lg bg-bg-muted/50 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {PRESETS.find(p => p.id === selectedPreset)?.description}
          </p>
          {isCustomized && !blocksMatchPreset && (
            <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              Custom
            </span>
          )}
        </div>

        {/* Customization Panel (Fase 2) */}
        <div className="mb-4 rounded-lg border border-border-subtle overflow-hidden">
          <button
            onClick={() => setCustomizeOpen(!customizeOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-bg-surface hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`h-3.5 w-3.5 text-text-muted transition-transform ${customizeOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs font-medium text-text-secondary">Personalizar bloques</span>
            </div>
            <span className="text-[10px] text-text-dimmed">
              {selectedCount} bloques · ~{pageEstimate} {pageEstimate === 1 ? 'página' : 'páginas'}
            </span>
          </button>

          {customizeOpen && (
            <div className="border-t border-border-subtle bg-bg-base px-3 py-2.5 space-y-1.5">
              {ALL_BLOCKS.map((block) => (
                <label
                  key={block}
                  className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-bg-hover/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedBlocks.has(block)}
                    onChange={() => toggleBlock(block)}
                    className="h-3.5 w-3.5 rounded border-border-subtle text-accent focus:ring-accent/30 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-text-secondary select-none">
                    {BLOCK_LABELS[block]}
                  </span>
                </label>
              ))}

              {/* Reset link */}
              {isCustomized && !blocksMatchPreset && (
                <button
                  onClick={() => {
                    setSelectedBlocks(new Set(PRESET_BLOCKS[selectedPreset]));
                    setIsCustomized(false);
                  }}
                  className="mt-1 text-[10px] text-accent hover:underline"
                >
                  Restaurar preset {selectedPreset}
                </button>
              )}

              {/* Minimum warning */}
              {!canGenerate && (
                <p className="text-[10px] text-danger mt-1">
                  Selecciona al menos 2 bloques para generar el informe.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Investors-specific options */}
        {selectedPreset === 'investors' && !(isCustomized && !blocksMatchPreset) && (
          <div className="mb-4 space-y-3 rounded-lg border border-border-subtle bg-bg-surface p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dimmed">
              Opciones del informe
            </p>

            {/* Period Type Selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Period type
              </label>
              <div className="flex rounded-lg border border-border-subtle overflow-hidden">
                <button
                  onClick={() => setPeriodType('year')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    periodType === 'year'
                      ? 'bg-accent text-white'
                      : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  Full Year
                </button>
                <button
                  onClick={() => setPeriodType('quarter')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                {periodType === 'year' ? 'Year' : 'Quarter'}
              </label>
              {periodType === 'year' ? (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                  className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  MRR <span className="text-text-muted font-normal">(&euro;)</span>
                </label>
                <input
                  type="number"
                  value={mrr}
                  onChange={(e) => setMrr(e.target.value)}
                  placeholder={String(Math.round(mrrDefault))}
                  className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  ARR <span className="text-text-muted font-normal">(&euro;)</span>
                </label>
                <input
                  type="number"
                  value={arr}
                  onChange={(e) => setArr(e.target.value)}
                  placeholder={String(Math.round(arrDefault))}
                  className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Custom Note (all presets) */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Nota personalizada <span className="text-text-muted font-normal">(opcional)</span>
          </label>
          <textarea
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="p.ej. Hitos clave, notas para el equipo..."
            rows={3}
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
