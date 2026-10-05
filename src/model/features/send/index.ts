import { mergeMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import type { Backend } from '../../../shared/contract';
import type { Action } from '../../types';

export function createSendStream(
  sendAction$: Observable<{
    clientId: string;
    text: string;
  }>,
  backend: Backend
): Observable<Action> {
  return sendAction$.pipe(
    mergeMap(({ clientId, text }) => {
      return new Observable<Action>((subscriber) => {
        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            subscriber.next({ type: 'failed', clientId });
            subscriber.complete();
          }
        }, 10000);

        backend.send(clientId, text)
          .then((message) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              subscriber.next({ type: 'acked', clientId, message });
              subscriber.complete();
            }
          })
          .catch((error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              if (error.message === 'offline') {
                subscriber.complete();
              } else {
                throw error;
              }
            }
          });

        return () => {
          clearTimeout(timeoutId);
        };
      });
    })
  );
}
