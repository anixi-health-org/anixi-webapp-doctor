import {
  formatSaClinicLineDetails,
  resolveSaClinicIcd10Cell,
} from './saClinicDocumentPdf';
import type { Invoice, InvoiceLineItem } from '../types';

describe('saClinicDocumentPdf formatters', () => {
  it('formats tariff lines like the clinic sample', () => {
    const item: InvoiceLineItem = {
      description: 'Consultation/visit',
      quantity: 1,
      amount: 1240,
      procedureCode: '0190',
    };
    expect(formatSaClinicLineDetails(item)).toBe('0190 Consultation/visit');
  });

  it('defaults consultation lines to 0190 when code missing', () => {
    expect(
      formatSaClinicLineDetails({
        description: 'Consultation',
        quantity: 1,
        amount: 100,
      }),
    ).toBe('0190 Consultation/visit');
  });

  it('prefers line ICD-10 then invoice diagnosis list', () => {
    const invoice = { diagnosisCodes: ['I10'] } as Invoice;
    expect(
      resolveSaClinicIcd10Cell(
        { description: 'x', quantity: 1, amount: 1, icd10Code: 'E11' },
        invoice,
      ),
    ).toBe('E11');
    expect(
      resolveSaClinicIcd10Cell({ description: 'x', quantity: 1, amount: 1 }, invoice),
    ).toBe('I10');
  });
});
