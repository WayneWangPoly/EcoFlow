import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, CheckCircle2, PackageCheck, TriangleAlert } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, LongPressButton, MobileActionBar, Pill, ProgressBar } from '../../components/ui';
import { BarcodeCameraScanner } from '../../components/BarcodeCameraScanner';
import { completeDeliveryStopIfReady, createPodRecord, scanDeliveryPackage, uploadPodPhoto } from '../../services/pilotSupabaseService';

function packageLabel(pkg: { packageIndex: number; totalPackages: number }) {
  return `Package ${pkg.packageIndex} of ${pkg.totalPackages}`;
}

export default function DeliveryScanPage() {
  const { stopId } = useParams();
  const { state, dispatch, helpers } = useOps();
  const currentUser = helpers.currentUser;
  const assignedRun = currentUser?.role === 'driver'
    ? (state.deliveryRuns.find((r) => r.driverId === currentUser.id || r.driverName === currentUser.name) ?? state.deliveryRuns[0])
    : state.deliveryRuns[0];
  const stops = state.deliveryStops.filter((s) => !assignedRun || s.runId === assignedRun.id).sort((a, b) => a.sequence - b.sequence);
  const selected = stops.find((s) => s.id === stopId) ?? stops.find((s) => s.status !== 'delivered' && s.status !== 'exception') ?? stops[0];
  const [barcode, setBarcode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualReason, setManualReason] = useState('Barcode damaged / unreadable');
  const [podMethod, setPodMethod] = useState<'photo' | 'signature' | 'contactless_note'>('photo');
  const [signatureName, setSignatureName] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [podNote, setPodNote] = useState('Left safely with customer / at agreed drop-off point.');
  const [feedback, setFeedback] = useState<{ tone: 'green' | 'red' | 'amber' | 'purple'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const packages = useMemo(() => selected ? helpers.orderPackages(selected.orderId) : [], [selected, state.packages]);
  if (!selected) return <EmptyState title="No delivery stop" body="Generate package labels first, then mark the run loaded." action={<Link to="/driver/run"><Button>Open run</Button></Link>} />;

  const order = state.orders.find((o) => o.id === selected.orderId);
  const customer = helpers.customer(selected.customerId);
  const scanned = packages.filter((p) => selected.scannedPackageIds.includes(p.id));
  const allScanned = packages.length > 0 && scanned.length === packages.length;
  const pod = state.proofsOfDelivery.find((p) => p.stopId === selected.id);
  const podReady = podMethod === 'photo' ? Boolean(photoName) : podMethod === 'signature' ? Boolean(signatureName.trim()) : Boolean(podNote.trim());

  const scan = () => {
    const code = barcode.trim();
    if (!code || busy) return;
    setBusy(true);
    window.setTimeout(() => {
      const pkg = state.packages.find((p) => p.barcodeValue === code);
      if (!pkg) {
        setFeedback({ tone: 'red', message: 'Unknown package barcode. Use manual entry if the thermal label is damaged.' });
      } else if (pkg.orderId !== selected.orderId) {
        setFeedback({ tone: 'red', message: 'Wrong customer package. Do not deliver this box at the current stop.' });
      } else {
        setFeedback({ tone: 'green', message: `Scanned ${packageLabel(pkg)}.` });
      }
      scanDeliveryPackage(code);
      dispatch({ type: 'SCAN_DELIVERY_PACKAGE', stopId: selected.id, barcodeValue: code });
      setBarcode('');
      setBusy(false);
    }, 320);
  };

  const manual = () => {
    if (!manualCode.trim() || busy) return;
    setBusy(true);
    window.setTimeout(() => {
      dispatch({ type: 'MANUAL_DELIVERY_PACKAGE', stopId: selected.id, typedCode: manualCode, reason: manualReason });
      setFeedback({ tone: 'purple', message: `Manual package entry submitted: ${manualCode}. This is audit logged.` });
      setManualCode('');
      setBusy(false);
    }, 320);
  };

  const confirmPod = async () => {
    if (busy) return;
    if (!podReady) {
      setFeedback({ tone: 'amber', message: podMethod === 'photo' ? 'Take a delivery photo before completing this stop.' : 'Complete the selected POD field before finishing delivery.' });
      return;
    }
    setBusy(true);
    let photoUrl = photoName;
    const input = document.getElementById('pod-camera-input') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (podMethod === 'photo' && file) {
      const uploaded = await uploadPodPhoto(selected.id, file);
      photoUrl = uploaded.url;
    }
    await createPodRecord({ deliveryStopId: selected.id, recipientName: signatureName || customer?.name, notes: podNote });
    dispatch({ type: 'CONFIRM_POD', stopId: selected.id, method: podMethod, signatureName, photoName: photoUrl, note: podNote });
    const completion = await completeDeliveryStopIfReady(selected.id, selected.orderId);
    setFeedback({ tone: completion.ok ? 'green' : 'amber', message: completion.ok ? 'Proof of delivery recorded. Stop completed.' : 'POD saved. Stop stays pending until all packages are scanned and POD exists.' });
    setBusy(false);
  };

  return (
    <div className="field-page pb-28 lg:pb-0">
      <FieldHeader
        eyebrow={`Stop #${selected.sequence}`}
        title={customer?.name ?? 'Delivery stop'}
        subtitle={`${order?.orderNumber ?? ''} · ${customer?.address}, ${customer?.suburb}`}
        right={<Pill tone={selected.status === 'delivered' ? 'green' : allScanned ? 'amber' : 'amber'}>{selected.status === 'delivered' ? 'delivered' : allScanned ? 'POD required' : `${scanned.length} of ${packages.length} scanned`}</Pill>}
      />

      <Card className="mb-4 border-eco-ink bg-eco-ink text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid">Current stop</div>
            <div className="mt-2 text-4xl font-black">{customer?.name}</div>
            <div className="mt-2 text-base font-semibold text-white/90">Expected: {packages.length ? packages.map(packageLabel).join(' · ') : 'No package labels yet'}</div>
          </div>
          <PackageCheck className="text-eco-acid" size={44} />
        </div>
        <ProgressBar value={scanned.length} total={packages.length || 1} className="mt-5" />
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-black">Scan delivery labels</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className="scan-input" placeholder="Scan thermal label barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(); }} autoFocus />
          <BarcodeCameraScanner label="Camera scan" onDetected={(code) => { setBarcode(code); scanDeliveryPackage(code).finally(() => window.setTimeout(() => dispatch({ type: 'SCAN_DELIVERY_PACKAGE', stopId: selected.id, barcodeValue: code }), 0)); setFeedback({ tone: 'green', message: `Camera detected package barcode ${code}.` }); }} />
          <Button size="lg" loading={busy} onClick={scan}>Scan package</Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {packages.map((pkg) => {
            const done = selected.scannedPackageIds.includes(pkg.id);
            return <button key={pkg.id} onClick={() => setBarcode(pkg.barcodeValue)} className={`rounded-2xl border p-4 text-left ${done ? 'border-green-300 bg-green-100' : 'border-eco-line bg-eco-fog'}`}>
              <div className="text-2xl font-black text-eco-ink">{packageLabel(pkg)}</div>
              <div className="mt-1 text-xs font-bold text-eco-muted">Code: {pkg.packageCode}</div>
              <div className="mt-2">{done ? <Pill tone="green">scanned</Pill> : <Pill tone="amber">pending</Pill>}</div>
            </button>;
          })}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-black">Unreadable barcode fallback</h2>
        <p className="mt-1 text-sm font-semibold text-eco-muted">Manually enter the last characters of the package code only if the thermal label is wet, damaged or unreadable. This creates an audit log and exception record.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <input className="rounded-xl border border-eco-line px-4 py-3 font-bold" inputMode="numeric" placeholder="Last 5 characters" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
          <input className="rounded-xl border border-eco-line px-4 py-3" value={manualReason} onChange={(e) => setManualReason(e.target.value)} />
          <Button variant="secondary" loading={busy} onClick={manual}>Manual entry</Button>
        </div>
      </Card>

      {feedback && <Card className={`mb-4 ${feedback.tone === 'green' ? 'border-green-300 bg-green-100' : feedback.tone === 'red' ? 'border-red-300 bg-red-100' : feedback.tone === 'purple' ? 'border-purple-300 bg-purple-100' : 'border-amber-300 bg-amber-100'}`}><div className="flex items-start gap-3">{feedback.tone === 'green' ? <CheckCircle2 className="text-green-800" /> : <TriangleAlert className={feedback.tone === 'red' ? 'text-red-800' : 'text-amber-800'} />}<div className="font-black text-eco-ink">{feedback.message}</div></div></Card>}

      <Card className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-black"><Camera size={20} /> Proof of delivery</h2>
        <p className="mt-1 text-sm font-semibold text-eco-muted">Scanning labels is not enough. The driver must record photo proof, customer name/signature, or a contactless delivery note.</p>
        {pod ? <div className="mt-4 rounded-2xl border border-green-300 bg-green-100 p-4"><div className="font-black text-green-950">POD recorded</div><div className="mt-1 text-sm font-bold text-green-900">{pod.method} · {pod.signatureName || pod.photoName || pod.note}</div></div> : (
          <div className="mt-4 grid gap-3">
            <select className="rounded-xl border border-eco-line px-4 py-3 font-bold" value={podMethod} onChange={(e) => setPodMethod(e.target.value as any)}>
              <option value="photo">Photo proof</option>
              <option value="signature">Customer signature/name</option>
              <option value="contactless_note">Contactless delivery note</option>
            </select>
            {podMethod === 'photo' && <div className="rounded-2xl border border-eco-line bg-eco-fog p-4">
              <input id="pod-camera-input" className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPhotoName(file.name);
                setPhotoPreview(URL.createObjectURL(file));
              }} />
              <label htmlFor="pod-camera-input" className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl bg-eco-ink px-4 py-5 text-center text-lg font-black text-white active:scale-[0.99]">
                <Camera className="mr-2" size={24} /> Open camera / take delivery photo
              </label>
              {photoPreview && <img src={photoPreview} alt="POD preview" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />}
              {photoName && <div className="mt-3 rounded-xl bg-white p-3 text-sm font-black text-eco-ink">Photo captured: {photoName}</div>}
            </div>}
            {podMethod === 'signature' && <input className="rounded-xl border border-eco-line px-4 py-3" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Customer name / signature text" />}
            <textarea className="min-h-24 rounded-xl border border-eco-line px-4 py-3" value={podNote} onChange={(e) => setPodNote(e.target.value)} />
          </div>
        )}
      </Card>

      <MobileActionBar>
        <Button className="w-full" size="xl" disabled={!allScanned || selected.status === 'delivered' || !podReady} loading={busy} onClick={confirmPod}>Record POD & complete delivery</Button>
      </MobileActionBar>

      <div className="mt-5 hidden justify-end gap-2 lg:flex">
        <LongPressButton size="lg" variant="warning" disabled={selected.status === 'delivered'} onConfirm={() => dispatch({ type: 'COMPLETE_STOP_WITH_EXCEPTION', stopId: selected.id, reason: 'Driver reported delivery exception / missing package.' })}>Hold: report exception</LongPressButton>
        <Button size="lg" disabled={!allScanned || selected.status === 'delivered' || !podReady} loading={busy} onClick={confirmPod}>Record POD & complete</Button>
      </div>
    </div>
  );
}
