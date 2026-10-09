/** Per-clinic VAT & banking for SA invoice PDFs (see docs/prescription & invoice templates/). */
export type PracticeBillingProfile = {
  vatNumber?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  accountType?: string;
  branchName?: string;
  swiftCode?: string;
  branchCode?: string;
};

export function normalizeBillingProfile(raw: unknown): PracticeBillingProfile {
  if (!raw || typeof raw !== 'object') return {};
  const row = raw as Record<string, unknown>;
  const pick = (key: keyof PracticeBillingProfile) => {
    const v = row[key];
    return typeof v === 'string' ? v.trim() : '';
  };
  return {
    vatNumber: pick('vatNumber') || undefined,
    bankName: pick('bankName') || undefined,
    accountHolder: pick('accountHolder') || undefined,
    accountNumber: pick('accountNumber') || undefined,
    accountType: pick('accountType') || undefined,
    branchName: pick('branchName') || undefined,
    swiftCode: pick('swiftCode') || undefined,
    branchCode: pick('branchCode') || undefined,
  };
}

export function formatBankingDetailsBlock(profile: PracticeBillingProfile): string {
  const lines: string[] = [];
  if (profile.bankName) lines.push(`BANK: ${profile.bankName}`);
  if (profile.accountHolder) lines.push(`ACCOUNT HOLDER: ${profile.accountHolder}`);
  if (profile.accountNumber) lines.push(`ACCOUNT NO: ${profile.accountNumber}`);
  if (profile.accountType) lines.push(`ACCOUNT TYPE: ${profile.accountType}`);
  if (profile.branchName) lines.push(`BRANCH NAME: ${profile.branchName}`);
  if (profile.swiftCode) lines.push(`SWIFT/BIC CODE: ${profile.swiftCode}`);
  if (profile.branchCode) lines.push(`BRANCH CODE: ${profile.branchCode}`);
  return lines.join('\n');
}

export function bankingDetailsNoteFromProfile(profile: PracticeBillingProfile): string | undefined {
  const block = formatBankingDetailsBlock(profile);
  return block ? `OUR BANKING DETAILS\n${block}` : undefined;
}
