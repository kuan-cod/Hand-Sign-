import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  Camera,
  AlertCircle,
} from 'lucide-react';

interface PhotoUploadTranslatorProps {
  onTranslateImage: (base64Image: string) => Promise<void>;
  isTranslating: boolean;
}

export const PhotoUploadTranslator: React.FC<PhotoUploadTranslatorProps> = ({
  onTranslateImage,
  isTranslating,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setErrorMsg('');
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('Image file size is too large (maximum 12MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleTranslateNow = async () => {
    if (!selectedImage || isTranslating) return;
    await onTranslateImage(selectedImage);
  };

  return (
    <div id="photo-upload-panel" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Upload className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-neutral-100">Photo / Image Sign Translation</h3>
        </div>
        {selectedImage && (
          <button
            id="photo-clear-btn"
            onClick={() => {
              setSelectedImage(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-xs text-neutral-400 hover:text-red-400 flex items-center space-x-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Image</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        id="photo-file-input"
      />

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!selectedImage ? (
        <div
          id="photo-drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-400 bg-emerald-500/10'
              : 'border-neutral-700/80 bg-neutral-950/40 hover:border-neutral-600 hover:bg-neutral-950/70'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 flex items-center justify-center text-neutral-400 mb-3">
            <ImageIcon className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-xs font-semibold text-neutral-200">
            Drag and drop a photo of a hand sign here, or <span className="text-emerald-400 underline">browse files</span>
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Supports ASL letters, words, and gesture photos (JPG, PNG, WEBP up to 12MB)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-video max-h-72 w-full rounded-xl overflow-hidden bg-black border border-neutral-800 flex items-center justify-center">
            <img
              src={selectedImage}
              alt="Hand gesture upload preview"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <button
            id="photo-translate-btn"
            onClick={handleTranslateNow}
            disabled={isTranslating}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            {isTranslating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Translating Photo with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Translate This Photo</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
