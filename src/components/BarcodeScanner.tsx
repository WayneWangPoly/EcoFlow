import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Camera, X } from 'lucide-react';
import { Button, Card } from './ui';

export type BarcodeScanResult = { value: string; symbology?: string; timestamp: string; actor: string; source: 'camera' | 'manual' };

export function BarcodeScanner({ actor, onDetected, label = 'Camera scan' }: { actor: string; onDetected: (result: BarcodeScanResult) => void; label?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('Ready');

  useEffect(() => () => { controlsRef.current?.stop(); streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  const emit = (value: string, symbology?: string) => onDetected({ value, symbology, timestamp: new Date().toISOString(), actor, source: 'camera' });

  const start = async () => {
    setOpen(true);
    const Detector = (window as any).BarcodeDetector;
    if (Detector) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new Detector();
      const timer = window.setInterval(async () => {
        if (!videoRef.current) return;
        const results = await detector.detect(videoRef.current);
        const hit = results?.[0];
        if (hit?.rawValue) { emit(hit.rawValue, hit.format); window.clearInterval(timer); setOpen(false); }
      }, 300);
      return;
    }
    setStatus('Using ZXing fallback scanner...');
    const reader = new BrowserMultiFormatReader();
    controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
      if (result) { emit(result.getText(), result.getBarcodeFormat().toString()); setOpen(false); controlsRef.current?.stop(); }
    });
  };

  return <div>
    <Button type="button" variant="secondary" onClick={start}><Camera size={16} /> {label}</Button>
    {open && <div className="fixed inset-0 z-50 bg-black/90 p-4 text-white"><div className="mx-auto max-w-lg"><div className="mb-2 flex justify-between"><div>Scan barcode</div><Button type="button" variant="secondary" onClick={() => setOpen(false)}><X size={16} />Close</Button></div><Card className="p-2"><video ref={videoRef} className="h-[60vh] w-full" muted playsInline /></Card><div className="mt-2 text-sm">{status}</div></div></div>}
  </div>;
}
