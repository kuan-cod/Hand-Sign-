import { BoundingBox, TrackedPerson, TrackingMode, FramingTightness } from '../types';

export interface ViewportTransform {
  zoom: number; // 1.0 to 3.0
  panX: number; // -50% to +50% or normalized offset
  panY: number; // -50% to +50% or normalized offset
  centerX: number; // 0..1 in video space
  centerY: number; // 0..1 in video space
}

export class PersonTrackerEngine {
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private prevFrameData: Uint8ClampedArray | null = null;
  private faceDetector: any = null;
  private isFaceDetectorAvailable = false;

  // Smoothing states (lerped)
  public currentViewport: ViewportTransform = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    centerX: 0.5,
    centerY: 0.5,
  };

  private targetViewport: ViewportTransform = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    centerX: 0.5,
    centerY: 0.5,
  };

  // Tracked people in view
  public trackedPeople: TrackedPerson[] = [];
  public selectedPersonId: string | null = null;
  public trackingMode: TrackingMode = 'auto';
  public tightness: FramingTightness = 'balanced';

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 160;
    this.offscreenCanvas.height = 120;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // Initialize native FaceDetector if supported by the browser
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        this.faceDetector = new (window as any).FaceDetector({
          maxDetectedFaces: 5,
          fastMode: true,
        });
        this.isFaceDetectorAvailable = true;
      } catch (e) {
        console.warn('Native FaceDetector unavailable, using CV fallback:', e);
      }
    }
  }

  /**
   * Process a live video frame to detect people and compute smooth auto-framing
   */
  public async processFrame(video: HTMLVideoElement, isMirrored: boolean): Promise<TrackedPerson[]> {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return this.trackedPeople;
    }

    let detected: TrackedPerson[] = [];

    // 1. Try Native FaceDetector if available
    if (this.isFaceDetectorAvailable && this.faceDetector) {
      try {
        const faces = await this.faceDetector.detect(video);
        if (faces && faces.length > 0) {
          detected = faces.map((face: any, index: number) => {
            const bb = face.boundingBox;
            let nx = bb.x / video.videoWidth;
            let ny = bb.y / video.videoHeight;
            let nw = bb.width / video.videoWidth;
            let nh = bb.height / video.videoHeight;

            // Mirror if camera is mirrored
            if (isMirrored) {
              nx = 1.0 - (nx + nw);
            }

            // Expand face box into upper torso & signing space
            const signingBox = this.expandFaceToSigningSpace({
              x: Math.max(0, nx),
              y: Math.max(0, ny),
              width: Math.min(1, nw),
              height: Math.min(1, nh),
            });

            return {
              id: `person-${index + 1}`,
              label: index === 0 ? 'Main Signer' : `Person ${index + 1}`,
              box: signingBox,
              isMain: index === 0,
              confidence: 95,
              lastSeen: Date.now(),
            };
          });
        }
      } catch (err) {
        // Fall back to CV detector
      }
    }

    // 2. High-speed Computer Vision Detector (Color + Motion Silhouette Clustering)
    if (detected.length === 0 && this.offscreenCtx) {
      detected = this.detectPeopleViaCV(video, isMirrored);
    }

    // If still no people found, keep last known if recent (<1.5s), else reset to default center
    if (detected.length === 0) {
      const now = Date.now();
      this.trackedPeople = this.trackedPeople.filter((p) => now - (p.lastSeen || 0) < 1500);
    } else {
      // Merge with previous to keep stable IDs and determine who is signing
      this.trackedPeople = this.smoothMergeDetections(detected);
    }

    // 3. Compute Target Viewport based on Tracking Mode
    this.updateTargetViewport();

    // 4. Smoothly interpolate current viewport towards target (Center Stage Lerp)
    this.stepInterpolation();

    return this.trackedPeople;
  }

  /**
   * Fast client-side Computer Vision fallback:
   * Uses skin/color segmentation + motion energy to cluster people in the room.
   */
  private detectPeopleViaCV(video: HTMLVideoElement, isMirrored: boolean): TrackedPerson[] {
    const ctx = this.offscreenCtx!;
    const w = this.offscreenCanvas.width;
    const h = this.offscreenCanvas.height;

    ctx.drawImage(video, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);
    const data = frame.data;
    const prev = this.prevFrameData;

    // Track horizontal presence across 8 vertical room slices/columns
    const numCols = 8;
    const colWeights = new Float32Array(numCols);
    const colMotion = new Float32Array(numCols);
    const colMinY = new Float32Array(numCols).fill(h);
    const colMaxY = new Float32Array(numCols).fill(0);

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Skin & upper body tone detection
        // Standard YCbCr transform:
        // Cr = 0.500*R - 0.419*G - 0.081*B + 128
        // Cb = -0.169*R - 0.331*G + 0.500*B + 128
        const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;
        const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
        const isSkin = cr >= 132 && cr <= 175 && cb >= 75 && cb <= 130 && r > g && g > b;

        // Motion detection against previous frame
        let isMoving = false;
        if (prev) {
          const diff = Math.abs(r - prev[i]) + Math.abs(g - prev[i + 1]) + Math.abs(b - prev[i + 2]);
          if (diff > 45) {
            isMoving = true;
          }
        }

        if (isSkin || isMoving) {
          // Compute column index (taking mirroring into account)
          const actualX = isMirrored ? w - 1 - x : x;
          const col = Math.min(numCols - 1, Math.floor((actualX / w) * numCols));
          colWeights[col] += isSkin ? 1.5 : 1.0;
          if (isMoving) colMotion[col] += 2.0;

          if (y < colMinY[col]) colMinY[col] = y;
          if (y > colMaxY[col]) colMaxY[col] = y;
        }
      }
    }

    // Save previous frame for next motion diff
    this.prevFrameData = new Uint8ClampedArray(data);

    // Group adjacent active columns into person clusters
    const clusters: Array<{ startCol: number; endCol: number; score: number; motion: number; minY: number; maxY: number }> = [];
    let inCluster = false;
    let start = 0;
    let score = 0;
    let motion = 0;
    let minY = h;
    let maxY = 0;

    const threshold = (w * h) / (numCols * 25); // Minimum weight to qualify

    for (let c = 0; c < numCols; c++) {
      if (colWeights[c] > threshold) {
        if (!inCluster) {
          inCluster = true;
          start = c;
          score = 0;
          motion = 0;
          minY = h;
          maxY = 0;
        }
        score += colWeights[c];
        motion += colMotion[c];
        minY = Math.min(minY, colMinY[c]);
        maxY = Math.max(maxY, colMaxY[c]);
      } else if (inCluster) {
        clusters.push({ startCol: start, endCol: c - 1, score, motion, minY, maxY });
        inCluster = false;
      }
    }
    if (inCluster) {
      clusters.push({ startCol: start, endCol: numCols - 1, score, motion, minY, maxY });
    }

    if (clusters.length === 0) {
      return [];
    }

    // Sort by combined score + motion (active signer has highest motion)
    clusters.sort((a, b) => b.score + b.motion * 2 - (a.score + a.motion * 2));

    return clusters.slice(0, 3).map((cl, idx) => {
      const x = cl.startCol / numCols;
      const width = (cl.endCol - cl.startCol + 1) / numCols;
      const y = Math.max(0, (cl.minY / h) * 0.9);
      const height = Math.min(1.0 - y, Math.max(0.4, (cl.maxY - cl.minY) / h + 0.2));

      const isMain = idx === 0;
      const isSigning = cl.motion > 40;

      return {
        id: `person-${idx + 1}`,
        label: isMain ? (isSigning ? 'Main Signer (Active)' : 'Main Person') : `Person ${idx + 1}`,
        box: {
          x: Math.max(0, Math.min(0.8, x)),
          y: Math.max(0, Math.min(0.4, y)),
          width: Math.min(1, Math.max(0.3, width)),
          height: Math.min(1, Math.max(0.45, height)),
        },
        isMain,
        isSigning,
        confidence: Math.min(96, Math.round(70 + cl.score / 20)),
        lastSeen: Date.now(),
      };
    });
  }

  /**
   * Expands a detected face rectangle to encompass the torso and signing space
   */
  private expandFaceToSigningSpace(faceBox: BoundingBox): BoundingBox {
    // Face width expansion for arms & shoulders: ~2.5x to 3.0x face width
    const targetWidth = Math.min(0.85, Math.max(0.38, faceBox.width * 2.8));
    // Face height expansion down to waist/torso: ~3.0x face height
    const targetHeight = Math.min(0.9, Math.max(0.55, faceBox.height * 3.2));

    const centerX = faceBox.x + faceBox.width / 2;
    const topY = Math.max(0.04, faceBox.y - faceBox.height * 0.25);

    const x = Math.max(0, Math.min(1 - targetWidth, centerX - targetWidth / 2));
    const y = Math.max(0, Math.min(1 - targetHeight, topY));

    return {
      x,
      y,
      width: targetWidth,
      height: targetHeight,
    };
  }

  /**
   * Smoothly merges newly detected people with existing list to avoid flickering labels
   */
  private smoothMergeDetections(newDetections: TrackedPerson[]): TrackedPerson[] {
    if (this.trackedPeople.length === 0) {
      return newDetections;
    }

    const merged: TrackedPerson[] = [];

    newDetections.forEach((detected, idx) => {
      // Find closest existing tracked person
      const match = this.trackedPeople.find((prev) => {
        const dx = Math.abs(prev.box.x + prev.box.width / 2 - (detected.box.x + detected.box.width / 2));
        return dx < 0.25;
      });

      if (match) {
        // Smooth bounding box with slight damping
        const alpha = 0.3; // 30% new, 70% previous for stable box
        const smoothedBox: BoundingBox = {
          x: match.box.x + (detected.box.x - match.box.x) * alpha,
          y: match.box.y + (detected.box.y - match.box.y) * alpha,
          width: match.box.width + (detected.box.width - match.box.width) * alpha,
          height: match.box.height + (detected.box.height - match.box.height) * alpha,
        };

        merged.push({
          ...detected,
          id: match.id,
          box: smoothedBox,
          isMain: this.selectedPersonId ? match.id === this.selectedPersonId : detected.isMain,
          lastSeen: Date.now(),
        });
      } else {
        merged.push({
          ...detected,
          id: `person-${Date.now()}-${idx}`,
          lastSeen: Date.now(),
        });
      }
    });

    return merged;
  }

  /**
   * Set people directly from Gemini AI Room Scan
   */
  public setPeopleFromAIScan(people: TrackedPerson[]) {
    this.trackedPeople = people.map((p, idx) => ({
      ...p,
      id: p.id || `person-${idx + 1}`,
      lastSeen: Date.now(),
    }));
    this.updateTargetViewport();
  }

  /**
   * Calculate target zoom and pan based on active tracking mode
   */
  private updateTargetViewport() {
    if (this.trackingMode === 'off') {
      this.targetViewport = {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        centerX: 0.5,
        centerY: 0.5,
      };
      return;
    }

    // Determine target bounding box to frame
    let targetBox: BoundingBox | null = null;

    if (this.trackingMode === 'group' && this.trackedPeople.length > 0) {
      // Group mode: union bounding box of all people
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      this.trackedPeople.forEach((p) => {
        minX = Math.min(minX, p.box.x);
        minY = Math.min(minY, p.box.y);
        maxX = Math.max(maxX, p.box.x + p.box.width);
        maxY = Math.max(maxY, p.box.y + p.box.height);
      });
      // Add padding
      const padX = 0.08;
      const padY = 0.06;
      targetBox = {
        x: Math.max(0, minX - padX),
        y: Math.max(0, minY - padY),
        width: Math.min(1, maxX - minX + padX * 2),
        height: Math.min(1, maxY - minY + padY * 2),
      };
    } else {
      // Auto or Manual mode: focus on a single person
      let targetPerson = this.trackedPeople.find((p) => p.id === this.selectedPersonId);
      if (!targetPerson) {
        // Fall back to main person or first person
        targetPerson = this.trackedPeople.find((p) => p.isMain) || this.trackedPeople[0];
      }

      if (targetPerson) {
        targetBox = targetPerson.box;
      }
    }

    if (!targetBox) {
      // No one detected: relax to wide center
      this.targetViewport = {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        centerX: 0.5,
        centerY: 0.5,
      };
      return;
    }

    // Calculate center of target box
    const centerX = targetBox.x + targetBox.width / 2;
    // Lower center slightly to include chest/hands comfortably
    const centerY = Math.min(0.8, targetBox.y + targetBox.height * 0.5);

    // Calculate ideal zoom level based on box size and user tightness preference
    const baseZoomMultiplier =
      this.tightness === 'tight' ? 1.4 : this.tightness === 'balanced' ? 1.15 : 0.95;

    // Zoom is inversely proportional to box width/height
    const maxDimension = Math.max(targetBox.width, targetBox.height);
    let targetZoom = (1.0 / maxDimension) * baseZoomMultiplier;

    // Clamp zoom to reasonable range [1.0 .. 2.6x]
    targetZoom = Math.max(1.0, Math.min(2.5, targetZoom));

    // Calculate Pan offsets in percentage (-50% to +50%)
    // When zoom is Z, visible window is 1/Z.
    // Normalized offset from frame center:
    const offsetX = centerX - 0.5;
    const offsetY = centerY - 0.5;

    // Max pan allowed before showing black border: (1 - 1/Z) / 2
    const maxPanX = Math.max(0, (1 - 1 / targetZoom) / 2);
    const maxPanY = Math.max(0, (1 - 1 / targetZoom) / 2);

    const clampedOffsetX = Math.max(-maxPanX, Math.min(maxPanX, offsetX));
    const clampedOffsetY = Math.max(-maxPanY, Math.min(maxPanY, offsetY));

    // Convert to CSS translate percentage relative to zoomed container
    // Translate is negative of center offset * 100
    const panX = -clampedOffsetX * 100;
    const panY = -clampedOffsetY * 100;

    this.targetViewport = {
      zoom: targetZoom,
      panX,
      panY,
      centerX,
      centerY,
    };
  }

  /**
   * Smooth physics step: lerp current viewport toward target
   */
  private stepInterpolation() {
    const smoothing = 0.085; // Silky Center Stage glide

    // Deadband check: if change is infinitesimal, avoid micro-jitter
    const dZoom = this.targetViewport.zoom - this.currentViewport.zoom;
    const dPanX = this.targetViewport.panX - this.currentViewport.panX;
    const dPanY = this.targetViewport.panY - this.currentViewport.panY;

    if (Math.abs(dZoom) > 0.005) {
      this.currentViewport.zoom += dZoom * smoothing;
    } else {
      this.currentViewport.zoom = this.targetViewport.zoom;
    }

    if (Math.abs(dPanX) > 0.05) {
      this.currentViewport.panX += dPanX * smoothing;
    } else {
      this.currentViewport.panX = this.targetViewport.panX;
    }

    if (Math.abs(dPanY) > 0.05) {
      this.currentViewport.panY += dPanY * smoothing;
    } else {
      this.currentViewport.panY = this.targetViewport.panY;
    }

    this.currentViewport.centerX += (this.targetViewport.centerX - this.currentViewport.centerX) * smoothing;
    this.currentViewport.centerY += (this.targetViewport.centerY - this.currentViewport.centerY) * smoothing;
  }

  /**
   * Helper to crop a video frame to the currently tracked viewport for translation
   */
  public captureTrackedFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    isMirrored: boolean,
    useFullWide: boolean = false
  ): string | null {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (useFullWide || this.trackingMode === 'off' || this.currentViewport.zoom <= 1.05) {
      // Full frame
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    }

    // Crop to the tracked region
    const zoom = this.currentViewport.zoom;
    const cropW = vw / zoom;
    const cropH = vh / zoom;

    // Crop center in source video coordinates
    // Account for mirror
    let sourceCenterX = this.currentViewport.centerX * vw;
    if (isMirrored) {
      sourceCenterX = (1.0 - this.currentViewport.centerX) * vw;
    }
    const sourceCenterY = this.currentViewport.centerY * vh;

    let sx = Math.max(0, Math.min(vw - cropW, sourceCenterX - cropW / 2));
    let sy = Math.max(0, Math.min(vh - cropH, sourceCenterY - cropH / 2));

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }
}
