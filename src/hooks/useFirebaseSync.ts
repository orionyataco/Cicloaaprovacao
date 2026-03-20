import { useEffect, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useStore } from '../store';
import { onAuthStateChanged } from 'firebase/auth';

export function useFirebaseSync() {
  const store = useStore();
  // Flag para bloquear sync enquanto carregamos dados do Firestore
  const isHydrating = useRef(false);
  // Flag para saber se já fizemos o carregamento inicial do Firestore
  const hasHydrated = useRef(false);
  // Ref para o timeout de debounce
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ────────────────────────────────────────────────
  // Listener de autenticação: carrega dados do Firestore
  // ────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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
              currentCycleIndex: remoteData.currentCycleIndex ?? 0,
              activeTopicId: remoteData.activeTopicId ?? null,
              isAuthenticated: true,
            });
            console.log('[Firebase] Dados carregados do Firestore.');
          } else {
            // Usuário novo — apenas marca como autenticado
            useStore.getState().login();
            console.log('[Firebase] Novo usuário, nenhum dado no Firestore ainda.');
          }
        } catch (error) {
          console.error('[Firebase] Erro ao carregar dados:', error);
          useStore.getState().login();
        } finally {
          // Aguarda 1 tick antes de liberar o sync para evitar loop
          setTimeout(() => {
            isHydrating.current = false;
            hasHydrated.current = true;
          }, 100);
        }
      } else {
        // Usuário deslogou
        isHydrating.current = false;
        hasHydrated.current = false;
        useStore.getState().logout();
        console.log('[Firebase] Usuário deslogado.');
      }
    });

    return () => unsubscribe();
  }, []);

  // ────────────────────────────────────────────────
  // Sync local → Firestore (com debounce de 2s)
  // Só executa após o carregamento inicial do Firestore ter completado
  // ────────────────────────────────────────────────
  useEffect(() => {
    // Não sincroniza se estiver hidratando do Firestore
    // Não sincroniza se ainda não carregou os dados do Firestore
    // Não sincroniza se o usuário não está autenticado
    if (isHydrating.current || !hasHydrated.current || !store.isAuthenticated) return;

    const user = auth.currentUser;
    if (!user) return;

    // Cancela o debounce anterior
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'users', user.uid);

        // Extrai apenas os dados (sem as funções/actions)
        const {
          login, logout, addSubject, addTopic, updateTopicStatus,
          logStudySession, setActiveTopicId, addQuestionLog,
          addFlashcard, reviewFlashcard, addSimulado, deleteSimulado,
          importEdital, deleteSubject, deleteAllSubjects,
          updateEditalInfo, updateScheduleConfig, updateUserProfile,
          setCurrentCycleIndex, resetAllData,
          ...dataToSave
        } = store;

        await setDoc(docRef, dataToSave, { merge: true });
        console.log('[Firebase] Dados sincronizados com o Firestore.');
      } catch (error) {
        console.error('[Firebase] Erro ao sincronizar dados:', error);
      }
    }, 2000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [store]);
}
