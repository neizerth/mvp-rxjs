import { createStore } from 'zustand/vanilla';
import type { CreateChat, Backend, ChatModel, Connection, Message } from './shared/contract';
import { createTransport } from './shared/transport';
import { createUseChat } from './model/ui';
import { createSendProcess } from './features/send';
import { createReceiveProcess } from './features/receive';
import { createOutboxProcess } from './features/outbox';
import { createLoadOlderProcess } from './features/load-older';
import { createBannerProcess } from './features/connection-banner';

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

export const createChat: CreateChat = (backend: Backend) => {
  const transport = createTransport(backend);
  const store = createStore<AppState>(() => ({
    messages: [],
    connection: 'connecting',
    showConnectionBanner: false,
    loadingOlder: false,
    hasOlder: true,
    pendingMessages: new Map(),
    failedMessages: new Set(),
    oldestId: undefined,
  }));

  const deps = { store, transport };
  let cleanups: Array<{ unsubscribe(): void }> = [];

  return {
    useChat: createUseChat(store),
    start() {
      transport.connect();
      const creators = [
        createSendProcess,
        createReceiveProcess,
        createOutboxProcess,
        createLoadOlderProcess,
        createBannerProcess,
      ];
      cleanups = creators.map((c) => c(deps)).filter((p) => !!p);

      transport.loadHistory().then(({ messages, hasMore }) => {
        const sorted = [...messages];
        sorted.sort((a, b) =>
          a.createdAt !== b.createdAt
            ? a.createdAt - b.createdAt
            : a.id.localeCompare(b.id)
        );
        const s = store.getState();
        store.setState({
          ...s,
          messages: sorted,
          hasOlder: hasMore,
          oldestId: sorted.length > 0 ? sorted[0]!.id : undefined,
        });
      });
    },

    dispose() {
      cleanups.forEach((c) => c.unsubscribe?.());
      transport.dispose();
    },
  };
};
