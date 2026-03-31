import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { Search, UserPlus, UserMinus, Trophy, Target, Clock, BookOpen, ChevronRight, UserCircle, X, LayoutDashboard, Target as TargetIcon, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicProfile {
  uid: string;
  name: string;
  username: string;
  bio: string;
  avatar: string | null;
  editalInfo: {
    carreira: string;
    cargo: string;
    banca: string;
  };
  stats: {
    totalQuestions: number;
    totalCorrect: number;
    totalStudySeconds: number;
    completedTheories: number;
    totalTopics: number;
  };
}

type RankingMetric = 'totalQuestions' | 'totalCorrect' | 'totalStudySeconds' | 'completedTheories';

export function Rankings() {
  const { followingIds, followUser, unfollowUser, userProfile } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [friendsProfiles, setFriendsProfiles] = useState<PublicProfile[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  
  const [globalTop, setGlobalTop] = useState<PublicProfile[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<PublicProfile | null>(null);
  const [activeRankingTab, setActiveRankingTab] = useState<RankingMetric>('totalQuestions');

  // Fetch profiles of users we follow
  useEffect(() => {
    const fetchFriends = async () => {
      if (followingIds.length === 0) {
        setFriendsProfiles([]);
        return;
      }
      
      setIsLoadingFriends(true);
      try {
        const q = query(collection(db, 'profiles'), where('uid', 'in', followingIds));
        const snap = await getDocs(q);
        const profiles = snap.docs.map(doc => doc.data() as PublicProfile);
        setFriendsProfiles(profiles);
      } catch (err) {
        console.error('Erro ao buscar amigos:', err);
      } finally {
        setIsLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [followingIds]);

  // Fetch Global Top 5 to show active users
  useEffect(() => {
    const fetchGlobal = async () => {
      setLoadingGlobal(true);
      try {
        const q = query(
          collection(db, 'profiles'), 
          orderBy('stats.totalQuestions', 'desc'),
          limit(5)
        );
        const snap = await getDocs(q);
        setGlobalTop(snap.docs.map(doc => doc.data() as PublicProfile));
      } catch (err) {
        console.error('Erro ao buscar ranking global:', err);
      } finally {
        setLoadingGlobal(false);
      }
    };
    fetchGlobal();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim().replace(/^@/, '');
    if (!cleanQuery) return;

    setIsSearching(true);
    try {
      // Busca por username (exato ou prefixo)
      const qUsername = query(
        collection(db, 'profiles'), 
        where('username', '>=', cleanQuery.toLowerCase()), 
        where('username', '<=', cleanQuery.toLowerCase() + '\uf8ff'),
        limit(5)
      );
      
      // Busca por nome (exato ou prefixo)
      const qName = query(
        collection(db, 'profiles'), 
        where('name', '>=', cleanQuery), 
        where('name', '<=', cleanQuery + '\uf8ff'),
        limit(5)
      );

      const [snapUser, snapName] = await Promise.all([getDocs(qUsername), getDocs(qName)]);
      const combined = [...snapUser.docs, ...snapName.docs].map(doc => doc.data() as PublicProfile);
      
      // Remove duplicados e o próprio usuário
      const uniqueResults = Array.from(new Map(combined.map(p => [p.uid, p])).values())
        .filter(p => p.uid !== auth.currentUser?.uid);
      
      setSearchResults(uniqueResults);
      if (uniqueResults.length === 0) {
        alert('Nenhum aluno encontrado com este nome ou @id.');
      }
    } catch (err) {
      console.error('Erro na busca:', err);
      alert('Erro ao conectar com o banco de dados.');
    } finally {
      setIsSearching(false);
    }
  };

  const getSortedRanking = (metric: RankingMetric) => {
    return [...friendsProfiles].sort((a, b) => (b.stats[metric] || 0) - (a.stats[metric] || 0));
  };

  const formatStudyTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <p className="text-zinc-400 mt-1">Siga amigos e compare seu desempenho em tempo real.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Search and Friends */}
        <div className="space-y-6">
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              Buscar Amigos
            </h2>
            <form onSubmit={handleSearch} className="relative">
              <input 
                type="text"
                placeholder="Nome ou @usuario..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-blue-400"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 border-t border-zinc-800 pt-4">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resultados da Busca</p>
                {searchResults.map(profile => (
                  <div key={profile.uid} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setSelectedUser(profile)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                        {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-700 p-1" />}
                      </div>
                      <div className="min-w-0 text-[10px]">
                        <div className="text-sm font-bold text-zinc-100 truncate">{profile.name}</div>
                        <div className="text-zinc-500 font-mono italic">@{profile.username}</div>
                      </div>
                    </button>
                    {followingIds.includes(profile.uid) ? (
                      <button onClick={() => unfollowUser(profile.uid)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                        <UserMinus className="w-5 h-5" />
                      </button>
                    ) : (
                      <button onClick={() => followUser(profile.uid)} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg">
                        <UserPlus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" />
              Alunos em Destaque (Global)
            </h2>
            <div className="space-y-3">
              {globalTop.map((profile) => (
                <div key={profile.uid} className="flex items-center justify-between p-3 bg-zinc-800/20 rounded-xl border border-zinc-800/50">
                   <button 
                      onClick={() => setSelectedUser(profile)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                        {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-800 p-1" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-100 truncate">{profile.name}</div>
                        <div className="text-[10px] text-zinc-500 italic">@{profile.username}</div>
                      </div>
                    </button>
                    {auth.currentUser?.uid !== profile.uid && (
                      followingIds.includes(profile.uid) ? (
                        <button onClick={() => unfollowUser(profile.uid)} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md">Seguindo</button>
                      ) : (
                        <button onClick={() => followUser(profile.uid)} className="text-[10px] bg-blue-600/10 text-blue-400 px-2 py-1 rounded-md border border-blue-500/30">Seguir</button>
                      )
                    )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-emerald-400" />
              Amigos Seguindo ({followingIds.length})
            </h2>
            <div className="space-y-3">
              {friendsProfiles.map(profile => (
                <button 
                  key={profile.uid}
                  onClick={() => setSelectedUser(profile)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                      {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-800" />}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-zinc-100">{profile.name}</div>
                      <div className="text-[10px] text-zinc-500">🏆 {profile.stats.totalQuestions} questões</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
              {friendsProfiles.length === 0 && (
                <div className="text-center py-8 text-zinc-600 text-sm italic">
                  Você ainda não segue nenhum amigo.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Rankings */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-400" />
                Ligas e Rankings (Amigos)
              </h2>
            </div>
            
            <div className="flex bg-zinc-900/50 p-1 border-b border-zinc-800 overflow-x-auto no-scrollbar">
              {[
                { id: 'totalQuestions', label: 'Questões', icon: Target },
                { id: 'totalCorrect', label: 'Acertos', icon: Trophy },
                { id: 'totalStudySeconds', label: 'Horas', icon: Clock },
                { id: 'completedTheories', label: 'Teoria', icon: BookOpen },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveRankingTab(tab.id as RankingMetric)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                    activeRankingTab === tab.id ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {getSortedRanking(activeRankingTab).map((profile, idx) => (
                  <div key={profile.uid} className="flex items-center gap-4 group">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm",
                      idx === 0 ? "bg-amber-400 text-amber-950" : 
                      idx === 1 ? "bg-zinc-300 text-zinc-800" :
                      idx === 2 ? "bg-amber-700 text-amber-100" :
                      "text-zinc-500 bg-zinc-800/50"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between p-4 bg-zinc-800/20 border border-zinc-800/50 rounded-2xl group-hover:border-amber-400/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                          {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-800 p-1" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-100">{profile.name}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{profile.editalInfo.carreira || 'Concurseiro'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-zinc-100">
                          {activeRankingTab === 'totalStudySeconds' ? formatStudyTime(profile.stats.totalStudySeconds) : 
                           activeRankingTab === 'completedTheories' ? `${profile.stats.completedTheories}/${profile.stats.totalTopics}` :
                           profile.stats[activeRankingTab]}
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                          {activeRankingTab === 'totalQuestions' ? 'Total' : 
                           activeRankingTab === 'totalCorrect' ? 'Acertos' :
                           activeRankingTab === 'totalStudySeconds' ? 'Estudadas' : 'Concluídas'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {friendsProfiles.length === 0 && (
                  <div className="text-center py-20 text-zinc-600">
                    Siga amigos para vê-los no ranking.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                  {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-800 p-2" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">{selectedUser.name}</h2>
                  <p className="text-sm text-zinc-500 font-mono">@{selectedUser.username}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-3 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Bio & Concurso */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800">
                  <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Sobre o Aluno</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed italic">{selectedUser.bio || 'Nenhuma biografia informada.'}</p>
                </div>
                <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800">
                  <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Foco no Concurso</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-200">
                      <span className="font-bold text-blue-400">Cargo:</span> {selectedUser.editalInfo.cargo || 'Não informado'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-200">
                      <span className="font-bold text-emerald-400">Banca:</span> {selectedUser.editalInfo.banca || 'Não definida'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-800/20 p-4 rounded-xl border border-zinc-800">
                  <TargetIcon className="w-4 h-4 text-blue-400 mb-2" />
                  <p className="text-xl font-bold text-zinc-100">{selectedUser.stats.totalQuestions}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Questões</p>
                </div>
                <div className="bg-zinc-800/20 p-4 rounded-xl border border-zinc-800">
                  <Trophy className="w-4 h-4 text-emerald-400 mb-2" />
                  <p className="text-xl font-bold text-zinc-100">{selectedUser.stats.totalCorrect}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Acertos</p>
                </div>
                <div className="bg-zinc-800/20 p-4 rounded-xl border border-zinc-800">
                  <Clock className="w-4 h-4 text-amber-400 mb-2" />
                  <p className="text-xl font-bold text-zinc-100">{formatStudyTime(selectedUser.stats.totalStudySeconds)}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Estudadas</p>
                </div>
                <div className="bg-zinc-800/20 p-4 rounded-xl border border-zinc-800">
                  <BookOpen className="w-4 h-4 text-purple-400 mb-2" />
                  <p className="text-xl font-bold text-zinc-100">{selectedUser.stats.completedTheories}/{selectedUser.stats.totalTopics}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Teoria</p>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <LayoutDashboard className="w-24 h-24 text-zinc-100" />
                </div>
                <h3 className="text-lg font-bold text-zinc-100 mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Resumo de Performance
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400 font-medium">Aproveitamento Geral</span>
                      <span className="text-zinc-100 font-bold">
                        {selectedUser.stats.totalQuestions > 0 
                          ? Math.round((selectedUser.stats.totalCorrect / selectedUser.stats.totalQuestions) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-1000"
                        style={{ width: `${selectedUser.stats.totalQuestions > 0 ? (selectedUser.stats.totalCorrect / selectedUser.stats.totalQuestions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400 font-medium">Progresso de Edital</span>
                      <span className="text-zinc-100 font-bold">
                        {selectedUser.stats.totalTopics > 0 
                          ? Math.round((selectedUser.stats.completedTheories / selectedUser.stats.totalTopics) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                        style={{ width: `${selectedUser.stats.totalTopics > 0 ? (selectedUser.stats.completedTheories / selectedUser.stats.totalTopics) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <footer className="p-6 border-t border-zinc-800 bg-zinc-950/20 flex gap-4">
              {followingIds.includes(selectedUser.uid) ? (
                <button 
                  onClick={() => unfollowUser(selectedUser.uid)}
                  className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <UserMinus className="w-5 h-5" /> Deixar de Seguir
                </button>
              ) : (
                <button 
                  onClick={() => followUser(selectedUser.uid)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <UserPlus className="w-5 h-5" /> Seguir Aluno
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
