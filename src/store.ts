import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, isBefore, startOfDay } from 'date-fns';

export type TopicStatus = 'NOT_READ' | 'THEORY_DONE' | 'SUMMARY_DONE' | 'REVIEWED';
export type ErrorReason = 'ATTENTION' | 'UNSEEN' | 'TRICK' | 'NONE';

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
  type: 'manual' | 'ai';
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
  bio: string;
  birthDate: string;
  gender: string;
  activeMethod: string;
  avatar: string | null;
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
  isAuthenticated: boolean;

  // Actions
  login: () => void;
  logout: () => void;
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  addTopic: (topic: Omit<Topic, 'id' | 'lastStudiedAt' | 'nextReviewAt' | 'reviewCount'>) => void;
  updateTopicStatus: (id: string, status: TopicStatus) => void;
  logStudySession: (topicId: string, durationSeconds: number) => void;
  setActiveTopicId: (id: string | null) => void;
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
  resetAllData: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      subjects: [
        { id: 's1', name: 'Português', color: '#3b82f6' },
        { id: 's2', name: 'Direito Constitucional', color: '#10b981' },
      ],
      topics: [
        { id: 't1', subjectId: 's1', name: 'Ortografia', status: 'NOT_READ', lastStudiedAt: null, nextReviewAt: null, reviewCount: 0 },
        { id: 't2', subjectId: 's1', name: 'Crase', status: 'THEORY_DONE', lastStudiedAt: new Date().toISOString(), nextReviewAt: addDays(new Date(), 1).toISOString(), reviewCount: 1 },
        { id: 't3', subjectId: 's2', name: 'Direitos Fundamentais', status: 'SUMMARY_DONE', lastStudiedAt: new Date().toISOString(), nextReviewAt: addDays(new Date(), 7).toISOString(), reviewCount: 2 },
      ],
      questionLogs: [
        { id: 'q1', topicId: 't2', date: new Date().toISOString(), totalQuestions: 20, correctAnswers: 15, errorReason: 'ATTENTION' },
        { id: 'q2', topicId: 't3', date: new Date().toISOString(), totalQuestions: 30, correctAnswers: 20, errorReason: 'TRICK' },
      ],
      flashcards: [
        { id: 'f1', topicId: 't2', front: 'Regra geral da crase?', back: 'Fusão da preposição A com o artigo A.', nextReviewAt: new Date().toISOString(), interval: 1, easeFactor: 2.5 },
        { id: 'f2', topicId: 't3', front: 'O que é o habeas corpus?', back: 'Remédio constitucional para proteger o direito de ir e vir.', nextReviewAt: new Date().toISOString(), interval: 1, easeFactor: 2.5 },
      ],
      simulados: [
        { id: 'sim1', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), name: 'Simulado 01', score: 65, total: 100, type: 'manual' },
        { id: 'sim2', date: new Date().toISOString(), name: 'Simulado 02', score: 72, total: 100, type: 'manual' },
      ],
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
        bio: '',
        birthDate: '',
        gender: '',
        activeMethod: 'Ciclo à Aprovação',
        avatar: null,
      },
      currentCycleIndex: 0,
      activeTopicId: null,
      isAuthenticated: false,

      login: () => set({ isAuthenticated: true }),
      logout: () => set({ isAuthenticated: false }),

      addSubject: (subject) => set((state) => ({ subjects: [...state.subjects, { ...subject, id: generateId() }] })),
      
      addTopic: (topic) => set((state) => ({ 
        topics: [...state.topics, { ...topic, id: generateId(), lastStudiedAt: null, nextReviewAt: null, reviewCount: 0 }] 
      })),

      setActiveTopicId: (id) => set({ activeTopicId: id }),

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
          currentCycleIndex: shouldAdvanceCycle
            ? (state.currentCycleIndex + 1) % (state.subjects.length || 1)
            : state.currentCycleIndex,
        };
      }),

      logStudySession: (topicId, durationSeconds) => set((state) => {
        const now = new Date();
        const topic = state.topics.find(t => t.id === topicId);
        let nextReviewAt = topic?.nextReviewAt;
        let reviewCount = topic?.reviewCount || 0;

        // 24/7/30 logic
        if (topic) {
           if (reviewCount === 0) {
             nextReviewAt = addDays(now, 1).toISOString();
           } else if (reviewCount === 1) {
             nextReviewAt = addDays(now, 7).toISOString();
           } else if (reviewCount === 2) {
             nextReviewAt = addDays(now, 30).toISOString();
           } else {
             nextReviewAt = addDays(now, 30).toISOString(); // Keep 30 days after
           }
           reviewCount += 1;
        }

        return {
          studySessions: [...state.studySessions, { id: generateId(), topicId, durationSeconds, date: now.toISOString() }],
          topics: state.topics.map(t => t.id === topicId ? { ...t, lastStudiedAt: now.toISOString(), nextReviewAt, reviewCount } : t),
          currentCycleIndex: (state.currentCycleIndex + 1) % (state.subjects.length || 1)
        };
      }),

      addQuestionLog: (log) => set((state) => ({
        questionLogs: [...state.questionLogs, { ...log, id: generateId(), date: new Date().toISOString() }]
      })),

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
        const newSubjects = [...state.subjects];
        const newTopics = [...state.topics];

        data.forEach(item => {
          const subjectId = generateId();
          newSubjects.push({
            id: subjectId,
            name: item.subject,
            color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
          });

          item.topics.forEach(topicName => {
            newTopics.push({
              id: generateId(),
              subjectId,
              name: topicName,
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
        studySessions: []
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

      resetAllData: () => set({
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
          activeDays: [1, 2, 3, 4, 5],
          hoursPerDay: 2,
        },
        userProfile: {
          name: 'Estudante',
          bio: '',
          birthDate: '',
          gender: '',
          activeMethod: 'Ciclo à Aprovação',
          avatar: null,
        },
        currentCycleIndex: 0,
        activeTopicId: null,
      }),
    }),
    {
      name: 'engine-aprovacao-storage',
    }
  )
);
