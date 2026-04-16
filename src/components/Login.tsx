import React, { useState } from 'react';
import { Mail, Lock, LogIn, CheckCircle2, BookOpen, GraduationCap, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface LoginProps {
  onLogin: () => void;
  onGotoSignup: () => void;
}

export function Login({ onLogin, onGotoSignup }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err: any) {
      console.error(err);
      setError("E-mail ou senha inválidos.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 selection:bg-emerald-500/30">
      {/* Background Glow Decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -z-10 animate-pulse delay-700" />

      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-10 group">
          <div className="relative inline-block mb-6">
            {/* Recreating the Cycle Logo feel with Lucide icons and composition */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
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

        {/* Login Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group/card">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within/field:text-emerald-400 transition-colors" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@email.com"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Senha
                </label>
                <button type="button" className="text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors uppercase tracking-widest font-bold">
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within/field:text-emerald-400 transition-colors" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl text-center font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group/btn"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>ACESSAR PLATAFORMA</span>
                  <LogIn className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
            <p className="text-zinc-500 text-sm">
              Ainda não tem uma conta?{' '}
              <button 
                type="button"
                onClick={onGotoSignup}
                className="text-emerald-400 font-semibold hover:underline decoration-emerald-500/30 underline-offset-4"
              >
                Criar agora
              </button>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center mt-12 text-zinc-600 text-xs">
          &copy; {new Date().getFullYear()} Ciclo a Aprovação. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
