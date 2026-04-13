import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, orderBy, addDoc } from 'firebase/firestore';
import { Search, UserPlus, UserMinus, Trophy, Target, Clock, BookOpen, ChevronRight, UserCircle, X, LayoutDashboard, Target as TargetIcon, Globe, Plus, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfWeek, parseISO } from 'date-fns';

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
  editalStructure?: { subject: string, topics: string[] }[];
}

type RankingMetric = 'proficiency' | 'totalStudySeconds' | 'completedTheories';

export function Rankings() {
  const { 
    followingIds, 
    weeklyRankingFriendIds, 
    toggleWeeklyRankingFriend, 
    followUser, 
    unfollowUser, 
    userProfile, 
    importEdital,
    customRankingStartDate,
    customRankingEndDate,
    setCustomRankingDates
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'social' | 'weekly'>('social');
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [friendsProfiles, setFriendsProfiles] = useState<PublicProfile[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  
  const [activeRankingTab, setActiveRankingTab] = useState<RankingMetric>('proficiency');
  const [activeWeeklyMetric, setActiveWeeklyMetric] = useState<'studySeconds' | 'proficiency'>('studySeconds');

  const [weeklyProfiles, setWeeklyProfiles] = useState<PublicProfile[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);

  const [globalTop, setGlobalTop] = useState<PublicProfile[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const [selectedUser, setSelectedUser] = useState<PublicProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Fetch profiles for custom weekly ranking
  useEffect(() => {
    const fetchWeekly = async () => {
      if (weeklyRankingFriendIds.length === 0) {
        setWeeklyProfiles([]);
        return;
      }
      
      setIsLoadingWeekly(true);
      try {
        const q = query(collection(db, 'profiles'), where('uid', 'in', weeklyRankingFriendIds));
        const snap = await getDocs(q);
        const profiles = snap.docs.map(doc => doc.data() as any);
        setWeeklyProfiles(profiles);
      } catch (err) {
        console.error('Erro ao buscar ranking semanal:', err);
      } finally {
        setIsLoadingWeekly(false);
      }
    };

    fetchWeekly();
  }, [weeklyRankingFriendIds]);

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

  const handleFollowAction = async (targetUid: string, targetName: string) => {
    followUser(targetUid);
    try {
      await addDoc(collection(db, 'notifications'), {
        toUid: targetUid,
        fromUid: auth.currentUser?.uid,
        type: 'follow',
        title: 'Novo seguidor!',
        message: `${userProfile.name} começou a seguir você.`,
        date: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error('Erro ao enviar notificação de follow:', err);
    }
  };

  const handleImportAction = async (targetUid: string, targetName: string, editalData: any) => {
    importEdital(editalData);
    try {
      await addDoc(collection(db, 'notifications'), {
        toUid: targetUid,
        fromUid: auth.currentUser?.uid,
        type: 'system',
        title: 'Edital Copiado!',
        message: `${userProfile.name} copiou a estrutura do seu edital.`,
        date: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error('Erro ao enviar notificação de cópia:', err);
    }
    showToast('Edital importado com sucesso!', 'success');
  };

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
      
      // Busca por nome (usando searchName que é sempre minúsculo)
      const qName = query(
        collection(db, 'profiles'), 
        where('searchName', '>=', cleanQuery.toLowerCase()), 
        where('searchName', '<=', cleanQuery.toLowerCase() + '\uf8ff'),
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
      alert('Erro ao conectar com o banco de dados. Verifique suas regras do Firestore.');
    } finally {
      setIsSearching(false);
    }
  };

  // Helper para o card do próprio usuário
  const myPublicProfile: PublicProfile = {
    uid: auth.currentUser?.uid || '',
    name: userProfile.name,
    username: userProfile.username,
    bio: userProfile.bio,
    avatar: userProfile.avatar,
    editalInfo: {
      carreira: useStore.getState().editalInfo.carreira,
      cargo: useStore.getState().editalInfo.cargo,
      banca: useStore.getState().editalInfo.banca,
    },
    editalStructure: useStore.getState().subjects.map(s => ({
      subject: s.name,
      topics: useStore.getState().topics.filter(t => t.subjectId === s.id).map(t => t.name)
    })),
    stats: {
      totalQuestions: useStore.getState().questionLogs.reduce((acc, curr) => acc + curr.totalQuestions, 0) + 
                     useStore.getState().simulados.filter(s => s.type === 'manual' || s.type === 'shared').reduce((acc, curr) => acc + curr.total, 0),
      totalCorrect: useStore.getState().questionLogs.reduce((acc, curr) => acc + curr.correctAnswers, 0) +
                   useStore.getState().simulados.filter(s => s.type === 'manual' || s.type === 'shared').reduce((acc, curr) => acc + curr.score, 0),
      totalStudySeconds: useStore.getState().studySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0),
      completedTheories: useStore.getState().topics.filter(t => t.status !== 'NOT_READ').length,
      totalTopics: useStore.getState().topics.length
    }
  };

  const getSortedRanking = (metric: RankingMetric) => {
    const all = [...friendsProfiles];
    // Adiciona o próprio usuário se ele tiver um perfil (username)
    if (myPublicProfile.uid && !all.some(p => p.uid === myPublicProfile.uid)) {
      all.push(myPublicProfile);
    }
    return all.sort((a, b) => {
      if (metric === 'proficiency') {
        const profA = a.stats.totalQuestions > 0 ? (a.stats.totalCorrect / a.stats.totalQuestions) * 100 : 0;
        const profB = b.stats.totalQuestions > 0 ? (b.stats.totalCorrect / b.stats.totalQuestions) * 100 : 0;
        return profB - profA;
      }
      return ((b.stats as any)[metric] || 0) - ((a.stats as any)[metric] || 0);
    });
  };

  const getSortedWeeklyRanking = () => {
    const all = [...weeklyProfiles];
    
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const rankingStart = customRankingStartDate ? parseISO(customRankingStartDate) : weekStart;
    const rankingEnd = customRankingEndDate ? parseISO(customRankingEndDate) : null;
    
    // Helper para filtrar os logs pelas datas
    const sumStat = (list: any[], dateField: string, valueField: string | ((curr: any) => number)) => {
       return list.reduce((acc, curr) => {
         const t = parseISO(curr[dateField]).getTime();
         if (t >= rankingStart.getTime() && (!rankingEnd || t <= rankingEnd.getTime())) {
            return acc + (typeof valueField === 'function' ? valueField(curr) : curr[valueField]);
         }
         return acc;
       }, 0);
    };

    // Add current user to weekly as well
    const myWeekly: any = {
      ...myPublicProfile,
      weeklyStats: {
        studySeconds: sumStat(useStore.getState().studySessions, 'date', 'durationSeconds'),
        totalQuestions: sumStat(useStore.getState().questionLogs, 'date', 'totalQuestions') + sumStat(useStore.getState().simulados.filter(s => s.type === 'manual' || s.type === 'shared'), 'date', 'total'),
        correctAnswers: sumStat(useStore.getState().questionLogs, 'date', 'correctAnswers') + sumStat(useStore.getState().simulados.filter(s => s.type === 'manual' || s.type === 'shared'), 'date', 'score')
      }
    };

    if (!all.some(p => p.uid === myWeekly.uid)) {
      all.push(myWeekly);
    }

    return all.sort((a: any, b: any) => {
      if (activeWeeklyMetric === 'proficiency') {
        const profA = a.weeklyStats?.totalQuestions > 0 ? (a.weeklyStats.correctAnswers / a.weeklyStats.totalQuestions) * 100 : 0;
        const profB = b.weeklyStats?.totalQuestions > 0 ? (b.weeklyStats.correctAnswers / b.weeklyStats.totalQuestions) * 100 : 0;
        return profB - profA;
      }
      const valA = a.weeklyStats?.[activeWeeklyMetric] || 0;
      const valB = b.weeklyStats?.[activeWeeklyMetric] || 0;
      return valB - valA;
    });
  };

  const formatStudyTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Ligas e Rankings</h1>
          <p className="text-zinc-400 mt-1">Siga amigos e compare seu desempenho em tempo real.</p>
        </div>
        
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('social')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              activeTab === 'social' ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Social / Global
          </button>
            <button 
            onClick={() => setActiveTab('weekly')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              activeTab === 'weekly' ? "bg-amber-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Meu Torneio
          </button>
        </div>
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
              <div className="mt-6 space-y-3 animate-in slide-in-from-top-2 border-t border-zinc-800 pt-6">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resultados da Busca</p>
                {searchResults.map(profile => (
                  <div key={profile.uid} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setSelectedUser(profile)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                        {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-700 p-1" />}
                      </div>
                      <div className="min-w-0 text-[10px]">
                        <div className="text-sm font-bold text-zinc-100 truncate">{profile.name}</div>
                        <div className="text-zinc-500 font-mono italic">@{profile.username}</div>
                      </div>
                    </button>
                    {followingIds.includes(profile.uid) ? (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => toggleWeeklyRankingFriend(profile.uid)}
                          title="Ranking Semanal"
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            weeklyRankingFriendIds.includes(profile.uid) ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 hover:text-amber-400"
                          )}
                        >
                          <Trophy className="w-5 h-5" />
                        </button>
                        <button onClick={() => unfollowUser(profile.uid)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                          <UserMinus className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleFollowAction(profile.uid, profile.name)} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg">
                        <UserPlus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-zinc-800/50">
               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Seu Perfil Público</p>
               <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-emerald-500/20 overflow-hidden">
                       {myPublicProfile.avatar ? <img src={myPublicProfile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-800 p-1" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-400">{myPublicProfile.name}</div>
                      <div className="text-[10px] text-zinc-500 italic">@{myPublicProfile.username || 'Sem apelido'}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(myPublicProfile)} className="text-[10px] text-zinc-400 hover:bg-zinc-800 px-2 py-1 rounded transition-colors">Ver como outros vêem</button>
               </div>
            </div>
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
                        {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-800 p-1" />}
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
                        <button onClick={() => handleFollowAction(profile.uid, profile.name)} className="text-[10px] bg-blue-600/10 text-blue-400 px-2 py-1 rounded-md border border-blue-500/30">Seguir</button>
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
                      {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-800" />}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-zinc-100">{profile.name}</div>
                      <div className="text-[10px] text-zinc-500">🏆 {profile.stats.totalQuestions} questões</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWeeklyRankingFriend(profile.uid);
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        weeklyRankingFriendIds.includes(profile.uid) ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 hover:text-amber-400"
                      )}
                    >
                      <Trophy className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
                  </div>
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
          {activeTab === 'social' ? (
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <Globe className="w-6 h-6 text-blue-400" />
                  Ranking Geral de Amigos
                </h2>
              </div>
              
              <div className="flex bg-zinc-900/50 p-1 border-b border-zinc-800 overflow-x-auto no-scrollbar">
                {[
                  { id: 'proficiency', label: 'Proficiência', icon: Target },
                  { id: 'totalStudySeconds', label: 'Horas', icon: Clock },
                  { id: 'completedTheories', label: 'Teoria', icon: BookOpen },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveRankingTab(tab.id as RankingMetric)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                      activeRankingTab === tab.id ? "text-blue-400 bg-blue-400/10 border-b-2 border-blue-400" : "text-zinc-500 hover:text-zinc-300"
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
                      <div className={cn(
                        "flex-1 flex items-center justify-between p-4 bg-zinc-800/20 border border-zinc-800/50 rounded-2xl group-hover:border-blue-400/30 transition-all",
                        profile.uid === auth.currentUser?.uid && "border-emerald-500/50 bg-emerald-500/5"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                            {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-800 p-1" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-100">{profile.name}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{profile.username}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-zinc-100">
                            {activeRankingTab === 'totalStudySeconds' ? formatStudyTime(profile.stats.totalStudySeconds) : 
                             activeRankingTab === 'completedTheories' ? `${profile.stats.completedTheories}/${profile.stats.totalTopics}` :
                             `${profile.stats.totalQuestions > 0 ? Math.round((profile.stats.totalCorrect / profile.stats.totalQuestions) * 100) : 0}%`}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                            {activeRankingTab === 'proficiency' ? 'Aproveitamento' : 
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
          ) : (
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl border-amber-500/20">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-gradient-to-r from-amber-500/5 to-transparent">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  Ranking do Torneio
                </h2>
                <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                   <button 
                    onClick={() => setActiveWeeklyMetric('studySeconds')}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-bold uppercase transition-all",
                      activeWeeklyMetric === 'studySeconds' ? "bg-amber-500 text-zinc-950" : "text-zinc-500"
                    )}
                   >Horas</button>
                   <button 
                    onClick={() => setActiveWeeklyMetric('proficiency')}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-bold uppercase transition-all",
                      activeWeeklyMetric === 'proficiency' ? "bg-amber-500 text-zinc-950" : "text-zinc-500"
                    )}
                   >Proficiência</button>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {getSortedWeeklyRanking().map((profile: any, idx) => (
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
                      <div className={cn(
                        "flex-1 flex items-center justify-between p-4 bg-zinc-800/20 border border-zinc-800/50 rounded-2xl group-hover:border-amber-400/30 transition-all",
                        profile.uid === auth.currentUser?.uid && "border-emerald-500/50 bg-emerald-500/5"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                            {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-800 p-1" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-100">{profile.name}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Semana Atual</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-amber-400">
                            {activeWeeklyMetric === 'studySeconds' 
                               ? formatStudyTime(profile.weeklyStats?.studySeconds || 0)
                               : `${profile.weeklyStats?.totalQuestions > 0 ? Math.round((profile.weeklyStats?.correctAnswers / profile.weeklyStats?.totalQuestions) * 100) : 0}%`}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                            {activeWeeklyMetric === 'studySeconds' ? 'Nesta Semana' : 'Aproveitamento'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {weeklyRankingFriendIds.length === 0 && (
                    <div className="text-center py-20 bg-zinc-950/30 border-2 border-dashed border-zinc-800 rounded-3xl">
                      <Trophy className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                      <p className="text-zinc-400 font-medium">Você ainda não escolheu amigos para este ranking.</p>
                      <p className="text-xs text-zinc-600 mt-1 max-w-[250px] mx-auto">
                        Clique no ícone de troféu ao lado do nome de um amigo na lista lateral para adicioná-lo.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 bg-amber-500/5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-amber-500" />
                   <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-[0.1em]">
                      Data Limite do Torneio
                   </span>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {customRankingEndDate && (
                      <button 
                        onClick={() => {
                          if(confirm('Tem certeza que deseja apagar o torneio atual?')) {
                            setCustomRankingDates(null, null);
                          }
                        }}
                        className="text-[10px] text-zinc-500 hover:text-red-400 font-bold px-2 py-1"
                      >
                        Limpar
                      </button>
                    )}
                    <input 
                      type="date"
                      value={customRankingEndDate ? customRankingEndDate.split('T')[0] : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                           // Define start date as 'now' and end date as selected date at 23:59:59
                           const endDate = new Date(e.target.value);
                           endDate.setHours(23, 59, 59, 999);
                           setCustomRankingDates(new Date().toISOString(), endDate.toISOString());
                        } else {
                           setCustomRankingDates(null, null);
                        }
                      }}
                      className="bg-zinc-950 border border-amber-500/20 text-zinc-100 rounded-lg text-xs px-3 py-1.5 focus:outline-none focus:border-amber-500/50"
                    />
                 </div>
              </div>
              {!customRankingEndDate && (
                <div className="px-6 pb-4 bg-amber-500/5">
                   <p className="text-[10px] text-zinc-500 italic text-center">
                      * Se não definir uma data limite, o ranking refletirá os dados da semana atual (segunda a domingo).
                   </p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                  {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserCircle className="w-full h-full text-zinc-800 p-2" />}
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

              {/* Edital Structure Sharing Area */}
              <div className="bg-zinc-950/30 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div>
                      <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-purple-400" />
                        Edital Verticalizado
                      </h3>
                      <p className="text-sm text-zinc-500">Este é o conteúdo programático que o aluno está estudando.</p>
                   </div>
                   {selectedUser.editalStructure && selectedUser.editalStructure.length > 0 && selectedUser.uid !== auth.currentUser?.uid && (
                     <button 
                        onClick={() => {
                          if (confirm(`Deseja importar os ${selectedUser.editalStructure?.length} assuntos e seus respectivos tópicos para o seu Edital? Isso será adicionado à sua lista atual.`)) {
                            handleImportAction(selectedUser.uid, selectedUser.name, selectedUser.editalStructure!);
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95"
                     >
                       <Plus className="w-4 h-4" /> Copiar para meu Edital
                     </button>
                   )}
                </div>

                {selectedUser.editalStructure && selectedUser.editalStructure.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                     {selectedUser.editalStructure.map((s, idx) => (
                       <div key={idx} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                          <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 truncate">{s.subject}</h4>
                          <div className="space-y-1">
                             {s.topics.slice(0, 5).map((t, tIdx) => (
                               <div key={tIdx} className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <div className="w-1 h-1 bg-zinc-800 rounded-full" /> {t}
                                </div>
                             ))}
                             {s.topics.length > 5 && (
                               <div className="text-[9px] text-zinc-600 pl-2">... e mais {s.topics.length - 5} tópicos</div>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border-2 border-dashed border-zinc-800 rounded-2xl">
                    <BookOpen className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm italic">Este usuário ainda não verticalizou seu edital.</p>
                  </div>
                )}
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
                  onClick={() => handleFollowAction(selectedUser.uid, selectedUser.name)}
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
