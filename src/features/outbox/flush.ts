import type { Observable } from 'rxjs';
import { tap, ignoreElements } from 'rxjs/operators';
import type { ActionType, Deps } from '../deps';
import { ofType } from '../of-type';

/** outbox/flush: независимая работа по каждому pending — запускаем dispatch'ем и не ждём. */
export function flushOutboxFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('outbox/flush'),
    tap(() => {
      for (const m of d.store.getState().messages) {
        if (m.status === 'pending' && m.clientId) d.dispatch('message/resend', { clientId: m.clientId });
      }
    }),
    ignoreElements(),
  );
}
