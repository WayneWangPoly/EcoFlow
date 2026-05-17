import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, FieldHeader, Pill, ProgressBar } from '../../components/ui';

const declarationItems = [
  'I confirm I am not under the influence of alcohol or drugs.',
  'I confirm I am fit for duty and safe to drive today.',
  'I understand I must report vehicle safety issues before departure.'
];

const vehicleItems = [
  'Vehicle rego appears valid.',
  'Service due / basic vehicle condition checked.',
  'Tyres are acceptable.',
  'Lights are working.',
  'Brakes feel safe to operate.'
];

export default function PreStartPage() {
  const { state, dispatch, helpers } = useOps();
  const currentUser = helpers.currentUser;
  const run = currentUser?.role === 'driver'
    ? (state.deliveryRuns.find((r) => r.driverId === currentUser.id || r.driverName === currentUser.name) ?? state.deliveryRuns[0])
    : state.deliveryRuns[0];
  const check = state.preStartChecks.find((c) => c.runId === run.id)!;
  const [signatureName, setSignatureName] = useState(check.signatureName ?? run.driverName);
  const [odometer, setOdometer] = useState(check.odometer ?? 42000);
  const [damageReported, setDamageReported] = useState(check.damageReported ?? false);
  const [notes, setNotes] = useState(check.notes ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries([...declarationItems, ...vehicleItems].map((item) => [item, check.status === 'passed'])));
  const total = declarationItems.length + vehicleItems.length;
  const done = Object.values(checked).filter(Boolean).length;
  const canSubmit = done === total && signatureName.trim().length > 1;

  const toggle = (item: string) => setChecked((current) => ({ ...current, [item]: !current[item] }));

  return (
    <div className="field-page pb-28 lg:pb-0">
      <FieldHeader
        eyebrow="Driver pre-start"
        title="Fit-for-duty declaration"
        subtitle={`${run.driverName} · Vehicle ${run.vehicleRego}. This must be completed before the delivery run is started.`}
        right={check.status === 'passed' ? <CheckCircle2 className="text-eco-acid" size={42} /> : <ShieldCheck className="text-eco-acid" size={42} />}
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-sm font-bold uppercase tracking-wide text-eco-muted">Checklist progress</div><div className="mt-1 text-3xl font-black">{done}/{total}</div></div>
          <Pill tone={check.status === 'passed' ? 'green' : canSubmit ? 'amber' : 'red'}>{check.status === 'passed' ? 'passed' : canSubmit ? 'ready to sign' : 'incomplete'}</Pill>
        </div>
        <ProgressBar value={done} total={total} className="mt-4" />
      </Card>

      <Card className="mb-4">
        <h2 className="text-xl font-black">Alcohol / drug and duty declaration</h2>
        <div className="mt-4 grid gap-3">
          {declarationItems.map((text) => (
            <button key={text} onClick={() => toggle(text)} className={`flex gap-3 rounded-2xl border p-4 text-left text-sm font-semibold ${checked[text] ? 'border-green-200 bg-green-50 text-green-950' : 'border-eco-line bg-white text-eco-ink'}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${checked[text] ? 'border-green-600 bg-green-600 text-white' : 'border-eco-line bg-white'}`}>{checked[text] ? '✓' : ''}</span>
              {text}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-xl font-black">Vehicle condition check</h2>
        <div className="mt-4 grid gap-3">
          {vehicleItems.map((text) => (
            <button key={text} onClick={() => toggle(text)} className={`flex gap-3 rounded-2xl border p-4 text-left text-sm font-semibold ${checked[text] ? 'border-green-200 bg-green-50 text-green-950' : 'border-eco-line bg-white text-eco-ink'}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${checked[text] ? 'border-green-600 bg-green-600 text-white' : 'border-eco-line bg-white'}`}>{checked[text] ? '✓' : ''}</span>
              {text}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-xl font-black">Sign-off</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="text-sm font-bold">Odometer</label><input className="mt-2 w-full rounded-xl border border-eco-line px-4 py-3" type="number" value={odometer} onChange={(e) => setOdometer(Number(e.target.value))} /></div>
          <div><label className="text-sm font-bold">Signature name</label><input className="mt-2 w-full rounded-xl border border-eco-line px-4 py-3" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} /></div>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-bold"><input className="h-5 w-5" type="checkbox" checked={damageReported} onChange={(e) => setDamageReported(e.target.checked)} /> Damage reported today</label>
        <textarea className="mt-3 min-h-28 w-full rounded-xl border border-eco-line px-4 py-3" placeholder="Notes, damage details, or nil." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <Button className="w-full" size="xl" disabled={!canSubmit} onClick={() => dispatch({ type: 'PASS_PRESTART', runId: run.id, signatureName, odometer, damageReported, notes })}>Sign and pass pre-start</Button>
    </div>
  );
}
