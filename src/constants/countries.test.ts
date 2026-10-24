import { detectDefaultCountryCode } from './countries';

function withZone(timeZone: string, language: string, run: () => void) {
  const original = Intl.DateTimeFormat;
  const zoneSpy = jest
    .spyOn(Intl, 'DateTimeFormat')
    .mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat,
    );
  const languageSpy = jest.spyOn(navigator, 'language', 'get').mockReturnValue(language);
  try {
    run();
  } finally {
    zoneSpy.mockRestore();
    languageSpy.mockRestore();
    expect(Intl.DateTimeFormat).toBe(original);
  }
}

describe('detectDefaultCountryCode', () => {
  it('trusts the timezone over an en-US browser language', () => {
    withZone('Africa/Johannesburg', 'en-US', () => expect(detectDefaultCountryCode()).toBe('ZA'));
    withZone('Africa/Casablanca', 'en-US', () => expect(detectDefaultCountryCode()).toBe('MA'));
  });

  it('falls back to South Africa for other African zones', () => {
    withZone('Africa/Harare', 'en-US', () => expect(detectDefaultCountryCode()).toBe('ZA'));
  });

  it('uses the browser region when the zone is not one we know', () => {
    withZone('America/Toronto', 'en-CA', () => expect(detectDefaultCountryCode()).toBe('CA'));
  });
});
