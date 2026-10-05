import type { StoreApi } from 'zustand';
import type { Connection } from '../../shared/contract';
import type { Transport } from '../../shared/transport';

interface AppState {
  connection: Connection;
  showConnectionBanner: boolean;
}

export function createBannerProcess(deps: {
  store: StoreApi<AppState>;
  transport: Transport;
}) {
  const { store, transport } = deps;
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;

  const unsubBackend = transport.backend.on((event) => {
    if (event.type === 'connection') {
      const s = store.getState();
      const newConn = event.state;

      if (newConn === 'reconnecting') {
        if (s.connection !== 'reconnecting') {
          if (bannerTimer) clearTimeout(bannerTimer);
          bannerTimer = setTimeout(() => {
            const st = store.getState();
            if (st.connection === 'reconnecting') {
              store.setState({
                ...st,
                showConnectionBanner: true,
              });
            }
          }, 3000);
        }
        store.setState({ ...s, connection: newConn });
      } else {
        if (bannerTimer) {
          clearTimeout(bannerTimer);
          bannerTimer = null;
        }
        store.setState({
          ...s,
          connection: newConn,
          showConnectionBanner: false,
        });
      }
    }
  });

  return {
    unsubscribe() {
      if (bannerTimer) clearTimeout(bannerTimer);
      unsubBackend();
    },
  };
}
