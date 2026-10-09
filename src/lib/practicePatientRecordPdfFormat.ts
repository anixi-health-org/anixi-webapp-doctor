export type PdfFieldRow = { label: string; value: string; fullWidth?: boolean };

export function hasPdfFieldContent(value: string): boolean {
  return value.trim() !== '' && value.trim() !== '—';
}

/** Omit empty optional rows so exports stay compact and clinic-ready. */
export function visiblePdfFields(
  fields: PdfFieldRow[],
  opts?: { keepEmpty?: boolean },
): PdfFieldRow[] {
  if (opts?.keepEmpty) return fields;
  return fields.filter((field) => hasPdfFieldContent(field.value));
}
