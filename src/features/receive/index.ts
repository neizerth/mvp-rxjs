import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Deps } from '../deps';

export function createReceiveFeature(deps: Deps): Observable<void> {
  return new Observable((subscriber) => {
    const unsub = deps.transport.backend.on((event) => {
      if (event.type === 'message') {
        const state = deps.store.getState();
        state.receive(event.message);
      }
    });
    return unsub;
  });
}
