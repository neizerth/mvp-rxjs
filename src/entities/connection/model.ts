import type { Connection } from '../../shared/contract';

export interface ConnectionState {
  connection: Connection;
  showConnectionBanner: boolean;
}

export const connectionActions = {
  setConnection(state: ConnectionState, connection: Connection): ConnectionState {
    return {
      ...state,
      connection,
      showConnectionBanner: connection === 'connected' ? false : state.showConnectionBanner,
    };
  },

  showBanner(state: ConnectionState): ConnectionState {
    return { ...state, showConnectionBanner: state.connection === 'reconnecting' };
  },

  hideBanner(state: ConnectionState): ConnectionState {
    return { ...state, showConnectionBanner: false };
  },
};
