/**
 * Virtual Demo Camera Generator
 * Provides an interactive simulated video stream of a signer in a room
 * when physical webcam access is denied, unavailable, or running in restricted iframes.
 */

export type DemoGestureType =
  | 'wave'
  | 'thumbs_up'
  | 'peace'
  | 'i_love_you'
  | 'thank_you'
  | 'ok_sign'
  | 'asl_a';

export interface DemoGestureOption {
  id: DemoGestureType;
  label: string;
  description: string;
  category: string;
}

export const DEMO_GESTURES: DemoGestureOption[] = [
  { id: 'wave', label: 'Wave "Hello"', description: 'Open palm waving in greeting', category: 'Common Words' },
  { id: 'thumbs_up', label: 'Thumbs Up', description: 'Universal positive approval gesture', category: 'Universal' },
  { id: 'peace', label: 'Peace / V Sign', description: 'Index and middle fingers extended', category: 'Universal' },
  { id: 'i_love_you', label: 'I Love You (ILY)', description: 'ASL sign with thumb, index & pinky', category: 'Common Words' },
  { id: 'thank_you', label: 'Thank You', description: 'Flat hand moving forward from chin', category: 'Common Words' },
  { id: 'ok_sign', label: 'OK Sign', description: 'Thumb & index circle with 3 fingers up', category: 'Universal' },
  { id: 'asl_a', label: 'Letter "A"', description: 'Fist with thumb upright on the side', category: 'ASL Alphabet' },
];

export class DemoSignerStream {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number | null = null;
  private activeGesture: DemoGestureType = 'wave';
  private frameCount = 0;
  private stream: MediaStream | null = null;

  constructor(width = 640, height = 480) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public setGesture(gesture: DemoGestureType) {
    this.activeGesture = gesture;
  }

  public getActiveGesture(): DemoGestureType {
    return this.activeGesture;
  }

