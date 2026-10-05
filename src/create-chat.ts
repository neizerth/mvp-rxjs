import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { Subject, Subscription } from 'rxjs';
import type { CreateChat, Backend, ChatModel, Connection, Message } from './shared/contract';
import { createTransport } from './shared/transport';
import type { Action, State } from './model/types';
import type { Deps } from './features/deps';
import { createSendFeature } from './features/send';
import { createReceiveFeature } from './features/receive';
import { createOutboxFeature } from './features/outbox';
import { createLoadOlderFeature } from './features/load-older';
import { createBannerFeature } from './features/connection-banner';

export const createChat: CreateChat = (backend: Backend) => {
  const transport = createTransport(backend);
  const actions$ = new Subject<Action>();
  let idCounter = 0;

  const store = createStore<any>((set) => {
    const sortMsgs = (msgs: Message[]) => msgs.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    return {
      messages: [],
      connection: 'connecting',
      showConnectionBanner: false,
      pendingMessages: new Map(),
      failedMessages: new Set(),
      oldestId: undefined,
      hasOlder: true,
      loadingOlder: false,
      addPending: (msg: Message) => set((s: any) => ({
        ...s,
        messages: [...s.messages, msg],
        pendingMessages: new Map([...s.pendingMessages, [msg.clientId, msg]]),
      })),
      markSent: (clientId: string, msg: Message) => set((s: any) => ({
        ...s,
        messages: sortMsgs([...s.messages.filter((m: Message) => m.clientId !== clientId), msg]),
        pendingMessages: new Map([...s.pendingMessages].filter((k: any) => k[0] !== clientId)),
        failedMessages: new Set([...s.failedMessages].filter((id: string) => id !== clientId)),
      })),
      markFailed: (clientId: string) => set((s: any) => ({
        ...s,
        failedMessages: new Set([...s.failedMessages, clientId]),
      })),
      receive: (msg: Message) => set((s: any) => {
        const exists = s.messages.find((m: Message) => m.id === msg.id);
        if (exists) return s;
        const msgs = sortMsgs([...s.messages, msg]);
        return {
          ...s,
          messages: msgs,
          pendingMessages: new Map([...s.pendingMessages].filter((k: any) => k[0] !== msg.clientId)),
          failedMessages: new Set([...s.failedMessages].filter((id: string) => id !== msg.clientId)),
        };
      }),
      setConnection: (state: Connection) => set((s: any) => ({
        ...s,
        connection: state,
        showConnectionBanner: state === 'connected' ? false : s.showConnectionBanner,
      })),
      setBanner: (show: boolean) => set((s: any) => ({ ...s, showConnectionBanner: show })),
      setLoading: (loading: boolean) => set((s: any) => ({ ...s, loadingOlder: loading })),
      prepend: (msgs: Message[], hasMore: boolean) => set((s: any) => ({
        ...s,
        messages: sortMsgs([...msgs, ...s.messages]),
        hasOlder: hasMore,
        loadingOlder: false,
        oldestId: msgs.length > 0 ? msgs[0]!.id : s.oldestId,
      })),
    };
  });

  const deps: Deps = {
    store: store as any,
    transport,
    dispatch: (a) => actions$.next(a),
    ids: { nextClientId: () => `c-${Date.now()}-${++idCounter}` },
  };

  let sub: Subscription | null = null;

  return {
    useChat() {
      const state = useStore(store);
      return {
        messages: state.messages.map((m: Message) => ({
          ...m,
          status: !m.clientId || !state.pendingMessages.has(m.clientId)
            ? ('sent' as const)
            : state.failedMessages.has(m.clientId)
              ? ('failed' as const)
              : ('pending' as const),
        })),
        connection: state.connection,
        showConnectionBanner: state.showConnectionBanner,
        loadingOlder: state.loadingOlder,
        hasOlder: state.hasOlder,
        send(text) {
          const clientId = deps.ids.nextClientId();
          actions$.next({ type: 'message/send', clientId, text });
        },
        retry(clientId) {
          actions$.next({ type: 'message/retry', clientId });
        },
        loadOlder() {
          actions$.next({ type: 'loadOlder/request' });
        },
      };
    },

    start() {
      transport.connect();
      sub = new Subscription();

      sub.add(createSendFeature(deps, actions$).subscribe());
      sub.add(createReceiveFeature(deps).subscribe());
      sub.add(createOutboxFeature(deps).subscribe());
      sub.add(createLoadOlderFeature(deps, actions$).subscribe());
      sub.add(createBannerFeature(deps).subscribe());

      transport.loadHistory().then(({ messages, hasMore }) => {
        const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
        store.setState((s: any) => ({
          ...s,
          messages: sorted,
          hasOlder: hasMore,
          oldestId: sorted.length > 0 ? sorted[0]!.id : undefined,
        }));
      });
    },

    dispose() {
      sub?.unsubscribe();
      actions$.complete();
      transport.dispose();
    },
  };
};
