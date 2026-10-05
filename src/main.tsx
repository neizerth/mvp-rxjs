import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './shared/ui/App';
import { createFakeBackend } from './shared/backend';
import { createChat } from './model/create-chat';
import { createTransport } from './shared/transport';

const backend = createFakeBackend();
const transport = createTransport(backend);
const session = transport.session;
const chat = createChat(backend);
chat.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App chat={chat} backend={backend} />
  </StrictMode>
);
