import { useState } from 'react';
import { Timer } from './components/Timer';
import { Dashboard } from './components/Dashboard';
import { Edital } from './components/Edital';
import { Flashcards } from './components/Flashcards';
import { Simulados } from './components/Simulados';
import { Account } from './components/Account';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { useStore } from './store';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, ListTodo, BrainCircuit, Trophy, Menu, X, UserCircle, LogOut, Users } from 'lucide-react';
import { Rankings } from './components/Rankings';
import { cn } from './lib/utils';
import { NotificationCenter } from './components/NotificationCenter';

type View = 'dashboard' | 'edital' | 'flashcards' | 'simulados' | 'account' | 'rankings';

export default function App() {
  useFirebaseSync();
  const { userProfile, isAuthenticated, login, logout } = useStore();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

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
              Ciclo à Aprovação
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
            <h2 className="text-lg lg:text-xl font-semibold text-zinc-100 truncate max-w-[150px] sm:max-w-none">
              {currentView === 'account' ? 'Minha Conta' : navItems.find(i => i.id === currentView)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
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
