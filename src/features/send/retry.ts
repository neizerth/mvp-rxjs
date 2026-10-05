import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import type { ActionType } from '../deps';
import type { Deps } from '../deps';
import { ofType } from '../of-type';
import { resendMessage } from './resend';

/** message/retry: ручной повтор только для failed, с тем же clientId. */
export function retryFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('message/retry'),
    mergeMap(({ clientId }) => {
      const msg = d.store.getState().messages.find((m) => m.clientId === clientId);
      if (msg?.status !== 'failed') return new Observable((observer) => observer.complete());
      d.store.getState().markPending(clientId);
      return resendMessage(d, { clientId });
    }),
  );
}
