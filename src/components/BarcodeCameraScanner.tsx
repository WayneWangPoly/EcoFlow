import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button, Card } from './ui';

type BarcodeCameraScannerProps = {
  label?: string;
  onDetected: (code: string) => void;
  className?: string;
};

const formats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'];

export function BarcodeCameraScanner({ label = 'Camera scan', onDetected, className }: BarcodeCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState('Ready to scan supplier carton / sleeve barcode.');
  const [busy, setBusy] = useState(false);

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setBusy(false);
    setOpen(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setSupported(false);
      setStatus('Camera barcode scanning is not supported by this browser. Use manual barcode entry or Chrome on Android.');
      return;
    }
    setOpen(true);
    setBusy(true);
    setStatus('Opening camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Detector({ formats });
      setStatus('Point the camera at the product barcode. Keep it steady until detected.');
      timerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const results = await detector.detect(video);
          const code = results?.[0]?.rawValue;
          if (code) {
            setStatus(`Detected: ${code}`);
            onDetected(String(code));
            stop();
          }
        } catch {
          // Keep scanning; some frames fail while camera autofocus settles.
        }
      }, 350);
    } catch (error) {
      setStatus('Camera could not be opened. Check browser permission, use HTTPS/local network, or enter the barcode manually.');
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button type="button" variant="secondary" size="lg" onClick={start} disabled={busy || !supported}>
        <Camera size={18} /> {label}
      </Button>
      {!supported && <div className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">Camera barcode detection is not available in this browser. Manual entry still works.</div>}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 text-white">
          <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-black">Barcode camera scan</div>
                <div className="text-sm text-white/75">Works best with Chrome on Android. Use good light and fill the frame with the barcode.</div>
              </div>
              <Button type="button" variant="secondary" onClick={stop}><X size={18} /> Close</Button>
            </div>
            <Card className="overflow-hidden border-white/20 bg-white/10 p-2">
              <video ref={videoRef} className="h-[58vh] w-full rounded-2xl object-cover" muted playsInline />
            </Card>
            <div className="rounded-2xl bg-white/10 p-4 text-sm font-bold">{status}</div>
          </div>
        </div>
      )}
    </div>
  );
}
