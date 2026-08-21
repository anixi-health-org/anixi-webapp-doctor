import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { getCroppedImageFile } from '../utils/cropImage';

interface LogoCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (file: File, previewUrl: string) => void;
  title?: string;
  description?: string;
  cropShape?: 'rect' | 'round';
}

export const LogoCropModal: React.FC<LogoCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = 'Crop practice logo',
  description = 'Drag to reposition. Use the slider to zoom.',
  cropShape = 'rect',
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropChange = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(file);
      onCropComplete(file, previewUrl);
      onClose();
    } catch {
      alert('Failed to crop image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>

        <div className="relative w-full h-72 bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={cropShape}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropChange}
          />
        </div>

        <div className="px-4 py-3 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={saving || !croppedAreaPixels}
            className="flex-1 px-4 py-2 bg-[#425950] text-white rounded-lg hover:bg-[#5a6f6a] disabled:opacity-50"
          >
            {saving ? 'Applying…' : 'Apply crop'}
          </button>
        </div>
      </div>
    </div>
  );
};
