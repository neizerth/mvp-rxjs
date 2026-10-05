import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { Subject, merge, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
import { flushOutboxFeature } from './features/outbox/flush';
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
  const features = [sendFeature, retryFeature, resendFeature, receiveFeature, flushOutboxFeature, loadOlderFeature, connectionBannerFeature];
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
