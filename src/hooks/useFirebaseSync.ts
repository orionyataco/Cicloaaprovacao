import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useStore } from '../store';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { startOfWeek, format, parseISO } from 'date-fns';

export function useFirebaseSync() {
  const store = useStore();
  const isHydrating = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref para unsubscriver listeners
  const sharedQuestionsUnsubscribe = useRef<(() => void) | null>(null);
  const notificationsUnsubscribe = useRef<(() => void) | null>(null);

  // ────────────────────────────────────────────────
  // Listener de autenticação: carrega dados do Firestore
  // ────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const currentStoreUid = useStore.getState().uid;
        if (currentStoreUid && currentStoreUid !== user.uid) {
          console.log('[Firebase] 🆔 Mudança de usuário detectada. Resetando estado local...');
          useStore.getState().resetAllData();
          useStore.getState().setUid(user.uid);
          // Reinicia as refs de controle
          isHydrating.current = false;
          setHasHydrated(false);
        } else if (!currentStoreUid) {
          // Se não tinha UID, vinculamos o atual
          useStore.getState().setUid(user.uid);
        }

        if (isHydrating.current || hasHydrated) return;
        
        isHydrating.current = true;
        setHasHydrated(false);

        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            const localLastUpdate = useStore.getState().lastUpdate;
            const remoteLastUpdate = remoteData.lastUpdate;

            console.log(`[Firebase] Checando sincronização: Local(${localLastUpdate}) vs Remoto(${remoteLastUpdate})`);

            // Só carrega se o banco estiver mais novo ou se local estiver zerado
            // Se local for mais novo, chamamos login() e deixamos o useEffect de sync subir os dados
            const shouldOverwrite = !localLastUpdate || 
                                    (remoteLastUpdate && new Date(remoteLastUpdate) > new Date(localLastUpdate));

            if (shouldOverwrite) {
              console.log('[Firebase] ⬇️ Dados remotos são mais novos. Atualizando estado local...');
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
                notifications: remoteData.notifications ?? [],
                lastUpdate: remoteData.lastUpdate ?? null,
                isAuthenticated: true,
                uid: user.uid
              });
            } else {
              console.log('[Firebase] ⬆️ Dados locais são mais recentes ou iguais. Mantendo estado atual para sincronizar em breve.');
              useStore.getState().login();
              useStore.getState().setUid(user.uid);
            }

            // Inicia escuta de questões compartilhadas e notificações
            setupListeners(user.uid);

          } else {
            // Usuário novo — Não resetamos se ele acabou de criar dados offline, 
            // mas marcamos o UID para posse desses dados.
            useStore.getState().login();
            useStore.getState().setUid(user.uid);
            console.log('[Firebase] Novo usuário logado, aguardando sincronização do estado local.');
          }
        } catch (error) {
          console.error('[Firebase] Erro ao carregar dados:', error);
          useStore.getState().setUid(user.uid);
          useStore.getState().login();
        } finally {
          setTimeout(() => {
            isHydrating.current = false;
            setHasHydrated(true);
          }, 300);
        }
      } else {
        // Usuário deslogou
        isHydrating.current = false;
        setHasHydrated(false);
        useStore.getState().logout();
        useStore.getState().resetAllData();
        clearListeners();
        console.log('[Firebase] Usuário deslogado.');
      }
    });

    const setupListeners = (uid: string) => {
      clearListeners();
      
      const q = query(collection(db, 'shared_questions'), where('toUid', '==', uid));
      sharedQuestionsUnsubscribe.current = onSnapshot(q, (snapshot) => {
        const sharedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        useStore.getState().setSharedQuestions(sharedDocs);
      });

      const nq = query(collection(db, 'notifications'), where('toUid', '==', uid), limit(20));
      notificationsUnsubscribe.current = onSnapshot(nq, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const notif = { id: change.doc.id, ...change.doc.data() } as any;
            const existing = useStore.getState().notifications.find(n => n.id === notif.id);
            if (!existing) {
              useStore.getState().addNotification({
                type: notif.type,
                title: notif.title,
                message: notif.message,
                fromUid: notif.fromUid,
                link: notif.link
              });
            }
          }
        });
      });
    };

    const clearListeners = () => {
      if (sharedQuestionsUnsubscribe.current) {
        sharedQuestionsUnsubscribe.current();
        sharedQuestionsUnsubscribe.current = null;
      }
      if (notificationsUnsubscribe.current) {
        notificationsUnsubscribe.current();
        notificationsUnsubscribe.current = null;
      }
    };

    return () => {
      unsubscribe();
      if (sharedQuestionsUnsubscribe.current) sharedQuestionsUnsubscribe.current();
      if (notificationsUnsubscribe.current) notificationsUnsubscribe.current();
    };
  }, []);

  // Sync local → Firestore
  useEffect(() => {
    // Só sincroniza se:
    // 1. Não está no meio de uma hidratação
    // 2. A hidratação inicial já ocorreu (evita sobrescrever o banco com dados vazios ao iniciar)
    // 3. O usuário está autenticado no Firebase
    const user = auth.currentUser;
    if (isHydrating.current || !hasHydrated || !store.isAuthenticated || !user) {
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        console.log(`[Firebase] ✨ Iniciando sincronização (${now})...`);
        const docRef = doc(db, 'users', user.uid);
        const profileRef = doc(db, 'profiles', user.uid);

        // Extrai apenas o estado (ignora funções) para salvar no Firestore
        const dataToSave = Object.fromEntries(
          Object.entries(store).filter(([_, v]) => typeof v !== 'function')
        ) as Record<string, any>;
        
        // Removemos dados que não devem ir no documento base do usuário
        delete dataToSave.sharedQuestions;

        // Validação de segurança: Se o avatar for Base64 muito grande, removemos para evitar erro do Firestore (1MB limit)
        const isBase64Avatar = dataToSave.userProfile?.avatar?.startsWith('data:');
        if (isBase64Avatar && dataToSave.userProfile.avatar.length > 800000) {
          console.warn('[Firebase] Avatar Base64 muito grande detectado. Omitindo do banco para evitar erro de limite.');
          dataToSave.userProfile = { ...dataToSave.userProfile, avatar: null };
        }
        
        const safeAvatar = dataToSave.userProfile?.avatar || null;

        // Atualiza o lastUpdate no estado local para que o próximo sync/refresh saiba
        useStore.setState({ lastUpdate: now });

        await setDoc(docRef, { 
          ...dataToSave,
          lastUpdate: now 
        }, { merge: true });
        
        // ────────────────────────────────────────────────
        // Public Profiling: Sync basic summary stats
        // ────────────────────────────────────────────────
        if (store.userProfile.username && store.userProfile.username.trim().length > 0) {
          const totalQuestionsFromLogs = store.questionLogs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
          const totalCorrectFromLogs = store.questionLogs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
          const manualSimulados = store.simulados.filter(s => s.type === 'manual' || s.type === 'shared');
          const totalQuestionsFromSimulados = manualSimulados.reduce((acc, curr) => acc + curr.total, 0);
          const totalCorrectFromSimulados = manualSimulados.reduce((acc, curr) => acc + curr.score, 0);

          const totalQuestions = totalQuestionsFromLogs + totalQuestionsFromSimulados;
          const totalCorrect = totalCorrectFromLogs + totalCorrectFromSimulados;
          const totalStudySeconds = store.studySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
          const completedTheories = store.topics.filter(t => t.status !== 'NOT_READ').length;
          const totalTopics = store.topics.length;
          
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
          const weekId = store.customRankingEndDate ? `custom-${store.customRankingStartDate}-${store.customRankingEndDate}` : format(weekStart, 'yyyy-ww');
          
          const rankingStart = store.customRankingStartDate ? parseISO(store.customRankingStartDate) : weekStart;
          const rankingEnd = store.customRankingEndDate ? parseISO(store.customRankingEndDate) : null;
          
          const validSessions = store.studySessions.filter(s => parseISO(s.date).getTime() >= rankingStart.getTime() && (!rankingEnd || parseISO(s.date).getTime() <= rankingEnd.getTime()));
          const validLogs = store.questionLogs.filter(q => parseISO(q.date).getTime() >= rankingStart.getTime() && (!rankingEnd || parseISO(q.date).getTime() <= rankingEnd.getTime()));
          const validSimulados = manualSimulados.filter(s => parseISO(s.date).getTime() >= rankingStart.getTime() && (!rankingEnd || parseISO(s.date).getTime() <= rankingEnd.getTime()));
          
          const weeklyStudySeconds = validSessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
          const weeklyTotalQs = validLogs.reduce((acc, curr) => acc + curr.totalQuestions, 0) + validSimulados.reduce((acc, curr) => acc + curr.total, 0);
          const weeklyCorrectQs = validLogs.reduce((acc, curr) => acc + curr.correctAnswers, 0) + validSimulados.reduce((acc, curr) => acc + curr.score, 0);

          await setDoc(profileRef, {
            uid: user.uid,
            name: store.userProfile.name || 'Estudante',
            searchName: (store.userProfile.name || 'Estudante').toLowerCase(), 
            username: store.userProfile.username.toLowerCase().trim(),
            bio: store.userProfile.bio || '',
            avatar: safeAvatar,
            editalInfo: {
              carreira: store.editalInfo.carreira || '',
              cargo: store.editalInfo.cargo || '',
              banca: store.editalInfo.banca || '',
            },
            editalStructure: store.subjects.slice(0, 50).map(s => ({
              subject: s.name,
              topics: store.topics.filter(t => t.subjectId === s.id).slice(0, 50).map(t => t.name)
            })),
            stats: {
              totalQuestions,
              totalCorrect,
              totalStudySeconds,
              completedTheories,
              totalTopics,
              lastUpdate: now
            },
            weeklyStats: {
              weekId,
              studySeconds: weeklyStudySeconds,
              totalQuestions: weeklyTotalQs,
              correctAnswers: weeklyCorrectQs
            }
          }, { merge: true });
        }

        console.log(`[Firebase] ✅ Sincronização concluída com sucesso (${new Date().toISOString()}).`);
      } catch (error) {
        console.error('[Firebase] ❌ Falha na sincronização:', error);
      }
    }, 1000);

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
    store.followingIds,
    store.weeklyRankingFriendIds,
    store.customRankingStartDate,
    store.customRankingEndDate,
    store.notifications,
    store.isAuthenticated,
    hasHydrated
  ]);
}
