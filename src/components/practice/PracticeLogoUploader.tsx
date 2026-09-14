import React, { useEffect, useRef, useState } from 'react';
import { LogoCropModal } from '../LogoCropModal';
import { useAuth } from '../../hooks/useAuth';
import {
  ACCEPTED_IMAGE_INPUT,
  describeImageUploadError,
  normalizeImageFile,
  shouldSkipCrop,
  validateImageFile,
} from '../../lib/imageUpload';
import { uploadPracticeLogo } from '../../services/doctorService';
import {
  djangoPatchPractice,
  djangoResolveMediaUrl,
  djangoUploadDocument,
} from '../../services/djangoApiService';

export const PRACTICE_LOGO_INPUT_ID = 'practice-logo-file-input';

type PracticeLogoUploaderProps = {
  logoUrl?: string | null;
  practiceId?: string;
  onUploaded?: (logoUrl: string) => void;
  /** Hide the inner title when the parent already labels this block. */
  embedded?: boolean;
};

export const PracticeLogoUploader: React.FC<PracticeLogoUploaderProps> = ({
  logoUrl,
  practiceId,
  onUploaded,
  embedded = false,
}) => {
  const { user, refreshUser, refreshPracticeSession } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOriginalFile, setPendingOriginalFile] = useState<File | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const source = logoUrl?.trim() || '';
    if (!source) {
      setPreviewUrl('');
      setBroken(false);
      return undefined;
    }
    if (source.startsWith('blob:') || source.startsWith('data:')) {
      setPreviewUrl(source);
      setBroken(false);
      return undefined;
    }
    void djangoResolveMediaUrl(source).then((resolved) => {
      if (cancelled) return;
      setPreviewUrl(resolved || source);
      setBroken(false);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const currentLogo = previewUrl || '';

  const openPicker = () => inputRef.current?.click();

  const handleCropped = async (file: File, nextPreview: string) => {
    if (!user?.id) {
      setError('Sign in to upload a logo.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      let uploadedUrl: string;
      if (practiceId) {
        const uploaded = await djangoUploadDocument(file, 'practice-logo', 'logo.jpg');
        await djangoPatchPractice(practiceId, { logoUrl: uploaded.storageKey });
        uploadedUrl = (await djangoResolveMediaUrl(uploaded.url)) ?? uploaded.url;
        await refreshPracticeSession();
      } else {
        uploadedUrl = await uploadPracticeLogo(user.id, file);
        await refreshUser();
      }
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(uploadedUrl);
      setBroken(false);
      URL.revokeObjectURL(nextPreview);
      onUploaded?.(uploadedUrl);
    } catch (err) {
      console.error('[PracticeLogoUploader] upload failed:', err);
      setError(describeImageUploadError(err, 'logo'));
      URL.revokeObjectURL(nextPreview);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#e1e7ef] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e1e7ef] bg-[#f8fafc]">
            {currentLogo && !broken ? (
              <img
                src={currentLogo}
                alt="Clinic letterhead logo"
                className="h-full w-full object-contain p-1"
                onError={() => setBroken(true)}
              />
            ) : (
              <span className="px-1 text-center text-[10px] leading-tight text-[#94a3b8]">
                {broken ? 'Logo not loading' : 'No logo'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            {embedded ? null : (
              <p className="text-sm font-semibold text-[#0E2340]">Letterhead & logo</p>
            )}
            <p className={`text-[13px] text-[#65758b] ${embedded ? '' : 'mt-0.5'}`}>
              PNG or JPG, used on invoices, prescriptions, and letters.
            </p>
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
            {broken && currentLogo ? (
              <p className="mt-1 text-xs text-amber-800">
                The stored file could not be displayed. Upload the logo again.
              </p>
            ) : null}
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
          accept={ACCEPTED_IMAGE_INPUT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (!file) return;
            const validationError = validateImageFile(file);
            if (validationError) {
              setError(validationError);
              return;
            }
            setError(null);
            setPendingOriginalFile(file);
            if (shouldSkipCrop(file)) {
              void (async () => {
                const prepared = await normalizeImageFile(file, 'practice-logo.jpg');
                await handleCropped(prepared, URL.createObjectURL(prepared));
              })();
              return;
            }
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
            setPendingOriginalFile(null);
          }}
          onUseOriginal={
            pendingOriginalFile
              ? () => {
                  const original = pendingOriginalFile;
                  setCropOpen(false);
                  if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
                  setCropImageSrc(null);
                  setPendingOriginalFile(null);
                  void (async () => {
                    const prepared = await normalizeImageFile(original, 'practice-logo.jpg');
                    await handleCropped(prepared, URL.createObjectURL(prepared));
                  })();
                }
              : undefined
          }
          onCropComplete={(file, preview) => {
            setCropOpen(false);
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
            setPendingOriginalFile(null);
            void handleCropped(file, preview);
          }}
        />
      ) : null}
    </div>
  );
};
