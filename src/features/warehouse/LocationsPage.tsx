import { useOps } from '../../app/OpsContext';
import { Card, Pill, SectionTitle } from '../../components/ui';

export default function LocationsPage() {
  const { state, helpers } = useOps();
  const zones = Array.from(new Set(state.locations.map((l) => l.zone))).sort();
  return (
    <>
      <SectionTitle title="Location Map" subtitle="EcoFlow supplies physical location barcodes. The system recognises them and keeps one SKU assignment per location. Future expansion simply adds more A-zone locations." />
      <div className="grid gap-5">
        {zones.map((zone) => (
          <Card key={zone}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Zone {zone}</h2><Pill>{state.locations.filter((l) => l.zone === zone).length} locations</Pill></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {state.locations.filter((l) => l.zone === zone).map((loc) => <div key={loc.id} className="rounded-2xl border border-eco-line p-4"><div className="flex items-center justify-between"><div className="text-lg font-black">{loc.code}</div><Pill tone={loc.status === 'active' ? 'green' : 'neutral'}>{loc.status}</Pill></div><div className="mt-2 text-sm text-eco-muted">Barcode: {loc.barcodeValue}</div><div className="mt-3 rounded-xl bg-eco-fog p-3 text-sm"><b>Assigned SKU</b><br />{loc.assignedSkuId ? helpers.sku(loc.assignedSkuId)?.displayName : 'Empty / unassigned'}</div></div>)}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
