import { useEffect, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useStore } from '../store';
import { onAuthStateChanged } from 'firebase/auth';

export function useFirebaseSync() {
  const store = useStore();
  const isInitialMount = useRef(true);
  const isUpdatingFromFirestore = useRef(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        store.login();
        // Fetch initial data from Firestore
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          isUpdatingFromFirestore.current = true;
          const data = docSnap.data();
          // We need a way to bulk update the store from the data
          // For now, let's assume the state structure matches
          // We might need to add a 'hydrate' action to the store
          store.resetAllData();
          // Manual hydrate
          useStore.setState({ ...data });
          isUpdatingFromFirestore.current = false;
        }
      } else {
        store.logout();
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync to Firestore on local changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isUpdatingFromFirestore.current || !store.isAuthenticated) return;

    const user = auth.currentUser;
    if (!user) return;

    const timeoutId = setTimeout(async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        // Exclude actions and computed properties from the store state
        const { 
          login, logout, addSubject, addTopic, updateTopicStatus, 
          logStudySession, setActiveTopicId, addQuestionLog, 
          addFlashcard, reviewFlashcard, addSimulado, deleteSimulado, 
          importEdital, deleteSubject, deleteAllSubjects, 
          updateEditalInfo, updateScheduleConfig, updateUserProfile, 
          setCurrentCycleIndex, resetAllData, ...dataToSave 
        } = store;

        await setDoc(docRef, dataToSave, { merge: true });
        console.log('Firebase synced successfully');
      } catch (error) {
        console.error('Error syncing to Firebase:', error);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [store]);
}
