import { parsePatientBulkCsv } from './bulkPatientImportService';

describe('parsePatientBulkCsv', () => {
  it('maps GoodX-style Patient Last/First Name columns into a full display name', () => {
    const csv = [
      'Patient General,Patient Last Name,Patient First Name,Patient Middle Name,Patient Birth Date,Patient Age,Patient Gender,Chart ID,Patient ID',
      ',SAGEN,Mary,Ann,10/03/1919,106,Female,000-00-0045-1,45',
      ',FERNEYHOUGH,John,,08/16/1935,90,Male,000-00-0046-1,46',
    ].join('\n');

    const parsed = parsePatientBulkCsv(csv);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      displayName: 'Mary Ann SAGEN',
      firstName: 'Mary',
      lastName: 'SAGEN',
      middleName: 'Ann',
      dateOfBirth: '10/03/1919',
      gender: 'Female',
      chartId: '000-00-0045-1',
      patientExternalId: '45',
    });
    expect(parsed.rows[1].displayName).toBe('John FERNEYHOUGH');
  });

  it('does not treat last_name as a full-name column', () => {
    const csv = 'last_name,first_name,chart_id\nMolefe,Thabo,CHT-1\n';
    const parsed = parsePatientBulkCsv(csv);
    expect(parsed.rows[0].displayName).toBe('Thabo Molefe');
  });

  it('skips rows with no name parts', () => {
    const csv = [
      'Patient Last Name,Patient First Name,Chart ID',
      ',,000-00-0001-1',
    ].join('\n');
    const parsed = parsePatientBulkCsv(csv);
    expect(parsed.rows).toEqual([]);
    expect(parsed.issues[0].message).toMatch(/Missing patient name/);
  });
});
