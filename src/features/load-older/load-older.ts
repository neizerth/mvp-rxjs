import { Observable, from } from 'rxjs';
import { exhaustMap, finalize, retry } from 'rxjs/operators';
import { timer } from 'rxjs';
import type { ActionType, Deps } from '../deps';
import { ofType } from '../of-type';

/** history/loadOlder: первая страница и подгрузка вверх. Повторный вызов во время загрузки игнорируется. */
export function loadOlderFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('history/loadOlder'),
    exhaustMap(() => {
      const s = d.store.getState();
      if (!s.hasOlder) return new Observable((observer) => observer.complete());

      s.loadOlderStarted();
      const epoch = d.session.epoch();
      const beforeId = s.messages.find((m) => m.status === 'sent')?.id;

      return from(d.transport.loadHistory(beforeId)).pipe(
        retry({
          count: 2,
          delay: (_, n) => timer(2 ** n * 100),
        }),
        exhaustMap((page) => {
          return new Observable<void>((observer) => {
            if (!d.session.assertEpoch(epoch)) {
              s.loadOlderFailed();
              observer.complete();
              return;
            }
            s.loadOlderDone(page.messages, page.hasMore);
            observer.complete();
          });
        }),
        finalize(() => {
          if (d.store.getState().loadingOlder) {
            d.store.getState().loadOlderFailed();
          }
        }),
      );
    }),
  );
}
