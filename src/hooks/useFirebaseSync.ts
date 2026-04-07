import { useEffect, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useStore } from '../store';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { startOfWeek, format, parseISO } from 'date-fns';

export function useFirebaseSync() {
  const store = useStore();
  const isHydrating = useRef(false);
  const hasHydrated = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref para unsubscriver listeners
  const sharedQuestionsUnsubscribe = useRef<(() => void) | null>(null);

  // ────────────────────────────────────────────────
  // Listener de autenticação: carrega dados do Firestore
  // ────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (isHydrating.current || hasHydrated.current) return;
        
        isHydrating.current = true;
        hasHydrated.current = false;

        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            // Sobrescreve o estado local com os dados do Firebase
            // sem disparar o sync de volta
            useStore.setState({
              subjects: remoteData.subjects ?? [],
              topics: remoteData.topics ?? [],
              questionLogs: remoteData.questionLogs ?? [],
              flashcards: remoteData.flashcards ?? [],
              simulados: remoteData.simulados ?? [],
              studySessions: remoteData.studySessions ?? [],
              editalInfo: remoteData.editalInfo ?? useStore.getState().editalInfo,
              scheduleConfig: remoteData.scheduleConfig ?? useStore.getState().scheduleConfig,
              userProfile: remoteData.userProfile ?? useStore.getState().userProfile,
              followingIds: remoteData.followingIds ?? [],
              weeklyRankingFriendIds: remoteData.weeklyRankingFriendIds ?? [],
              customRankingStartDate: remoteData.customRankingStartDate ?? null,
              customRankingEndDate: remoteData.customRankingEndDate ?? null,
              currentCycleIndex: remoteData.currentCycleIndex ?? 0,
              activeTopicId: remoteData.activeTopicId ?? null,
              isAuthenticated: true,
            });
            console.log('[Firebase] Dados carregados do Firestore.');

            // Inicia escuta de questões compartilhadas
            const q = query(collection(db, 'shared_questions'), where('toUid', '==', user.uid));
            sharedQuestionsUnsubscribe.current = onSnapshot(q, (snapshot) => {
              const sharedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
              useStore.getState().setSharedQuestions(sharedDocs);
            });
          } else {
            // Usuário novo — Garante que o estado local esteja limpo antes de logar
            useStore.getState().resetAllData();
            useStore.getState().login();
            console.log('[Firebase] Novo usuário, estado resetado e logado.');
          }
        } catch (error) {
          console.error('[Firebase] Erro ao carregar dados:', error);
          useStore.getState().login();
        } finally {
          // Aguarda um pouco antes de liberar o sync para evitar loop
          setTimeout(() => {
            isHydrating.current = false;
            hasHydrated.current = true;
          }, 300);
        }
      } else {
        // Usuário deslogou
        isHydrating.current = false;
        hasHydrated.current = false;
        useStore.getState().logout();
        useStore.getState().resetAllData();
        if (sharedQuestionsUnsubscribe.current) {
          sharedQuestionsUnsubscribe.current();
          sharedQuestionsUnsubscribe.current = null;
        }
        console.log('[Firebase] Usuário deslogado e estado local resetado.');
      }
    });

    return () => {
      unsubscribe();
      if (sharedQuestionsUnsubscribe.current) sharedQuestionsUnsubscribe.current();
    };
  }, []);

  // Sync local → Firestore
  useEffect(() => {
    // Só sincroniza se:
    // 1. Não está no meio de uma hidratação
    // 2. A hidratação inicial já ocorreu (evita sobrescrever o banco com dados vazios ao iniciar)
    // 3. O usuário está autenticado no Firebase
    const user = auth.currentUser;
    if (isHydrating.current || !hasHydrated.current || !store.isAuthenticated || !user) {
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        console.log('[Firebase] Iniciando sincronização...');
        const docRef = doc(db, 'users', user.uid);
        const profileRef = doc(db, 'profiles', user.uid);

        // Extrai apenas os dados (sem as funções/actions)
        const {
          login, logout, addSubject, addTopic, updateTopicStatus,
          logStudySession, setActiveTopicId, addQuestionLog,
          addFlashcard, reviewFlashcard, addSimulado, deleteSimulado,
          importEdital, deleteSubject, deleteAllSubjects,
          updateEditalInfo, updateScheduleConfig, updateUserProfile,
          setCurrentCycleIndex, resetAllData, followUser, unfollowUser,
          setAutoGenerateTopicId, autoGenerateTopicId,
          setSharedQuestions, sharedQuestions,
          customRankingStartDate, customRankingEndDate,
          toggleWeeklyRankingFriend, setCustomRankingDates,
          ...dataToSave
        } = store;

        // Validação de segurança: Se o avatar for Base64 muito grande, removemos para evitar erro do Firestore (1MB limit)
        if (dataToSave.userProfile?.avatar && dataToSave.userProfile.avatar.length > 800000) {
          console.warn('[Firebase] Avatar Base64 muito grande detectado. Omitindo do banco para evitar erro de limite.');
          dataToSave.userProfile = { ...dataToSave.userProfile, avatar: null };
        }

        await setDoc(docRef, dataToSave, { merge: true });
        
        // ────────────────────────────────────────────────
        // Public Profiling: Sync basic summary stats
        // ────────────────────────────────────────────────
        if (store.userProfile.username) {
          const totalQuestionsFromLogs = store.questionLogs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
          const totalCorrectFromLogs = store.questionLogs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
          const manualSimulados = store.simulados.filter(s => s.type === 'manual');
          const totalQuestionsFromSimulados = manualSimulados.reduce((acc, curr) => acc + curr.total, 0);
          const totalCorrectFromSimulados = manualSimulados.reduce((acc, curr) => acc + curr.score, 0);

          const totalQuestions = totalQuestionsFromLogs + totalQuestionsFromSimulados;
          const totalCorrect = totalCorrectFromLogs + totalCorrectFromSimulados;
          const totalStudySeconds = store.studySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
          const completedTheories = store.topics.filter(t => t.status !== 'NOT_READ').length;
          const totalTopics = store.topics.length;
          
          // ────────────────────────────────────────────────
          // Custom / Weekly Stats Calculation
          // ────────────────────────────────────────────────
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Segunda-feira
          const weekId = store.customRankingEndDate ? `custom-${store.customRankingStartDate}-${store.customRankingEndDate}` : format(weekStart, 'yyyy-ww');
          
          const rankingStart = store.customRankingStartDate ? parseISO(store.customRankingStartDate) : weekStart;
          const rankingEnd = store.customRankingEndDate ? parseISO(store.customRankingEndDate) : null;
          
          let validSessions = store.studySessions;
          let validLogs = store.questionLogs;
          let validSimulados = manualSimulados;

          validSessions = validSessions.filter(s => parseISO(s.date).getTime() >= rankingStart.getTime());
          validLogs = validLogs.filter(q => parseISO(q.date).getTime() >= rankingStart.getTime());
          validSimulados = validSimulados.filter(s => parseISO(s.date).getTime() >= rankingStart.getTime());

          if (rankingEnd) {
             validSessions = validSessions.filter(s => parseISO(s.date).getTime() <= rankingEnd.getTime());
             validLogs = validLogs.filter(q => parseISO(q.date).getTime() <= rankingEnd.getTime());
             validSimulados = validSimulados.filter(s => parseISO(s.date).getTime() <= rankingEnd.getTime());
          }
          
          const weeklyStudySeconds = validSessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
          const weeklyTotalQs = validLogs.reduce((acc, curr) => acc + curr.totalQuestions, 0) + validSimulados.reduce((acc, curr) => acc + curr.total, 0);
          const weeklyCorrectQs = validLogs.reduce((acc, curr) => acc + curr.correctAnswers, 0) + validSimulados.reduce((acc, curr) => acc + curr.score, 0);

          await setDoc(profileRef, {
            uid: user.uid,
            name: store.userProfile.name,
            searchName: store.userProfile.name.toLowerCase(), 
            username: store.userProfile.username.toLowerCase(),
            bio: store.userProfile.bio,
            avatar: store.userProfile.avatar,
            editalInfo: {
              carreira: store.editalInfo.carreira,
              cargo: store.editalInfo.cargo,
              banca: store.editalInfo.banca,
            },
            editalStructure: store.subjects.map(s => ({
              subject: s.name,
              topics: store.topics.filter(t => t.subjectId === s.id).map(t => t.name)
            })),
            stats: {
              totalQuestions,
              totalCorrect,
              totalStudySeconds,
              completedTheories,
              totalTopics,
              lastUpdate: new Date().toISOString()
            },
            weeklyStats: {
              weekId,
              studySeconds: weeklyStudySeconds,
              totalQuestions: weeklyTotalQs,
              correctAnswers: weeklyCorrectQs
            }
          }, { merge: true });
        }

        console.log('[Firebase] Sincronização concluída com sucesso (privado e público).');
      } catch (error) {
        console.error('[Firebase] Falha na sincronização:', error);
      }
    }, 2000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    store.subjects, 
    store.topics, 
    store.questionLogs, 
    store.flashcards, 
    store.simulados, 
    store.studySessions, 
    store.editalInfo, 
    store.scheduleConfig, 
    store.userProfile, 
    store.currentCycleIndex,
    store.isAuthenticated
  ]);
}
