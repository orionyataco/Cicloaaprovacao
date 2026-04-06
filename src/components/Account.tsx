import React, { useState, useRef } from 'react';
import { useStore } from '@/store';
import { User, Trash2, Save, AlertTriangle, ShieldCheck, Camera, X as CloseIcon, Loader2 } from 'lucide-react';
import { storage, auth, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, deleteDoc } from 'firebase/firestore';

export function Account() {
  const { userProfile, updateUserProfile, resetAllData } = useStore();
  const [formData, setFormData] = useState(userProfile);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(formData);
      alert('Perfil atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOldAvatar = async () => {
    if (userProfile.avatar && userProfile.avatar.includes('firebasestorage')) {
      try {
        const oldRef = ref(storage, userProfile.avatar);
        await deleteObject(oldRef);
      } catch (err) {
        console.warn('Erro ao deletar avatar antigo:', err);
      }
    }
  };

  const handleReset = async () => {
    const user = auth.currentUser;
    if (user) {
      // 1. Apagar arquivos do Storage (Avatar)
      await deleteOldAvatar();

      // 2. Apagar documento do Firestore para limpar o banco
      try {
        const docRef = doc(db, 'users', user.uid);
        await deleteDoc(docRef);
      } catch (err) {
        console.error('Erro ao deletar documento do Firestore:', err);
      }
    }

    // 3. Resetar estado local
    resetAllData();
    setShowResetConfirm(false);
    
    // Pequeno delay para garantir que o sync perceba o reset (se houver algum listener sobrando)
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const compressImage = (base64Str: string): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.7);
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const user = auth.currentUser;
    if (!user) return;

    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
      }
      
      setUploadingAvatar(true);
      try {
        // 1. Remover avatar antigo se existir no storage
        await deleteOldAvatar();

        // 2. Ler e Comprimir antes do upload
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const compressedBlob = await compressImage(base64);
          
          // 3. Upload para Firebase Storage em pastas por usuário
          const avatarRef = ref(storage, `avatars/${user.uid}/${Date.now()}_thumb.jpg`);
          const snapshot = await uploadBytes(avatarRef, compressedBlob);
          const downloadURL = await getDownloadURL(snapshot.ref);

          // 4. Atualizar estado com a URL do storage
          setFormData({ ...formData, avatar: downloadURL });
          updateUserProfile({ ...formData, avatar: downloadURL });
          console.log('[Account] Imagem comprimida e enviada para o servidor.');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Erro no upload:', err);
        alert('Falha ao subir imagem para o servidor.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const removeAvatar = async () => {
    await deleteOldAvatar();
    setFormData({ ...formData, avatar: null });
    updateUserProfile({ ...formData, avatar: null });
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
                  {uploadingAvatar ? (
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  ) : formData.avatar ? (
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
                  disabled={uploadingAvatar}
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-zinc-100 font-semibold">Foto de Perfil</h3>
                <p className="text-xs text-zinc-500 mt-1">PNG, JPG ou WEBP. Máximo de 5MB.</p>
                {formData.avatar && (
                  <button 
                    onClick={removeAvatar}
                    className="text-xs text-red-500 hover:text-red-400 mt-2 font-medium flex items-center gap-1 mx-auto sm:mx-0 disabled:opacity-50"
                    disabled={uploadingAvatar}
                  >
                    <CloseIcon className="w-3 h-3" /> Remover foto
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome do Usuário (Busca)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">@</span>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-0_]/g, '').toLowerCase() })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder="ex: joao_concursos"
                  />
                </div>
                <p className="text-[10px] text-zinc-600">Este nome será usado para ser encontrado por amigos.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome de Exibição</label>
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
                disabled={isSaving || uploadingAvatar}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
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

              <div className="p-4 bg-zinc-950 border border-emerald-500/10 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldCheck className="w-12 h-12 text-emerald-400" />
                </div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 relative z-10">Status de Sincronização</p>
                <div className="flex items-center gap-2 relative z-10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-zinc-100 font-medium">Nuvem Ativa (Firebase)</p>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 relative z-10">Seus dados estão protegidos e sincronizados.</p>
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
