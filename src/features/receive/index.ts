import { Observable } from 'rxjs';
import type { Backend, Message } from '../../shared/contract';
import type { Action } from '../../types';

export function createReceiveStream(backend: Backend): Observable<Action> {
  return new Observable((subscriber) => {
    const unsubscribe = backend.on((event) => {
      if (event.type === 'message') {
        subscriber.next({ type: 'receive', message: event.message });
      }
    });
    return unsubscribe;
  });
}
