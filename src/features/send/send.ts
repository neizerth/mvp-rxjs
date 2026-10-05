import type { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import type { ActionType } from '../deps';
import type { Deps } from '../deps';
import { ofType } from '../of-type';
import { resendMessage } from './resend';

/** message/send: оптимистичное pending в стор, затем доставка. */
export function sendFeature(
  d: Deps,
  actions$: Observable<{ type: ActionType; payload?: unknown }>,
) {
  return actions$.pipe(
    ofType('message/send'),
    mergeMap(({ text }) => {
      const clientId = d.ids.clientId();
      d.store.getState().addPending({
        id: clientId,
        clientId,
        text,
        author: 'me',
        createdAt: d.clock.now(),
        status: 'pending',
      });
      return resendMessage(d, { clientId });
    }),
  );
}
