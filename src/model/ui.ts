import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { ChatModel, Message, Connection, ChatItem } from '../shared/contract';

interface AppState {
  messages: Message[];
  connection: Connection;
  showConnectionBanner: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  pendingMessages: Map<string, Message>;
  failedMessages: Set<string>;
  oldestId: string | undefined;
}

export function createUseChat(store: StoreApi<AppState>) {
  return function useChat(): ChatModel {
    const state = useStore(store);
    return {
      messages: state.messages.map((m) => ({
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
        const clientId = `${Date.now()}-${Math.random()}`;
        const msg: Message = {
          id: `pending-${clientId}`,
          clientId,
          text,
          author: 'me',
          createdAt: Date.now(),
        };
        const s = store.getState();
        const pending = new Map(s.pendingMessages);
        pending.set(clientId, msg);
        const msgs = [...s.messages, msg];
        store.setState({
          ...s,
          messages: msgs,
          pendingMessages: pending,
        });
        const processSend = (store as any).__processSend;
        if (processSend) {
          processSend(clientId, text);
        }
      },
      retry(clientId) {
        const s = store.getState();
        if (s.pendingMessages.has(clientId)) {
          const failed = new Set(s.failedMessages);
          failed.delete(clientId);
          store.setState({
            ...s,
            failedMessages: failed,
          });
          const processSend = (store as any).__processSend;
          if (processSend) {
            const msg = s.pendingMessages.get(clientId);
            if (msg) processSend(clientId, msg.text);
          }
        }
      },
      loadOlder() {
        const loadOlderFunc = (store as any).__loadOlderFunc;
        if (loadOlderFunc) {
          loadOlderFunc();
        }
      },
    };
  };
}
