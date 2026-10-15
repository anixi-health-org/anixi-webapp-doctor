import { clinicianDisplayName, clinicianGivenName, clinicianHeaderLabel } from './clinicianName';

describe('clinicianName', () => {
  it('does not prefix Dr when the stored name already has a title', () => {
    expect(clinicianDisplayName('Dr Jarjusey')).toBe('Dr Jarjusey');
    expect(clinicianHeaderLabel('Dr Jarjusey')).toBe('Dr. Jarjusey');
    expect(clinicianGivenName('Dr. Jarjusey')).toBe('Jarjusey');
  });

  it('adds a title only when the stored name has none', () => {
    expect(clinicianHeaderLabel('Jarjusey')).toBe('Dr. Jarjusey');
    expect(clinicianDisplayName('Amina Fall')).toBe('Dr. Amina Fall');
  });

  it('does not manufacture Dr. Dr from a title-only first token', () => {
    expect(clinicianHeaderLabel('Dr')).toBe('Doctor');
    expect(clinicianHeaderLabel('Dr.')).toBe('Doctor');
  });
});
