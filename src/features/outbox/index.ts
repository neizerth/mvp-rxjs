import { Observable } from 'rxjs';
import type { Deps } from '../deps';
import type { BackendEvent } from '../../shared/contract';
import type { Message } from '../../shared/contract';

export function createOutboxFeature(deps: Deps): Observable<void> {
  return new Observable((subscriber) => {
    const unsub = deps.transport.backend.on((event: BackendEvent) => {
      if (event.type === 'connection' && event.state === 'connected') {
        const state = deps.store.getState();
        state.pendingMessages.forEach((msg: Message, clientId: string) => {
          if (!state.failedMessages.has(clientId)) {
            deps.dispatch({ type: 'message/retry', clientId });
          }
        });
      }
    });
    return unsub;
  });
}
