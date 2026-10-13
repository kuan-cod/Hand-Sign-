import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Sparkles,
  Zap,
  RefreshCw,
  Eye,
  EyeOff,
  Users,
  UserCheck,
  Target,
  Maximize2,
  Scan,
  Sliders,
  Check,
  Play,
  Upload,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { TrackedPerson, TrackingMode, FramingTightness } from '../types';
import { PersonTrackerEngine, ViewportTransform } from '../utils/personTracker';
import { DEMO_GESTURES, DemoSignerStream, DemoGestureType } from '../utils/demoCamera';

interface CameraViewProps {
  onTranslate: (frameOrFrames: string | string[], isSequence: boolean) => Promise<void>;
  isTranslating: boolean;
  autoTranslate: boolean;
  setAutoTranslate: (val: boolean) => void;
  autoInterval: number;
  setAutoInterval: (val: number) => void;
  handInFrameGuidance?: string;
  onSwitchToUpload?: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onTranslate,
  isTranslating,
  autoTranslate,
  setAutoTranslate,
  autoInterval,
  setAutoInterval,
  handInFrameGuidance,
  onSwitchToUpload,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<PersonTrackerEngine>(new PersonTrackerEngine());
  const demoStreamRef = useRef<DemoSignerStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isBursting, setIsBursting] = useState(false);
  const [burstCount, setBurstCount] = useState(0);

  // Virtual Demo Mode (for when physical webcam is blocked, unavailable, or denied)
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoGesture, setDemoGesture] = useState<DemoGestureType>('wave');

  // Person Tracking States
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('auto');
  const [framingTightness, setFramingTightness] = useState<FramingTightness>('balanced');
  const [trackedPeople, setTrackedPeople] = useState<TrackedPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
    centerX: 0.5,
    centerY: 0.5,
  });
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [isScanningRoom, setIsScanningRoom] = useState(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [cropForTranslation, setCropForTranslation] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Keep tracker engine parameters in sync
  useEffect(() => {
    trackerRef.current.trackingMode = trackingMode;
    trackerRef.current.tightness = framingTightness;
    trackerRef.current.selectedPersonId = selectedPersonId;
  }, [trackingMode, framingTightness, selectedPersonId]);

  // Start virtual simulated demo camera
  const startDemoCamera = useCallback((gesture: DemoGestureType = 'wave') => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (demoStreamRef.current) {
      demoStreamRef.current.stop();
    }

    const demo = new DemoSignerStream();
    demo.setGesture(gesture);
    demoStreamRef.current = demo;

    const demoStream = demo.getStream();
    setStream(demoStream);
    setIsDemoMode(true);
    setDemoGesture(gesture);
    setHasPermission(true);
    setPermissionError('');

    if (videoRef.current) {
      videoRef.current.srcObject = demoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Switch gesture in demo camera
  const handleSelectDemoGesture = (gesture: DemoGestureType) => {
    setDemoGesture(gesture);
    if (demoStreamRef.current) {
      demoStreamRef.current.setGesture(gesture);
    }
  };

  // Start real webcam
  const startCamera = useCallback(async () => {
    try {
      if (demoStreamRef.current) {
        demoStreamRef.current.stop();
        demoStreamRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setPermissionError('');
      setIsDemoMode(false);

      // Attempt high-res constraint first, then fallback to basic { video: true }
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (constraintErr: any) {
        if (
          constraintErr.name === 'OverconstrainedError' ||
          constraintErr.name === 'ConstraintNotSatisfiedError'
        ) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw constraintErr;
        }
      }

      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current && mediaStream) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => console.warn('Video play notice:', err));
      }
    } catch (err: any) {
      console.warn('Webcam access notice (permission or device restriction):', err?.message || err);
      setHasPermission(false);
      setPermissionError(
        err.name === 'NotAllowedError' || err.message?.includes('Permission denied')
          ? 'Camera permission was denied in your browser. You can enable it in site settings, or use the interactive Demo Camera below.'
          : err.name === 'NotFoundError'
          ? 'No physical camera detected on this device. You can use the Interactive Demo Camera or Photo Upload.'
          : 'Could not connect to camera: ' + (err.message || 'Device unavailable')
      );
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (demoStreamRef.current) {
        demoStreamRef.current.stop();
      }
    };
  }, [facingMode]);

  // Continuous tracking loop (Center Stage camera director)
  useEffect(() => {
    let animationFrameId: number;
    let lastProcessTime = 0;

    const trackingLoop = async (timestamp: number) => {
      if (videoRef.current && hasPermission && videoRef.current.readyState >= 2) {
        // Run detection every ~70ms (14-15 fps for CV efficiency, while animation renders at 60fps)
        if (timestamp - lastProcessTime > 70) {
          lastProcessTime = timestamp;
          const people = await trackerRef.current.processFrame(videoRef.current, isMirrored);
          setTrackedPeople([...people]);
        }
        // Viewport smoothly lerps on every animation frame for 60fps silky motion
        setViewport({ ...trackerRef.current.currentViewport });
      }
      animationFrameId = requestAnimationFrame(trackingLoop);
    };

    animationFrameId = requestAnimationFrame(trackingLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [hasPermission, isMirrored]);

  // Scan Room with Gemini AI
  const handleScanRoom = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isScanningRoom) return;
    setIsScanningRoom(true);
    setScanSummary('Scanning room for people...');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.85);

      const res = await fetch('/api/detect-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frameBase64 }),
      });

      if (!res.ok) throw new Error('Failed to scan room');
      const data = await res.json();

      if (data.people && Array.isArray(data.people) && data.people.length > 0) {
        const formattedPeople: TrackedPerson[] = data.people.map((p: any, i: number) => ({
          id: p.id || `person-${i + 1}`,
          label: p.label || (p.isMain ? 'Main Signer' : `Person ${i + 1}`),
          box: {
            x: Math.max(0, Math.min(1, p.box?.x ?? 0.2)),
            y: Math.max(0, Math.min(1, p.box?.y ?? 0.1)),
            width: Math.max(0.2, Math.min(1, p.box?.width ?? 0.6)),
            height: Math.max(0.3, Math.min(1, p.box?.height ?? 0.7)),
          },
          isMain: Boolean(p.isMain),
          isSigning: Boolean(p.isSigning),
          description: p.description,
          confidence: 98,
          lastSeen: Date.now(),
        }));

        trackerRef.current.setPeopleFromAIScan(formattedPeople);
        setTrackedPeople(formattedPeople);
        setScanSummary(data.summary || `Found ${formattedPeople.length} people in the room`);

        // If tracking was off, automatically turn on auto-tracking
        if (trackingMode === 'off') {
          setTrackingMode('auto');
        }
      } else {
        setScanSummary(data.summary || 'No people detected in current view');
      }
    } catch (err) {
      console.warn('Room scan notice:', err);
      setScanSummary('Could not scan room. Check camera connection.');
    } finally {
      setIsScanningRoom(false);
      setTimeout(() => setScanSummary(null), 4000);
    }
  }, [isScanningRoom, isMirrored, trackingMode]);

  // Capture current video frame as base64 JPEG (uses cropped tracked view if enabled)
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    return trackerRef.current.captureTrackedFrame(
      video,
      canvas,
      isMirrored,
      !cropForTranslation
    );
  }, [isMirrored, cropForTranslation]);

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

  // Select a specific person to track
  const handleSelectPerson = (personId: string) => {
    if (selectedPersonId === personId && trackingMode === 'manual') {
      setSelectedPersonId(null);
      setTrackingMode('auto');
    } else {
      setSelectedPersonId(personId);
      setTrackingMode('manual');
    }
  };

  // Find currently targeted person
  const activeTrackedPerson =
    trackingMode === 'manual'
      ? trackedPeople.find((p) => p.id === selectedPersonId)
      : trackedPeople.find((p) => p.isMain) || trackedPeople[0];

  return (
    <div id="camera-view-container" className="relative flex flex-col bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Viewport header toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur text-xs gap-2">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasPermission ? (isDemoMode ? 'bg-cyan-400' : 'bg-emerald-400') : 'bg-red-400'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${hasPermission ? (isDemoMode ? 'bg-cyan-500' : 'bg-emerald-500') : 'bg-red-500'}`} />
          </span>
          <span className="font-semibold text-neutral-200">
            {isDemoMode ? 'Demo Signer Feed' : 'Live Camera Feed'}
          </span>

          {/* Active Tracking Pill */}
          {trackingMode !== 'off' && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
              <Target className="w-3 h-3 animate-spin text-emerald-400" />
              <span>
                {trackingMode === 'group'
                  ? `Group Auto-Frame (${trackedPeople.length || 1} in room)`
                  : activeTrackedPerson
                  ? `Tracking ${activeTrackedPerson.label} • ${viewport.zoom.toFixed(1)}x`
                  : `Auto-Centering • ${viewport.zoom.toFixed(1)}x`}
              </span>
            </div>
          )}

          {autoTranslate && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-medium">
              Auto-Scanning ({autoInterval}s)
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {/* If in demo mode, show button to connect real webcam */}
          {isDemoMode && (
            <button
              id="switch-to-real-webcam-btn"
              onClick={startCamera}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center space-x-1.5 transition-all"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connect Webcam</span>
            </button>
          )}

          {/* AI Room Scan Button */}
          <button
            id="scan-room-ai-btn"
            onClick={handleScanRoom}
            disabled={isScanningRoom || !hasPermission}
            title="Scan room with Gemini AI to detect and identify all people in the frame"
            className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold flex items-center space-x-1.5 transition-all disabled:opacity-50"
          >
            <Scan className={`w-3.5 h-3.5 ${isScanningRoom ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isScanningRoom ? 'Scanning Room...' : 'Scan Room (AI)'}</span>
          </button>

          {/* Toggle Bounding Boxes overlay */}
          <button
            id="toggle-tracking-overlay-btn"
            onClick={() => setShowBoundingBoxes((prev) => !prev)}
            title={showBoundingBoxes ? 'Hide person target boxes' : 'Show person target boxes'}
            className={`p-1.5 rounded-lg border transition-all ${
              showBoundingBoxes && trackingMode !== 'off'
                ? 'bg-neutral-800 border-neutral-700 text-emerald-400'
                : 'bg-transparent border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {showBoundingBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

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

          {/* Switch front/back camera (when not in demo) */}
          {!isDemoMode && (
            <button
              id="camera-switch-facing-btn"
              onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
              title="Switch front/rear camera"
              className="p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Tracking Settings Toggle */}
          <button
            id="tracking-settings-btn"
            onClick={() => setShowSettings((prev) => !prev)}
            title="Configure person tracking & auto-framing"
            className={`p-1.5 rounded-lg border transition-all ${
              showSettings
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-transparent border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Demo Signer Switcher Toolbar (Visible when in demo mode) */}
      {isDemoMode && (
        <div className="px-4 py-2 bg-cyan-950/40 border-b border-cyan-800/40 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-cyan-300 font-semibold text-[11px] flex items-center space-x-1">
              <Play className="w-3 h-3 text-cyan-400" />
              <span>Simulate Gesture:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {DEMO_GESTURES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleSelectDemoGesture(g.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    demoGesture === g.id
                      ? 'bg-cyan-500 text-black font-bold shadow-sm'
                      : 'bg-neutral-900/80 text-neutral-300 hover:text-white border border-neutral-800'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Person Tracking Quick Control Bar */}
      <div className="px-4 py-2 bg-neutral-950/80 border-b border-neutral-800/60 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center space-x-1.5">
          <span className="text-neutral-400 text-[11px] font-medium mr-1">Camera Tracking:</span>

          <button
            id="track-mode-auto-btn"
            onClick={() => {
              setTrackingMode('auto');
              setSelectedPersonId(null);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium text-[11px] flex items-center space-x-1 transition-all ${
              trackingMode === 'auto'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Target className="w-3 h-3" />
            <span>Auto-Track Signer</span>
          </button>

          <button
            id="track-mode-group-btn"
            onClick={() => {
              setTrackingMode('group');
              setSelectedPersonId(null);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium text-[11px] flex items-center space-x-1 transition-all ${
              trackingMode === 'group'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Group Frame</span>
          </button>

          <button
            id="track-mode-off-btn"
            onClick={() => {
              setTrackingMode('off');
              setSelectedPersonId(null);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium text-[11px] flex items-center space-x-1 transition-all ${
              trackingMode === 'off'
                ? 'bg-neutral-700 text-white shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fixed Wide</span>
          </button>
        </div>

        {/* Multi-person quick buttons if multiple detected */}
        {trackedPeople.length > 1 && (
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-neutral-500 mr-1">Lock to:</span>
            {trackedPeople.map((p) => {
              const isSelected = trackingMode === 'manual' && selectedPersonId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPerson(p.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Tracking Settings Drawer */}
      {showSettings && (
        <div className="p-3 bg-neutral-950 border-b border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fade-in">
          <div>
            <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
              Framing Tightness
            </label>
            <div className="grid grid-cols-3 gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800 text-[11px]">
              {(['tight', 'balanced', 'wide'] as FramingTightness[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setFramingTightness(t)}
                  className={`py-1 rounded capitalize font-medium transition-all ${
                    framingTightness === t
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-neutral-500 block mt-1">
              {framingTightness === 'tight'
                ? 'Close-up on hands & chest (~2.0x)'
                : framingTightness === 'balanced'
                ? 'Standard upper body & signing space'
                : 'Spacious room context'}
            </span>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
              Translation Frame Focus
            </label>
            <button
              onClick={() => setCropForTranslation(!cropForTranslation)}
              className={`w-full py-1.5 px-3 rounded-lg border text-[11px] flex items-center justify-between transition-all ${
                cropForTranslation
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
            >
              <span>{cropForTranslation ? 'Crop to Tracked Signer' : 'Send Full Room Frame'}</span>
              {cropForTranslation && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
            <span className="text-[10px] text-neutral-500 block mt-1">
              Cropping gives AI higher clarity on hand fingers
            </span>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
              Room Occupancy
            </label>
            <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] text-neutral-300">
              <p className="font-semibold text-white">
                {trackedPeople.length === 0
                  ? 'Searching for people...'
                  : `${trackedPeople.length} ${trackedPeople.length === 1 ? 'person' : 'people'} detected`}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Current zoom: {viewport.zoom.toFixed(2)}x
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Video Viewport with Center Stage Digital PTZ */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {hasPermission === false ? (
          /* Graceful, helpful recovery card when camera is blocked or permission denied */
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-lg w-full">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Camera Permission Needed</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed max-w-md">
              {permissionError}
            </p>

            {/* Quick 3 Options: Demo Camera, Retry, or Photo Upload */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-md">
              <button
                id="camera-launch-demo-btn"
                onClick={() => startDemoCamera('wave')}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/60 flex items-center justify-center space-x-2 transition-all active:scale-95"
              >
                <Play className="w-4 h-4" />
                <span>Use Interactive Demo Camera</span>
              </button>

              <button
                id="camera-retry-permission-btn"
                onClick={startCamera}
                className="w-full sm:w-auto px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>

              {onSwitchToUpload && (
                <button
                  id="camera-fallback-upload-btn"
                  onClick={onSwitchToUpload}
                  className="w-full sm:w-auto px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center space-x-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
              )}
            </div>

            {/* Browser instructions tip */}
            <div className="mt-5 pt-4 border-t border-neutral-800/80 w-full text-left">
              <p className="text-[11px] font-semibold text-neutral-300 mb-1 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span>How to enable camera in browser:</span>
              </p>
              <ul className="text-[11px] text-neutral-500 space-y-0.5 list-disc list-inside">
                <li>Click the tune/padlock icon on the left of your browser address bar</li>
                <li>Set <span className="text-neutral-400 font-medium">Camera</span> permissions to <span className="text-emerald-400 font-medium">Allow</span></li>
                <li>Tap <span className="text-neutral-400 font-medium">"Retry Camera"</span> above</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {/* Smoothly Panning/Zooming Video Wrapper */}
            <div
              className="w-full h-full relative will-change-transform"
              style={{
                transform: `scale(${viewport.zoom}) translate(${viewport.panX}%, ${viewport.panY}%)`,
                transformOrigin: '50% 50%',
                transition: 'transform 0.08s linear',
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
              />

              {/* Interactive Person Tracking Bounding Boxes overlay */}
              {showBoundingBoxes && trackingMode !== 'off' && trackedPeople.map((person) => {
                const isTarget =
                  trackingMode === 'group' ||
                  (trackingMode === 'manual'
                    ? person.id === selectedPersonId
                    : person.isMain);

                return (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPerson(person.id)}
                    style={{
                      left: `${person.box.x * 100}%`,
                      top: `${person.box.y * 100}%`,
                      width: `${person.box.width * 100}%`,
                      height: `${person.box.height * 100}%`,
                    }}
                    className={`absolute cursor-pointer border-2 rounded-2xl transition-all duration-300 ${
                      isTarget
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.35)] ring-2 ring-emerald-400/20'
                        : 'border-white/30 bg-white/5 hover:border-emerald-400/70 hover:bg-emerald-500/10'
                    }`}
                  >
                    {/* Glowing corner reticles */}
                    <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400 rounded-br" />

                    {/* Person Tag Badge */}
                    <div
                      className={`absolute -top-7 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide backdrop-blur-md flex items-center space-x-1.5 shadow-md ${
                        isTarget
                          ? 'bg-emerald-500 text-black'
                          : 'bg-neutral-900/90 text-neutral-300 border border-neutral-700'
                      }`}
                    >
                      {person.isSigning ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      <span>{person.label}</span>
                      {isTarget && <span className="opacity-75">• Tracked</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gesture Targeting Frame HUD overlay (Fixed Center of Viewport) */}
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

                {/* Scanning line animation when translating or bursting or scanning */}
                {(isTranslating || isBursting || isScanningRoom) && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-bounce" />
                )}

                {/* Frame hint text */}
                <div className="absolute -bottom-7 px-3 py-1 bg-neutral-950/85 backdrop-blur rounded-full border border-neutral-800 text-[11px] text-neutral-300 font-medium">
                  {isScanningRoom
                    ? 'Scanning Room for People...'
                    : isBursting
                    ? `Recording Gesture... Frame ${burstCount} of 3`
                    : isTranslating
                    ? 'Analyzing Hand Sign...'
                    : handInFrameGuidance ||
                      (trackingMode !== 'off'
                        ? 'Camera is auto-tracking your signing space'
                        : 'Position hand sign inside frame')}
                </div>
              </div>
            </div>

            {/* AI Room Scan Banner */}
            {scanSummary && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-neutral-900/90 border border-emerald-500/50 text-emerald-300 text-xs font-semibold rounded-full shadow-2xl flex items-center space-x-2 animate-fade-in">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>{scanSummary}</span>
              </div>
            )}

            {/* Multi-frame burst overlay banner */}
            {isBursting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-500/90 text-black text-xs font-bold rounded-full shadow-lg flex items-center space-x-2 animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                <span>Capturing Motion Sequence ({burstCount}/3)</span>
              </div>
            )}

            {/* Translating indicator overlay */}
            {isTranslating && !isBursting && !scanSummary && (
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
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-emerald-700/60 rounded text-emerald-100">
              Space
            </kbd>
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
            <span className="text-neutral-400">Auto Scan</span>
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
