import { Observable } from 'rxjs';
import type { Backend, Connection } from '../../shared/contract';
import type { Action } from '../../types';

export function createConnectionStream(backend: Backend): Observable<Action> {
  return new Observable((subscriber) => {
    const unsubscribe = backend.on((event) => {
      if (event.type === 'connection') {
        subscriber.next({
          type: 'connectionChanged',
          state: event.state,
        });
      }
    });
    return unsubscribe;
  });
}

export function getInitialConnection(): Connection {
  return 'connecting';
}
