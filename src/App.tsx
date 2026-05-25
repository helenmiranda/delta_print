import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChatwootUserProvider } from './contexts/ChatwootUserContext';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import QuotesPage from './pages/QuotesPage';
import ApprovalPage from './pages/ApprovalPage';
import PrePressPage from './pages/PrePressPage';
import PrintProofsPage from './pages/PrintProofsPage';
import ImpressaoExpressaPage from './pages/ImpressaoExpressaPage';
import DesignKanban from './pages/DesignKanban';
import TicketsPage from './pages/TicketsPage';

function App() {
  return (
    // ChatwootUserProvider para compatibilidade com funcionalidades existentes
    // UserProvider para o módulo de Design Kanban (com fallback dev mode)
    // ToastProvider para notificações globais disponíveis em toda a aplicação
    <ChatwootUserProvider>
      <UserProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/orcamentos-expressa" replace />} />
              <Route path="/orcamentos" element={<Navigate to="/orcamentos-expressa" replace />} />
              <Route path="/orcamentos-expressa" element={<QuotesPage setor="GRAFICA_EXPRESSA" />} />
              <Route path="/orcamentos-industrial" element={<QuotesPage setor="GRAFICA_INDUSTRIAL" />} />
              <Route path="/orcamentos-comunica-visual" element={<QuotesPage setor="COMUNICA_VISUAL" />} />
              <Route path="/impressao-expressa" element={<ImpressaoExpressaPage />} />
              <Route path="/aprovacao" element={<ApprovalPage />} />
              <Route path="/pre-impressao" element={<PrePressPage />} />
              <Route path="/provas" element={<PrintProofsPage />} />
              {/* Rota do módulo Design Kanban */}
              <Route path="/design" element={<DesignKanban />} />
              {/* Rota de Tickets */}
              <Route path="/tickets" element={<TicketsPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </UserProvider>
    </ChatwootUserProvider>
  );
}

export default App;
