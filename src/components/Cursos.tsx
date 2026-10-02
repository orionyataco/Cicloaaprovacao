import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Library, Plus, ArrowRight, BookOpen, Clock, Settings, Edit2, Check, X, Globe, UserCircle, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';

interface CommunityEdital {
  uid: string;
  name: string;
  username: string;
  avatar: string | null;
  cargo: string;
  carreira: string;
  subjects: { subject: string; topics: string[] }[];
}

interface CursosProps {
  onViewChange: (view: any) => void;
}

export function Cursos({ onViewChange }: CursosProps) {
  const { savedCourses, activeCourseId, switchCourse, createCourse, deleteCourse, updateCourseName, editalInfo, subjects, topics } = useStore();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [communityEditals, setCommunityEditals] = useState<CommunityEdital[]>([]);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);
  const [communitySearchTerm, setCommunitySearchTerm] = useState('');

  useEffect(() => {
    const fetchCommunityEditals = async () => {
      if (!isFirebaseConfigured()) return;
      setIsLoadingCommunity(true);
      try {
        const currentUid = useStore.getState().uid;
        const profilesRef = collection(db, 'profiles');
        const snapshot = await getDocs(query(profilesRef, limit(50)));
        const results: CommunityEdital[] = [];
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.editalStructure && Array.isArray(data.editalStructure) && data.editalStructure.length > 0 && docSnap.id !== currentUid) {
            results.push({
              uid: docSnap.id,
              name: data.name || 'Estudante',
              username: data.username || '',
              avatar: data.avatar || null,
              cargo: data.editalInfo?.cargo || '',
              carreira: data.editalInfo?.carreira || '',
              subjects: data.editalStructure,
            });
          }
        });
        setCommunityEditals(results);
      } catch (err) {
        console.error('Erro na comunidade:', err);
      } finally {
        setIsLoadingCommunity(false);
      }
    };
    fetchCommunityEditals();
  }, []);

  const joinCommunityCourse = (course: CommunityEdital) => {
    const newName = `Cópia: ${course.name}`;
    createCourse(newName);
    // A importação deve puxar do curso recém ativado (sincrono graças à store)
    useStore.getState().importEdital(course.subjects, newName);
    useStore.getState().updateEditalInfo({ cargo: course.cargo, carreira: course.carreira });
    onViewChange('edital');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    
    createCourse(newCourseName);
    setIsCreating(false);
    setNewCourseName('');
    onViewChange('edital');
  };

  const handleSwitch = (id: string) => {
    switchCourse(id);
    onViewChange('edital');
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      updateCourseName(id, editName);
    }
    setEditingId(null);
  };

  const activeCourse = savedCourses.find(c => c.id === activeCourseId);

  // Calcula a % de compatibilidade de um curso listado em relação ao Curso Principal atualmente ativo
  const getCompatibility = (targetCourse: typeof savedCourses[0]) => {
     if (!activeCourse && subjects.length === 0) return 0; 
     const activeTopicsWithSubjects = topics.map(t => {
       const sub = subjects.find(s => s.id === t.subjectId);
       return { subjectName: sub?.name.toLowerCase().trim() || '', topicName: t.name.toLowerCase().trim() };
     });
     if (activeTopicsWithSubjects.length === 0) return 0;

     let matchCount = 0;
     targetCourse.topics.forEach(t => {
       const tSub = targetCourse.subjects.find(s => s.id === t.subjectId);
       const tSubStr = tSub?.name.toLowerCase().trim() || '';
       const tNameStr = t.name.toLowerCase().trim();
       const isMatch = activeTopicsWithSubjects.some(at => at.subjectName === tSubStr && at.topicName === tNameStr);
       if (isMatch) matchCount++;
     });
     
     if (targetCourse.topics.length === 0) return 0;
     return Math.round((matchCount / targetCourse.topics.length) * 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Meus Cursos & Editais</h1>
          <p className="text-sm text-zinc-400 mt-1">Gerencie seus múltiplos editais e jornadas de estudo</p>
        </div>
        
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Criar Novo Edital
          </button>
        ) : (
          <form onSubmit={handleCreate} className="flex gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800 focus-within:border-emerald-500/50">
            <input
              type="text"
              autoFocus
              placeholder="Nome do concurso/curso..."
              value={newCourseName}
              onChange={e => setNewCourseName(e.target.value)}
              className="bg-transparent text-sm text-zinc-200 px-3 outline-none min-w-[200px]"
            />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 p-2 rounded-lg text-white">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setIsCreating(false)} className="hover:bg-zinc-800 p-2 rounded-lg text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Renderiza o card do curso 'ativo' com informações em tempo real da Store. */}
        {activeCourseId && activeCourse && (
          <div className="bg-zinc-900 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 rounded-bl-xl text-[10px] font-bold text-emerald-400 uppercase">
              Ativo Agora
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <Library className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                {editingId === activeCourse.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveEdit(activeCourse.id); }} className="flex gap-2 w-full">
                     <input type="text" autoFocus value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => saveEdit(activeCourse.id)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100" />
                  </form>
                ) : (
                  <h3 className="font-bold text-zinc-100 text-lg flex items-center gap-2 group-hover:text-emerald-400 transition-colors">
                    {activeCourse.name}
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(activeCourse.id); setEditName(activeCourse.name); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-zinc-300 transition-all">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                )}
                <p className="text-xs text-zinc-500 line-clamp-1">{editalInfo.cargo || editalInfo.carreira || 'Sem cargo definido'}</p>
              </div>
            </div>

            <div className="flex bg-zinc-950/50 rounded-xl p-3 mb-5 border border-zinc-800/50">
              <div className="flex-1 text-center border-r border-zinc-800/50">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-0.5">Matérias</p>
                <p className="text-lg font-bold text-zinc-200">{subjects.length}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-0.5">Data da Prova</p>
                <p className="text-sm font-semibold text-zinc-300 mt-1">{editalInfo.dataProva ? format(new Date(editalInfo.dataProva), 'dd/MM/yy') : '--'}</p>
              </div>
            </div>

            <button 
              onClick={() => onViewChange('edital')}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 py-2.5 rounded-xl text-emerald-400 font-bold text-sm transition-all"
            >
              Continuar Estudando <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Renderiza os cursos salvos não-ativos */}
        {savedCourses.filter(c => c.id !== activeCourseId && c.id !== 'default_migration').map((course) => {
          const compatibilidade = getCompatibility(course);
          
          return (
          <div key={course.id} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-5 group flex flex-col relative overflow-hidden">
            
            {compatibilidade > 0 && activeCourseId && (
               <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500/20 rounded-bl-xl text-[10px] font-bold text-blue-400">
                 {compatibilidade}% Compatível
               </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-zinc-800/50 rounded-xl group-hover:bg-zinc-800 transition-colors">
                <Library className="w-6 h-6 text-zinc-400 group-hover:text-zinc-300" />
              </div>
              <div className="flex-1">
                {editingId === course.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveEdit(course.id); }} className="flex gap-2 w-full">
                     <input type="text" autoFocus value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => saveEdit(course.id)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100" />
                  </form>
                ) : (
                  <h3 className="font-bold text-zinc-300 text-lg flex items-center gap-2 group-hover:text-zinc-100 transition-colors">
                    {course.name}
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(course.id); setEditName(course.name); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-zinc-400 transition-all">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                )}
                <p className="text-xs text-zinc-500 line-clamp-1">{course.editalInfo?.cargo || course.editalInfo?.carreira || 'Sem cargo definido'}</p>
              </div>
            </div>

            <div className="flex bg-zinc-950/50 rounded-xl p-3 mb-5 border border-zinc-800/30 flex-1">
              <div className="flex-1 text-center border-r border-zinc-800/30">
                <p className="text-[10px] text-zinc-600 font-bold uppercase mb-0.5">Matérias</p>
                <p className="text-lg font-bold text-zinc-400">{course.subjects?.length || 0}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-zinc-600 font-bold uppercase mb-0.5">Data da Prova</p>
                <p className="text-sm font-semibold text-zinc-500 mt-1">{course.editalInfo?.dataProva ? format(new Date(course.editalInfo.dataProva), 'dd/MM/yy') : '--'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleSwitch(course.id)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl font-bold text-sm transition-all"
              >
                Ativar Curso
              </button>
              
              <button 
                onClick={() => { if(confirm('Tem certeza que deseja remover este curso? Você perderá todos os estudos vinculados unicamente a ele.')) deleteCourse(course.id); }}
                className="p-2.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                title="Excluir curso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          );
        })}

        {savedCourses.length === 0 && !activeCourseId && (
          <div className="col-span-full py-16 flex flex-col items-center text-center bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
            <BookOpen className="w-16 h-16 text-emerald-500/20 mb-4" />
            <h3 className="text-xl font-bold text-zinc-300 mb-2">Nenhum curso iniciado</h3>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">Comece agora mesmo criando seu primeiro edital de estudos e acompanhe seu progresso.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-950/20 transition-all"
            >
              Criar Meu Primeiro Edital
            </button>
          </div>
        )}
      </div>

      {/* Seção da Comunidade */}
      <div className="pt-10 mb-8 border-t border-zinc-900 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" /> Explorar Editais da Comunidade
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Descubra mapas de estudo compartilhados por outros usuários</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por cargo, usuário..."
              value={communitySearchTerm}
              onChange={(e) => setCommunitySearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>

        {isLoadingCommunity ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 relative mb-4">
              <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-spin border-t-blue-500" />
            </div>
            <p className="text-zinc-500 text-sm animate-pulse">Buscando editais recentes...</p>
          </div>
        ) : communityEditals.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-3xl">
             <p className="text-zinc-500 text-sm">Nenhum edital compatível encontrado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {communityEditals
              .filter(ce => {
                if (!communitySearchTerm.trim()) return true;
                const term = communitySearchTerm.toLowerCase();
                return (
                  ce.name.toLowerCase().includes(term) ||
                  ce.username.toLowerCase().includes(term) ||
                  ce.cargo.toLowerCase().includes(term) ||
                  ce.carreira.toLowerCase().includes(term) ||
                  ce.subjects.some(s => s.subject.toLowerCase().includes(term))
                );
              })
              .map(ce => (
                <div key={ce.uid} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-blue-500/30 transition-all flex flex-col group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -z-10 group-hover:bg-blue-500/10 transition-colors" />
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                      {ce.avatar ? (
                        <img src={ce.avatar} alt={ce.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserCircle className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{ce.name}</h3>
                      {ce.username && <p className="text-[10px] text-zinc-500 truncate">@{ce.username}</p>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 mb-5">
                    {(ce.cargo || ce.carreira) ? (
                      <div className="flex flex-col gap-1">
                        {ce.cargo && <span className="bg-blue-500/10 text-blue-400 text-xs font-semibold px-2 py-1 rounded line-clamp-2 truncate">{ce.cargo}</span>}
                        {ce.carreira && <span className="bg-zinc-800 text-zinc-400 text-[10px] uppercase font-bold px-2 py-1 rounded truncate w-fit">{ce.carreira}</span>}
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-xs italic">Cargo indefinido</span>
                    )}
                    <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between items-center">
                       <span className="text-xs font-medium text-zinc-400">{ce.subjects.length} Matérias</span>
                       <span className="text-[10px] text-zinc-600 font-bold bg-zinc-950 px-1.5 py-0.5 rounded">{ce.subjects.reduce((a, b) => a + b.topics.length, 0)} Tópicos</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => joinCommunityCourse(ce)}
                    className="w-full bg-zinc-950 hover:bg-blue-600 text-zinc-300 hover:text-white border border-zinc-800 hover:border-blue-500 py-2.5 rounded-xl font-bold text-sm transition-all"
                  >
                    Ingressar neste Curso
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
