import { Observable, Subject } from 'rxjs';
import { filter, mergeMap, timeout, catchError } from 'rxjs/operators';
import { from, of } from 'rxjs';
import type { Deps } from '../deps';
import type { Action } from '../../model/types';
import type { Message } from '../../shared/contract';

export function createSendFeature(deps: Deps, actions$: Subject<Action>): Observable<void> {
  return actions$.pipe(
    filter((a): a is { type: 'message/send'; clientId: string; text: string } | { type: 'message/retry'; clientId: string } =>
      a.type === 'message/send' || a.type === 'message/retry'
    ),
    mergeMap((action) => {
      const isNewSend = action.type === 'message/send';
      const { clientId, text } = isNewSend
        ? action as { type: 'message/send'; clientId: string; text: string }
        : (() => {
            const state = deps.store.getState();
            const msg = state.pendingMessages.get(action.clientId);
            return { clientId: action.clientId, text: msg?.text || '' };
          })();

      const state = deps.store.getState();
      if (isNewSend) {
        const msg: Message = {
          id: `pending-${clientId}`,
          clientId,
          text,
          author: 'me',
          createdAt: Date.now(),
        };
        state.addPending(msg);
      }

      return from(deps.transport.send(clientId, text)).pipe(
        timeout(10000),
        mergeMap((message) => {
          state.markSent(clientId, message);
          return of();
        }),
        catchError((error) => {
          if (error.message === 'offline') return of();
          state.markFailed(clientId);
          return of();
        })
      );
    })
  );
}
