'use client';

import { useEffect, useRef, useState } from 'react';
import { Contract, ContractEvent } from '@/types';
import { formatCurrency } from '@/lib/data';

const CLIENT_LOGO_MAP: Record<string, string> = {
  SAM: '/logos/sam.png',
  AIV: '/logos/aiv.png',
  CKB: '/logos/ckb.png',
  AND: '/logos/and.png',
  MY: '/logos/my.png',
  CAS: '/logos/cas.jpg',
  BKT: '/logos/bkt.png',
  IND: '/logos/ind.png',
  CJM: '/logos/cjm.png',
  MTUA: '/logos/mtua.png',
  FDP: '/logos/fdp.png',
  ABC: '/logos/abc.png',
  SKD: '/logos/skd.svg',
  PVR: '/logos/pvr.jpg',
  PRS: '/logos/prs.png',
  SAN: '/logos/san.png',
  SAB: '/logos/sab.png',
};

const AVATAR_COLORS = [
  'bg-accent-muted text-accent',
  'bg-success-muted text-success',
  'bg-warning-muted text-warning',
  'bg-[rgba(220,38,38,0.10)] text-danger',
  'bg-[rgba(37,99,235,0.10)] text-info',
  'bg-[rgba(124,58,237,0.10)] text-[#7c3aed]',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ClientLogo({ clientId, clientName, size = 'md' }: { clientId: string; clientName: string; size?: 'sm' | 'md' }) {
  const [imgError, setImgError] = useState(false);
  const logoSrc = CLIENT_LOGO_MAP[clientId];
  const sizeClass = size === 'md' ? 'w-10 h-10' : 'w-7 h-7';
  const textSize = size === 'md' ? 'text-sm' : 'text-[10px]';

  if (logoSrc && !imgError) {
    return (
      <img
        src={logoSrc}
        alt={clientName}
        className={`${sizeClass} rounded-full object-contain bg-white border border-border-subtle flex-shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }

  const initials = clientId.slice(0, 2).toUpperCase();
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center ${textSize} font-bold flex-shrink-0 ${getAvatarColor(clientId)}`}>
      {initials}
    </div>
  );
}

function normalizeStatus(status: string): string {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getRenewalLabel(endDate: string | null): { text: string; className: string } {
  if (!endDate) return { text: 'Indefinido', className: 'text-text-dimmed italic' };
  const end = new Date(endDate);
  const today = new Date();
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: 'Vencido', className: 'text-danger font-medium' };
  if (diffDays <= 90) return { text: `en ${diffDays} d\u00edas`, className: 'text-warning font-medium' };
  return { text: `en ${diffDays} d\u00edas`, className: 'text-text-muted' };
}

function DetailItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-text-dimmed uppercase tracking-wider">{label}</p>
      <p className={`text-sm mt-0.5 ${className || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  EXPANSION: 'bg-success-muted text-success',
  NEW_BUSINESS: 'bg-accent-muted text-accent',
  'CANCELACI\u00d3N': 'bg-danger-muted text-danger',
  CANCELACION: 'bg-danger-muted text-danger',
  DOWNGRADE: 'bg-warning-muted text-warning',
};

interface ContractDetailDrawerProps {
  contract: Contract;
  events: ContractEvent[];
  onClose: () => void;
}

export function ContractDetailDrawer({ contract, events, onClose }: ContractDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount + Escape key handler
  useEffect(() => {
    closeRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contract.contract_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silently
    }
  };

  const status = normalizeStatus(contract.status);
  const renewal = getRenewalLabel(contract.end_date);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-full sm:max-w-md bg-white shadow-2xl overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de contrato"
      >
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-border-subtle p-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <ClientLogo clientId={contract.client_id} clientName={contract.client_name} size="md" />
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{contract.client_name}</h2>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  status === 'activo'
                    ? 'bg-success-muted text-success'
                    : status === 'inactivo'
                    ? 'bg-danger-muted text-danger'
                    : 'bg-warning-muted text-warning'
                }`}>
                  {status === 'activo' ? 'Activo' : status === 'inactivo' ? 'Inactivo' : 'Negociaci\u00f3n'}
                </span>
              </div>
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              className="p-2 hover:bg-bg-hover rounded-full transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Contract ID + Copy */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-text-muted">{contract.contract_id}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-bg-hover transition-colors"
              aria-label="Copiar ID de contrato"
            >
              {copied ? (
                <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-text-dimmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* Detalles del contrato */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Detalles del contrato
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem label="Producto" value={contract.product} />
              <DetailItem label="Owner" value={contract.account_owner} />
              <DetailItem label="ARR Base" value={contract.base_arr_eur > 0 ? formatCurrency(contract.base_arr_eur) : '--'} />
              <DetailItem label="ARR Actual" value={contract.current_price_annual > 0 ? formatCurrency(contract.current_price_annual) : '--'} className="font-medium" />
              <DetailItem label="MRR" value={contract.current_mrr > 0 ? formatCurrency(contract.current_mrr) : '--'} />
              <DetailItem label="Moneda" value={contract.currency === 'us dollar' ? 'USD' : 'EUR'} />
              <DetailItem label="SetUp" value={contract.set_up > 0 ? formatCurrency(contract.set_up) : '--'} />
              <DetailItem label="Facturaci\u00f3n" value={contract.billing_frequency ? contract.billing_frequency.charAt(0).toUpperCase() + contract.billing_frequency.slice(1) : '--'} />
              <DetailItem label="Inicio" value={formatDate(contract.start_date)} />
              <DetailItem label="Fin" value={contract.end_date ? formatDate(contract.end_date) : 'Indefinido'} />
              <DetailItem label="Renovaci\u00f3n" value={renewal.text} className={renewal.className} />
              <DetailItem label="D\u00edas preaviso" value={contract.notice_days ? `${contract.notice_days} d\u00edas` : '--'} />
            </div>
          </section>

          {/* IPC */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              IPC
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem label="Aplicable" value={contract.ipc_applicable ? 'S\u00ed' : 'No'} className={contract.ipc_applicable ? 'text-success font-medium' : ''} />
              {contract.ipc_applicable && (
                <>
                  <DetailItem label="Frecuencia" value={contract.ipc_frequency || '--'} />
                  <DetailItem label="Mes aplicaci\u00f3n" value={contract.ipc_application_month || '--'} />
                </>
              )}
            </div>
          </section>

          {/* Historial de eventos */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Historial de eventos
            </h3>
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.event_id}
                    className="flex items-start gap-3 py-2 border-b border-border-subtle last:border-0"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        EVENT_TYPE_STYLES[event.event_type] || 'bg-bg-muted text-text-muted'
                      }`}>
                        {event.event_type}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">{event.reason}</p>
                      {event.arr_delta !== 0 && (
                        <p className={`text-xs font-mono ${event.arr_delta > 0 ? 'text-success' : 'text-danger'}`}>
                          {event.arr_delta > 0 ? '+' : ''}{formatCurrency(event.arr_delta)} ARR
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-xs text-text-dimmed mt-0.5">{event.notes}</p>
                      )}
                      <p className="text-[10px] text-text-dimmed mt-1">
                        {new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-dimmed italic">Sin eventos registrados</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
