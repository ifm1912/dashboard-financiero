'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { ChartDataPoint, MRRMetric, Contract, ContractEvent } from '@/types';
import { formatCurrency, formatMonth } from '@/lib/data';

interface RevenueChartProps {
  data: ChartDataPoint[];
}

interface MRRChartProps {
  data: MRRMetric[];
}

// Design System v2 - Chart colors (Light Mode)
const CHART_COLORS = {
  primary: '#4f46e5',
  primaryMuted: 'rgba(79, 70, 229, 0.08)',
  secondary: '#16a34a',
  secondaryMuted: 'rgba(22, 163, 74, 0.08)',
  tertiary: '#d97706',
  danger: '#dc2626',
  grid: 'rgba(0, 0, 0, 0.06)',
  text: '#64748b',
  tooltipBg: '#ffffff',
};

// Paleta para gráficos de múltiples categorías
const MULTI_COLORS = [
  '#4f46e5', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0d9488',
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border-default bg-chart-tooltip-bg px-3 py-2 shadow-2xl backdrop-blur-sm">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-dimmed">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function RevenueBarChart({ data }: RevenueChartProps) {
  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="month"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.primaryMuted }} />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span className="text-[11px] text-text-muted ml-1">{value}</span>}
            iconSize={8}
          />
          <Bar
            dataKey="recurring"
            name="Recurrente"
            fill={CHART_COLORS.primary}
            radius={[2, 2, 0, 0]}
            stackId="a"
          />
          <Bar
            dataKey="non_recurring"
            name="No Recurrente"
            fill={CHART_COLORS.secondary}
            radius={[2, 2, 0, 0]}
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MRRAreaChart({ data }: MRRChartProps) {
  const formattedData = data.map(d => ({
    ...d,
    month: formatMonth(d.month),
  }));

  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
              <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="month"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="mrr_approx"
            name="MRR"
            stroke={CHART_COLORS.primary}
            strokeWidth={1.5}
            fill="url(#mrrGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueLineChart({ data }: RevenueChartProps) {
  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="month"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span className="text-[11px] text-text-muted ml-1">{value}</span>}
            iconSize={8}
          />
          <Line
            type="monotone"
            dataKey="recurring"
            name="Recurrente"
            stroke={CHART_COLORS.primary}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: CHART_COLORS.primary, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="non_recurring"
            name="No Recurrente"
            stroke={CHART_COLORS.secondary}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: CHART_COLORS.secondary, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// Gráficos de Contratos
// ============================================

interface ContractChartProps {
  contracts: Contract[];
}

interface EventChartProps {
  events: ContractEvent[];
}

interface ARRByClientData {
  name: string;
  arr: number;
}

interface ARRByProductData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface EventImpactData {
  type: string;
  expansion: number;
  cancelacion: number;
}

