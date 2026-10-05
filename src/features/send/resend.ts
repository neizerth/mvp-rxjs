import { Observable, from, mergeMap } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import type { ActionType, Deps } from '../deps';
import { ofType } from '../of-type';

const ACK_TIMEOUT_MS = 10_000;

/**
 * Один шаг доставки: отправить pending-сообщение (идемпотентно по clientId).
 * offline — остаётся pending (дошлёт outbox); нет ack за 10 с — failed.
 */
export function resendMessage(d: Deps, { clientId }: { clientId: string }): Observable<void> {
  return new Observable((observer) => {
    const msg = d.store.getState().messages.find((m) => m.clientId === clientId);
    if (!msg || msg.status !== 'pending') {
      observer.complete();
      return;
    }

    const epoch = d.session.epoch();
    let completed = false;

    const timeoutHandle = d.timers.set(`ack:${clientId}`, () => {
      if (!completed) {
        completed = true;
        d.store.getState().markFailed(clientId);
        observer.complete();
      }
    }, ACK_TIMEOUT_MS);

    from(d.transport.send(clientId, msg.text))
      .pipe(
        tap((ack) => {
          if (!completed) {
            if (d.session.assertEpoch(epoch)) {
              d.store.getState().markSent(clientId, ack.id);
            }
            completed = true;
          }
        }),
        catchError((e) => {
          if (!completed) {
            if (!(e instanceof Error && e.message === 'offline')) {
              d.store.getState().markFailed(clientId);
            }
            completed = true;
          }
          return new Observable((obs) => obs.complete());
        }),
        finalize(() => {
          d.timers.clear(`ack:${clientId}`);
        }),
      )
      .subscribe({
        next: () => {
          if (!completed) {
            completed = true;
            observer.next();
          }
        },
        error: (e) => {
          if (!completed) {
            completed = true;
            observer.error(e);
          }
        },
        complete: () => {
          if (!completed) {
            completed = true;
          }
          observer.complete();
        },
      });
  });
}

/** message/resend: фича для обработки resend действий. */
export function resendFeature(d: Deps, actions$: Observable<{ type: ActionType; payload?: unknown }>) {
  return actions$.pipe(
    ofType('message/resend'),
    mergeMap(({ clientId }) => resendMessage(d, { clientId })),
  );
}
