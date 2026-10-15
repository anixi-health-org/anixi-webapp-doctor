import {
  encodeMediaStorageKey,
  extractMediaStorageKey,
  isDirectBrowserMediaUrl,
} from './mediaUrls';

describe('mediaUrls', () => {
  it('encodes path segments without collapsing slashes', () => {
    expect(encodeMediaStorageKey('doctor-logos/abc-123/logo.jpg')).toBe(
      'doctor-logos/abc-123/logo.jpg',
    );
    expect(encodeMediaStorageKey('doctor-logos/a b/logo.jpg')).toBe(
      'doctor-logos/a%20b/logo.jpg',
    );
  });

  it('extracts a storage key from an API media URL', () => {
    expect(
      extractMediaStorageKey(
        'https://api.anixihealth.com/api/v1/documents/media/doctor-logos/abc/logo.jpg/?access=token',
      ),
    ).toBe('doctor-logos/abc/logo.jpg');
  });

  it('treats a bare storage key as a storage key', () => {
    expect(extractMediaStorageKey('doctor-logos/abc/logo.jpg')).toBe(
      'doctor-logos/abc/logo.jpg',
    );
  });

  it('leaves public CDN URLs alone', () => {
    expect(isDirectBrowserMediaUrl('https://cdn.example/afrimed.png')).toBe(true);
    expect(
      isDirectBrowserMediaUrl(
        'https://api.anixihealth.com/api/v1/documents/media/doctor-logos/abc/logo.jpg/',
      ),
    ).toBe(false);
    expect(extractMediaStorageKey('https://cdn.example/afrimed.png')).toBeUndefined();
  });
});
