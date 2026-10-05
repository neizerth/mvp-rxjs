import { Observable, from, EMPTY } from 'rxjs';
import { timeout, catchError, tap, groupBy, mergeMap, switchMap } from 'rxjs/operators';
import type { Deps } from '../deps';

const ACK_TIMEOUT_MS = 10_000;

/** Per-message pipeline: отправка с отменой при повторе того же clientId. */
export function sendPipeline(
  d: Deps,
  messages$: Observable<{ type: 'send' | 'retry' | 'resend'; clientId?: string }>,
) {
  return messages$.pipe(
    groupBy((msg) => msg.clientId || 'batch'),
    mergeMap((group$) =>
      group$.pipe(
        switchMap((msg) => {
          const { clientId } = msg;
          if (!clientId) return EMPTY;

          const m = d.store.getState().messages.find((x) => x.clientId === clientId);
          if (!m || m.status !== 'pending') return EMPTY;

          const epoch = d.session.epoch();
          return from(d.transport.send(clientId, m.text)).pipe(
            timeout({ first: ACK_TIMEOUT_MS }),
            tap((ack) => {
              if (d.session.assertEpoch(epoch)) {
                d.store.getState().markSent(clientId, ack.id);
              }
            }),
            catchError((e) => {
              if (!(e instanceof Error && e.message === 'offline')) {
                d.store.getState().markFailed(clientId);
              }
              return EMPTY;
            }),
          );
        }),
      ),
    ),
  );
}
