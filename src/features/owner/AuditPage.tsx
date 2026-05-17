import { useOps } from '../../app/OpsContext';
import { Card, Pill, SectionTitle } from '../../components/ui';

export default function AuditPage() {
  const { state } = useOps();
  return (
    <>
      <SectionTitle title="Activity Log" subtitle="Actor-level audit trail. v1.5 records actorId, actorName, payload and version-ready metadata for later KPI, pay-per-task and Supabase optimistic locking." />
      <Card>
        <div className="divide-y divide-eco-line">
          {state.auditLogs.map((log) => <div key={log.id} className="grid gap-3 py-3 lg:grid-cols-[1fr_220px_260px] lg:items-start">
            <div>
              <div className="font-bold">{log.action}</div>
              <div className="text-sm text-eco-muted">{log.entityType} · {log.entityId}</div>
              {log.payload !== undefined && <pre className="mt-2 max-h-28 overflow-auto rounded-xl bg-eco-fog p-3 text-xs text-eco-muted">{JSON.stringify(log.payload, null, 2)}</pre>}
            </div>
            <div className="flex items-center gap-2"><Pill>{log.actorRole}</Pill><span className="text-sm font-bold">{log.actorName}</span></div>
            <div className="text-xs text-eco-muted">{log.actorId}<br />{new Date(log.createdAt).toLocaleString()}</div>
          </div>)}
        </div>
      </Card>
    </>
  );
}
