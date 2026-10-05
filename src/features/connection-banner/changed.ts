import type { Observable } from 'rxjs';
import { EMPTY, timer } from 'rxjs';
import { tap, switchMap, ignoreElements } from 'rxjs/operators';
import type { ActionType, Deps } from '../deps';
import { ofType } from '../of-type';

const BANNER_DELAY_MS = 3_000;

/**
 * connection/changed: статус в стор, сессия, баннер (reconnecting 3 с подряд),
 * при connected — независимый запуск outbox/flush.
 */
export function connectionBannerFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('connection/changed'),
    tap(({ state }) => {
      const s = d.store.getState();
      s.setConnection(state);
      if (state === 'reconnecting') {
        d.session.reconnecting();
      } else if (state === 'connected') {
        d.session.connected();
        s.hideBanner();
        d.dispatch('outbox/flush');
      }
    }),
    switchMap(({ state }) => {
      if (state === 'reconnecting') {
        return timer(BANNER_DELAY_MS).pipe(
          tap(() => d.store.getState().showBanner()),
          ignoreElements(),
        );
      }
      return EMPTY;
    }),
  );
}
