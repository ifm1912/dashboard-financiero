/**
 * Entry point for generating custom block-based PDF reports.
 * Uses dynamic imports for code splitting.
 */

import { ReportBlock } from './pdf-blocks';

export async function generateBlockReport(
  customNote: string,
  blocks: ReportBlock[]
): Promise<void> {
  const [{ collectBlockReportData }, { renderBlockReport }] = await Promise.all([
    import('./pdf-block-data'),
    import('./pdf-block-renderer'),
  ]);

  const data = await collectBlockReportData(customNote);
  const doc = renderBlockReport(data, blocks, {
    title: 'GPTadvisor — Custom Report',
    subtitle: data.reportMonth,
  });

  const filename = `custom_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
