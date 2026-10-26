import { useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { acceptInvitation } from './services/client';

/** Accepts a link invitation for the authenticated account. */
export function InvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const accept = useMutation({ mutationFn: () => acceptInvitation({ token }), onSuccess: () => navigate('/members') });
  return <section><h1 className="text-2xl font-semibold">Organization invitation</h1><button className="mt-4 rounded bg-blue-700 px-4 py-2 text-white" disabled={accept.isPending} onClick={() => accept.mutate()}>Accept invitation</button>{accept.isError && <p role="alert">Unable to accept this invitation.</p>}</section>;
}
