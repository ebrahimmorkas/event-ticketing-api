import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/feedback';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

/** Camera scanning uses the browser's built-in BarcodeDetector (Chrome, Edge, Android). */
export const canScanQr = typeof Detector === 'function';

export function QrScanner({ onScan, paused }: { onScan: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);

  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!Detector) return;
    const detector = new Detector({ formats: ['qr_code'] });
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    let lastCode = '';
    let lastAt = 0;

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !pausedRef.current) {
        try {
          const [code] = await detector.detect(video);
          // Ignore the same code held in front of the camera for a few seconds.
          if (code && (code.rawValue !== lastCode || Date.now() - lastAt > 4000)) {
            lastCode = code.rawValue;
            lastAt = Date.now();
            onScanRef.current(code.rawValue);
          }
        } catch {
          // A frame that cannot be decoded is not an error worth surfacing.
        }
      }
      frame = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        void tick();
      })
      .catch(() => setError('Camera access was denied. You can still type the ticket code.'));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  return (
    <video
      ref={videoRef}
      muted
      playsInline
      aria-label="Camera preview for scanning ticket QR codes"
      className="aspect-video w-full rounded-lg bg-black object-cover"
    />
  );
}
