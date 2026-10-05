import type { Observable } from 'rxjs';
import { tap, ignoreElements } from 'rxjs/operators';
import type { ActionType } from '../deps';
import type { Deps } from '../deps';
import { ofType } from '../of-type';

/** message/send: оптимистичное pending в стор, затем dispatch resend. */
export function sendFeature(
  d: Deps,
  actions$: Observable<{ type: ActionType; payload?: unknown }>,
) {
  return actions$.pipe(
    ofType('message/send'),
    tap(({ text }) => {
      const clientId = d.ids.clientId();
      d.store.getState().addPending({
        id: clientId,
        clientId,
        text,
        author: 'me',
        createdAt: d.clock.now(),
        status: 'pending',
      });
      d.dispatch('message/resend', { clientId });
    }),
    ignoreElements(),
  );
}
