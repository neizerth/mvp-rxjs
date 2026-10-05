import { Observable, from, EMPTY, mergeMap } from 'rxjs';
import { timeout, catchError, tap } from 'rxjs/operators';
import type { ActionType, Deps } from '../deps';
import { ofType } from '../of-type';

const ACK_TIMEOUT_MS = 10_000;

/** message/resend: отправить pending-сообщение с timeout и обработкой ошибок. */
export function resendFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('message/resend'),
    mergeMap(({ clientId }) => {
      const msg = d.store.getState().messages.find((m) => m.clientId === clientId);
      if (!msg || msg.status !== 'pending') return EMPTY;
      const epoch = d.session.epoch();
      return from(d.transport.send(clientId, msg.text)).pipe(
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
  );
}
