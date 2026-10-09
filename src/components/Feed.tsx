import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  HelpCircle, 
  MessageSquare, 
  Heart, 
  Copy, 
  Check, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  X, 
  Sparkles, 
  Bold, 
  Italic, 
  List, 
  Heading3, 
  Quote, 
  Code, 
  ExternalLink, 
  Search, 
  BookOpen, 
  Bookmark, 
  Eye, 
  MessageCircle,
  CloudCheck,
  HardDrive
} from 'lucide-react';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc, 
  limit 
} from 'firebase/firestore';
import { useStore } from '../store';
import { cn } from '../lib/utils';

export type PostType = 'text' | 'question' | 'tip' | 'link';

export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}

export interface QuestionData {
  subject?: string;
  topic?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  userAnswers?: Record<string, number>;
}

export interface FeedPost {
  id: string;
  type: PostType;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  authorTargetExam?: string | null;
  title?: string;
  content: string;
  linkUrl?: string;
  linkTitle?: string;
  imageUrl?: string | null;
  question?: QuestionData;
  likes: string[];
  comments: PostComment[];
  createdAt: string;
}

const INITIAL_DEMO_POSTS: FeedPost[] = [
  {
    id: 'demo-1',
    type: 'question',
    authorId: 'prof-claudia',
    authorName: 'Profa. Cláudia Mendes',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    authorTargetExam: 'Magistratura Estadual',
    title: 'Direito Constitucional - Eficácia das Normas',
    content: 'Questão inédita focada nas pegadinhas da banca FGV sobre a classificação das normas constitucionais segundo José Afonso da Silva. Analise e responda com atenção!',
    question: {
      subject: 'Direito Constitucional',
      topic: 'Aplicabilidade das Normas Constitucionais',
      options: [
        'Normas de eficácia contida dependem obrigatoriamente de lei posterior para produzirem seus efeitos imediatos.',
        'Normas de eficácia plena têm aplicabilidade direta, imediata e integral, não dependendo de legislação integradora para surtir efeitos.',
        'Normas de eficácia limitada são autoaplicáveis e produzem todos os seus efeitos desde a promulgação da Constituição.',
        'Normas programáticas não possuem nenhuma relevância jurídica e são meras exortações morais sem valor cogente.',
        'Normas de eficácia exaurida admitem restrição posterior pelo legislador ordinário a qualquer tempo.'
      ],
      correctIndex: 1,
      explanation: 'Gabarito Letra B! As normas de eficácia plena têm aplicabilidade direta, imediata e integral desde a entrada em vigor da Carta Magna, não demandando normatização infraconstitucional integradora para exercerem a plenitude de seus efeitos.',
      userAnswers: {
        'user-101': 1,
        'user-102': 1,
        'user-103': 0,
        'user-104': 1,
      }
    },
    likes: ['user-101', 'user-102', 'user-105'],
    comments: [
      {
        id: 'c1',
        authorId: 'carlos-estudos',
        authorName: 'Carlos Eduardo',
        authorAvatar: null,
        content: 'Excelente questão! A diferença entre eficácia contida (restringível) e limitada (necessita de integração) cai em quase toda prova.',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'demo-2',
    type: 'tip',
    authorId: 'mariana-concurseira',
    authorName: 'Mariana Lima',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    authorTargetExam: 'Receita Federal - Auditor Fiscal',
    title: 'Mnemônico infalível: Princípios da Administração Pública',
    content: `Para quem sempre confunde os princípios expressos no art. 37 da CF/88:

Lembre-se sempre do clássico: **LIMPE**!
- **L**egalidade: O administrador só faz o que a lei autoriza.
- **I**mpessoalidade: Finalidade pública, sem promoção pessoal.
- **M**oralidade: Atuação ética, lealdade e boa-fé.
- **P**ublicidade: Transparência dos atos oficiais.
- **E**ficiência: Busca por resultados com celeridade e custo-benefício.

> Dica de ouro: Atenção com o princípio da *razoabilidade* e *proporcionalidade*, que são **implícitos**, e não expressos no caput do art. 37!`,
    likes: ['user-101', 'user-103'],
    comments: [],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'demo-3',
    type: 'link',
    authorId: 'felipe-tech',
    authorName: 'Felipe Rocha',
    authorAvatar: null,
    authorTargetExam: 'Tribunal de Contas (TCU)',
    title: 'Edital Verticalizado e Estatísticas de Questões',
    content: 'Compartilhando um levantamento dos tópicos mais cobrados pela banca nos últimos anos de provas. Vale a pena conferir o peso de cada disciplina!',
    linkUrl: 'https://www.concursosnobrasil.com.br',
    linkTitle: 'Estatísticas e Análise de Incidência de Disciplinas',
    likes: ['user-102', 'user-104', 'user-105', 'user-106'],
    comments: [
      {
        id: 'c2',
        authorId: 'lucas-pcdf',
        authorName: 'Lucas Andrade',
        authorAvatar: null,
        content: 'Muito bom! Ajudou demais a recalcular os pesos no meu ciclo semanal.',
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

// Função auxiliar para remover recursivamente campos com valor undefined (que o Firestore proíbe)
function sanitizePayload(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        cleaned[k] = sanitizePayload(v);
      }
    }
    return cleaned;
  }
  return obj;
}

export function Feed() {
  const { userProfile, addFlashcard } = useStore();
  const currentUid = auth.currentUser?.uid || 'user-local-' + (userProfile.username || 'estudante');
  const isCloudAvailable = isFirebaseConfigured() && Boolean(auth.currentUser);

  // Estados dos posts
  const [posts, setPosts] = useState<FeedPost[]>(() => {
    const saved = localStorage.getItem('ciclo_community_feed');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        return INITIAL_DEMO_POSTS;
      }
    }
    return INITIAL_DEMO_POSTS;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<PostType | 'all' | 'mine' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'compose' | 'list'>('list');

  // Estado do Compositor de Post
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  
  // Imagem
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImageInputOpen, setIsImageInputOpen] = useState(false);
  const [imageExternalUrl, setImageExternalUrl] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Link
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  // Questão
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionTopic, setQuestionTopic] = useState('');
  const [questionOptions, setQuestionOptions] = useState<string[]>([
    '', '', '', ''
  ]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);
  const [questionExplanation, setQuestionExplanation] = useState('');

  // Comentários ativos
  const [expandedCommentPostId, setExpandedCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{ [postId: string]: string }>({});

  // Botão copiar feedback
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Salva no LocalStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('ciclo_community_feed', JSON.stringify(posts));
  }, [posts]);

  // Sincronização em tempo real com Firebase Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    try {
      const q = query(
        collection(db, 'feed_posts'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const fetchedPosts = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            })) as FeedPost[];
            
            setPosts((prev) => {
              const remoteSignatures = new Set(
                fetchedPosts.map(p => `${p.authorId}_${p.content.trim().slice(0, 60)}`)
              );
              // Mantém posts locais que ainda não foram sincronizados
              const localOnly = prev.filter(p => 
                p.id.startsWith('post-local-') && 
                !remoteSignatures.has(`${p.authorId}_${p.content.trim().slice(0, 60)}`)
              );

              // Unifica e remove duplicatas por ID
              const seen = new Set<string>();
              const combined = [...localOnly, ...fetchedPosts];
              return combined.filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
              });
            });
          }
        },
        (error) => {
          console.warn('[Feed] Firebase listener retornou erro (mantendo modo local):', error.message);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[Feed] Erro ao iniciar listener do Firestore:', err);
    }
  }, []);

  // Comprimir imagem enviada via Canvas para manter leve (< 120KB)
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onerror = () => reject(new Error('Falha ao processar imagem.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        resolve(compressed);
      };
    });
  };

  // Upload de arquivo de imagem
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('A imagem deve ter menos de 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressImage(reader.result as string);
        setImageUrl(compressed);
        setIsImageInputOpen(false);
      } catch (err) {
        console.error('Erro ao comprimir imagem:', err);
        alert('Não foi possível processar a imagem selecionada.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Colar imagem via clipboard (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const compressed = await compressImage(reader.result as string);
              setImageUrl(compressed);
              showToast('Imagem colada com sucesso!');
            } catch (err) {
              console.error('Erro ao processar imagem colada:', err);
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  };

  // Inserção de formatação rápida no editor
  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = `${prefix}${selected || 'texto'}${suffix}`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 5)
      );
    }, 50);
  };

  // Adicionar alternativa na questão
  const handleAddOption = () => {
    if (questionOptions.length >= 6) {
      alert('Máximo de 6 alternativas por questão.');
      return;
    }
    setQuestionOptions([...questionOptions, '']);
  };

  // Remover alternativa
  const handleRemoveOption = (index: number) => {
    if (questionOptions.length <= 2) {
      alert('A questão deve ter pelo menos 2 alternativas.');
      return;
    }
    const updated = questionOptions.filter((_, i) => i !== index);
    setQuestionOptions(updated);
    if (correctOptionIndex >= updated.length) {
      setCorrectOptionIndex(0);
    }
  };

  // Atualizar texto de alternativa
  const handleOptionTextChange = (index: number, val: string) => {
    const updated = [...questionOptions];
    updated[index] = val;
    setQuestionOptions(updated);
  };

  // Enviar publicação (com proteção contra undefined e fallback automático)
  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && postType !== 'question') {
      alert('Por favor, escreva o conteúdo da sua publicação.');
      return;
    }

    let finalQuestionData: QuestionData | undefined = undefined;

    if (postType === 'question') {
      if (!content.trim()) {
        alert('Por favor, escreva o enunciado da questão.');
        return;
      }
      // Filtra alternativas preenchidas
      const validOptions = questionOptions.map(opt => opt.trim()).filter(opt => opt.length > 0);
      if (validOptions.length < 2) {
        alert('Por favor, preencha pelo menos duas alternativas para a questão.');
        return;
      }
      const safeCorrectIndex = correctOptionIndex < validOptions.length ? correctOptionIndex : 0;

      finalQuestionData = {
        options: validOptions,
        correctIndex: safeCorrectIndex,
        userAnswers: {}
      };

      if (questionSubject.trim()) {
        finalQuestionData.subject = questionSubject.trim();
      }
      if (questionTopic.trim()) {
        finalQuestionData.topic = questionTopic.trim();
      }
      if (questionExplanation.trim()) {
        finalQuestionData.explanation = questionExplanation.trim();
      }
    }

    setIsSubmitting(true);

    // Evita avatar base64 gigantesco
    let safeAvatar = userProfile.avatar || null;
    if (safeAvatar && safeAvatar.startsWith('data:') && safeAvatar.length > 200000) {
      safeAvatar = null;
    }

    const localPostId = `post-local-${Date.now()}`;
    const newPost: FeedPost = {
      id: localPostId,
      type: postType,
      authorId: currentUid,
      authorName: userProfile.name || 'Estudante Concurseiro',
      authorAvatar: safeAvatar,
      authorTargetExam: userProfile.bio || 'Concursos & OAB',
      content: content.trim(),
      likes: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    if (title.trim()) {
      newPost.title = title.trim();
    }

    if (linkUrl.trim()) {
      newPost.linkUrl = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
      if (linkTitle.trim()) {
        newPost.linkTitle = linkTitle.trim();
      }
    }

    if (imageUrl) {
      newPost.imageUrl = imageUrl;
    }

    if (finalQuestionData) {
      newPost.question = finalQuestionData;
    }

    let savedInCloud = false;

    // Tentativa de salvar no Firestore
    if (isFirebaseConfigured()) {
      try {
        const payloadToUpload = sanitizePayload({ ...newPost });
        delete (payloadToUpload as any).id;
        const docRef = await addDoc(collection(db, 'feed_posts'), payloadToUpload);
        newPost.id = docRef.id;
        savedInCloud = true;
      } catch (err: any) {
        console.warn('[Feed] Não foi possível gravar no Firestore (usando salvamento local):', err?.message || err);
      }
    }

    // Salva no estado local removendo qualquer duplicata ou versão provisória
    setPosts(prev => {
      const clean = prev.filter(p => p.id !== newPost.id && p.id !== localPostId);
      return [newPost, ...clean];
    });

    if (savedInCloud) {
      showToast('✨ Publicado e sincronizado com sucesso na nuvem!');
    } else {
      showToast('Publicado com sucesso no feed!');
    }

    // Limpar formulário
    setContent('');
    setTitle('');
    setImageUrl(null);
    setLinkUrl('');
    setLinkTitle('');
    setQuestionSubject('');
    setQuestionTopic('');
    setQuestionOptions(['', '', '', '']);
    setCorrectOptionIndex(0);
    setQuestionExplanation('');
    setPostType('text');
    setActiveTab('list');
    setIsSubmitting(false);
  };

  // Curtir ou descurtir post
  const handleToggleLike = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const alreadyLiked = post.likes.includes(currentUid);
    const updatedLikes = alreadyLiked 
      ? post.likes.filter(uid => uid !== currentUid)
      : [...post.likes, currentUid];

    // Atualização otimista
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: updatedLikes } : p));

    if (isFirebaseConfigured() && post.id && !post.id.startsWith('post-local-') && !post.id.startsWith('demo-')) {
      try {
        await updateDoc(doc(db, 'feed_posts', post.id), {
          likes: updatedLikes
        });
      } catch (err) {
        console.warn('[Feed] Erro ao sincronizar curtida:', err);
      }
    }
  };

  // Responder questão no feed
  const handleAnswerQuestion = async (postId: string, optionIndex: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post || !post.question) return;

    if (post.question.userAnswers?.[currentUid] !== undefined) {
      return;
    }

    const updatedUserAnswers = {
      ...(post.question.userAnswers || {}),
      [currentUid]: optionIndex
    };

    const updatedQuestion = {
      ...post.question,
      userAnswers: updatedUserAnswers
    };

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, question: updatedQuestion } : p));

    const isCorrect = optionIndex === post.question.correctIndex;
    showToast(isCorrect ? '🎉 Resposta correta! Você acertou o gabarito!' : '❌ Resposta incorreta. Confira o comentário do autor.');

    if (isFirebaseConfigured() && post.id && !post.id.startsWith('post-local-') && !post.id.startsWith('demo-')) {
      try {
        await updateDoc(doc(db, 'feed_posts', post.id), {
          'question.userAnswers': updatedUserAnswers
        });
      } catch (err) {
        console.warn('[Feed] Erro ao registrar voto da questão na nuvem:', err);
      }
    }
  };

  // Salvar questão do feed como Flashcard
  const handleSaveAsFlashcard = (post: FeedPost) => {
    if (!post.question) return;

    const optLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const front = `**[${post.question.subject || 'Comunidade'}] ${post.title || 'Questão'}**\n\n${post.content}\n\n` +
      post.question.options.map((opt, i) => `${optLetters[i]}) ${opt}`).join('\n');

    const back = `**Gabarito Correto: Letra ${optLetters[post.question.correctIndex]}**\n\n${post.question.options[post.question.correctIndex]}\n\n` +
      (post.question.explanation ? `**Comentário do Autor:**\n${post.question.explanation}` : '');

    addFlashcard({
      topicId: 'feed-shared',
      front,
      back,
      subjectLabel: post.question.subject || 'Questões da Comunidade',
      topicLabel: post.question.topic || 'Feed'
    });

    showToast('✨ Questão salva no seu Banco de Flashcards com sucesso!');
  };

  // Adicionar comentário
  const handleAddComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const newComment: PostComment = {
      id: `comment-${Date.now()}`,
      authorId: currentUid,
      authorName: userProfile.name || 'Estudante Concurseiro',
      authorAvatar: userProfile.avatar || null,
      content: text,
      createdAt: new Date().toISOString()
    };

    const updatedComments = [...(post.comments || []), newComment];

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: updatedComments } : p));
    setCommentText(prev => ({ ...prev, [postId]: '' }));

    if (isFirebaseConfigured() && post.id && !post.id.startsWith('post-local-') && !post.id.startsWith('demo-')) {
      try {
        await updateDoc(doc(db, 'feed_posts', post.id), {
          comments: updatedComments
        });
      } catch (err) {
        console.warn('[Feed] Erro ao salvar comentário na nuvem:', err);
      }
    }
  };

  // Apagar post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Tem certeza de que deseja remover esta publicação do feed?')) return;

    setPosts(prev => prev.filter(p => p.id !== postId));
    showToast('Publicação removida com sucesso.');

    if (isFirebaseConfigured() && !postId.startsWith('post-local-') && !postId.startsWith('demo-')) {
      try {
        await deleteDoc(doc(db, 'feed_posts', postId));
      } catch (err) {
        console.warn('[Feed] Erro ao deletar post do Firestore:', err);
      }
    }
  };

  // Copiar conteúdo do post para a área de transferência
  const handleCopyPost = (post: FeedPost) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let textToCopy = '';

    if (post.title) {
      textToCopy += `📌 ${post.title}\n\n`;
    }

    if (post.type === 'question' && post.question) {
      if (post.question.subject) {
        textToCopy += `[${post.question.subject}${post.question.topic ? ` • ${post.question.topic}` : ''}]\n\n`;
      }
      textToCopy += `${post.content}\n\n`;
      post.question.options.forEach((opt, idx) => {
        textToCopy += `${letters[idx]}) ${opt}\n`;
      });
      if (post.question.explanation) {
        textToCopy += `\n💡 Gabarito: Letra ${letters[post.question.correctIndex]}\n${post.question.explanation}\n`;
      }
    } else {
      textToCopy += `${post.content}\n`;
      if (post.linkUrl) {
        textToCopy += `\n🔗 ${post.linkTitle ? post.linkTitle + ': ' : ''}${post.linkUrl}\n`;
      }
    }

    navigator.clipboard.writeText(textToCopy.trim());
    setCopiedPostId(post.id);
    showToast('📋 Copiado para a área de transferência!');
    setTimeout(() => {
      setCopiedPostId(prev => (prev === post.id ? null : prev));
    }, 3000);
  };

  // Renderizador simplificado de Markdown
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');

    return (
      <div className="space-y-2 text-zinc-200 text-sm sm:text-base leading-relaxed break-words">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-base sm:text-lg font-bold text-white mt-3 mb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-lg sm:text-xl font-bold text-emerald-400 mt-3 mb-1">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }

          if (trimmed.startsWith('> ')) {
            return (
              <div key={idx} className="border-l-4 border-emerald-500/80 bg-emerald-500/5 px-3 py-2 rounded-r-lg my-2 text-zinc-300 italic text-sm">
                {trimmed.replace('> ', '')}
              </div>
            );
          }

          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 text-zinc-300 pl-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span>{renderInlineStyles(trimmed.replace(/^[-*]\s+/, ''))}</span>
              </div>
            );
          }

          if (!trimmed) {
            return <div key={idx} className="h-2" />;
          }

          return <p key={idx}>{renderInlineStyles(line)}</p>;
        })}
      </div>
    );
  };

  // Estilização inline simples (**negrito**, *itálico*, `código`, links)
  const renderInlineStyles = (contentStr: string) => {
    const parts = contentStr.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-zinc-300">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a
            key={index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-0.5"
          >
            {linkMatch[1]}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }
      return part;
    });
  };

  // Formatação de data amigável
  const formatTimeAgo = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const diffMs = Date.now() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'Agora mesmo';
      if (diffMinutes < 60) return `há ${diffMinutes} min`;
      if (diffHours < 24) return `há ${diffHours}h`;
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return `há ${diffDays} dias`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return 'Recentemente';
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Filtragem e deduplicação dos posts para evitar duplicatas visuais
  const filteredPosts = posts.filter(post => {
    if (filterType === 'mine') {
      if (post.authorId !== currentUid) return false;
    } else if (filterType === 'image') {
      if (!post.imageUrl) return false;
    } else if (filterType !== 'all') {
      if (post.type !== filterType) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = post.title?.toLowerCase().includes(q);
      const matchContent = post.content.toLowerCase().includes(q);
      const matchAuthor = post.authorName.toLowerCase().includes(q);
      const matchSubject = post.question?.subject?.toLowerCase().includes(q);
      return matchTitle || matchContent || matchAuthor || matchSubject;
    }

    return true;
  });

  // Garante que cada post apareça estritamente uma única vez na tela
  const uniquePosts = React.useMemo(() => {
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();

    return filteredPosts.filter(post => {
      if (!post.id || seenIds.has(post.id)) return false;
      seenIds.add(post.id);

      const sig = `${post.authorId}_${post.content.trim().slice(0, 60)}`;
      if (seenSignatures.has(sig)) return false;
      seenSignatures.add(sig);

      return true;
    });
  }, [filteredPosts]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast de notificação rápida */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-zinc-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce border border-emerald-300">
          <Sparkles className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal Lightbox para visualização de imagem em tamanho real */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-3 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full transition-all"
            title="Fechar imagem"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Visualização ampliada" 
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Header do Feed */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900/60 p-6 sm:p-8 rounded-3xl border border-zinc-800 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Feed da Comunidade
                  </h1>
                  {isCloudAvailable ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CloudCheck className="w-3 h-3" /> Nuvem Ativa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                      <HardDrive className="w-3 h-3" /> Armazenamento Local
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Compartilhe questões com gabarito, resumos, links, esquemas e imagens de estudo
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'compose' ? 'list' : 'compose')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer",
                activeTab === 'compose'
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20 hover:scale-[1.02]"
              )}
            >
              {activeTab === 'compose' ? (
                <>
                  <Eye className="w-4 h-4" />
                  Ver Feed
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Criar Publicação
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Seção do Compositor de Postagem */}
      {activeTab === 'compose' && (
        <form 
          onSubmit={handleSubmitPost}
          onPaste={handlePaste}
          className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Nova Publicação
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
              title="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Seleção do Tipo de Post */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Tipo de Conteúdo:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'text', label: 'Texto & Resumo', icon: BookOpen },
                { type: 'question', label: 'Questão Interativa', icon: HelpCircle },
                { type: 'tip', label: 'Dica & Mnemônico', icon: Sparkles },
                { type: 'link', label: 'Link & Material', icon: LinkIcon }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = postType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setPostType(item.type as PostType)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isSelected ? "text-emerald-400" : "text-zinc-500")} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título opcional */}
          <div>
            <input
              type="text"
              placeholder={postType === 'question' ? "Título / Assunto da Questão (ex: FGV - Direito Administrativo)" : "Título ou Assunto (Opcional)"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Campos específicos para QUESTÃO */}
          {postType === 'question' && (
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <HelpCircle className="w-4 h-4" />
                Configurar Questão com Gabarito
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Disciplina (ex: Direito Constitucional)"
                  value={questionSubject}
                  onChange={(e) => setQuestionSubject(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Tópico (ex: Direitos Fundamentais - Art. 5º)"
                  value={questionTopic}
                  onChange={(e) => setQuestionTopic(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Alternativas */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Alternativas (Marque o botão na alternativa correta):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Alternativa
                  </button>
                </div>

                {questionOptions.map((opt, idx) => {
                  const isCorrect = correctOptionIndex === idx;
                  return (
                    <div 
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border transition-all",
                        isCorrect ? "bg-emerald-500/10 border-emerald-500/50" : "bg-zinc-900 border-zinc-800"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectOptionIndex(idx)}
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-all cursor-pointer",
                          isCorrect 
                            ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20" 
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        )}
                        title={isCorrect ? "Alternativa Correta (Gabarito)" : "Clique para marcar como correta"}
                      >
                        {optionLetters[idx]}
                      </button>

                      <input
                        type="text"
                        placeholder={`Texto da alternativa ${optionLetters[idx]}...`}
                        value={opt}
                        onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                        className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                      />

                      {isCorrect && (
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Gabarito
                        </span>
                      )}

                      {questionOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remover alternativa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Justificativa / Comentário do Gabarito */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Comentário / Justificativa do Gabarito (Opcional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Explique o fundamento da resposta correta (ex: súmula, artigo de lei, jurisprudência)..."
                  value={questionExplanation}
                  onChange={(e) => setQuestionExplanation(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Campos específicos para LINK */}
          {(postType === 'link' || linkUrl) && (
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <LinkIcon className="w-4 h-4" />
                Anexar Link Externo
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="https://exemplo.com/material-ou-edital"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Título do Link (ex: Edital Verticalizado em PDF)"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Editor Básico de Texto com Toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {postType === 'question' ? 'Enunciado da Questão:' : 'Texto da Publicação:'}
              </label>

              {/* Abas Escrever vs Prévia */}
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setEditorMode('write')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    editorMode === 'write' ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Escrever
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    editorMode === 'preview' ? "bg-zinc-800 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Pré-visualizar
                </button>
              </div>
            </div>

            {/* Barra de Ferramentas do Editor */}
            {editorMode === 'write' && (
              <div className="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-950 border border-zinc-800 rounded-t-xl text-zinc-400">
                <button
                  type="button"
                  onClick={() => insertFormatting('**', '**')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Negrito (**texto**)"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Itálico (*texto*)"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('### ')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Título (### Título)"
                >
                  <Heading3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('- ')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Lista com marcadores (- item)"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('> ')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Citação / Destaque (> citação)"
                >
                  <Quote className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('`', '`')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Código / Monospace (`termo`)"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('[Nome do Link](', ')')}
                  className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-all cursor-pointer"
                  title="Inserir link no texto [texto](url)"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-zinc-800 mx-1" />

                <span className="text-[11px] text-zinc-500 ml-auto hidden sm:inline">
                  Dica: Você também pode colar imagens diretamente (Ctrl+V)
                </span>
              </div>
            )}

            {editorMode === 'write' ? (
              <textarea
                ref={textareaRef}
                rows={postType === 'question' ? 4 : 5}
                placeholder={
                  postType === 'question'
                    ? "Escreva aqui o enunciado da sua questão (você pode formatar com negrito, itálico, listas)..."
                    : "Compartilhe uma dica, resumo esquematizado, dúvida ou informação com a comunidade..."
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-b-xl p-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all resize-y"
              />
            ) : (
              <div className="min-h-[120px] bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                {content.trim() ? (
                  renderFormattedText(content)
                ) : (
                  <p className="text-zinc-600 text-sm italic">Nenhum texto para pré-visualizar ainda.</p>
                )}
              </div>
            )}
          </div>

          {/* Área de Imagem Anexada */}
          {imageUrl && (
            <div className="relative inline-block border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950 group">
              <img 
                src={imageUrl} 
                alt="Imagem anexada" 
                className="max-h-60 max-w-full rounded-2xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => setLightboxImage(imageUrl)}
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-all cursor-pointer"
                title="Remover imagem"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[11px] text-zinc-300 px-2 py-0.5 rounded-md">
                Clique para ampliar
              </div>
            </div>
          )}

          {/* Menu de Inserir Imagem (URL ou Arquivo) */}
          {isImageInputOpen && !imageUrl && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  Compartilhar Imagem (Esquema, Mapa Mental ou Foto)
                </span>
                <button 
                  type="button"
                  onClick={() => setIsImageInputOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opção 1: Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-4 border border-dashed border-zinc-700 hover:border-emerald-500/60 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 transition-all cursor-pointer"
                >
                  <ImageIcon className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs font-semibold">Escolher do Computador/Celular</span>
                  <span className="text-[10px] text-zinc-500">PNG, JPG, WEBP (Comprimido automaticamente)</span>
                </button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />

                {/* Opção 2: Link de Imagem */}
                <div className="flex flex-col justify-between p-3 border border-zinc-800 rounded-xl bg-zinc-900/50 space-y-2">
                  <span className="text-xs text-zinc-400">Ou cole o link direto de uma imagem da web:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://exemplo.com/imagem.png"
                      value={imageExternalUrl}
                      onChange={(e) => setImageExternalUrl(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (imageExternalUrl.trim()) {
                          setImageUrl(imageExternalUrl.trim());
                          setIsImageInputOpen(false);
                          setImageExternalUrl('');
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 rounded-lg cursor-pointer"
                    >
                      Usar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé do Formulário de Envio */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImageInputOpen(!isImageInputOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                  imageUrl 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                )}
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                {imageUrl ? "Imagem Anexada ✓" : "Anexar Imagem"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (postType !== 'link') {
                    setLinkUrl(linkUrl ? '' : 'https://');
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                  linkUrl 
                    ? "bg-blue-500/10 border-blue-500 text-blue-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                )}
              >
                <LinkIcon className="w-4 h-4 text-blue-400" />
                {linkUrl ? "Link Adicionado ✓" : "Adicionar Link"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Publicando...' : 'Publicar no Feed'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por termo, matéria ou autor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-zinc-500 font-medium">
            Mostrando {uniquePosts.length} {uniquePosts.length === 1 ? 'publicação' : 'publicações'}
          </span>
        </div>

        {/* Pílulas de Filtro */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'Todos os Posts' },
            { id: 'question', label: '❓ Questões' },
            { id: 'tip', label: '💡 Dicas & Resumos' },
            { id: 'link', label: '🔗 Links & Materiais' },
            { id: 'image', label: '🖼️ Com Imagens' },
            { id: 'mine', label: '👤 Meus Posts' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                filterType === tab.id
                  ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-400 shadow-sm"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline de Publicações */}
      <div className="space-y-5">
        {uniquePosts.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-500">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-200">Nenhuma publicação encontrada</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                {searchQuery || filterType !== 'all' 
                  ? 'Tente ajustar os filtros ou a palavra-chave pesquisada.' 
                  : 'Seja o primeiro a compartilhar uma questão, dica ou link com os concurseiros!'}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('compose')}
              className="bg-emerald-500 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Criar Primeira Publicação
            </button>
          </div>
        ) : (
          uniquePosts.map((post) => {
            const isAuthor = post.authorId === currentUid;
            const isLiked = post.likes.includes(currentUid);
            const userHasAnswered = post.question?.userAnswers?.[currentUid] !== undefined;
            const userAnswerIndex = post.question?.userAnswers?.[currentUid];
            const isQuestion = post.type === 'question' && post.question;
            const totalAnswers = post.question?.userAnswers 
              ? Object.keys(post.question.userAnswers).length 
              : 0;

            return (
              <article
                key={post.id}
                className="bg-zinc-900 border border-zinc-800/90 rounded-3xl p-5 sm:p-7 shadow-lg space-y-4 hover:border-zinc-700/80 transition-all relative overflow-hidden"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center shrink-0">
                      {post.authorAvatar ? (
                        <img 
                          src={post.authorAvatar} 
                          alt={post.authorName} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-bold text-sm text-emerald-400">
                          {post.authorName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-zinc-100">{post.authorName}</span>
                        {isAuthor && (
                          <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                            Você
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-500">• {formatTimeAgo(post.createdAt)}</span>
                      </div>

                      {post.authorTargetExam && (
                        <p className="text-[11px] text-zinc-500 font-medium truncate max-w-xs sm:max-w-md">
                          Foco: {post.authorTargetExam}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badge do tipo de post */}
                  <div className="flex items-center gap-2">
                    {post.type === 'question' && (
                      <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" /> Questão
                      </span>
                    )}
                    {post.type === 'tip' && (
                      <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Dica
                      </span>
                    )}
                    {post.type === 'link' && (
                      <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <LinkIcon className="w-3.5 h-3.5" /> Material
                      </span>
                    )}

                    {isAuthor && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title="Remover publicação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Título do Post (se houver) */}
                {post.title && (
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {post.title}
                  </h3>
                )}

                {/* Conteúdo / Enunciado Formatado */}
                <div className="text-zinc-200">
                  {renderFormattedText(post.content)}
                </div>

                {/* Exibição da Imagem (se houver) */}
                {post.imageUrl && (
                  <div className="mt-3 relative group">
                    <img
                      src={post.imageUrl}
                      alt="Imagem da publicação"
                      className="max-h-96 w-auto max-w-full rounded-2xl object-cover border border-zinc-800 shadow-md cursor-pointer hover:border-emerald-500/50 transition-all"
                      onClick={() => setLightboxImage(post.imageUrl!)}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-[10px] text-zinc-300 px-2 py-0.5 rounded-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      🔍 Clique para tela cheia
                    </div>
                  </div>
                )}

                {/* Exibição do Link (se houver) */}
                {post.linkUrl && (
                  <a
                    href={post.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 rounded-2xl p-4 transition-all group mt-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-zinc-200 truncate group-hover:text-blue-400 transition-colors">
                            {post.linkTitle || post.linkUrl}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {post.linkUrl}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-blue-400 shrink-0 hidden sm:inline">
                        Acessar Link →
                      </span>
                    </div>
                  </a>
                )}

                {/* Seção Interativa da Questão (com gabarito e porcentagens) */}
                {isQuestion && post.question && (
                  <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 mt-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        {post.question.subject && (
                          <span className="font-semibold text-emerald-400">
                            {post.question.subject}
                          </span>
                        )}
                        {post.question.topic && (
                          <span>• {post.question.topic}</span>
                        )}
                      </div>
                      <span>
                        {totalAnswers} {totalAnswers === 1 ? 'resposta' : 'respostas da comunidade'}
                      </span>
                    </div>

                    {/* Alternativas */}
                    <div className="space-y-2">
                      {post.question.options.map((optionText, optIndex) => {
                        const isCorrectAnswer = optIndex === post.question!.correctIndex;
                        const isUserChoice = userAnswerIndex === optIndex;
                        const canShowAnswer = userHasAnswered || isAuthor;

                        let optionVoteCount = 0;
                        if (post.question!.userAnswers) {
                          optionVoteCount = Object.values(post.question!.userAnswers).filter(ans => ans === optIndex).length;
                        }
                        const percentage = totalAnswers > 0 ? Math.round((optionVoteCount / totalAnswers) * 100) : 0;

                        return (
                          <div key={optIndex} className="relative">
                            <button
                              type="button"
                              onClick={() => handleAnswerQuestion(post.id, optIndex)}
                              disabled={canShowAnswer}
                              className={cn(
                                "w-full text-left p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all relative z-10 flex items-start gap-3",
                                !canShowAnswer && "hover:border-emerald-500/60 hover:bg-zinc-900 bg-zinc-900/60 border-zinc-800 text-zinc-200 cursor-pointer",
                                canShowAnswer && isCorrectAnswer && "bg-emerald-500/15 border-emerald-500/80 text-emerald-200 shadow-sm",
                                canShowAnswer && isUserChoice && !isCorrectAnswer && "bg-rose-500/15 border-rose-500/80 text-rose-200",
                                canShowAnswer && !isCorrectAnswer && !isUserChoice && "bg-zinc-900/40 border-zinc-800/60 text-zinc-400 opacity-80"
                              )}
                            >
                              <span className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                                canShowAnswer && isCorrectAnswer 
                                  ? "bg-emerald-500 text-zinc-950" 
                                  : canShowAnswer && isUserChoice && !isCorrectAnswer
                                  ? "bg-rose-500 text-white"
                                  : "bg-zinc-800 text-zinc-400"
                              )}>
                                {optionLetters[optIndex]}
                              </span>

                              <span className="flex-1 leading-snug">{optionText}</span>

                              {canShowAnswer && (
                                <div className="flex items-center gap-2 shrink-0">
                                  {isCorrectAnswer && (
                                    <span className="text-emerald-400 flex items-center gap-1 font-bold text-xs">
                                      <CheckCircle2 className="w-4 h-4" /> Gabarito
                                    </span>
                                  )}
                                  {isUserChoice && !isCorrectAnswer && (
                                    <span className="text-rose-400 flex items-center gap-1 font-bold text-xs">
                                      <XCircle className="w-4 h-4" /> Sua Escolha
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-zinc-400">
                                    {percentage}%
                                  </span>
                                </div>
                              )}
                            </button>

                            {canShowAnswer && (
                              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                                <div 
                                  className={cn(
                                    "h-full opacity-10 transition-all duration-500",
                                    isCorrectAnswer ? "bg-emerald-500" : "bg-zinc-400"
                                  )}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explicação do Gabarito revelada após responder */}
                    {(userHasAnswered || isAuthor) && (
                      <div className="space-y-3 pt-2">
                        {post.question.explanation && (
                          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-200">
                            <span className="font-bold flex items-center gap-1 mb-1 text-emerald-300">
                              <Sparkles className="w-3.5 h-3.5" /> Comentário do Autor:
                            </span>
                            <p className="leading-relaxed whitespace-pre-line">{post.question.explanation}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-zinc-500">
                            {userAnswerIndex === post.question.correctIndex ? '✅ Você acertou!' : '💡 Revise para fixar o conteúdo.'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSaveAsFlashcard(post)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                            Salvar como Flashcard
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rodapé de Interações (Curtir, Comentários, Copiar) */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs text-zinc-400">
                  <div className="flex items-center gap-4">
                    {/* Botão de Curtir */}
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={cn(
                        "flex items-center gap-1.5 font-bold transition-all p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer",
                        isLiked ? "text-rose-400" : "text-zinc-400 hover:text-rose-400"
                      )}
                    >
                      <Heart className={cn("w-4 h-4 transition-transform", isLiked ? "fill-rose-500 text-rose-500 scale-110" : "")} />
                      <span>{post.likes.length}</span>
                    </button>

                    {/* Botão de Comentários */}
                    <button
                      onClick={() => setExpandedCommentPostId(expandedCommentPostId === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 font-semibold text-zinc-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments?.length || 0} comentários</span>
                    </button>
                  </div>

                  {/* Botão Copiar */}
                  <button
                    onClick={() => handleCopyPost(post)}
                    className={cn(
                      "flex items-center gap-1.5 transition-all p-1.5 px-2.5 rounded-lg hover:bg-zinc-800 cursor-pointer font-medium",
                      copiedPostId === post.id 
                        ? "text-emerald-400 font-bold bg-emerald-500/10" 
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                    title="Copiar texto ou questão da publicação"
                  >
                    {copiedPostId === post.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Área de Comentários Expandida */}
                {expandedCommentPostId === post.id && (
                  <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4 space-y-3.5 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Comentários & Discussão ({post.comments?.length || 0})
                    </h4>

                    {/* Lista de Comentários */}
                    <div className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
                      {(!post.comments || post.comments.length === 0) ? (
                        <p className="text-xs text-zinc-500 italic py-1">Nenhum comentário ainda. Comece a discussão!</p>
                      ) : (
                        post.comments.map((comm) => (
                          <div key={comm.id} className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-200">{comm.authorName}</span>
                              <span className="text-[10px] text-zinc-500">{formatTimeAgo(comm.createdAt)}</span>
                            </div>
                            <p className="text-zinc-300 leading-relaxed">{comm.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input de Novo Comentário */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Deixe uma dúvida, dica ou comentário..."
                        value={commentText[post.id] || ''}
                        onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(post.id);
                          }
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        disabled={!commentText[post.id]?.trim()}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 p-2 rounded-xl transition-all cursor-pointer"
                        title="Enviar comentário"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
