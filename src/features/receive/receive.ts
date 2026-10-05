import type { Observable } from 'rxjs';
import { tap, ignoreElements } from 'rxjs/operators';
import type { ActionType, Deps } from '../deps';
import { ofType } from '../of-type';

/** message/receive: слияние входящего (чужое, эхо своего, дубликат) делает срез. */
export function receiveFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('message/receive'),
    tap(({ message }) => {
      d.store.getState().receive(message);
    }),
    ignoreElements(),
  );
}