  public getStream(): MediaStream {
    if (!this.stream) {
      if (typeof this.canvas.captureStream === 'function') {
        this.stream = this.canvas.captureStream(30);
      } else {
        // Fallback: create empty stream if captureStream is missing
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        this.stream = dest.stream;
      }
      this.startLoop();
    }
    return this.stream;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public startLoop() {
    if (this.animId) return;

    const render = () => {
      this.frameCount++;
      this.drawScene();
      this.animId = requestAnimationFrame(render);
    };

    this.animId = requestAnimationFrame(render);
  }

  public stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private drawScene() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this.frameCount * 0.05;

    // 1. Cozy Room Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1e293b'); // slate-800
    bgGrad.addColorStop(1, '#0f172a'); // slate-900
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle wall moulding & art in background
    ctx.fillStyle = '#334155';
    ctx.fillRect(w * 0.1, h * 0.15, w * 0.22, h * 0.25);
    ctx.fillStyle = '#475569';
    ctx.fillRect(w * 0.12, h * 0.18, w * 0.18, h * 0.19);
    // Plant on shelf in background
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(w * 0.72, h * 0.28, w * 0.08, h * 0.08);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(w * 0.76, h * 0.26, 22, 0, Math.PI * 2);
    ctx.fill();

    // 2. Realistic Human Signer
    // Natural human micro-breathing & sway
    const swayX = Math.sin(t * 0.8) * 4;
    const breatheY = Math.cos(t * 1.2) * 3;

    const personCenterX = w * 0.5 + swayX;
    const personBaseY = h * 0.95 + breatheY;

    // Torso / Navy Shirt
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(personCenterX - 110, personBaseY);
    ctx.lineTo(personCenterX - 85, personBaseY - 170); // Left shoulder
    ctx.quadraticCurveTo(personCenterX, personBaseY - 185, personCenterX + 85, personBaseY - 170); // Neckline
    ctx.lineTo(personCenterX + 110, personBaseY);
    ctx.closePath();
    ctx.fill();

    // Shirt collar highlight
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(personCenterX, personBaseY - 170, 24, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Neck
    ctx.fillStyle = '#e29d72'; // Realistic warm skin tone
    ctx.fillRect(personCenterX - 18, personBaseY - 210, 36, 45);

    // Head / Face
    ctx.beginPath();
    ctx.ellipse(personCenterX, personBaseY - 240, 48, 62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.arc(personCenterX, personBaseY - 252, 52, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();

    // Facial features: Eyes & friendly smile
    ctx.fillStyle = '#1e293b';
    // Eyes
    ctx.beginPath();
    ctx.arc(personCenterX - 16, personBaseY - 242, 4, 0, Math.PI * 2);
    ctx.arc(personCenterX + 16, personBaseY - 242, 4, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(personCenterX, personBaseY - 232, 14, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Left Arm (relaxed at side)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(personCenterX - 85, personBaseY - 170);
    ctx.lineTo(personCenterX - 125, personBaseY - 40);
    ctx.lineTo(personCenterX - 95, personBaseY - 30);
    ctx.lineTo(personCenterX - 65, personBaseY - 160);
    ctx.closePath();
    ctx.fill();

    // Right Arm (active signing arm in chest space)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(personCenterX + 85, personBaseY - 170);
    ctx.lineTo(personCenterX + 70, personBaseY - 70); // Elbow
    ctx.lineTo(personCenterX + 25, personBaseY - 125); // Wrist
    ctx.lineTo(personCenterX + 45, personBaseY - 165);
    ctx.closePath();
    ctx.fill();

    // 3. Render Hand Gesture at Wrist / Signing Space
    const handX = personCenterX + 15 + Math.sin(t * 1.5) * 2;
    const handY = personBaseY - 135 + Math.cos(t * 1.5) * 2;

    this.drawHandGesture(ctx, handX, handY, t);

    // 4. Subtle "Simulated Feed" Watermark Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 160, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(26, 27, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Demo Signer Feed', 36, 31);
  }

  private drawHandGesture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number
  ) {
    ctx.save();
    ctx.translate(x, y);

    const skinColor = '#e29d72';
    const skinShadow = '#c9784e';

    switch (this.activeGesture) {
      case 'wave': {
        // Waving hand oscillating left and right
        const waveAngle = Math.sin(t * 3.5) * 0.28;
        ctx.rotate(waveAngle);

        // Palm
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // 5 Extended Fingers
        const fingerOffsets = [-16, -8, 0, 8, 16];
        const fingerHeights = [30, 42, 46, 38, 28];
        fingerOffsets.forEach((fx, i) => {
          ctx.beginPath();
          ctx.roundRect(fx - 4, -28 - fingerHeights[i], 8, fingerHeights[i], 4);
          ctx.fill();
          ctx.strokeStyle = skinShadow;
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Thumb spread outward
        ctx.beginPath();
        ctx.roundRect(-26, -15, 18, 10, 5);
        ctx.fill();
        break;
      }

      case 'thumbs_up': {
        // Closed fist with thumb straight up
        ctx.fillStyle = skinColor;
        // Fist
        ctx.beginPath();
        ctx.ellipse(0, 5, 24, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Folded fingers lines
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 2;
        [-4, 4, 12].forEach((fy) => {
          ctx.beginPath();
          ctx.moveTo(-16, fy);
          ctx.lineTo(14, fy);
          ctx.stroke();
        });

        // Thumb pointing UP
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.roundRect(-7, -42, 14, 42, 7);
        ctx.fill();
        ctx.strokeStyle = skinShadow;
        ctx.stroke();
        break;
      }

      case 'peace': {
        // V-Sign: Index and middle fingers extended, others curled
        ctx.fillStyle = skinColor;
        // Palm fist
        ctx.beginPath();
        ctx.ellipse(0, 10, 22, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Thumb holding ring/pinky
        ctx.beginPath();
        ctx.ellipse(-4, 12, 12, 8, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Index finger (angled left)
        ctx.save();
        ctx.rotate(-0.25);
        ctx.beginPath();
        ctx.roundRect(-7, -48, 12, 50, 6);
        ctx.fill();
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Middle finger (angled right)
        ctx.save();
        ctx.rotate(0.25);
        ctx.beginPath();
        ctx.roundRect(-5, -52, 12, 54, 6);
        ctx.fill();
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'i_love_you': {
        // ASL ILY: Thumb, Index, Pinky extended; Middle and Ring folded
        ctx.fillStyle = skinColor;
        // Palm
        ctx.beginPath();
        ctx.ellipse(0, 8, 22, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Middle & Ring fingers curled into palm
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-2, 8, 8, 0, Math.PI);
        ctx.arc(6, 8, 8, 0, Math.PI);
        ctx.stroke();

        // Index finger (upright)
        ctx.beginPath();
        ctx.roundRect(-14, -46, 11, 48, 5.5);
        ctx.fill();
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pinky finger (upright on right)
        ctx.beginPath();
        ctx.roundRect(14, -38, 9, 40, 4.5);
        ctx.fill();
        ctx.stroke();

        // Thumb (extended out to the left)
        ctx.beginPath();
        ctx.roundRect(-36, -6, 26, 12, 6);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'thank_you': {
        // ASL "Thank You": Flat hand near chin moving outwards
        ctx.fillStyle = skinColor;
        // Flat hand facing signer, moving forward
        const forwardOffset = Math.sin(t * 2.5) * 12;
        ctx.translate(forwardOffset * 0.5, forwardOffset * 0.8);

        // Flat palm
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 fingers together extended upwards
        [-12, -4, 4, 12].forEach((fx, i) => {
          ctx.beginPath();
          ctx.roundRect(fx - 4, -40 - (i === 1 || i === 2 ? 6 : 0), 8, 38, 4);
          ctx.fill();
          ctx.strokeStyle = skinShadow;
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Thumb tucked alongside
        ctx.beginPath();
        ctx.roundRect(-22, -10, 14, 10, 5);
        ctx.fill();
        break;
      }

      case 'ok_sign': {
        // OK Sign: Thumb and index finger form circle, 3 fingers up
        ctx.fillStyle = skinColor;
        // Palm
        ctx.beginPath();
        ctx.ellipse(-6, 8, 20, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Circle of thumb + index
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(-10, -8, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-10, -8, 14, 0, Math.PI * 2);
        ctx.stroke();

        // 3 remaining fingers extended (Middle, Ring, Pinky)
        [4, 14, 22].forEach((fx, idx) => {
          ctx.fillStyle = skinColor;
          ctx.beginPath();
          ctx.roundRect(fx - 4, -42 - (idx === 0 ? 6 : 0), 8, 42, 4);
          ctx.fill();
          ctx.strokeStyle = skinShadow;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        break;
      }

      case 'asl_a': {
        // ASL Letter "A": Closed compact fist with thumb straight up against index finger
        ctx.fillStyle = skinColor;
        // Fist
        ctx.beginPath();
        ctx.ellipse(0, 5, 24, 24, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 curled fingers
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 2;
        [-6, 0, 6, 12].forEach((fy) => {
          ctx.beginPath();
          ctx.moveTo(-16, fy);
          ctx.lineTo(12, fy);
          ctx.stroke();
        });

        // Thumb pressed firmly against index finger on side
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.roundRect(-20, -18, 13, 30, 6.5);
        ctx.fill();
        ctx.strokeStyle = skinShadow;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }
}
