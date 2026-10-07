import type { UnichartBatchApplyResult } from '../services/djangoApiService';

export function formatUnichartBatchApplySummary(
  summary: UnichartBatchApplyResult,
  fileName: string,
): string {
  const updated = summary.applied ?? 0;
  const created = summary.created ?? 0;
  const lines = [
    `✅ Finished OCR and backfill from **${fileName}**.`,
    `- **${summary.totalCharts}** chart section(s) in the PDF`,
    `- **${updated}** existing patient(s) updated (empty fields only)`,
    ...(created > 0 ? [`- **${created}** new roster patient(s) created and filled`] : []),
    `- **${summary.alreadyApplied}** already had this chart`,
    `- **${summary.unmatched}** could not match (and were not added)`,
  ];
  if (summary.ambiguous > 0) {
    lines.push(`- **${summary.ambiguous}** ambiguous (multiple roster matches)`);
  }
  if (summary.failed > 0) {
    lines.push(`- **${summary.failed}** failed to apply`);
  }
  const appliedRows = summary.results.filter((row) => row.status === 'applied').slice(0, 5);
  if (appliedRows.length > 0) {
    lines.push('');
    lines.push('Updated:');
    for (const row of appliedRows) {
      const fields = (row.filled ?? []).join(', ') || 'chart data';
      lines.push(`- **${row.patientName}**: ${fields}`);
    }
    if (summary.applied > appliedRows.length) {
      lines.push(`- …and ${summary.applied - appliedRows.length} more`);
    }
  }
  if (summary.applied === 0 && summary.totalCharts === 1 && summary.unmatched === 1) {
    lines.push('');
    lines.push(
      'This PDF looks like one UniCharts chart that did not match anyone on your roster (check name and date of birth).',
    );
  }
  return lines.join('\n');
}
