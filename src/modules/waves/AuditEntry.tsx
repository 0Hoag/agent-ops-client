import { RelativeTime } from '../../shared/ui/ProductTerms';
const label = (value: string, fallback: string) => value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, fallback);

export function AuditEntry({ entry }: { entry: { actorID?: string; occurredAt?: string; createdAt?: string; action?: string; wave?: string; jobID?: string; outcome?: string } }) {
  return <><span>{entry.actorID ? label(entry.actorID, 'Actor recorded') : 'Actor not recorded — check audit source'}</span>{' · '}<RelativeTime value={entry.occurredAt ?? entry.createdAt} />{' · '}{entry.action ?? 'Action not recorded — check audit source'}{' · Batch '}{entry.wave ?? 'not assigned'}{' · '}{entry.jobID ? label(entry.jobID, 'Agent task recorded') : 'No agent task linked'}{' · '}{entry.outcome ?? 'Outcome not recorded — refresh audit history'}</>;
}
