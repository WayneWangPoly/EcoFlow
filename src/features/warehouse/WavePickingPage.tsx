import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPinned, ShoppingBasket } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, MobileActionBar, Pill, ProgressBar } from '../../components/ui';
import type { ZoneCode } from '../../domain/types';

export default function WavePickingPage() {
  const { waveId } = useParams();
  const { state, dispatch, helpers } = useOps();
  const wave = state.waves.find((w) => w.id === waveId) ?? state.waves[0];
  const [zone, setZone] = useState<ZoneCode | undefined>(wave?.zones[0]);

  const lines = useMemo(() => {
    if (!wave) return [];
    return state.waveLines
      .filter((l) => l.waveId === wave.id)
      .map((line) => ({ ...line, location: helpers.location(line.locationId), sku: helpers.sku(line.skuId) }))
      .sort((a, b) => (a.location?.code ?? '').localeCompare(b.location?.code ?? ''));
  }, [wave, state.waveLines, helpers]);

  if (!wave) return <EmptyState title="No wave selected" body="Create a cart wave or single pick first." action={<Link to="/warehouse/waves"><Button>Open waves</Button></Link>} />;

  const zones = wave.zones;
  const currentZone = zone ?? zones[0];
  const zoneLines = lines.filter((l) => l.location?.zone === currentZone);
  const zonePicked = zoneLines.length > 0 && zoneLines.every((l) => l.status === 'zone_picked');
  const pickedZones = zones.filter((z) => lines.filter((l) => l.location?.zone === z).every((l) => l.status === 'zone_picked')).length;
  const allZonesPicked = zones.length > 0 && pickedZones === zones.length;
  const nextUnpickedZone = zones.find((z) => lines.filter((l) => l.location?.zone === z).some((l) => l.status !== 'zone_picked'));
  const totalQty = zoneLines.reduce((sum, l) => sum + l.requiredQuantity, 0);
  const isCartWave = wave.pickMode === 'cart_wave';

  return (
    <div className="field-page pb-28 lg:pb-0">
      <FieldHeader
        eyebrow={isCartWave ? '4-slot cart wave' : wave.pickMode === 'single_pick' ? 'Single customer pick' : 'Wave picking'}
        title={wave.waveNumber}
        subtitle={isCartWave ? 'Pick by location once, then drop quantities into trolley boxes A/B/C/D. No aisle scanning; final SKU verification happens at van-front packing.' : 'Aisle work only prompts what to pick. Do not scan here; SKU verification happens at sorting / packing.'}
        right={<Pill tone={wave.status === 'picked' ? 'green' : 'amber'}>{wave.status}</Pill>}
      />

      <Link to="/warehouse/waves" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-eco-muted"><ArrowLeft size={16} /> Back to waves</Link>

      {isCartWave && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <div className="flex items-start gap-3">
            <ShoppingBasket className="mt-1 text-blue-800" />
            <div>
              <div className="text-lg font-black text-blue-950">Trolley setup: four open boxes</div>
              <p className="mt-1 text-sm font-semibold leading-6 text-blue-900">Label the trolley boxes A, B, C and D. When you reach each location, take the total quantity, then place the listed quantity into each customer slot.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {wave.cartSlots?.map((slot) => <Pill key={slot.slotCode} tone="blue">{slot.slotCode}: {helpers.customer(slot.customerId)?.name}</Pill>)}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-eco-muted">Zone progress</div>
            <div className="mt-1 text-2xl font-black">{pickedZones}/{zones.length} zones picked</div>
          </div>
          <Pill tone="dark">{wave.orderIds.length} order{wave.orderIds.length > 1 ? 's' : ''}</Pill>
        </div>
        <ProgressBar value={pickedZones} total={zones.length} className="mt-4" />
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {zones.map((z) => {
            const zLines = lines.filter((l) => l.location?.zone === z);
            const done = zLines.length > 0 && zLines.every((l) => l.status === 'zone_picked');
            return (
              <button key={z} onClick={() => setZone(z)} className={`rounded-2xl border p-3 text-center font-black ${currentZone === z ? 'border-eco-ink bg-eco-ink text-white' : done ? 'border-green-200 bg-green-50 text-green-900' : 'border-eco-line bg-white text-eco-ink'}`}>
                <div>{z}</div>
                <div className="mt-1 text-[11px] font-bold opacity-80">{done ? 'picked' : `${zLines.length} lines`}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {allZonesPicked && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <div className="text-lg font-black text-green-950">Aisle picking complete</div>
          <p className="mt-1 text-sm text-green-800">Move the trolley to the van-front packing area. Next step: verify each customer slot by scanning SKUs and generate 1/N labels.</p>
          <Link to={`/warehouse/sorting/${wave.id}`}><Button className="mt-3">Open van-front sorting</Button></Link>
        </Card>
      )}

      <Card className="mb-4 bg-eco-ink text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid/80">Current zone</div>
            <div className="mt-1 text-5xl font-black">{currentZone}</div>
            <div className="mt-2 text-sm text-white/75">{zoneLines.length} locations · {totalQty} units total</div>
          </div>
          {zonePicked ? <CheckCircle2 className="text-eco-acid" size={42} /> : <MapPinned className="text-eco-acid" size={42} />}
        </div>
      </Card>

      <div className="grid gap-3">
        {zoneLines.map((line) => (
          <Card key={line.id} className={`warehouse-mobile-card ${line.status === 'zone_picked' ? 'border-green-200 bg-green-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex rounded-xl bg-eco-ink px-3 py-2 text-2xl font-black text-white">{line.location?.code}</div>
                <div className="mt-3 text-base font-black text-eco-ink">{line.sku?.displayName}</div>
                <div className="mt-1 text-sm font-semibold text-eco-muted">Location barcode: {line.location?.barcodeValue}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-wide text-eco-muted">Total pick</div>
                <div className="text-5xl font-black">{line.requiredQuantity}</div>
                <div className="text-xs font-bold text-eco-muted">{line.unit}</div>
              </div>
            </div>

            {isCartWave && line.slotBreakdown?.length ? (
              <div className="mt-4 rounded-2xl border border-eco-line bg-white p-3">
                <div className="text-xs font-black uppercase tracking-wide text-eco-muted">Put into trolley slots</div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {line.slotBreakdown.map((slot) => (
                    <div key={`${line.id}-${slot.slotCode}`} className="rounded-2xl bg-eco-fog p-3">
                      <div className="text-2xl font-black text-eco-ink">{slot.slotCode}</div>
                      <div className="mt-1 truncate text-xs font-bold text-eco-muted">{helpers.customer(slot.customerId)?.name}</div>
                      <div className="mt-2 text-3xl font-black">{slot.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 text-sm">
              <span className="font-bold text-eco-muted">Pick prompt only</span>
              <Pill tone={line.status === 'zone_picked' ? 'green' : 'amber'}>{line.status === 'zone_picked' ? 'zone picked' : 'pending'}</Pill>
            </div>
          </Card>
        ))}
      </div>

      <MobileActionBar>
        {allZonesPicked ? (
          <Link to={`/warehouse/sorting/${wave.id}`} className="w-full"><Button className="w-full" size="xl">Continue to van-front sorting</Button></Link>
        ) : zonePicked ? (
          <Button className="w-full" size="xl" variant="secondary" onClick={() => nextUnpickedZone && setZone(nextUnpickedZone)}>
            Next zone: {nextUnpickedZone ?? '—'}
          </Button>
        ) : (
          <Button className="w-full" size="xl" onClick={() => currentZone && dispatch({ type: 'MARK_ZONE_PICKED', waveId: wave.id, zone: currentZone })}>
            Mark {currentZone} picked
          </Button>
        )}
      </MobileActionBar>

      <div className="mt-5 hidden justify-end gap-2 lg:flex">
        {allZonesPicked ? (
          <Link to={`/warehouse/sorting/${wave.id}`}><Button size="lg">Continue to van-front sorting</Button></Link>
        ) : zonePicked ? (
          <Button size="lg" variant="secondary" onClick={() => nextUnpickedZone && setZone(nextUnpickedZone)}>Next zone: {nextUnpickedZone ?? '—'}</Button>
        ) : (
          <Button size="lg" onClick={() => currentZone && dispatch({ type: 'MARK_ZONE_PICKED', waveId: wave.id, zone: currentZone })}>Mark {currentZone} picked</Button>
        )}
      </div>
    </div>
  );
}
