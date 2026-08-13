import { useState } from 'react';
import { Timer } from './components/Timer';
import { Dashboard } from './components/Dashboard';
import { Edital } from './components/Edital';
import { Flashcards } from './components/Flashcards';
import { Simulados } from './components/Simulados';
import { Account } from './components/Account';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { SharedQuestionView } from './components/SharedQuestionView';
import { useStore } from './store';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, ListTodo, BrainCircuit, Trophy, Menu, X, UserCircle, LogOut, Users, BookOpen, CheckCircle2, GraduationCap, RefreshCw } from 'lucide-react';
import { Rankings } from './components/Rankings';
import { cn } from './lib/utils';
import { NotificationCenter } from './components/NotificationCenter';

type View = 'dashboard' | 'edital' | 'flashcards' | 'simulados' | 'account' | 'rankings';

export default function App() {
  useFirebaseSync();
  const { userProfile, isAuthenticated, login, logout, isDemoMode } = useStore();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const handleGoToSignup = () => {
    useStore.setState({ isAuthenticated: false });
    setIsSignup(true);
  };

  // Detecta parâmetro ?q= para questões compartilhadas publicamente
  const [sharedQuestionId, setSharedQuestionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q');
  });

  const clearSharedParam = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url.pathname);
    setSharedQuestionId(null);
  };

  const navItems = [
    { id: 'dashboard', label: 'Relatórios de Performance', icon: LayoutDashboard },
    { id: 'edital', label: 'Meu Edital', icon: ListTodo },
    { id: 'simulados', label: 'Simulados e Questões', icon: Trophy },
    { id: 'flashcards', label: 'Banco de Flashcards', icon: BrainCircuit },
    { id: 'rankings', label: 'Rankings e Amigos', icon: Users },
  ] as const;

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  // Se há um parâmetro ?q= e o usuário NÃO está autenticado, mostra a view pública
  if (sharedQuestionId && !isAuthenticated) {
    return (
      <SharedQuestionView
        questionId={sharedQuestionId}
        onGoToSignup={() => { clearSharedParam(); setIsSignup(true); }}
        onGoToLogin={() => { clearSharedParam(); }}
      />
    );
  }

  // Se há um parâmetro ?q= e o usuário ESTÁ autenticado, limpa o parâmetro
  // (o usuário já está dentro da plataforma)
  if (sharedQuestionId && isAuthenticated) {
    clearSharedParam();
  }

  if (!isAuthenticated) {
    if (isSignup) {
      return (
        <Signup 
          onSignup={() => { login(); setIsSignup(false); }} 
          onBackToLogin={() => setIsSignup(false)} 
        />
      );
    }
    return (
      <Login 
        onLogin={login} 
        onGotoSignup={() => setIsSignup(true)} 
      />
    );
  }

  // Se está autenticado, mas os dados ainda não foram carregados do Firebase
  if (!useStore.getState().isHydrated) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 selection:bg-emerald-500/30">
        {/* Background Glow Decorations */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -z-10 animate-pulse delay-700" />

        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-10 group">
            <div className="relative inline-block mb-6">
              <div className="relative w-32 h-32 mx-auto flex items-center justify-center transition-transform duration-500">
                <div className="absolute inset-0 border-4 border-dashed border-emerald-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-1 border-2 border-blue-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                
                <div className="z-10 flex flex-col items-center">
                  <div className="relative">
                    <BookOpen className="w-12 h-12 text-blue-400" />
                    <CheckCircle2 className="absolute -top-1 -right-1 w-6 h-6 text-emerald-400 bg-[#09090b] rounded-full" />
                  </div>
                  <GraduationCap className="w-8 h-8 text-emerald-500 -mt-1" />
                </div>
                
                <RefreshCw className="absolute inset-0 w-full h-full text-blue-500/10 animate-[spin_20s_linear_infinite]" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold tracking-tighter text-white">
              CICLO <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">A APROVAÇÃO</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-2 uppercase tracking-[0.2em] font-medium">
              Preparação que te leva lá
            </p>
          </div>

          {/* Sync Card */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
            
            <div className="relative z-10 py-4 flex flex-col items-center justify-center">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-spin border-t-emerald-500" />
                <div className="absolute inset-2 border-4 border-blue-500/10 rounded-full animate-spin-slow border-t-blue-500" />
              </div>
              <h2 className="text-lg font-bold text-zinc-100 animate-pulse">Sincronizando seus dados...</h2>
              <p className="text-zinc-500 text-xs mt-2 font-medium">Isso levará apenas um segundo.</p>
            </div>
          </div>

          <p className="text-center mt-12 text-zinc-600 text-xs">
            &copy; {new Date().getFullYear()} Ciclo a Aprovação. Todos os direitos reservados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-br from-emerald-400 to-blue-500 bg-clip-text text-transparent">
              Ciclo a Aprovação
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-semibold">Alta Performance</p>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-zinc-800 rounded-lg lg:hidden text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 space-y-3 border-t border-zinc-800">
          <button 
            onClick={() => handleViewChange('account')}
            className={cn(
              "w-full bg-zinc-950 rounded-xl p-4 border transition-all text-left group",
              currentView === 'account' ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Perfil do Usuário</div>
              <UserCircle className={cn("w-4 h-4 transition-colors", currentView === 'account' ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400")} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                {userProfile.avatar ? (
                  <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserCircle className="w-6 h-6 text-zinc-700" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-zinc-200 truncate">{userProfile.name}</div>
              </div>
            </div>
          </button>
          <button 
            onClick={async () => {
              await signOut(auth);
              logout();
              useStore.getState().resetAllData();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {isDemoMode && (
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-300 font-medium flex items-center justify-center gap-2 shrink-0">
            <span>✨ Você está no Modo de Demonstração (dados salvos localmente neste navegador).</span>
            <button 
              onClick={handleGoToSignup} 
              className="underline hover:text-white font-bold transition-colors cursor-pointer"
            >
              Criar Conta Grátis
            </button>
            <span>para salvar na nuvem!</span>
          </div>
        )}

        {/* Topbar */}
        <header className="h-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3 lg:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-zinc-900 rounded-lg lg:hidden text-zinc-400"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:block w-2 h-8 bg-emerald-500 rounded-full" />
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-zinc-100 truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">
              {currentView === 'account' ? 'Minha Conta' : navItems.find(i => i.id === currentView)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-4">
            <NotificationCenter />
            <Timer />
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-5xl mx-auto pb-24">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'edital' && <Edital onViewChange={handleViewChange} />}
            {currentView === 'flashcards' && <Flashcards />}
            {currentView === 'simulados' && <Simulados />}
            {currentView === 'rankings' && <Rankings />}
            {currentView === 'account' && <Account />}
          </div>
        </div>
      </main>
    </div>
  );
}