// Tooltip personalizado para contratos
const ContractTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border-default bg-chart-tooltip-bg px-3 py-2 shadow-2xl backdrop-blur-sm">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-dimmed">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ARR por Cliente (barras horizontales)
export function ARRByClientChart({ contracts }: ContractChartProps) {
  const activeContracts = contracts.filter(c => c.status === 'activo');

  // Agrupar por cliente
  const clientMap = new Map<string, number>();
  activeContracts.forEach(c => {
    const current = clientMap.get(c.client_name) || 0;
    clientMap.set(c.client_name, current + c.current_price_annual);
  });

  const data: ARRByClientData[] = Array.from(clientMap.entries())
    .map(([name, arr]) => ({ name, arr }))
    .sort((a, b) => b.arr - a.arr)
    .slice(0, 10);

  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 80, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={75}
          />
          <Tooltip content={<ContractTooltip />} cursor={{ fill: CHART_COLORS.primaryMuted }} />
          <Bar
            dataKey="arr"
            name="ARR"
            fill={CHART_COLORS.primary}
            radius={[0, 2, 2, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ARR por Producto (donut)
export function ARRByProductChart({ contracts }: ContractChartProps) {
  const activeContracts = contracts.filter(c => c.status === 'activo');

  // Agrupar por producto
  const productMap = new Map<string, number>();
  activeContracts.forEach(c => {
    const current = productMap.get(c.product) || 0;
    productMap.set(c.product, current + c.current_price_annual);
  });

  const data: ARRByProductData[] = Array.from(productMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={MULTI_COLORS[index % MULTI_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              backgroundColor: CHART_COLORS.tooltipBg,
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span className="text-[11px] text-text-muted ml-1">{value}</span>}
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Expansión por Cliente (barras comparando base vs actual)
export function ExpansionByClientChart({ contracts }: ContractChartProps) {
  const activeContracts = contracts.filter(c => c.status === 'activo');

  // Agrupar por cliente
  const clientMap = new Map<string, { base: number; current: number }>();
  activeContracts.forEach(c => {
    const current = clientMap.get(c.client_name) || { base: 0, current: 0 };
    current.base += c.base_arr_eur;
    current.current += c.current_price_annual;
    clientMap.set(c.client_name, current);
  });

  const data = Array.from(clientMap.entries())
    .map(([name, values]) => ({
      name,
      base: values.base,
      expansion: Math.max(0, values.current - values.base),
    }))
    .filter(d => d.expansion > 0)
    .sort((a, b) => b.expansion - a.expansion)
    .slice(0, 8);

  if (data.length === 0) {
    return (
      <div className="flex h-56 sm:h-64 lg:h-80 items-center justify-center text-text-muted">
        Sin expansiones registradas
      </div>
    );
  }

  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="name"
            stroke={CHART_COLORS.text}
            fontSize={9}
            tickLine={false}
            axisLine={false}
            dy={8}
            interval={0}
            angle={-20}
            textAnchor="end"
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<ContractTooltip />} cursor={{ fill: CHART_COLORS.primaryMuted }} />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span className="text-[11px] text-text-muted ml-1">{value}</span>}
            iconSize={8}
          />
          <Bar
            dataKey="base"
            name="ARR Base"
            fill={CHART_COLORS.text}
            radius={[2, 2, 0, 0]}
            stackId="a"
          />
          <Bar
            dataKey="expansion"
            name="Expansión"
            fill={CHART_COLORS.secondary}
            radius={[2, 2, 0, 0]}
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Impacto de Eventos (expansión vs cancelación)
export function EventImpactChart({ events }: EventChartProps) {
  // Agrupar por mes
  const monthMap = new Map<string, { expansion: number; cancelacion: number }>();

  events.forEach(e => {
    const month = e.effective_from.substring(0, 7); // YYYY-MM
    const current = monthMap.get(month) || { expansion: 0, cancelacion: 0 };

    if (e.event_type === 'EXPANSION') {
      current.expansion += e.arr_delta;
    } else if (e.event_type === 'CANCELACIÓN') {
      current.cancelacion += Math.abs(e.arr_delta);
    }

    monthMap.set(month, current);
  });

  const data = Array.from(monthMap.entries())
    .map(([month, values]) => ({
      month: new Date(month + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
      expansion: values.expansion,
      cancelacion: -values.cancelacion, // negativo para mostrar hacia abajo
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (data.length === 0) {
    return (
      <div className="flex h-56 sm:h-64 lg:h-80 items-center justify-center text-text-muted">
        Sin eventos registrados
      </div>
    );
  }

  return (
    <div className="h-56 sm:h-64 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="month"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(Math.abs(value) / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Math.abs(value as number))}
            contentStyle={{
              backgroundColor: CHART_COLORS.tooltipBg,
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span className="text-[11px] text-text-muted ml-1">{value}</span>}
            iconSize={8}
          />
          <Bar
            dataKey="expansion"
            name="Expansión"
            fill={CHART_COLORS.secondary}
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="cancelacion"
            name="Cancelación"
            fill={CHART_COLORS.danger}
            radius={[0, 0, 2, 2]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ARR por Owner (barras)
export function ARRByOwnerChart({ contracts }: ContractChartProps) {
  const activeContracts = contracts.filter(c => c.status === 'activo');

  // Agrupar por owner
  const ownerMap = new Map<string, number>();
  activeContracts.forEach(c => {
    const current = ownerMap.get(c.account_owner) || 0;
    ownerMap.set(c.account_owner, current + c.current_price_annual);
  });

  const data = Array.from(ownerMap.entries())
    .map(([name, arr]) => ({ name, arr }))
    .sort((a, b) => b.arr - a.arr);

  return (
    <div className="h-48 sm:h-56 lg:h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="name"
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<ContractTooltip />} cursor={{ fill: CHART_COLORS.primaryMuted }} />
          <Bar
            dataKey="arr"
            name="ARR"
            fill={CHART_COLORS.tertiary}
            radius={[2, 2, 0, 0]}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={MULTI_COLORS[index % MULTI_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
