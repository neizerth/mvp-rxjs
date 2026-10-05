import type { Observable } from 'rxjs';
import { tap, ignoreElements } from 'rxjs/operators';
import type { ActionType } from '../deps';
import type { Deps } from '../deps';
import { ofType } from '../of-type';

/** message/retry: ручной повтор только для failed, затем dispatch resend. */
export function retryFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('message/retry'),
    tap(({ clientId }) => {
      const msg = d.store.getState().messages.find((m) => m.clientId === clientId);
      if (msg?.status !== 'failed') return;
      d.store.getState().markPending(clientId);
      d.dispatch('message/resend', { clientId });
    }),
    ignoreElements(),
  );
}
