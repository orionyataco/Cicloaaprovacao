import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, Plus, X, Brain, Loader2, CheckCircle2, ChevronRight, AlertTriangle, Trash2, BrainCircuit, Share2, Users, Search, ExternalLink } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, limit, setDoc } from 'firebase/firestore';
import { cn, fetchDocsByIds } from '@/lib/utils';
import { callGemini } from '@/lib/gemini';
import { GeneratedQuestion, SharedQuestion } from '@/store';

// Removido interface GeneratedQuestion local pois foi movida para o store.ts
export function Simulados() {
  const { 
    simulados, 
    addSimulado, 
    deleteSimulado, 
    subjects, 
    topics, 
    editalInfo, 
    addFlashcard, 
    addQuestionLog, 
    logStudySession, 
    autoGenerateTopicId, 
    setAutoGenerateTopicId, 
    autoGenerateSubjectId, 
    setAutoGenerateSubjectId, 
    autoGenerateCount, 
    followingIds, 
    sharedQuestions, 
    userProfile,
    wrongQuestions,
    addWrongQuestion,
    deleteWrongQuestion,
    updateWrongQuestionErrorReason,
    updateWrongQuestionAiAnalysis
  } = useStore();
  
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);
  const [convertedToFlashcard, setConvertedToFlashcard] = useState<Record<number, boolean>>({});
  const [showSubjectBreakdown, setShowSubjectBreakdown] = useState(false);
  const [manualSubjectScores, setManualSubjectScores] = useState<Record<string, { correct: string, total: string }>>({});
  const [activeTab, setActiveTab] = useState<'simulados' | 'erros'>('simulados');
  const [analyzingId, setAnalyzingId] = useState<string|null>(null);

  const handleAnalyzeError = async (wq: any) => {
    setAnalyzingId(wq.id);
    try {
      const reasonLabel = {
        NONE: 'Não informado',
        ATTENTION: 'Falta de Atenção / Pegadinha',
        LACK_OF_CONTENT: 'Falta de Conteúdo / Não estudei o tema',
        INTERPRETATION: 'Erro de Interpretação do enunciado',
        TIME: 'Tempo escasso / Pressão',
        OTHER: 'Outro motivo'
      }[wq.errorReason as 'NONE' | 'ATTENTION' | 'LACK_OF_CONTENT' | 'INTERPRETATION' | 'TIME' | 'OTHER'] || 'Não informado';

      const prompt = `Você é um professor mentor de concursos especializado. O aluno errou a seguinte questão e precisa de um feedback cirúrgico.
      
Materia: ${wq.subject}
Assunto: ${wq.topic}
Questão: ${wq.text}
Alternativas:
${wq.options.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}

Gabarito Oficial: Alternativa ${String.fromCharCode(65 + wq.correctIndex)})
Alternativa que o aluno marcou: ${wq.userAnswerIndex >= 0 ? `Alternativa ${String.fromCharCode(65 + wq.userAnswerIndex)})` : 'Não respondeu'}
Causa alegada pelo aluno para o erro: ${reasonLabel}
Explicação padrão da questão: ${wq.explanation}

Por favor, faça um diagnóstico rápido do erro cometido pelo aluno. Explique de forma muito direta (máximo 4 parágrafos) por que a alternativa dele está errada e o gabarito oficial está correto, e dê uma dica prática de estudo personalizada (ex: foco na lei seca, resolução de questões semelhantes, ou revisão teórica específica) para que ele nunca mais erre esse tipo de questão. Escreva em português do Brasil com tom encorajador e profissional.`;

      const response = await callGemini(prompt);
      if (response) {
        updateWrongQuestionAiAnalysis(wq.id, response);
      } else {
        alert('Não foi possível obter resposta da IA.');
      }
    } catch (err: any) {
      console.error('Erro na análise de IA:', err);
      alert(`Erro ao analisar: ${err.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  // AI Generation State
  const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Active Exam State
  const [activeExam, setActiveExam] = useState<GeneratedQuestion[]|null>(null);
  const [activeExamType, setActiveExamType] = useState<'ai'|'shared'>('ai');
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [examFinished, setExamFinished] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number|null>(null);
  const [activeExamCategory, setActiveExamCategory] = useState<'simulado'|'questoes'>('simulado');

  // Sharing State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [questionToShare, setQuestionToShare] = useState<GeneratedQuestion|null>(null);
  const [friends, setFriends] = useState<{uid: string, name: string, username: string}[]>([]);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  
  // Share Modal Search State
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{uid: string, name: string, username: string}[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);

  // External Share State
  const [externalShareLink, setExternalShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !score || !total) return;
    
    addSimulado({
      name,
      score: Number(score),
      total: Number(total),
      date: new Date().toISOString(),
      type: 'manual',
      category: showSubjectBreakdown ? 'simulado' : 'questoes'
    });

    // Se houver breakdown por matéria, adiciona ao questionLog para refletir nos relatórios
    if (showSubjectBreakdown) {
      Object.entries(manualSubjectScores).forEach(([subjectId, results]) => {
        const res = results as { correct: string, total: string };
        if (res.correct && res.total) {
          // Encontra o primeiro tópico da matéria para atribuir os acertos
          const firstTopic = topics.find(t => t.subjectId === subjectId);
          if (firstTopic) {
            addQuestionLog({
              topicId: firstTopic.id,
              totalQuestions: Number(res.total),
              correctAnswers: Number(res.correct),
              errorReason: 'NONE'
            });
          }
        }
      });
    }
    
    setName('');
    setScore('');
    setTotal('');
    setManualSubjectScores({});
    setShowSubjectBreakdown(false);
    setIsAdding(false);
  };

  const handleDistributionChange = (subjectId: string, value: string) => {
    const num = parseInt(value) || 0;
    setDistribution(prev => ({ ...prev, [subjectId]: num }));
  };

  const totalRequestedQuestions = Object.values(distribution).reduce((a: number, b: number) => a + b, 0);

  const generateExam = useCallback(async (overrideDistribution?: Record<string, number>, targetTopicId?: string, forceCount?: number) => {
    const dist = overrideDistribution || distribution;
    const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0);

    if (total === 0) {
      alert('Selecione pelo menos uma questão.');
      return;
    }
    setIsGenerating(true);
    try {
      console.log('Iniciando geração de simulado...');

      const isCespe = editalInfo.banca.toLowerCase().includes('cespe') || editalInfo.banca.toLowerCase().includes('cebraspe');
      const promptType = isCespe ? 'Certo/Errado (apenas 2 alternativas)' : 'múltipla escolha (5 alternativas)';

      let subjectsWithTopics;
      if (targetTopicId) {
        const topic = topics.find(t => t.id === targetTopicId);
        const subject = subjects.find(s => s.id === topic?.subjectId);
        subjectsWithTopics = [{
          disciplina: subject?.name || 'Assunto',
          quantidade_questoes: forceCount || 3,
          topicos_base: [topic?.name || 'Tema']
        }];
      } else {
        subjectsWithTopics = subjects
          .filter(s => dist[s.id] > 0)
          .map(s => ({
            disciplina: s.name,
            quantidade_questoes: dist[s.id],
            topicos_base: topics.filter(t => t.subjectId === s.id).map(t => t.name)
          }));
      }

      const category = subjectsWithTopics.length > 1 ? 'simulado' : 'questoes';
      setActiveExamCategory(category);

      const examplesByBanca = {
        cespe: {
          style: 'Certo/Errado com afirmações categóricas que exigem julgamento objetivo',
          example: {
            subject: 'Direito Constitucional',
            topic: 'Art. 5º da CF - Direitos e Garantias Fundamentais',
            text: 'À luz da Constituição Federal de 1988 e do entendimento consolidado do STF, é legítima a decretação de prisão preventiva com fundamento exclusivo na gravidade abstrata do delito, independentemente de demonstração de contemporaneidade do risco processual.',
            options: ['Certo', 'Errado'],
            correctIndex: 1,
            explanation: 'Errado. O STF firmou entendimento (HC 104.339) de que a prisão preventiva não pode ser decretada com base exclusivamente na gravidade abstrata do crime. É necessária a demonstração concreta de contemporaneidade dos requisitos do art. 312 do CPP.'
          }
        },
        fgv: {
          style: 'Casos práticos e situações-problema com 5 alternativas',
          example: {
            subject: 'Raciocínio Lógico',
            topic: 'Estruturas Lógicas',
            text: 'Em uma repartição pública, os analistas A, B e C fazem afirmações sobre seus próprios cargos: A diz "B é analista administrativo"; B diz "C é analista judiciário"; C diz "A não é analista administrativo". Sabe-se que apenas um deles mente. Se A é analista administrativo, quem é analista judiciário?',
            options: ['Apenas B', 'Apenas C', 'B e C', 'A e C', 'Nenhum'],
            correctIndex: 0,
            explanation: 'Se A é analista administrativo, a afirmação de C ("A não é analista administrativo") é falsa, então C mente. Como apenas um mente, A e B falam a verdade. B diz que C é analista judiciário → contradição (C mente, mas isso não impede). Na verdade, se C mente, sua afirmação é falsa → A é analista administrativo (ok). B verdade → C é analista judiciário. Logo B é analista judiciário. Alternativa A.'
          }
        },
        fcc: {
          style: 'Literalidade da lei e doutrina clássica com 5 alternativas',
          example: {
            subject: 'Direito Administrativo',
            topic: 'Atos Administrativos - Atributos',
            text: 'A presunção de legitimidade dos atos administrativos é um atributo que impõe ao administrado o ônus de provar eventual ilegalidade. Contudo, tal presunção é relativa (juris tantum), admitindo prova em contrário. Nesse contexto, assinale a alternativa correta:',
            options: [
              'A presunção de legitimidade é absoluta para atos vinculados.',
              'A presunção de legitimidade impede o controle judicial do ato.',
              'A presunção de legitimidade é relativa e admite prova em contrário.',
              'A presunção de legitimidade aplica-se apenas a atos discricionários.',
              'A presunção de legitimidade cessa com a edição do ato.'
            ],
            correctIndex: 2,
            explanation: 'Art. 2º da LINDB c/c doutrina de Maria Sylvia Di Pietro. A presunção de legitimidade é relativa (juris tantum), ou seja, admite prova em contrário. Não é absoluta, não impede controle judicial e aplica-se a todos os atos administrativos.'
          }
        }
      };

      const bancaLower = editalInfo.banca.toLowerCase();
      const chooseExample = bancaLower.includes('cespe') || bancaLower.includes('cebraspe') ? examplesByBanca.cespe
        : bancaLower.includes('fgv') ? examplesByBanca.fgv
        : bancaLower.includes('fcc') ? examplesByBanca.fcc
        : examplesByBanca.fgv;

      const prompt = `Você é um professor especialista em concursos públicos brasileiros, com vasta experiência em bancas como Cebraspe/Cespe, FGV e FCC.

Sua tarefa é gerar questões inéditas e de alto nível técnico no formato ${promptType} para a banca examinadora: "${editalInfo.banca || 'Padrão Profissional (FGV/FCC/Cespe)'}".

─── INSTRUÇÕES DE ESTILO ───
Estilo da banca para esta geração: ${chooseExample.style}

Para referência, SIGA EXATAMENTE O NÍVEL DE DIFICULDADE E ESTRUTURA DESTE EXEMPLO REAL:
Assunto: ${chooseExample.example.subject}
Tópico: ${chooseExample.example.topic}
Enunciado: "${chooseExample.example.text}"
Alternativas: ${JSON.stringify(chooseExample.example.options)}
Gabarito: ${chooseExample.example.correctIndex} (${chooseExample.example.options[chooseExample.example.correctIndex]})
Explicação: ${chooseExample.example.explanation}

─── REGRAS CRÍTICAS ───
1. LEGISLAÇÃO: Para Direito, use a Constituição Federal vigente, leis secas e códigos. NUNCA invente leis ou artigos.
2. JURISPRUDÊNCIA: Use entendimentos PACIFICADOS do STF (súmulas vinculantes, repercussão geral) e STJ (súmulas, recursos repetitivos). Prefira jurisprudência atual (2023-2026).
3. PEGADINHAS REAIS: Modele as questões a partir de erros clássicos de concurseiros:
   - Confundir prazos (ex: 5 vs 10 dias, decadência vs prescrição)
   - Trocar sujeitos (ex: competência da União vs Estado vs Município)
   - Esquecer exceções (ex: "salvo disposição em contrário")
   - Inverter o ônus da prova
   - Ignorar a hierarquia das normas
4. RIGOR TÉCNICO: Cada questão deve ter UMA resposta inequívoca. Evite enunciados vagos ou dupla interpretação.
5. CONHECIMENTOS REGIONAIS (AMAPÁ): Para temas de História e Geografia do Amapá, baseie-se estritamente em:
   - Ciclo do Manganês (ICOMI): exploração na Serra do Navio (1957-1997)
   - Criação do Território Federal do Amapá (1943) e elevação a Estado (1988)
   - Limites: Oiapoque (N), Pará (S e O), Oceano Atlântico (L)
   - População: ~900 mil hab. (IBGE 2024), Macapá como capital
   NÃO alucine dados demográficos ou históricos.
6. ATUALIZAÇÃO: Priorize a legislação e jurisprudência mais recentes. Se houver divergência doutrinária, indique o entendimento majoritário.

─── DISTRIBUIÇÃO SOLICITADA ───
${JSON.stringify(subjectsWithTopics, null, 2)}

─── FORMATO DE SAÍDA ───
RETORNE EXCLUSIVAMENTE UM ARRAY JSON VÁLIDO (SEM TEXTO ADICIONAL FORA DO JSON, SEM MARKDOWN, SEM EXPLICAÇÕES ANTES OU DEPOIS):
[
  {
    "subject": "Nome exato da disciplina (igual ao informado acima)",
    "topic": "Tópico específico com detalhe (ex: Art. 5º, XII - Inviolabilidade do sigilo de dados)",
    "text": "Enunciado completo no estilo da banca alvo",
    "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"${isCespe ? '' : `, "Alternativa E"`}],
    "correctIndex": 0,
    "explanation": "Explicação técnica CITANDO o dispositivo legal, súmula ou entendimento jurisprudencial aplicável. Seja didático."
  }
]`;

      const responseText = await callGemini(prompt);
      
      if (responseText) {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        const cleanText = jsonMatch ? jsonMatch[0] : responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedQuestions = JSON.parse(cleanText) as GeneratedQuestion[];
        
        setActiveExam(generatedQuestions);
        setActiveExamType('ai');
        setUserAnswers({});
        setExamFinished(false);
        setExamStartTime(Date.now());
        setIsGeneratingModalOpen(false);
      } else {
        throw new Error('Resposta vazia da IA');
      }
    } catch (error: any) {
      console.error('Erro ao gerar simulado:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [distribution, editalInfo.banca, subjects, topics]);

  useEffect(() => {
    if (autoGenerateTopicId) {
      const topic = topics.find(t => t.id === autoGenerateTopicId);
      if (topic) {
        generateExam({ [topic.subjectId]: autoGenerateCount }, topic.id, autoGenerateCount);
      }
      setAutoGenerateTopicId(null);
    } else if (autoGenerateSubjectId) {
      const subject = subjects.find(s => s.id === autoGenerateSubjectId);
      if (subject) {
        generateExam({ [subject.id]: autoGenerateCount }, undefined, autoGenerateCount);
      }
      setAutoGenerateSubjectId(null);
    }
  }, [autoGenerateTopicId, autoGenerateSubjectId, autoGenerateCount, topics, subjects, generateExam, setAutoGenerateTopicId, setAutoGenerateSubjectId]);

  const [activeSharedId, setActiveSharedId] = useState<string|null>(null);
  const [activeSharedSenderUid, setActiveSharedSenderUid] = useState<string|null>(null);

  const finishExam = async () => {
    if (!activeExam) return;
    
    let correctCount = 0;
    const subjectResults: Record<string, { total: number, correct: number }> = {};

    activeExam.forEach((q, index) => {
      const isCorrect = userAnswers[index] === q.correctIndex;
      if (isCorrect) {
        correctCount++;
      } else {
        addWrongQuestion({
          subject: q.subject,
          topic: q.topic,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          userAnswerIndex: userAnswers[index] !== undefined ? userAnswers[index] : -1,
          explanation: q.explanation
        });
      }

      // Track by topic for question logs
      const subject = subjects.find(s => 
        s.name.trim().toLowerCase() === q.subject.trim().toLowerCase() ||
        s.name.toLowerCase().includes(q.subject.toLowerCase()) ||
        q.subject.toLowerCase().includes(s.name.toLowerCase())
      );

      if (subject) {
        let topic = topics.find(t => 
          t.subjectId === subject.id && (
            t.name.trim().toLowerCase() === q.topic.trim().toLowerCase() ||
            t.name.toLowerCase().includes(q.topic.toLowerCase()) ||
            q.topic.toLowerCase().includes(t.name.toLowerCase())
          )
        );

        if (!topic) {
          topic = topics.find(t => t.subjectId === subject.id);
        }

        if (topic) {
          if (!subjectResults[topic.id]) {
            subjectResults[topic.id] = { total: 0, correct: 0 };
          }
          subjectResults[topic.id].total++;
          if (isCorrect) {
            subjectResults[topic.id].correct++;
          }
        }
      }
    });

    // Notificação para o remetente se for questão compartilhada
    if (activeExamType === 'shared' && activeSharedSenderUid) {
      try {
        const isCorrect = correctCount > 0;
        await addDoc(collection(db, 'notifications'), {
          toUid: activeSharedSenderUid,
          fromUid: auth.currentUser?.uid,
          type: 'system',
          title: isCorrect ? '🎉 Acertaram sua questão!' : '📚 Resolveram sua questão',
          message: `${userProfile.name} ${isCorrect ? 'ACERTOU' : 'errou'} a questão que você compartilhou.`,
          date: new Date().toISOString(),
          read: false,
          timestamp: serverTimestamp()
        });
        
        // Apaga a questão da lista do usuário atual pois já foi resolvida
        if (activeSharedId) {
          await deleteDoc(doc(db, 'shared_questions', activeSharedId));
        }
      } catch (err) {
        console.error('Erro ao enviar feedback de questão compartilhada:', err);
      }
    }

    // Log each topic result to question logs
    if (activeExamType !== 'shared') {
      Object.entries(subjectResults).forEach(([topicId, result]) => {
        addQuestionLog({
          topicId,
          totalQuestions: result.total,
          correctAnswers: result.correct,
          errorReason: 'NONE'
        });
      });
    }

    // Log study session duration
    if (examStartTime) {
      const durationSeconds = Math.floor((Date.now() - examStartTime) / 1000);
      const firstTopicId = Object.keys(subjectResults)[0];
      if (firstTopicId) {
        logStudySession(firstTopicId, durationSeconds);
      }
    }

    addSimulado({
      name: activeExamType === 'shared' ? `Questão Compartilhada - ${format(new Date(), "dd/MM/yyyy HH:mm")}` : `Simulado IA - ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      score: correctCount,
      total: activeExam.length,
      date: new Date().toISOString(),
      type: activeExamType === 'shared' ? 'shared' : 'ai',
      category: activeExamCategory
    });

    setExamFinished(true);
    // Limpa os trackers de compartilhamento
    setActiveSharedId(null);
    setActiveSharedSenderUid(null);
  };

  const handleConvertToFlashcard = (q: GeneratedQuestion, index: number) => {
    addFlashcard({
      topicId: topics.find(t => t.name === q.topic)?.id || topics[0]?.id || 't1',
      front: q.text,
      back: `Assunto: ${q.subject}\nResposta: ${q.options[q.correctIndex]}\n\nExplicação: ${q.explanation}`
    });
    setConvertedToFlashcard(prev => ({ ...prev, [index]: true }));
  };

  const openShareModal = (q: GeneratedQuestion) => {
    setQuestionToShare(q);
    setIsShareModalOpen(true);
    fetchFriends();
  };

  const fetchFriends = async () => {
    if (followingIds.length === 0) return;
    setIsSharingLoading(true);
    try {
      const profiles = await fetchDocsByIds<{ uid: string; name: string; username: string }>('profiles', 'uid', followingIds);
      setFriends(profiles.map(p => ({ uid: p.uid, name: p.name, username: p.username })));
    } catch (err) {
      console.error('Erro ao buscar amigos para compartilhar:', err);
    } finally {
      setIsSharingLoading(false);
    }
  };

  const shareWithFriend = async (friendUid: string) => {
    if (!questionToShare || !auth.currentUser) return;
    
    try {
      await addDoc(collection(db, 'shared_questions'), {
        fromUid: auth.currentUser.uid,
        fromName: userProfile.name,
        toUid: friendUid,
        date: new Date().toISOString(),
        question: questionToShare,
        timestamp: serverTimestamp()
      });
      alert('Questão compartilhada com sucesso!');
      setIsShareModalOpen(false);
      setFriendSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Erro ao compartilhar questão:', err);
      alert('Erro ao compartilhar.');
    }
  };

  const deleteSharedQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shared_questions', id));
    } catch (err) {
      console.error('Erro ao excluir questão compartilhada:', err);
    }
  };

  const handleSearchFriends = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = friendSearchQuery.trim().replace(/^@/, '');
    if (!cleanQuery) {
      setSearchResults([]);
      return;
    }

    setIsSearchingFriends(true);
    try {
      const qUsername = query(
        collection(db, 'profiles'), 
        where('username', '>=', cleanQuery.toLowerCase()), 
        where('username', '<=', cleanQuery.toLowerCase() + '\uf8ff'),
        limit(5)
      );
      
      const qName = query(
        collection(db, 'profiles'), 
        where('searchName', '>=', cleanQuery.toLowerCase()), 
        where('searchName', '<=', cleanQuery.toLowerCase() + '\uf8ff'),
        limit(5)
      );

      const [snapUser, snapName] = await Promise.all([getDocs(qUsername), getDocs(qName)]);
      const combined = [...snapUser.docs, ...snapName.docs].map(doc => ({
        uid: doc.id,
        name: doc.data().name,
        username: doc.data().username
      }));
      
      const uniqueResults = Array.from(new Map(combined.map(p => [p.uid, p])).values())
        .filter(p => p.uid !== auth.currentUser?.uid);
      
      setSearchResults(uniqueResults);
    } catch (err) {
      console.error('Erro na busca de amigos:', err);
    } finally {
      setIsSearchingFriends(false);
    }
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setFriendSearchQuery('');
    setSearchResults([]);
    setExternalShareLink(null);
    setLinkCopied(false);
  };

  const shareExternally = async () => {
    if (!questionToShare || !auth.currentUser) return;
    setIsGeneratingLink(true);
    try {
      const shareId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      await setDoc(doc(db, 'public_questions', shareId), {
        fromName: userProfile.name,
        fromAvatar: userProfile.avatar || null,
        fromUid: auth.currentUser.uid,
        question: questionToShare,
        date: new Date().toISOString(),
        views: 0,
        solves: 0,
        timestamp: serverTimestamp()
      });

      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}?q=${shareId}`;
      setExternalShareLink(link);
    } catch (err) {
      console.error('Erro ao gerar link externo:', err);
      alert('Erro ao gerar link de compartilhamento.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyExternalLink = async () => {
    if (!externalShareLink) return;
    try {
      await navigator.clipboard.writeText(externalShareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = externalShareLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  const nativeShare = async () => {
    if (!externalShareLink || !questionToShare) return;
    try {
      await navigator.share({
        title: 'Desafio - Ciclo a Aprovação',
        text: `${userProfile.name} te enviou uma quest\u00e3o de ${questionToShare.subject}. Mostre que voc\u00ea consegue resolver!`,
        url: externalShareLink
      });
    } catch (err) {
      // User cancelled or not supported
      console.log('Share cancelled or not supported:', err);
    }
  };

  const displayedFriends = friendSearchQuery.trim() ? searchResults : friends;

  const shareModalNode = isShareModalOpen && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
            <Share2 className="w-6 h-6 text-blue-400" />
            Compartilhar Questão
          </h2>
          <button onClick={closeShareModal} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-zinc-400 text-sm mb-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800 italic">
           "{questionToShare?.text?.substring(0, 100)}..."
        </p>

        <form onSubmit={handleSearchFriends} className="relative mb-6">
          <input 
            type="text"
            placeholder="Pesquisar por @usuario ou nome..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
            value={friendSearchQuery}
            onChange={(e) => {
              setFriendSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults([]);
            }}
          />
          <button 
            type="submit"
            disabled={isSearchingFriends}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-blue-400"
          >
            <Search className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {friendSearchQuery.trim() ? 'Resultados da busca' : 'Amigos que você segue'}
           </p>
           {isSharingLoading || isSearchingFriends ? (
             <div className="flex justify-center py-8">
               <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
             </div>
           ) : displayedFriends.length > 0 ? (
             displayedFriends.map(friend => (
               <button 
                key={friend.uid}
                onClick={() => shareWithFriend(friend.uid)}
                className="w-full flex items-center justify-between p-4 bg-zinc-800/30 hover:bg-blue-600/10 rounded-2xl border border-zinc-800 hover:border-blue-500/30 transition-all text-left group"
               >
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 group-hover:text-blue-400">
                      {friend.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-100">{friend.name}</div>
                      <div className="text-[10px] text-zinc-500">@{friend.username}</div>
                    </div>
                 </div>
                 <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400" />
               </button>
             ))
           ) : (
             <div className="text-center py-8">
               <p className="text-zinc-500 text-sm italic">Nenhum aluno encontrado.</p>
             </div>
           )}
        </div>

         {/* Divider */}
         <div className="flex items-center gap-3 my-4">
           <div className="flex-1 h-px bg-zinc-800" />
           <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">ou compartilhe externamente</span>
           <div className="flex-1 h-px bg-zinc-800" />
         </div>

         {/* External Share Section */}
         <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
           {!externalShareLink ? (
             <div className="text-center">
               <p className="text-sm text-zinc-400 mb-4">
                 Gere um link público para enviar por <span className="text-emerald-400 font-semibold">WhatsApp</span>, <span className="text-blue-400 font-semibold">Telegram</span>, ou qualquer rede social.
               </p>
               <p className="text-[10px] text-zinc-600 mb-4">A pessoa poderá resolver a questão sem precisar ter conta. Depois, ela escolhe se quer criar uma.</p>
               <button
                 onClick={shareExternally}
                 disabled={isGeneratingLink}
                 className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10"
               >
                 {isGeneratingLink ? (
                   <><Loader2 className="w-4 h-4 animate-spin" /> Gerando link...</>
                 ) : (
                   <><ExternalLink className="w-4 h-4" /> Gerar Link de Convite</>  
                 )}
               </button>
             </div>
           ) : (
             <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="flex items-center gap-2 mb-2">
                 <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                 <span className="text-sm font-bold text-emerald-400">Link gerado com sucesso!</span>
               </div>
               <div className="flex items-center gap-2">
                 <input
                   type="text"
                   readOnly
                   value={externalShareLink}
                   className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-zinc-300 font-mono select-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                   onClick={(e) => (e.target as HTMLInputElement).select()}
                 />
                 <button
                   onClick={copyExternalLink}
                   className={cn(
                     "px-4 py-2.5 rounded-lg text-xs font-bold transition-all border shrink-0",
                     linkCopied
                       ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                       : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                   )}
                 >
                   {linkCopied ? '✓ Copiado!' : 'Copiar'}
                 </button>
               </div>
               {typeof navigator.share === 'function' && (
                 <button
                   onClick={nativeShare}
                   className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                 >
                   <Share2 className="w-4 h-4" /> Enviar via WhatsApp / Redes Sociais
                 </button>
               )}
             </div>
           )}
         </div>
      </div>
    </div>
  );

  if (isGenerating && !activeExam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
          <Brain className="w-8 h-8 text-blue-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-zinc-100 tracking-tight">Gerando suas questões...</h2>
          <p className="text-zinc-500 font-medium">A IA do Ciclo está preparando o melhor material para você. Aguarde alguns segundos.</p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-widest pt-4">
             <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
             <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
             <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
             Processando
          </div>
        </div>
      </div>
    );
  }

  if (activeExam) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-zinc-800 pb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">Simulado e Questões IA</h1>
            <p className="text-zinc-400 mt-1">
              {examFinished ? 'Resultados do simulado' : `Questão ${Object.keys(userAnswers).length} de ${activeExam.length} respondidas`}
            </p>
          </div>
          <button 
            onClick={() => setActiveExam(null)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium"
          >
            Sair do Simulado
          </button>
        </header>

        <div className="space-y-6 md:space-y-12">
          {activeExam.map((q, qIndex) => (
            <div key={qIndex} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-zinc-800 text-zinc-300 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  Questão {qIndex + 1}
                </span>
                <span className="text-sm text-emerald-400 font-medium">{q.subject}</span>
                <span className="text-sm text-zinc-500">• {q.topic}</span>
              </div>
              
              <p className="text-lg text-zinc-100 mb-8 leading-relaxed whitespace-pre-wrap">{q.text}</p>
              
              <div className="space-y-3">
                {q.options.map((opt, optIndex) => {
                  const isSelected = userAnswers[qIndex] === optIndex;
                  const isCorrect = q.correctIndex === optIndex;
                  const showResult = examFinished;
                  
                  let optionClass = "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300";
                  
                  if (showResult) {
                    if (isCorrect) optionClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
                    else if (isSelected && !isCorrect) optionClass = "border-red-500/50 bg-red-500/10 text-red-200";
                    else optionClass = "border-zinc-800 bg-zinc-900/50 text-zinc-500 opacity-50";
                  } else if (isSelected) {
                    optionClass = "border-emerald-500 bg-emerald-500/10 text-emerald-200";
                  }

                  return (
                    <button
                      key={optIndex}
                      disabled={examFinished}
                      onClick={() => setUserAnswers(prev => ({ ...prev, [qIndex]: optIndex }))}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4",
                        optionClass,
                        !examFinished && "cursor-pointer"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5",
                        showResult && isCorrect ? "border-emerald-500 bg-emerald-500 text-zinc-900" :
                        showResult && isSelected && !isCorrect ? "border-red-500 bg-red-500 text-zinc-900" :
                        isSelected ? "border-emerald-500 bg-emerald-500 text-zinc-900" : "border-zinc-600"
                      )}>
                        {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> : 
                         showResult && isSelected && !isCorrect ? <X className="w-4 h-4" /> : 
                         String.fromCharCode(65 + optIndex)}
                      </div>
                      <span className="leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {examFinished && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-5 h-5 text-blue-400" />
                      <h4 className="font-semibold text-zinc-200">Explicação</h4>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed">{q.explanation}</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => handleConvertToFlashcard(q, qIndex)}
                      disabled={convertedToFlashcard[qIndex]}
                      className={cn(
                        "flex-1 items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all flex border",
                        convertedToFlashcard[qIndex]
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30"
                      )}
                    >
                      {convertedToFlashcard[qIndex] ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Flashcard Criado
                        </>
                      ) : (
                        <>
                          <BrainCircuit className="w-4 h-4" /> Criar Flashcard
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => openShareModal(q)}
                      className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 border border-zinc-700/50 px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> Compartilhar Questão
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!examFinished && (
          <div className="sticky bottom-4 md:bottom-8 flex justify-end pb-2">
            <button
              onClick={finishExam}
              disabled={Object.keys(userAnswers).length < activeExam.length}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-5 py-3 md:px-8 md:py-4 rounded-2xl font-bold text-base md:text-lg shadow-2xl transition-all flex items-center gap-3"
            >
              Finalizar Simulado <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
        
        {shareModalNode}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Simulados</h1>
          <p className="text-zinc-400 mt-1">Registre e acompanhe sua evolução em provas completas e questões avulsas.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {sharedQuestions.length > 0 && activeTab === 'simulados' && (
             <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">
                <Users className="w-3 h-3" /> {sharedQuestions.length} novas questões compartilhadas
             </div>
          )}
          {activeTab === 'simulados' && (
            <>
              <button 
                onClick={() => setIsGeneratingModalOpen(true)}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Brain className="w-4 h-4" /> Gerar com IA
              </button>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {isAdding ? 'Cancelar' : 'Registrar Manual'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Abas de Navegação */}
      <div className="flex overflow-x-auto border-b border-zinc-800 no-scrollbar">
        <button
          onClick={() => setActiveTab('simulados')}
          className={cn(
            "pb-4 px-6 text-sm font-bold border-b-2 transition-all",
            activeTab === 'simulados'
              ? "border-emerald-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          )}
        >
          Histórico de Simulados
        </button>
        <button
          onClick={() => setActiveTab('erros')}
          className={cn(
            "pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === 'erros'
              ? "border-emerald-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          )}
        >
          Caderno de Erros Inteligente
          {wrongQuestions.length > 0 && (
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-black">
              {wrongQuestions.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'simulados' ? (
        <>
          {/* Shared Questions Section */}
          {sharedQuestions.length > 0 && (
            <section className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Questões Compartilhadas com Você
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedQuestions.map((shared) => (
                  <div key={shared.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-amber-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                           {shared.fromName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Enviado por {shared.fromName}</p>
                          <p className="text-[8px] text-zinc-600">{format(parseISO(shared.date), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteSharedQuestion(shared.id)} className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm text-zinc-100 line-clamp-2 mb-4 italic">"{shared.question.text}"</p>
                    <button 
                      onClick={() => {
                        setActiveExam([shared.question]);
                        setActiveExamType('shared');
                        setActiveSharedId(shared.id);
                        setActiveSharedSenderUid(shared.fromUid);
                        setUserAnswers({});
                        setExamStartTime(Date.now());
                        setActiveExamCategory('questoes');
                      }}
                      className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold rounded-lg border border-amber-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Brain className="w-3 h-3" /> Resolver agora
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isAdding && (
            <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Nome da Prova</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Simulado TJ-SP 01"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Acertos</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Total de Questões</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                  />
                </div>
              </div>

              <div className="bg-zinc-800/50 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Desempenho por Matéria (Opcional)</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowSubjectBreakdown(!showSubjectBreakdown)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {showSubjectBreakdown ? 'Ocultar Detalhes' : 'Detalhar por Matéria'}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500">Ao detalhar por matéria, esses resultados serão refletidos nos seus Relatórios de Performance.</p>
                
                {showSubjectBreakdown && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    {subjects.map(subject => (
                      <div key={subject.id} className="flex items-center justify-between gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                          <span className="text-xs text-zinc-300 truncate">{subject.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            placeholder="Hits"
                            value={manualSubjectScores[subject.id]?.correct || ''}
                            onChange={(e) => setManualSubjectScores(prev => ({ 
                              ...prev, 
                              [subject.id]: { ...prev[subject.id], correct: e.target.value, total: prev[subject.id]?.total || '10' } 
                            }))}
                            className="w-12 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs text-center"
                          />
                          <span className="text-zinc-600">/</span>
                          <input 
                            type="number" 
                            placeholder="Total"
                            value={manualSubjectScores[subject.id]?.total || ''}
                            onChange={(e) => setManualSubjectScores(prev => ({ 
                              ...prev, 
                              [subject.id]: { ...prev[subject.id], total: e.target.value } 
                            }))}
                            className="w-12 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs text-center"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                  Salvar
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {simulados.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(simulado => {
              const percentage = Math.round((simulado.score / simulado.total) * 100);
              let colorClass = "text-zinc-400";
              if (percentage >= 85) colorClass = "text-emerald-400";
              else if (percentage >= 70) colorClass = "text-blue-400";
              else colorClass = "text-red-400";

              return (
                <div key={simulado.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <Trophy className={`w-5 h-5 ${colorClass}`} />
                      <h3 className="font-semibold text-zinc-100">{simulado.name}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">
                        {format(parseISO(simulado.date), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                      {confirmDelete === simulado.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400 font-medium">Excluir?</span>
                          <button onClick={() => { deleteSimulado(simulado.id); setConfirmDelete(null); }} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Sim</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs bg-zinc-700 text-zinc-200 px-2 py-1 rounded hover:bg-zinc-600">Não</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDelete(simulado.id)}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-400/10"
                          title="Excluir simulado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-bold tracking-tighter ${colorClass}`}>
                      {percentage}%
                    </span>
                    <span className="text-sm text-zinc-500 mb-1">
                      ({simulado.score}/{simulado.total})
                    </span>
                  </div>
                </div>
              );
            })}
            
            {simulados.length === 0 && !isAdding && (
              <div className="col-span-full text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                Nenhum simulado registrado.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Caderno de Erros Inteligente
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Aqui ficam registradas as questões que você errou nos simulados de IA. Revise-as e mapeie suas falhas.</p>
            </div>
            <div className="flex items-center gap-4 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total de Erros</span>
              <span className="text-xl font-black text-red-400">{wrongQuestions.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {wrongQuestions.map((wq) => (
              <div key={wq.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-4 hover:border-zinc-700 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-red-500/20">
                      Questão Errada
                    </span>
                    <span className="text-sm text-emerald-400 font-bold">{wq.subject}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-xs text-zinc-400 font-medium truncate max-w-[200px]" title={wq.topic}>{wq.topic}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono">
                      {format(parseISO(wq.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    <button
                      onClick={() => deleteWrongQuestion(wq.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Remover do caderno de erros"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-zinc-100 text-sm md:text-base leading-relaxed whitespace-pre-wrap">{wq.text}</p>

                {/* Opções */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {wq.options.map((opt, oIdx) => {
                    const isUserAnswer = wq.userAnswerIndex === oIdx;
                    const isCorrectAnswer = wq.correctIndex === oIdx;
                    
                    let borderClass = "border-zinc-800 bg-zinc-950/20 text-zinc-400";
                    let labelClass = "border-zinc-700 text-zinc-500";
                    if (isCorrectAnswer) {
                      borderClass = "border-emerald-500/30 bg-emerald-500/5 text-emerald-300";
                      labelClass = "border-emerald-500 bg-emerald-500 text-zinc-950 font-bold";
                    } else if (isUserAnswer) {
                      borderClass = "border-red-500/30 bg-red-500/5 text-red-300";
                      labelClass = "border-red-500 bg-red-500 text-zinc-950 font-bold";
                    }

                    return (
                      <div key={oIdx} className={cn("p-3.5 rounded-xl border text-xs flex items-start gap-3", borderClass)}>
                        <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5", labelClass)}>
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Causa do Erro e Análise de IA */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-zinc-800/80">
                  {/* Causa do Erro */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Causa do Erro</label>
                    <select
                      value={wq.errorReason}
                      onChange={(e) => updateWrongQuestionErrorReason(wq.id, e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      <option value="NONE">Selecione o motivo...</option>
                      <option value="ATTENTION">Falta de Atenção / Pegadinha</option>
                      <option value="LACK_OF_CONTENT">Falta de Conteúdo / Não estudei</option>
                      <option value="INTERPRETATION">Erro de Interpretação</option>
                      <option value="TIME">Tempo esgotado / Pressão</option>
                      <option value="OTHER">Outro motivo</option>
                    </select>
                  </div>

                  {/* Análise de IA */}
                  <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Análise do Professor IA</span>
                      <button
                        onClick={() => handleAnalyzeError(wq)}
                        disabled={analyzingId === wq.id}
                        className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                      >
                        {analyzingId === wq.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                        ) : (
                          <><BrainCircuit className="w-3.5 h-3.5" /> {wq.aiAnalysis ? 'Reanalisar Erro' : 'Analisar meu Erro'}</>
                        )}
                      </button>
                    </div>

                    {wq.aiAnalysis ? (
                      <div className="bg-blue-950/20 border border-blue-900/30 p-4 rounded-xl text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-1">
                        {wq.aiAnalysis}
                      </div>
                    ) : (
                      <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl text-xs text-zinc-500 italic text-center">
                        Clique em "Analisar meu Erro" para receber um diagnóstico e dicas de estudo personalizadas.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {wrongQuestions.length === 0 && (
              <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
                <p className="font-medium text-sm">Nenhum erro registrado no seu caderno!</p>
                <p className="text-xs text-zinc-600 mt-1">Continue resolvendo simulados de IA para mapear seus pontos de melhoria.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Geração */}
      {isGeneratingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                Gerar Simulado ou Questões
              </h2>
              <button onClick={() => setIsGeneratingModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Cadastre disciplinas no Edital primeiro.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-sm text-zinc-400 mb-4">
                    Escolha a quantidade de questões por matéria:
                  </p>
                  {subjects.map(subject => (
                    <div key={subject.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                        <span className="text-sm font-medium text-zinc-200">{subject.name}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={distribution[subject.id] || ''}
                        onChange={(e) => handleDistributionChange(subject.id, e.target.value)}
                        placeholder="0"
                        className="w-16 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded text-center py-1 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">
                    Total: <span className="text-zinc-100 font-bold">{totalRequestedQuestions}</span> questões
                  </div>
                  <button
                    onClick={generateExam}
                    disabled={isGenerating || totalRequestedQuestions === 0}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {isGenerating ? 'Gerando...' : 'Gerar Agora'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalNode}
    </div>
  );
}
