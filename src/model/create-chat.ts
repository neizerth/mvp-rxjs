import { useSyncExternalStore } from 'react';
import { BehaviorSubject, Subject, Subscription, mergeMap } from 'rxjs';
import type { CreateChat, Backend, ChatModel } from '../shared/contract';
import type { State } from './types';
import { createReceiveStream } from './features/receive';
import { createConnectionStream } from './entities/connection';

const initialState: State = {
  messages: [],
  connection: 'connecting',
  pendingMessages: new Map(),
  failedMessages: new Set(),
  oldestId: undefined,
  hasOlder: false,
  loadingOlder: false,
  showConnectionBanner: false,
};

export const createChat: CreateChat = (backend) => {
  const state$ = new BehaviorSubject<State>(initialState);
  const sendAction$ = new Subject<{ clientId: string; text: string }>();
  const loadOlder$ = new Subject<void>();
  let disposed = false;
  let subs: Subscription | null = null;
  let connectionBannerTimer: ReturnType<typeof setTimeout> | null = null;

  const setState = (fn: (s: State) => State) => {
    if (!disposed) {
      state$.next(fn(state$.value));
    }
  };

  function useChat(): ChatModel {
    const state = useSyncExternalStore(
      (notify) => {
        const sub = state$.subscribe(() => notify());
        return () => sub.unsubscribe();
      },
      () => state$.value
    );

    return {
      messages: state.messages.map((m) => {
        if (!m.clientId) {
          return { ...m, status: 'sent' as const };
        }
        const status = state.failedMessages.has(m.clientId)
          ? 'failed'
          : 'pending';
        return { ...m, status };
      }),
      connection: state.connection,
      showConnectionBanner: state.showConnectionBanner,
      hasOlder: state.hasOlder,
      loadingOlder: state.loadingOlder,
      send(text) {
        const clientId = `${Date.now()}-${Math.random()}`;
        const msg = {
          id: `pending-${clientId}`,
          clientId,
          text,
          author: 'me' as const,
          createdAt: Date.now(),
        };
        setState((s) => {
          const p = new Map(s.pendingMessages);
          p.set(clientId, msg);
          return {
            ...s,
            messages: [...s.messages, msg],
            pendingMessages: p,
            failedMessages: new Set(
              [...s.failedMessages].filter((id) => id !== clientId)
            ),
          };
        });
        sendAction$.next({ clientId, text });
      },
      retry(clientId) {
        const msg = state.pendingMessages.get(clientId);
        if (msg) {
          sendAction$.next({ clientId, text: msg.text });
        }
      },
      loadOlder() {
        if (!state.hasOlder || state.loadingOlder) return;
        loadOlder$.next();
      },
    };
  }

  return {
    useChat,
    start() {
      backend.connect();
      subs = new Subscription();

      subs.add(createReceiveStream(backend).subscribe((action) => {
        if (action.type === 'receive') {
          setState((s) => {
            const existing = s.messages.find((m) => m.id === action.message.id);
            if (existing) return s;
            const hasPending =
              action.message.clientId &&
              s.pendingMessages.has(action.message.clientId);
            if (hasPending && action.message.clientId) {
              const old = s.pendingMessages.get(action.message.clientId)!;
              const msgs = s.messages.filter((m) => m !== old);
              msgs.push(action.message);
              msgs.sort((a, b) =>
                a.createdAt !== b.createdAt
                  ? a.createdAt - b.createdAt
                  : a.id.localeCompare(b.id)
              );
              const p = new Map(s.pendingMessages);
              p.delete(action.message.clientId);
              return {
                ...s,
                messages: msgs,
                pendingMessages: p,
                failedMessages: new Set(
                  [...s.failedMessages].filter(
                    (id) => id !== action.message.clientId
                  )
                ),
              };
            }
            const msgs = [...s.messages, action.message];
            msgs.sort((a, b) =>
              a.createdAt !== b.createdAt
                ? a.createdAt - b.createdAt
                : a.id.localeCompare(b.id)
            );
            return { ...s, messages: msgs };
          });
        }
      }));

      let lastConnection = state$.value.connection;
      subs.add(createConnectionStream(backend).subscribe((action) => {
        if (action.type === 'connectionChanged') {
          const wasConnected = state$.value.connection === 'connected';
          setState((s) => {
            if (
              action.state === 'reconnecting' &&
              s.connection !== 'reconnecting'
            ) {
              connectionBannerTimer = setTimeout(() => {
                setState((st) => ({ ...st, showConnectionBanner: true }));
              }, 3000);
            } else if (
              action.state !== 'reconnecting' &&
              s.connection === 'reconnecting'
            ) {
              if (connectionBannerTimer) {
                clearTimeout(connectionBannerTimer);
                connectionBannerTimer = null;
              }
            }
            return {
              ...s,
              connection: action.state,
              showConnectionBanner:
                action.state === 'reconnecting'
                  ? s.showConnectionBanner
                  : false,
            };
          });
          if (
            action.state === 'connected' &&
            !wasConnected &&
            state$.value.pendingMessages.size > 0
          ) {
            state$.value.pendingMessages.forEach((msg, clientId) => {
              sendAction$.next({ clientId, text: msg.text });
            });
          }
          lastConnection = action.state;
        }
      }));

      subs.add(
        sendAction$
          .pipe(
            mergeMap(({ clientId, text }) => {
              return new Promise<void>((resolve) => {
                let done = false;
                const timeoutHandle = setTimeout(() => {
                  if (!done) {
                    done = true;
                    setState((s) => {
                      const f = new Set(s.failedMessages);
                      f.add(clientId);
                      return { ...s, failedMessages: f };
                    });
                    resolve();
                  }
                }, 10000);

                backend
                  .send(clientId, text)
                  .then((message) => {
                    if (!done) {
                      done = true;
                      clearTimeout(timeoutHandle);
                      setState((s) => {
                        const pending = s.pendingMessages.get(clientId);
                        if (!pending) return s;
                        const msgs = s.messages.filter((m) => m !== pending);
                        msgs.push(message);
                        msgs.sort((a, b) =>
                          a.createdAt !== b.createdAt
                            ? a.createdAt - b.createdAt
                            : a.id.localeCompare(b.id)
                        );
                        const p = new Map(s.pendingMessages);
                        p.delete(clientId);
                        const f = new Set(s.failedMessages);
                        f.delete(clientId);
                        return {
                          ...s,
                          messages: msgs,
                          pendingMessages: p,
                          failedMessages: f,
                        };
                      });
                    }
                    resolve();
                  })
                  .catch((err) => {
                    if (!done) {
                      if (err.message === 'offline') {
                        clearTimeout(timeoutHandle);
                      }
                      done = true;
                      resolve();
                    }
                  });
              });
            })
          )
          .subscribe()
      );

      subs.add(
        loadOlder$.subscribe(() => {
          const s = state$.value;
          if (!s.hasOlder || s.loadingOlder) return;
          setState((st) => ({ ...st, loadingOlder: true }));
          backend.loadHistory(s.oldestId).then(({ messages, hasMore }) => {
            setState((st) => {
              const all = [...messages, ...st.messages];
              all.sort((a, b) =>
                a.createdAt !== b.createdAt
                  ? a.createdAt - b.createdAt
                  : a.id.localeCompare(b.id)
              );
              return {
                ...st,
                messages: all,
                loadingOlder: false,
                hasOlder: hasMore,
                oldestId: messages.length > 0 ? messages[0]!.id : st.oldestId,
              };
            });
          });
        })
      );

      backend.loadHistory().then(({ messages, hasMore }) => {
        setState((s) => {
          const sorted = [...messages].sort((a, b) =>
            a.createdAt !== b.createdAt
              ? a.createdAt - b.createdAt
              : a.id.localeCompare(b.id)
          );
          return {
            ...s,
            messages: sorted,
            hasOlder: hasMore,
            oldestId: sorted.length > 0 ? sorted[0]!.id : undefined,
          };
        });
      });
    },
    dispose() {
      disposed = true;
      if (subs) subs.unsubscribe();
      if (connectionBannerTimer) clearTimeout(connectionBannerTimer);
      sendAction$.complete();
      loadOlder$.complete();
    },
  };
};
