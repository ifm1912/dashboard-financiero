import { VCPeriod } from '@/types';

export async function generateVCReport(
  period: VCPeriod,
  customText: string,
  manualMRR: number,
  manualARR: number
): Promise<void> {
  const [{ collectVCReportData }, { renderVCReport }] = await Promise.all([
    import('./vc-report-data'),
    import('./vc-report-renderer'),
  ]);

  const data = await collectVCReportData(period, customText, manualMRR, manualARR);
  const doc = renderVCReport(data);

  const periodStr =
    period.type === 'year'
      ? `FY${period.year}`
      : `Q${period.quarter}_${period.year}`;
  const filename = `vc_report_${periodStr}.pdf`;
  doc.save(filename);
}
