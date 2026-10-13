import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Sparkles,
  Play,
  Square,
  Zap,
  RefreshCw,
  Eye,
  AlertCircle,
} from 'lucide-react';

interface CameraViewProps {
  onTranslate: (frameOrFrames: string | string[], isSequence: boolean) => Promise<void>;
  isTranslating: boolean;
  autoTranslate: boolean;
  setAutoTranslate: (val: boolean) => void;
  autoInterval: number;
  setAutoInterval: (val: number) => void;
  handInFrameGuidance?: string;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onTranslate,
  isTranslating,
  autoTranslate,
  setAutoTranslate,
  autoInterval,
  setAutoInterval,
  handInFrameGuidance,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isBursting, setIsBursting] = useState(false);
  const [burstCount, setBurstCount] = useState(0);

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setPermissionError('');

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => console.error('Play error:', err));
      }
    } catch (err: any) {
      console.error('Webcam access error:', err);
      setHasPermission(false);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in browser settings.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device. You can use the Photo Upload tab instead.'
          : 'Failed to access camera: ' + (err.message || 'Unknown error')
      );
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  // Capture current video frame as base64 JPEG
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [isMirrored]);

  // Single frame capture
  const handleSingleCapture = useCallback(async () => {
    if (isTranslating || isBursting) return;
    const frame = captureFrame();
    if (frame) {
      await onTranslate(frame, false);
    }
  }, [captureFrame, isTranslating, isBursting, onTranslate]);

  // Dynamic multi-frame sequence capture (3 frames across 900ms)
  const handleBurstCapture = useCallback(async () => {
    if (isTranslating || isBursting) return;
    setIsBursting(true);
    setBurstCount(0);

    const frames: string[] = [];
    const totalFrames = 3;
    const intervalTime = 320;

    for (let i = 0; i < totalFrames; i++) {
      setBurstCount(i + 1);
      const frame = captureFrame();
      if (frame) frames.push(frame);
      if (i < totalFrames - 1) {
        await new Promise((r) => setTimeout(r, intervalTime));
      }
    }

    setIsBursting(false);
    setBurstCount(0);

    if (frames.length > 0) {
      await onTranslate(frames, true);
    }
  }, [captureFrame, isTranslating, isBursting, onTranslate]);

  // Keyboard shortcut: Spacebar to capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleSingleCapture();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSingleCapture]);

  // Continuous Auto-Translate loop
  useEffect(() => {
    if (!autoTranslate || !stream) return;

    const intervalId = setInterval(() => {
      if (!isTranslating && !isBursting) {
        const frame = captureFrame();
        if (frame) {
          onTranslate(frame, false);
        }
      }
    }, autoInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoTranslate, autoInterval, stream, isTranslating, isBursting, captureFrame, onTranslate]);

  return (
    <div id="camera-view-container" className="relative flex flex-col bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Viewport header toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/60 backdrop-blur text-xs">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasPermission ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${hasPermission ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          </span>
          <span className="font-semibold text-neutral-200">Live Camera Feed</span>
          {autoTranslate && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium animate-pulse">
              Auto-Scanning ({autoInterval}s)
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Mirror toggle */}
          <button
            id="camera-mirror-toggle-btn"
            onClick={() => setIsMirrored((prev) => !prev)}
            title="Mirror video feed"
            className={`p-1.5 rounded-lg border transition-all ${
              isMirrored
                ? 'bg-neutral-800 border-neutral-700 text-neutral-200'
                : 'bg-transparent border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Switch front/back camera */}
          <button
            id="camera-switch-facing-btn"
            onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
            title="Switch front/rear camera"
            className="p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {hasPermission === false ? (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
            <CameraOff className="w-12 h-12 text-neutral-500 mb-3" />
            <p className="text-sm font-semibold text-neutral-300 mb-1">Camera Unavailable</p>
            <p className="text-xs text-neutral-400 mb-4">{permissionError}</p>
            <button
              id="camera-retry-permission-btn"
              onClick={startCamera}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Permission</span>
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
            />

            {/* Gesture Targeting HUD overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Hand framing guides */}
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 border-2 border-dashed border-emerald-500/40 rounded-3xl flex items-center justify-center">
                {/* Corner reticles */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-xl" />

                {/* Subtle center crosshair */}
                <div className="w-4 h-4 border border-emerald-500/30 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-emerald-400/60 rounded-full" />
                </div>

                {/* Scanning line animation when translating or auto-scanning */}
                {(isTranslating || isBursting) && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-bounce" />
                )}

                {/* Frame hint text */}
                <div className="absolute -bottom-7 px-3 py-1 bg-neutral-950/80 backdrop-blur rounded-full border border-neutral-800 text-[11px] text-neutral-300 font-medium">
                  {isBursting
                    ? `Recording Gesture... Frame ${burstCount} of 3`
                    : isTranslating
                    ? 'Analyzing Hand Sign...'
                    : handInFrameGuidance || 'Position hand sign inside frame'}
                </div>
              </div>
            </div>

            {/* Multi-frame burst overlay banner */}
            {isBursting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-500/90 text-black text-xs font-bold rounded-full shadow-lg flex items-center space-x-2 animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                <span>Capturing Motion Sequence ({burstCount}/3)</span>
              </div>
            )}

            {/* Translating indicator overlay */}
            {isTranslating && !isBursting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-emerald-500/90 text-white text-xs font-semibold rounded-full shadow-lg flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Translating with Gemini AI...</span>
              </div>
            )}
          </>
        )}

        {/* Hidden canvas for snapshotting */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Camera Control Footer */}
      <div className="p-4 bg-neutral-950/90 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Quick capture buttons */}
        <div className="flex items-center space-x-2">
          <button
            id="camera-snap-translate-btn"
            onClick={handleSingleCapture}
            disabled={!hasPermission || isTranslating || isBursting}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center space-x-2 transition-all active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Translate Sign</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-emerald-700/60 rounded text-emerald-100">Space</kbd>
          </button>

          <button
            id="camera-dynamic-burst-btn"
            onClick={handleBurstCapture}
            disabled={!hasPermission || isTranslating || isBursting}
            title="Captures 3 rapid frames to recognize moving gestures like Wave, Thank You, Please"
            className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-xl border border-neutral-700 flex items-center space-x-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Dynamic Gesture</span>
          </button>
        </div>

        {/* Right: Auto-translate toggle & speed */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
            <span className="text-neutral-400">Auto</span>
            <button
              id="camera-auto-toggle-btn"
              onClick={() => setAutoTranslate(!autoTranslate)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                autoTranslate ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  autoTranslate ? 'left-5' : 'left-1'
                }`}
              />
            </button>

            {autoTranslate && (
              <select
                id="camera-auto-interval-select"
                value={autoInterval}
                onChange={(e) => setAutoInterval(Number(e.target.value))}
                className="bg-neutral-800 text-neutral-200 rounded px-1.5 py-0.5 text-[11px] border border-neutral-700 outline-none"
              >
                <option value={1.5}>1.5s</option>
                <option value={2}>2.0s</option>
                <option value={3}>3.0s</option>
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
