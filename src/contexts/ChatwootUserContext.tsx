import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface ChatwootUser {
  id: number;
  name: string;
  email: string;
  token: string;
  account_id: number;
}

interface ChatwootUserContextValue {
  user: ChatwootUser | null;
}

const ChatwootUserContext = createContext<ChatwootUserContextValue>({ user: null });

const ALLOWED_ORIGIN = 'https://chat.anexusdigital.com.br';

export function ChatwootUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ChatwootUser | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== ALLOWED_ORIGIN) return;
      const data = event.data;
      if (!data || data.type !== 'CW_USER') return;
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        token: data.token,
        account_id: data.account_id,
      });
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <ChatwootUserContext.Provider value={{ user }}>
      {children}
    </ChatwootUserContext.Provider>
  );
}

export function useChatwootUser(): ChatwootUser | null {
  return useContext(ChatwootUserContext).user;
}
