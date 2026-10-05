import { Subject } from 'rxjs';
import type { StoreApi } from 'zustand';
import type { Message } from '../../shared/contract';
import type { Transport } from '../../shared/transport';

interface AppState {
  messages: Message[];
  loadingOlder: boolean;
  hasOlder: boolean;
  oldestId: string | undefined;
}

export function createLoadOlderProcess(deps: {
  store: StoreApi<AppState>;
  transport: Transport;
}) {
  const { store, transport } = deps;
  const loadOlder$ = new Subject<void>();

  const processLoadOlder = () => {
    const s = store.getState();
    if (!s.hasOlder || s.loadingOlder) return;

    store.setState({ ...s, loadingOlder: true });

    transport.loadHistory(s.oldestId).then(({ messages, hasMore }) => {
      const st = store.getState();
      const all = [...messages, ...st.messages];
      all.sort((a, b) =>
        a.createdAt !== b.createdAt
          ? a.createdAt - b.createdAt
          : a.id.localeCompare(b.id)
      );
      store.setState({
        ...st,
        messages: all,
        loadingOlder: false,
        hasOlder: hasMore,
        oldestId: messages.length > 0 ? messages[0]!.id : st.oldestId,
      });
    });
  };

  // Store reference for useChat to call
  (deps.store as any).__loadOlderFunc = processLoadOlder;
  (deps.store as any).__loadOlderSubject = loadOlder$;

  const sub = loadOlder$.subscribe(() => {
    processLoadOlder();
  });

  return {
    unsubscribe() {
      sub.unsubscribe();
      loadOlder$.complete();
    },
  };
}
