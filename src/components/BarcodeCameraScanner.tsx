import { BarcodeScanner } from './BarcodeScanner';

export function BarcodeCameraScanner({ label, onDetected }: { label?: string; onDetected: (code: string) => void }) {
  return <BarcodeScanner actor="system" label={label} onDetected={(r) => onDetected(r.value)} />;
}
