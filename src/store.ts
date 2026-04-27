import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, isBefore, startOfDay } from 'date-fns';

export type TopicStatus = 'NOT_READ' | 'THEORY_DONE' | 'SUMMARY_DONE' | 'REVIEWED';
export type ErrorReason = 'ATTENTION' | 'UNSEEN' | 'TRICK' | 'NONE';

export interface GeneratedQuestion {
  subject: string;
  topic: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SharedQuestion {
  id: string;
  fromName: string;
  fromUid: string;
  toUid: string;
  date: string;
  question: GeneratedQuestion;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  status: TopicStatus;
  lastStudiedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  youtubeLink?: string;
  driveLink?: string;
  summary?: string;
}

export interface QuestionLog {
  id: string;
  topicId: string;
  date: string;
  totalQuestions: number;
  correctAnswers: number;
  errorReason: ErrorReason;
}

export interface Flashcard {
  id: string;
  topicId: string;
  front: string;
  back: string;
  nextReviewAt: string | null;
  interval: number;
  easeFactor: number;
}

export interface Simulado {
  id: string;
  date: string;
  name: string;
  score: number;
  total: number;
  type: 'manual' | 'ai' | 'shared';
  category: 'simulado' | 'questoes';
}

export interface EditalInfo {
  carreira: string;
  cargo: string;
  banca: string;
  remuneracao: string;
  vagas: string;
  periodoInscricao: string;
  valorInscricao: string;
  siteConcurso: string;
  dataProva: string;
}

export interface ScheduleConfig {
  activeDays: number[]; // 0-6
  hoursPerDay: number;
}

export interface StudySession {
  id: string;
  topicId: string;
  durationSeconds: number;
  date: string;
}

export interface UserProfile {
  name: string;
  username: string; // Adicionado para busca de amigos
  bio: string;
  birthDate: string;
  gender: string;
  avatar: string | null;
}

export type NotificationType = 'follow' | 'flashcard' | 'calendar' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  date: string;
  read: boolean;
  link?: string;
  fromUid?: string;
}

interface AppState {
  subjects: Subject[];
  topics: Topic[];
  questionLogs: QuestionLog[];
  flashcards: Flashcard[];
  simulados: Simulado[];
  studySessions: StudySession[];
  editalInfo: EditalInfo;
  scheduleConfig: ScheduleConfig;
  userProfile: UserProfile;
  currentCycleIndex: number;
  activeTopicId: string | null;
  autoGenerateTopicId: string | null;
  autoGenerateSubjectId: string | null;
  autoGenerateCount: number;
  followingIds: string[]; // Lista de UIDs de amigos seguidos
  weeklyRankingFriendIds: string[]; // Lista de UIDs de amigos para o ranking personalizado
  customRankingStartDate: string | null;
  customRankingEndDate: string | null;
  sharedQuestions: SharedQuestion[];
  timerStartTime: string | null;
  timerActiveTopicId: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  lastUpdate: string | null;
  notifications: AppNotification[];
  uid: string | null;

