import {
  switchMap,
  map,
  startWith,
  distinctUntilChanged,
} from 'rxjs/operators';
import { Observable, timer, of } from 'rxjs';
import type { Action } from '../../types';

export function createConnectionBannerStream(
  connection$: Observable<string>
): Observable<Action> {
  return connection$.pipe(
    switchMap((state) => {
      if (state === 'reconnecting') {
        return timer(3000).pipe(
          map(() => ({ type: 'bannerShow' as const })),
          startWith({ type: 'bannerHide' as const })
        );
      }
      return of({ type: 'bannerHide' as const });
    }),
    distinctUntilChanged((a, b) => a.type === b.type)
  );
}
