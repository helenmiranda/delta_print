// Contexto de usuário com suporte a fallback para modo desenvolvimento.
// Escuta mensagens postMessage do Chatwoot (iframe pai) com o tipo 'CW_USER'.
// Se os dados não chegarem em 3 segundos, usa um usuário de desenvolvimento.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Origem permitida para aceitar mensagens do Chatwoot
const ALLOWED_ORIGIN = 'https://chat.anexusdigital.com.br';

// Tempo de espera antes de ativar o fallback dev (ms)
const FALLBACK_TIMEOUT_MS = 3000;

export interface AppUser {
  email: string;
  name: string;
}

interface UserContextValue {
  user: AppUser;
  isDevMode: boolean;
}

// Usuário padrão para desenvolvimento local (fora do iframe do Chatwoot)
const DEV_USER: AppUser = {
  email: 'dev@anexus.com',
  name: 'Dev Mode',
};

const UserContext = createContext<UserContextValue>({
  user: DEV_USER,
  isDevMode: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    // Função que processa mensagens vindas do iframe pai (Chatwoot)
    function handleMessage(event: MessageEvent) {
      // Validar origem da mensagem por segurança
      if (event.origin !== ALLOWED_ORIGIN) return;
      const data = event.data;
      if (!data || data.type !== 'CW_USER') return;
      if (!data.email || !data.name) return;

      // Atualizar usuário com dados reais do Chatwoot
      setUser({ email: data.email, name: data.name });
    }

    window.addEventListener('message', handleMessage);

    // Fallback: se não receber dados em 3s, ativar modo dev
    const timer = setTimeout(() => {
      setUser((prev) => {
        if (prev === null) {
          setIsDevMode(true);
          return DEV_USER;
        }
        return prev;
      });
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, []);

  // Enquanto aguarda os dados, usar DEV_USER para não bloquear a renderização
  const resolvedUser = user ?? DEV_USER;

  return (
    <UserContext.Provider value={{ user: resolvedUser, isDevMode }}>
      {children}
    </UserContext.Provider>
  );
}

// Hook para consumir o contexto de usuário
export function useUser(): UserContextValue {
  return useContext(UserContext);
}
