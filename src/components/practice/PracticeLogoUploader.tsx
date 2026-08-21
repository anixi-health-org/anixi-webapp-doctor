import React, { useRef, useState } from 'react';
import { LogoCropModal } from '../LogoCropModal';
import { useAuth } from '../../hooks/useAuth';
import { uploadPracticeLogo } from '../../services/doctorService';

export const PRACTICE_LOGO_INPUT_ID = 'practice-logo-file-input';

type PracticeLogoUploaderProps = {
  logoUrl?: string | null;
  onUploaded?: (logoUrl: string) => void;
};

export const PracticeLogoUploader: React.FC<PracticeLogoUploaderProps> = ({
  logoUrl,
  onUploaded,
}) => {
  const { user, refreshUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(logoUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLogo = previewUrl || logoUrl || '';

  const openPicker = () => inputRef.current?.click();

  const handleCropped = async (file: File, nextPreview: string) => {
    if (!user?.id) {
      setError('Sign in to upload a logo.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploadedUrl = await uploadPracticeLogo(user.id, file);
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(uploadedUrl);
      URL.revokeObjectURL(nextPreview);
      await refreshUser();
      onUploaded?.(uploadedUrl);
    } catch (err) {
      console.error('[PracticeLogoUploader] upload failed:', err);
      setError('Could not upload the logo. Please try a PNG or JPG under 5 MB.');
      URL.revokeObjectURL(nextPreview);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#e1e7ef] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e1e7ef] bg-[#f8fafc]">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="Practice logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="px-1 text-center text-[10px] text-[#94a3b8]">No logo</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0E2340]">Letterhead & logo</p>
            <p className="mt-0.5 text-[13px] text-[#65758b]">
              Used on invoices, prescriptions, and doctor letters.
            </p>
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading || !user?.id}
          className="inline-flex h-9 items-center rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-3.5 text-xs font-semibold text-[#344256] shadow-sm transition hover:border-anixi-green hover:text-anixi-green disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : currentLogo ? 'Update logo' : 'Upload logo'}
        </button>
        <input
          id={PRACTICE_LOGO_INPUT_ID}
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (!file) return;
            const src = URL.createObjectURL(file);
            setCropImageSrc(src);
            setCropOpen(true);
          }}
        />
      </div>

      {cropImageSrc ? (
        <LogoCropModal
          isOpen={cropOpen}
          imageSrc={cropImageSrc}
          onClose={() => {
            setCropOpen(false);
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
          onCropComplete={(file, preview) => {
            setCropOpen(false);
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
            void handleCropped(file, preview);
          }}
        />
      ) : null}
    </div>
  );
};
