import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, Pill, SectionTitle } from '../../components/ui';

export default function ExceptionsPage() {
  const { state, dispatch } = useOps();
  const open = state.exceptions.filter((e) => e.status === 'open');
  return (
    <>
      <SectionTitle title="Exceptions" subtitle="Mixed carton warnings, wrong SKU scans, missing packages and delivery issues are kept here for owner review." />
      {open.length === 0 ? <EmptyState title="No open exceptions" body="When a wrong SKU or package is scanned, it will appear here." /> : <div className="grid gap-4">{open.map((ex) => <Card key={ex.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Pill tone={ex.severity === 'high' ? 'red' : ex.severity === 'medium' ? 'amber' : 'neutral'}>{ex.severity}</Pill><Pill>{ex.type.replaceAll('_', ' ')}</Pill></div><div className="mt-3 font-bold">{ex.message}</div><div className="mt-1 text-sm text-eco-muted">{new Date(ex.createdAt).toLocaleString()}</div></div><Button onClick={() => dispatch({ type: 'RESOLVE_EXCEPTION', exceptionId: ex.id })}>Resolve</Button></div></Card>)}</div>}
    </>
  );
}
