export async function generateExecutiveReport(): Promise<void> {
  // Dynamic imports for code splitting — only loads when user clicks the button
  const [{ collectReportData }, { renderExecutiveReport }] = await Promise.all([
    import('./report-data'),
    import('./pdf-renderer'),
  ]);

  const data = await collectReportData();
  const doc = renderExecutiveReport(data);

  const now = new Date();
  const filename = `informe_ejecutivo_${now.toISOString().slice(0, 7)}.pdf`;
  doc.save(filename);
}
