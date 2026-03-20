import React, { useState, useRef } from 'react';
import { useStore } from '@/store';
import { User, Trash2, Save, AlertTriangle, ShieldCheck, Camera, X as CloseIcon } from 'lucide-react';

export function Account() {
  const { userProfile, updateUserProfile, resetAllData } = useStore();
  const [formData, setFormData] = useState(userProfile);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    updateUserProfile(formData);
  };

  const handleReset = () => {
    resetAllData();
    setShowResetConfirm(false);
    window.location.reload();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        alert('A imagem deve ter no máximo 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      <header>
        <h1 className="text-2xl font-bold text-zinc-100">Minha Conta</h1>
        <p className="text-zinc-400 mt-1">Gerencie seu perfil e configurações do sistema.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <User className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Informações Pessoais</h2>
            </div>

            {/* Avatar Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-zinc-950 border-2 border-zinc-800 overflow-hidden flex items-center justify-center">
                  {formData.avatar ? (
                    <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-10 h-10 text-zinc-700" />
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-500 transition-all active:scale-90"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-zinc-100 font-semibold">Foto de Perfil</h3>
                <p className="text-xs text-zinc-500 mt-1">PNG, JPG ou WEBP. Máximo de 1MB.</p>
                {formData.avatar && (
                  <button 
                    onClick={() => setFormData({ ...formData, avatar: null })}
                    className="text-xs text-red-500 hover:text-red-400 mt-2 font-medium flex items-center gap-1 mx-auto sm:mx-0"
                  >
                    <CloseIcon className="w-3 h-3" /> Remover foto
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome do Usuário</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Gênero</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                >
                  <option value="">Selecione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                  <option value="Prefiro não dizer">Prefiro não dizer</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Data de Nascimento</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Método Ativo</label>
                <input
                  type="text"
                  value={formData.activeMethod}
                  onChange={(e) => setFormData({ ...formData, activeMethod: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="Ex: Ciclo à Aprovação"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Bio / Objetivos</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[100px]"
                placeholder="Conte um pouco sobre sua jornada de estudos..."
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>

        {/* System Settings & Reset */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Sistema</h2>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Versão do App</p>
                <p className="text-zinc-100 font-mono">v1.2.0-mobile-ready</p>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Armazenamento Local</p>
                <p className="text-zinc-100">Seus dados são salvos apenas neste navegador.</p>
              </div>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Zona de Perigo</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Ao resetar o sistema, todos os seus editais, ciclos, questões e flashcards serão apagados permanentemente.
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 px-4 py-3 rounded-xl font-semibold transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              Resetar Todo o Sistema
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="p-3 bg-red-500/10 rounded-2xl">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">Tem certeza?</h2>
            </div>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Esta ação é irreversível. Todos os seus dados de estudo serão perdidos para sempre.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-zinc-400 hover:bg-zinc-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-900/20"
              >
                Sim, Resetar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
