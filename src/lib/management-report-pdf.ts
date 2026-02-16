export async function generateManagementReport(customNote: string): Promise<void> {
  // Dynamic imports for code splitting — only loads when user clicks the button
  const [{ collectManagementReportData }, { renderManagementReport }] = await Promise.all([
    import('./management-report-data'),
    import('./management-report-renderer'),
  ]);

  const data = await collectManagementReportData(customNote);
  const doc = renderManagementReport(data);

  const now = new Date();
  const filename = `management_report_${now.toISOString().slice(0, 7)}.pdf`;
  doc.save(filename);
}
