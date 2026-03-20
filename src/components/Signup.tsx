import React, { useState } from 'react';
import { Mail, Lock, User, UserPlus, CheckCircle2, BookOpen, GraduationCap, RefreshCw, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

interface SignupProps {
  onSignup: () => void;
  onBackToLogin: () => void;
}

export function Signup({ onSignup, onBackToLogin }: SignupProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("As senhas não coincidem!");
      return;
    }
    
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      onSignup();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao criar sua conta.");
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
        <div className="text-center mb-8 group">
          <div className="relative inline-block mb-4">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
              <div className="absolute inset-0 border-4 border-dashed border-emerald-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="z-10 flex flex-col items-center">
                <div className="relative">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                  <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-emerald-400 bg-[#09090b] rounded-full" />
                </div>
                <GraduationCap className="w-6 h-6 text-emerald-500 -mt-0.5" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-white">
            CRIAR SUA <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">CONTA</span>
          </h1>
        </div>

        {/* Signup Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group/card">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
          
          <button 
            onClick={onBackToLogin}
            className="absolute top-6 left-6 text-zinc-500 hover:text-emerald-400 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4 relative z-10">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within/field:text-emerald-400 transition-colors" />
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  className="w-full bg-zinc-950/30 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within/field:text-emerald-400 transition-colors" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@email.com"
                  className="w-full bg-zinc-950/30 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    className="w-full bg-zinc-950/30 border border-zinc-800 rounded-2xl py-3.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Confirmar
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    className="w-full bg-zinc-950/30 border border-zinc-800 rounded-2xl py-3.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl text-center font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group/btn"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>CRIAR CONTA AGORA</span>
                    <UserPlus className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
            <p className="text-zinc-500 text-sm">
              Já possui uma conta?{' '}
              <button 
                onClick={onBackToLogin}
                className="text-emerald-400 font-semibold hover:underline decoration-emerald-500/30 underline-offset-4"
              >
                Fazer login
              </button>
            </p>
          </div>
        </div>

        <p className="text-center mt-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em]">
          Ciclo à Aprovação &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