  // Actions
  setUid: (uid: string | null) => void;
  login: () => void;
  logout: () => void;
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  addTopic: (topic: Omit<Topic, 'id' | 'lastStudiedAt' | 'nextReviewAt' | 'reviewCount'>) => void;
  updateTopicStatus: (id: string, status: TopicStatus) => void;
  updateTopicLinks: (id: string, links: { youtubeLink?: string; driveLink?: string }) => void;
  updateTopicSummary: (id: string, summary: string) => void;
  logStudySession: (topicId: string, durationSeconds: number) => void;
  setActiveTopicId: (id: string | null) => void;
  setAutoGenerateTopicId: (id: string | null, count?: number) => void;
  setAutoGenerateSubjectId: (id: string | null, count?: number) => void;
  addQuestionLog: (log: Omit<QuestionLog, 'id' | 'date'>) => void;
  addFlashcard: (card: Omit<Flashcard, 'id' | 'nextReviewAt' | 'interval' | 'easeFactor'>) => void;
  reviewFlashcard: (id: string, quality: number) => void;
  addSimulado: (simulado: Omit<Simulado, 'id'>) => void;
  deleteSimulado: (id: string) => void;
  importEdital: (data: { subject: string; topics: string[] }[]) => void;
  deleteSubject: (id: string) => void;
  deleteAllSubjects: () => void;
  updateEditalInfo: (info: Partial<EditalInfo>) => void;
  updateScheduleConfig: (config: Partial<ScheduleConfig>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  setCurrentCycleIndex: (index: number) => void;
  followUser: (uid: string) => void;
  unfollowUser: (uid: string) => void;
  toggleWeeklyRankingFriend: (uid: string) => void;
  setCustomRankingDates: (start: string | null, end: string | null) => void;
  setSharedQuestions: (questions: SharedQuestion[]) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'> & { id?: string }) => void;
  markNotificationAsRead: (id: string) => void;
  deleteNotification: (id: string) => void;
  deleteAllNotifications: () => void;
  setNotifications: (notifications: AppNotification[]) => void;
  resetAllData: () => void;
  startTimer: (topicId: string | null) => void;
  stopTimer: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      subjects: [],
      topics: [],
      questionLogs: [],
      flashcards: [],
      simulados: [],
      studySessions: [],
      editalInfo: {
        carreira: '',
        cargo: '',
        banca: '',
        remuneracao: '',
        vagas: '',
        periodoInscricao: '',
        valorInscricao: '',
        siteConcurso: '',
        dataProva: '',
      },
      scheduleConfig: {
        activeDays: [1, 2, 3, 4, 5], // Seg-Sex
        hoursPerDay: 2,
      },
      userProfile: {
        name: 'Estudante',
        username: '', // Inicialmente vazio
        bio: '',
        birthDate: '',
        gender: '',
        avatar: null,
      },
      currentCycleIndex: 0,
      followingIds: [],
      weeklyRankingFriendIds: [],
      customRankingStartDate: null,
      customRankingEndDate: null,
      sharedQuestions: [],
      activeTopicId: null,
      autoGenerateTopicId: null,
      autoGenerateSubjectId: null,
      autoGenerateCount: 3,
      uid: null,
      timerStartTime: null,
      timerActiveTopicId: null,
      isAuthenticated: false,
      isHydrated: false,
      lastUpdate: null,
      notifications: [],

      setUid: (uid) => set({ uid }),
      login: () => set({ isAuthenticated: true }),
      logout: () => set({ isAuthenticated: false, uid: null }),

      addSubject: (subject) => set((state) => ({ subjects: [...state.subjects, { ...subject, id: generateId() }] })),
      
      addTopic: (topic) => set((state) => ({ 
        topics: [...state.topics, { ...topic, id: generateId(), lastStudiedAt: null, nextReviewAt: null, reviewCount: 0 }] 
      })),

      setActiveTopicId: (id) => set({ activeTopicId: id }),
      setAutoGenerateTopicId: (id, count) => set({ 
        autoGenerateTopicId: id, 
        autoGenerateCount: count || 3,
        autoGenerateSubjectId: null 
      }),
      setAutoGenerateSubjectId: (id, count) => set({ 
        autoGenerateSubjectId: id, 
        autoGenerateCount: count || 3,
        autoGenerateTopicId: null 
      }),

      updateTopicLinks: (id, links) => set((state) => ({
        topics: state.topics.map(t => t.id === id ? { ...t, ...links } : t)
      })),
      
      updateTopicSummary: (id, summary) => set((state) => ({
        topics: state.topics.map(t => t.id === id ? { ...t, summary } : t)
      })),

      updateTopicStatus: (id, status) => set((state) => {
        const now = new Date().toISOString();
        const topic = state.topics.find(t => t.id === id);
        // Avança o ciclo quando um tópico sai de NOT_READ (ex: marcou "Teoria Concluída")
        // Isso garante que o próximo slot do ciclo será de uma matéria diferente
        const shouldAdvanceCycle = topic && topic.status === 'NOT_READ' && status !== 'NOT_READ';

        return {
          topics: state.topics.map((t) => {
            if (t.id === id) {
              let nextReviewAt = t.nextReviewAt;
              let reviewCount = t.reviewCount;
              
              // If moving to a "done" state, schedule first review (24h)
              if (status !== 'NOT_READ' && t.status === 'NOT_READ') {
                nextReviewAt = addDays(new Date(), 1).toISOString();
                reviewCount = 1;
              }

              return { ...t, status, lastStudiedAt: now, nextReviewAt, reviewCount };
            }
            return t;
          }),
          // Avança para a próxima matéria no ciclo
          currentCycleIndex: shouldAdvanceCycle && state.subjects.length > 0
            ? (state.currentCycleIndex + 1) % state.subjects.length
            : state.currentCycleIndex,
        };
      }),

      logStudySession: (topicId, durationSeconds) => set((state) => {
        const now = new Date();
        const topic = state.topics.find(t => t.id === topicId);
        let nextReviewAt = topic?.nextReviewAt;
        let reviewCount = topic?.reviewCount || 0;

        // 24/7/30 logic (only if it's the first time or if it's a review)
        if (topic) {
           // If session is very short (< 30s), don't update review metadata to avoid noise
           if (durationSeconds > 30) {
             if (reviewCount === 0) {
               nextReviewAt = addDays(now, 1).toISOString();
               reviewCount = 1;
             } else if (reviewCount === 1) {
               nextReviewAt = addDays(now, 7).toISOString();
               reviewCount = 2;
             } else if (reviewCount === 2) {
               nextReviewAt = addDays(now, 30).toISOString();
               reviewCount = 3;
             } else {
               nextReviewAt = addDays(now, 30).toISOString(); // Keep 30 days after
               reviewCount += 1;
             }
           }
        }

        return {
          studySessions: [...state.studySessions, { id: generateId(), topicId, durationSeconds, date: now.toISOString() }],
          topics: state.topics.map(t => t.id === topicId ? { ...t, lastStudiedAt: now.toISOString(), nextReviewAt, reviewCount } : t),
          // Removido o avanço automático de ciclo aqui para evitar herança de pausas
        };
      }),

      addQuestionLog: (log) => set((state) => {
        const now = new Date();
        const topic = state.topics.find(t => t.id === log.topicId);
        let nextReviewAt = topic?.nextReviewAt;
        let reviewCount = topic?.reviewCount || 0;

        // Se lançou desempenho, atualiza o agendamento da próxima revisão (mesma lógica 24/7/30)
        if (topic) {
           if (reviewCount === 0) nextReviewAt = addDays(now, 1).toISOString();
           else if (reviewCount === 1) nextReviewAt = addDays(now, 7).toISOString();
           else nextReviewAt = addDays(now, 30).toISOString();
           reviewCount += 1;
        }

        return {
          questionLogs: [...state.questionLogs, { ...log, id: generateId(), date: now.toISOString() }],
          topics: state.topics.map(t => t.id === log.topicId ? { ...t, lastStudiedAt: now.toISOString(), nextReviewAt, reviewCount } : t)
        };
      }),

      addFlashcard: (card) => set((state) => ({
        flashcards: [...state.flashcards, { ...card, id: generateId(), nextReviewAt: new Date().toISOString(), interval: 1, easeFactor: 2.5 }]
      })),

      reviewFlashcard: (id, quality) => set((state) => {
        // Simple SM-2 algorithm
        return {
          flashcards: state.flashcards.map(card => {
            if (card.id !== id) return card;
            
            let easeFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
            if (easeFactor < 1.3) easeFactor = 1.3;
            
            let interval = card.interval;
            if (quality < 3) {
              interval = 1;
            } else {
              if (card.interval === 1) interval = 6;
              else interval = Math.round(card.interval * easeFactor);
            }

            return {
              ...card,
              easeFactor,
              interval,
              nextReviewAt: addDays(new Date(), interval).toISOString()
            };
          })
        };
      }),

      addSimulado: (simulado) => set((state) => ({
        simulados: [...state.simulados, { ...simulado, id: generateId() }]
      })),

      deleteSimulado: (id) => set((state) => ({
        simulados: state.simulados.filter(s => s.id !== id)
      })),

      importEdital: (data) => set((state) => {
        if (!Array.isArray(data)) return state;

        const newSubjects = [...state.subjects];
        const newTopics = [...state.topics];

        data.forEach(item => {
          if (!item.subject || !Array.isArray(item.topics)) return;

          const subjectId = generateId();
          newSubjects.push({
            id: subjectId,
            name: String(item.subject),
            color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
          });

          item.topics.forEach(topicName => {
            if (!topicName) return;
            newTopics.push({
              id: generateId(),
              subjectId,
              name: String(topicName),
              status: 'NOT_READ',
              lastStudiedAt: null,
              nextReviewAt: null,
              reviewCount: 0
            });
          });
        });

        return { subjects: newSubjects, topics: newTopics };
      }),

      deleteSubject: (id) => set((state) => {
        const topicsToRemove = state.topics.filter(t => t.subjectId === id).map(t => t.id);
        return {
          subjects: state.subjects.filter(s => s.id !== id),
          topics: state.topics.filter(t => t.subjectId !== id),
          questionLogs: state.questionLogs.filter(q => !topicsToRemove.includes(q.topicId)),
          flashcards: state.flashcards.filter(f => !topicsToRemove.includes(f.topicId)),
          studySessions: state.studySessions.filter(s => !topicsToRemove.includes(s.topicId)),
        };
      }),

      deleteAllSubjects: () => set({
        subjects: [],
        topics: [],
        questionLogs: [],
        flashcards: [],
        studySessions: [],
        currentCycleIndex: 0
      }),

      updateEditalInfo: (info) => set((state) => ({
        editalInfo: { ...state.editalInfo, ...info }
      })),

      updateScheduleConfig: (config) => set((state) => ({
        scheduleConfig: { ...state.scheduleConfig, ...config }
      })),

      updateUserProfile: (profile) => set((state) => ({
        userProfile: { ...state.userProfile, ...profile }
      })),

      setCurrentCycleIndex: (index) => set({ currentCycleIndex: index }),

      followUser: (uid) => set((state) => ({ 
        followingIds: state.followingIds.includes(uid) ? state.followingIds : [...state.followingIds, uid] 
      })),

      unfollowUser: (uid) => set((state) => ({ 
        followingIds: state.followingIds.filter(id => id !== uid),
        weeklyRankingFriendIds: state.weeklyRankingFriendIds.filter(id => id !== uid)
      })),

      toggleWeeklyRankingFriend: (uid) => set((state) => ({
        weeklyRankingFriendIds: state.weeklyRankingFriendIds.includes(uid)
          ? state.weeklyRankingFriendIds.filter(id => id !== uid)
          : [...state.weeklyRankingFriendIds, uid]
      })),

      setCustomRankingDates: (start, end) => set({
        customRankingStartDate: start,
        customRankingEndDate: end
      }),
      
      setSharedQuestions: (questions) => set({ sharedQuestions: questions }),
      
      addNotification: (notification) => set((state) => ({
        notifications: [
          { 
            ...notification, 
            id: notification.id || generateId(), 
            date: new Date().toISOString(), 
            read: false 
          }, 
          ...state.notifications
        ].slice(0, 50)
      })),

      markNotificationAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
      })),

      deleteNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
      
      deleteAllNotifications: () => set({ notifications: [] }),

      setNotifications: (notifications) => set({ notifications }),

      resetAllData: () => set({
        subjects: [],
        topics: [],
        questionLogs: [],
        flashcards: [],
        simulados: [],
        studySessions: [],
        notifications: [],
        editalInfo: {
          carreira: '',
          cargo: '',
          banca: '',
          remuneracao: '',
          vagas: '',
          periodoInscricao: '',
          valorInscricao: '',
          siteConcurso: '',
          dataProva: '',
        },
        scheduleConfig: {
          activeDays: [1, 2, 3, 4, 5],
          hoursPerDay: 2,
        },
        userProfile: {
          name: 'Estudante',
          username: '',
          bio: '',
          birthDate: '',
          gender: '',
          avatar: null,
        },
        currentCycleIndex: 0,
        followingIds: [],
        weeklyRankingFriendIds: [],
        customRankingStartDate: null,
        customRankingEndDate: null,
        sharedQuestions: [],
        activeTopicId: null,
        autoGenerateTopicId: null,
        autoGenerateSubjectId: null,
        autoGenerateCount: 3,
        lastUpdate: null,
        uid: null,
        timerStartTime: null,
        timerActiveTopicId: null,
        isAuthenticated: false,
        isHydrated: false,
      }),

      startTimer: (topicId) => set({ 
        timerStartTime: new Date().toISOString(), 
        timerActiveTopicId: topicId 
      }),

      stopTimer: () => set({ 
        timerStartTime: null, 
        timerActiveTopicId: null 
      }),
    }),
    {
      name: 'engine-aprovacao-storage',
    }
  )
);
