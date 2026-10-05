import { Observable } from 'rxjs';
import type { Deps } from '../deps';
import type { BackendEvent } from '../../shared/contract';

export function createBannerFeature(deps: Deps): Observable<void> {
  return new Observable((subscriber) => {
    let bannerTimer: ReturnType<typeof setTimeout> | null = null;

    const unsub = deps.transport.backend.on((event: BackendEvent) => {
      if (event.type === 'connection') {
        const state = deps.store.getState();
        state.setConnection(event.state);

        if (event.state === 'reconnecting') {
          if (bannerTimer) clearTimeout(bannerTimer);
          bannerTimer = setTimeout(() => {
            const s = deps.store.getState();
            if (s.connection === 'reconnecting') {
              s.setBanner(true);
            }
          }, 3000);
        } else {
          if (bannerTimer) clearTimeout(bannerTimer);
          state.setBanner(false);
        }
      }
    });

    subscriber.add(() => {
      if (bannerTimer) clearTimeout(bannerTimer);
      unsub();
    });

    return () => {
      if (bannerTimer) clearTimeout(bannerTimer);
      unsub();
    };
  });
}
