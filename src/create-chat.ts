import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { Subject, merge, Subscription, Observable, EMPTY } from 'rxjs';
import { takeUntil, distinctUntilChanged, switchMap, tap, filter } from 'rxjs/operators';
import type { Chat, ChatModel, CreateChat } from './shared/contract';
import { createClock, createIds, createTimers } from './shared/runtime';
import { createSession, createTransport } from './shared/transport';
import { createConnectionSlice } from './entities/connection/model';
import { createMessagesSlice } from './entities/message/model';
import type { ActionType, ChatState, Deps } from './features/deps';
import { sendFeature } from './features/send/send';
import { retryFeature } from './features/send/retry';
import { resendFeature } from './features/send/resend';
import { receiveFeature } from './features/receive/receive';
import { loadOlderFeature } from './features/load-older/load-older';
import { connectionBannerFeature } from './features/connection-banner/changed';

export const createChat: CreateChat = (backend): Chat => {
  const store = createStore<ChatState>()((set) => ({ ...createMessagesSlice(set), ...createConnectionSlice(set) }));
  const timers = createTimers();
  const transport = createTransport(backend);
  const session = createSession();
  const actions$ = new Subject<{ type: ActionType; payload?: unknown }>();
  const stop$ = new Subject<void>();

  const deps: Deps = { store, transport, session, timers, ids: createIds(), clock: createClock(),
    dispatch: (type, ...args) => actions$.next({ type, payload: args[0] as unknown }) };

  // Outbox feature
  const outboxFeature = (d: Deps, act$: Observable<{ type: ActionType; payload?: unknown }>) =>
    act$.pipe(
      filter((a) => a.type === 'outbox/flush'),
      tap(() => {
        const pending = d.store.getState().messages.filter((m) => m.status === 'pending' && m.clientId);
        for (const m of pending) {
          if (m.clientId) d.dispatch('message/resend', { clientId: m.clientId });
        }
      }),
      switchMap(() => EMPTY),
    );

  const features = [
    sendFeature,
    retryFeature,
    resendFeature,
    receiveFeature,
    loadOlderFeature,
    connectionBannerFeature,
    outboxFeature,
  ];

  let subscription: Subscription | null = null;
  const actions = {
    send: (text: string) => deps.dispatch('message/send', { text }),
    retry: (clientId: string) => deps.dispatch('message/retry', { clientId }),
    loadOlder: () => deps.dispatch('history/loadOlder'),
  };
  let unsubscribe = () => {};

  return {
    useChat(): ChatModel {
      const { messages, connection, showConnectionBanner, hasOlder, loadingOlder } = useStore(store);
      return { messages, connection, showConnectionBanner, hasOlder, loadingOlder, ...actions };
    },
    start() {
      unsubscribe = transport.on((e) =>
        e.type === 'connection'
          ? deps.dispatch('connection/changed', { state: e.state })
          : deps.dispatch('message/receive', { message: e.message }),
      );
      transport.start();
      subscription = merge(...features.map((f) => f(deps, actions$).pipe(takeUntil(stop$)))).subscribe({
        error: (e) => console.error('[feature]', e),
      });
      deps.dispatch('history/loadOlder');
    },
    dispose() {
      stop$.next();
      stop$.complete();
      subscription?.unsubscribe();
      unsubscribe();
      session.stop();
      timers.clearAll();
    },
  };
};
