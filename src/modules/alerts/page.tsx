import { useEffect, useState } from 'react';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { useQuery } from '@tanstack/react-query';
import { alertOrganization, listAlertHistory } from './services/client';
import { ThresholdSettings } from './ThresholdSettings';
import { ChannelSettings } from './ChannelSettings';

export function AlertsPage() {
  const [page, setPage] = useState(1); const [perPage, setPerPage] = useState(20);
  const [org, setOrg] = useState(''); const [sessionError, setSessionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let generation = 0;
    const clear = () => { generation++; setOrg(''); setPage(1); setSessionError(false); };
    const refresh = () => { clear(); const current = generation; void alertOrganization().then((id) => { if (current === generation) setOrg(id); }).catch(() => { if (current === generation) setSessionError(true); }); };
    refresh(); window.addEventListener('organization:will-change', clear); window.addEventListener('organization:changed', refresh);
    return () => { generation++; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [attempt]);
  const query = useQuery({ queryKey: ['alert-history', org, page, perPage], queryFn: () => listAlertHistory(page, perPage), enabled: !!org });
  return <section><h1 className="mb-5 text-2xl font-semibold">Alert history</h1>
    {!org && !sessionError && <p role="status">Select an organization to view alert history.</p>}
    {sessionError && <p role="alert">Unable to load alert organization. <button onClick={() => setAttempt((value) => value + 1)}>Retry</button></p>}
    {org && <><ChannelSettings organizationId={org} /><ThresholdSettings organizationId={org} /><label>Items per page<select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}>{[20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      {query.isPending && <p role="status">Loading alert history…</p>}
      {query.isError && <div role="alert">Unable to load alert history: {query.error.message}<button onClick={() => void query.refetch()}>Retry</button></div>}
      {query.data?.data.length === 0 && <p>No alert history found.</p>}
      {query.data?.data.length === 0 && <SetupLinks />}
      {query.data?.data.map((item) => <article className="mb-3 border bg-white p-4" key={item.id}><h2 className="font-semibold">{item.rule || 'Alert'}</h2><p>{item.message}</p><p>{item.detectedAt} · {item.repository || '—'} · {item.subject || '—'}</p></article>)}
      <div className="flex gap-3"><button disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button disabled={query.isFetching || !query.data || page * perPage >= query.data.total} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </>}
  </section>;
}
