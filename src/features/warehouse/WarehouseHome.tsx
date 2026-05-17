import { Link } from 'react-router-dom';
import { ArrowDownToLine, Boxes, ClipboardList, MapPinned, PackageCheck, ScanLine, TriangleAlert } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { BigStat, FieldHeader, Pill, QuickLinkCard } from '../../components/ui';

export default function WarehouseHome() {
  const { state } = useOps();
  const activeWave = state.waves.find((w) => ['planned', 'picking', 'picked', 'sorting'].includes(w.status));
  const receiving = state.receivingBatches.length;
  const putawayPending = state.putawayTasks.filter((t) => t.status === 'pending').length;
  const sortingWaiting = state.sortingTasks.filter((t) => ['pending', 'sorting'].includes(t.status)).length;
  const packingReady = state.orders.filter((o) => ['sorted', 'packed'].includes(o.status)).length;
  const labelsToday = state.packages.filter((p) => p.status !== 'voided').length;
  const openIssues = state.exceptions.filter((e) => e.status === 'open').length;

  return (
    <div className="field-page">
      <FieldHeader
        eyebrow="Warehouse mobile"
        title="Today’s warehouse work"
        subtitle="Aisle picking uses location prompts. SKU confirmation happens at sorting and packing, where mistakes are easiest to catch."
        right={<Pill tone={activeWave ? 'amber' : 'green'}>{activeWave ? `${activeWave.waveNumber} active` : 'clear'}</Pill>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat label="Putaway" value={putawayPending} hint="staging tasks" />
        <BigStat label="Sorting" value={sortingWaiting} hint="orders waiting" />
        <BigStat label="Packing" value={packingReady} hint="ready for labels" />
        <BigStat label="Labels" value={labelsToday} hint="printed / active" />
        <BigStat label="Issues" value={openIssues} hint="open exceptions" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLinkCard to="/warehouse/receiving" title="Receiving" body="Scan carton barcode, enter quantity, confirm mixed-carton warning." count={receiving}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><ClipboardList size={18} /> Inbound batches</div>
        </QuickLinkCard>
        <QuickLinkCard to="/warehouse/putaway" title="Putaway" body="Move received stock from staging into A1/A2 locations with location and product barcode checks." count={putawayPending}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><ArrowDownToLine size={18} /> Staging to shelf</div>
        </QuickLinkCard>
        <QuickLinkCard to="/warehouse/waves" title="Cart wave picking" body="Use the small trolley as A/B/C/D slots for four small customers, while big customers stay single pick." count={state.waves.length}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><Boxes size={18} /> 4-slot trolley</div>
        </QuickLinkCard>
        <QuickLinkCard to={activeWave ? `/warehouse/sorting/${activeWave.id}` : '/warehouse/waves'} title="Van-front sorting" body="After trolley picking, verify each customer slot before packing and labels." count={sortingWaiting}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><ScanLine size={18} /> SKU quality check</div>
        </QuickLinkCard>
        <QuickLinkCard to="/warehouse/packing" title="Packing & labels" body="Confirm actual package count, print 1/N thermal delivery labels." count={packingReady}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><PackageCheck size={18} /> Label bench</div>
        </QuickLinkCard>
        <QuickLinkCard to="/warehouse/locations" title="Locations" body="One location, one SKU. Recognise boss-provided location barcodes." count={state.locations.length}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><MapPinned size={18} /> A1–A6 setup</div>
        </QuickLinkCard>
        <QuickLinkCard to="/owner/exceptions" title="Open issues" body="Wrong SKU scans, missing packages, receiving warnings and delivery issues." count={openIssues}>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold text-eco-muted"><TriangleAlert size={18} /> Supervisor review</div>
        </QuickLinkCard>
      </div>

      <div className="mt-5 rounded-3xl border border-eco-line bg-white p-4 text-sm leading-6 text-eco-muted">
        <b className="text-eco-ink">Warehouse rule for v1.6:</b> receive into staging, put away by scanning location + product, use 4-slot cart waves for small mixed sleeve orders, single-pick bulky customers, verify accurately at van-front sorting, and keep short-pick/backorder records instead of blocking the wave.
      </div>
    </div>
  );
}
