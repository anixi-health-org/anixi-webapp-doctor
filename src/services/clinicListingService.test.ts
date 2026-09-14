import { mapPublicClinicRow } from './clinicListingService';

describe('mapPublicClinicRow', () => {
  it('maps Django public clinic payloads', () => {
    const listing = mapPublicClinicRow({
      id: 'p1',
      name: 'Cape Heart',
      slug: 'cape-heart',
      tagline: 'Cardiac care',
      city: 'Cape Town',
      province: 'Western Cape',
      services: ['ECG'],
      acceptsMedicalAid: true,
      logoUrl: 'https://cdn.example/logo.png',
      bhfPracticeNumber: 'BHF-99',
    });
    expect(listing).toMatchObject({
      id: 'p1',
      name: 'Cape Heart',
      slug: 'cape-heart',
      acceptsMedicalAid: true,
      logoUrl: 'https://cdn.example/logo.png',
      bhfPracticeNumber: 'BHF-99',
      services: ['ECG'],
    });
  });
});
