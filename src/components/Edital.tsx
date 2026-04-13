import React, { useState, useRef } from 'react';
import { useStore, TopicStatus, EditalInfo } from '@/store';
import { Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, BookOpen, FileText, RefreshCw, Upload, Loader2, Trash2, AlertTriangle, Edit2, Save, X, Info, ExternalLink, CalendarDays, CalendarClock, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ciclo } from './Ciclo';
import { Cronograma } from './Cronograma';

export function Edital({ onViewChange }: { onViewChange: (view: any) => void }) {
  const { subjects, topics, addSubject, addTopic, updateTopicStatus, importEdital, deleteSubject, deleteAllSubjects, editalInfo, updateEditalInfo, setActiveTopicId, activeTopicId, setAutoGenerateTopicId, setAutoGenerateSubjectId } = useStore();
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [genCounts, setGenCounts] = useState<Record<string, number>>({});
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempInfo, setTempInfo] = useState<EditalInfo>(editalInfo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveInfo = () => {
    updateEditalInfo(tempInfo);
    setIsEditingInfo(false);
    showToast('Informações do edital atualizadas!', 'success');
  };

  const handleCancelInfo = () => {
    setTempInfo(editalInfo);
    setIsEditingInfo(false);
  };

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getRandomColor = () => `#${Math.floor(Math.random()*16777215).toString(16)}`;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      showToast('Por favor, envie um arquivo PDF.', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) { // 15MB limit (base64 will be ~20MB)
      showToast('O arquivo é muito grande (máximo 15MB).', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY_V2)?.replace(/['"]/g, '').trim();
          
          if (!apiKey) {
            showToast('API Key do Gemini não configurada.', 'error');
            setIsUploading(false);
            return;
          }
          
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite"
          }, { apiVersion: 'v1' });

          console.log(`Iniciando análise com Gemini 2.0. Arquivo: ${file.name}`);
          
          const prompt = `Você é um especialista em estruturação de editais de concursos (Verticalização de Edital). Analise o PDF em anexo e extraia rigorosamente o "CONTEÚDO PROGRAMÁTICO".

Retorne um objeto JSON seguindo EXATAMENTE este formato:
{
  "disciplinas": [
    {
      "subject": "Nome da Matéria",
      "topics": ["Tópico 1", "Tópico 2"]
    }
  ]
}

REGRAS DE VERTICALIZAÇÃO:
1. Decomponha tópicos compostos (separados por vírgula, ponto ou ponto-e-vírgula) em itens individuais.
2. Remova números de itens e referências burocráticas da banca. 
3. Mantenha apenas o nome direto do assunto.`;

          let response;
          try {
            const result = await model.generateContent([
              {
                inlineData: {
                  data: base64String,
                  mimeType: file.type
                }
              },
              { text: prompt }
            ]);
            response = await result.response;
          } catch (err: any) {
             console.error('Primeira tentativa falhou:', err);
             // Tenta o modelo Pro como fallback em caso de qualquer erro, inclusive 404 ou 429
             console.log('Tentando modelo alternativo (gemini-2.0-flash)...');
             try {
               const fallbackModel = genAI.getGenerativeModel({ 
                 model: "gemini-2.5-flash-lite"
               });
               const result = await fallbackModel.generateContent([
                 { inlineData: { data: base64String, mimeType: file.type } },
                 { text: prompt }
               ]);
               response = await result.response;
             } catch (fallbackErr: any) {
               console.log('Tentativa Pro falhou, tentando gemini-pro legado...');
               try {
                 const legacyModel = genAI.getGenerativeModel({ model: "gemini-pro" });
                 const result = await legacyModel.generateContent([
                   { inlineData: { data: base64String, mimeType: file.type } },
                   { text: prompt }
                 ]);
                 response = await result.response;
               } catch (legacyErr) {
                 console.error('Todas as tentativas falharam:', legacyErr);
                 throw new Error('Falha ao processar PDF com IA. Verifique sua chave API no AI Studio e se o serviço está habilitado.');
               }
             }
          }

          const responseText = response.text();

          if (responseText) {
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);
            
            if (data.disciplinas && Array.isArray(data.disciplinas)) {
              importEdital(data.disciplinas);
              showToast('Edital importado com sucesso!', 'success');
            } else {
              showToast('Não foi possível extrair o conteúdo programático deste PDF.', 'error');
            }
          } else {
            throw new Error('A IA não retornou texto.');
          }
        } catch (err: any) {
          console.error('ERRO SDK:', err);
          showToast(`Erro ao processar PDF: ${err.message || 'Erro desconhecido'}`, 'error');
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      showToast('Erro ao ler o arquivo.', 'error');
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    addSubject({ name: newSubjectName.trim(), color: getRandomColor() });
    setNewSubjectName('');
  };

  const handleBulkAdd = () => {
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').filter(line => line.trim() !== '');
    const subjectsMap: Record<string, string[]> = {};

    lines.forEach(line => {
      const parts = line.split('-').map(p => p.trim());
      if (parts.length >= 2) {
        const subject = parts[0];
        const topic = parts.slice(1).join('-').trim();
        
        if (!subjectsMap[subject]) {
          subjectsMap[subject] = [];
        }
        subjectsMap[subject].push(topic);
      }
    });

    const importData = Object.entries(subjectsMap).map(([subject, topics]) => ({
      subject,
      topics
    }));

    if (importData.length > 0) {
      importEdital(importData);
      setBulkText('');
      setIsBulkAddModalOpen(false);
      showToast(`${importData.length} matérias processadas com sucesso!`, 'success');
    } else {
      showToast('Formato inválido. Use: Matéria - Assunto', 'error');
    }
  };

  const handleAddTopic = (e: React.FormEvent, subjectId: string) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    addTopic({ name: newTopicName, subjectId, status: 'NOT_READ' });
    setNewTopicName('');
    setActiveSubjectId(null);
  };

  const statusIcons: Record<TopicStatus, React.ReactNode> = {
    NOT_READ: <Circle className="w-4 h-4 text-zinc-600" />,
    THEORY_DONE: <BookOpen className="w-4 h-4 text-blue-500" />,
    SUMMARY_DONE: <FileText className="w-4 h-4 text-amber-500" />,
    REVIEWED: <RefreshCw className="w-4 h-4 text-emerald-500" />
  };

  const statusLabels: Record<TopicStatus, string> = {
    NOT_READ: 'Não Lido',
    THEORY_DONE: 'Teoria Concluída',
    SUMMARY_DONE: 'Resumo Feito',
    REVIEWED: 'Revisado'
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <p className="text-zinc-400 mt-1">Gerencie as disciplinas e tópicos do seu edital.</p>
        </div>
      </header>

      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-8 sm:right-8 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50",
          toast.type === 'success' ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" : "bg-red-500/20 border border-red-500/30 text-red-400"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-medium text-sm sm:text-base">{toast.text}</span>
        </div>
      )}

      {/* Edital Info Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 sm:p-6 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Info className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">Informações do Concurso</h2>
          </div>
          {!isEditingInfo ? (
            <button 
              onClick={() => { setTempInfo(editalInfo); setIsEditingInfo(true); }}
              className="text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" /> Editar Informações
            </button>
          ) : (
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={handleSaveInfo}
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
              <button 
                onClick={handleCancelInfo}
                className="flex-1 sm:flex-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {isEditingInfo ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[
                { label: 'Carreira', key: 'carreira', placeholder: 'Ex: Policial, Administrativa' },
                { label: 'Cargo', key: 'cargo', placeholder: 'Ex: Analista Judiciário' },
                { label: 'Banca Organizadora', key: 'banca', placeholder: 'Ex: FCC, FGV, Cebraspe' },
                { label: 'Remuneração', key: 'remuneracao', placeholder: 'Ex: R$ 12.000,00' },
                { label: 'Vagas (Reservas?)', key: 'vagas', placeholder: 'Ex: 50 + CR (Negros/PCD)' },
                { label: 'Período da Inscrição', key: 'periodoInscricao', placeholder: 'Ex: 01/04 a 30/04' },
                { label: 'Valor da Inscrição', key: 'valorInscricao', placeholder: 'Ex: R$ 150,00' },
                { label: 'Data da Prova', key: 'dataProva', placeholder: 'Ex: 15/06/2026' },
                { label: 'Site do Concurso', key: 'siteConcurso', placeholder: 'Ex: vunesp.com.br' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1.5 uppercase tracking-widest">{field.label}</label>
                  <input 
                    type="text"
                    value={tempInfo[field.key as keyof EditalInfo]}
                    onChange={(e) => setTempInfo({ ...tempInfo, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm transition-all"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-6 sm:gap-y-8 gap-x-6 sm:gap-x-12">
              {[
                { label: 'Carreira', value: editalInfo.carreira, icon: '🎯' },
                { label: 'Cargo', value: editalInfo.cargo, icon: '💼' },
                { label: 'Banca', value: editalInfo.banca, icon: '🏛️' },
                { label: 'Remuneração', value: editalInfo.remuneracao, icon: '💰' },
                { label: 'Vagas', value: editalInfo.vagas, icon: '👥' },
                { label: 'Data da Prova', value: editalInfo.dataProva, icon: '📝' },
                { label: 'Inscrição', value: editalInfo.periodoInscricao, icon: '📅' },
                { label: 'Taxa', value: editalInfo.valorInscricao, icon: '🎫' },
              ].map((item, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{item.label}</span>
                  </div>
                  <div className="text-zinc-100 font-semibold text-sm pl-7 group-hover:text-emerald-400 transition-colors">
                    {item.value || <span className="text-zinc-700 italic font-normal text-xs">Não informado</span>}
                  </div>
                </div>
              ))}
              {editalInfo.siteConcurso && (
                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🌐</span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Site Oficial</span>
                  </div>
                  <a 
                    href={editalInfo.siteConcurso.startsWith('http') ? editalInfo.siteConcurso : `https://${editalInfo.siteConcurso}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 font-semibold text-sm pl-7 hover:underline flex items-center gap-1.5 w-fit break-all"
                  >
                    {editalInfo.siteConcurso} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8 sm:space-y-12 py-4">
        <section className="bg-zinc-950/50 rounded-3xl border border-zinc-800/50 p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CalendarDays className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100">Cronograma Semanal</h2>
          </div>
          <Cronograma />
        </section>

        <section className="bg-zinc-950/50 rounded-3xl border border-zinc-800/50 p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <CalendarClock className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100">Ciclo de Hoje</h2>
          </div>
          <Ciclo onViewChange={onViewChange} />
        </section>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100">Matérias do Edital</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {subjects.length > 0 && (
              confirmDelete === 'ALL' ? (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-xs sm:text-sm text-red-400 font-medium">Apagar tudo?</span>
                  <div className="flex gap-2">
                    <button onClick={() => { deleteAllSubjects(); setConfirmDelete(null); }} className="text-xs bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600">Sim</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs bg-zinc-700 text-zinc-200 px-3 py-1 rounded-md hover:bg-zinc-600">Não</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete('ALL')}
                  className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Limpar Tudo</span><span className="sm:hidden">Limpar</span>
                </button>
              )
            )}

            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 sm:flex-none bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="hidden sm:inline">{isUploading ? 'Analisando PDF...' : 'Importar PDF'}</span>
              <span className="sm:hidden">{isUploading ? '...' : 'PDF'}</span>
            </button>

            <button 
              onClick={() => setIsBulkAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> <span>Adicionar Matérias e Tópicos</span>
            </button>
          </div>
        </div>
        {subjects.map(subject => {
          const subjectTopics = topics.filter(t => t.subjectId === subject.id);
          const isExpanded = expandedSubjects[subject.id];
          
          return (
            <div key={subject.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer group/subject"
                onClick={() => toggleSubject(subject.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-zinc-500" /> : <ChevronRight className="w-5 h-5 text-zinc-500" />}
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                  <span className="font-semibold text-zinc-100">{subject.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="number" 
                      min="1" 
                      max="20" 
                      value={genCounts[subject.id] || 3}
                      onChange={(e) => {
                        setGenCounts(prev => ({ ...prev, [subject.id]: parseInt(e.target.value) || 1 }));
                      }}
                      className="w-10 bg-transparent text-center text-xs font-bold text-zinc-100 focus:outline-none"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoGenerateSubjectId(subject.id, genCounts[subject.id] || 3);
                        onViewChange('simulados');
                      }}
                      className="p-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-md transition-all flex items-center gap-1.5"
                      title="Gerar questões desta matéria"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Gerar</span>
                    </button>
                  </div>

                  {confirmDelete === subject.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400 font-medium">Excluir?</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSubject(subject.id); setConfirmDelete(null); }} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Sim</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="text-xs bg-zinc-700 text-zinc-200 px-2 py-1 rounded hover:bg-zinc-600">Não</button>
                    </div>
                  ) : (
                    <div 
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(subject.id); }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                      title="Excluir disciplina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-zinc-800 p-4 bg-zinc-900/50 space-y-2">
                  {subjectTopics.map(topic => (
                    <div key={topic.id} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all group",
                      activeTopicId === topic.id 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : "bg-zinc-800/30 border-zinc-800/50 hover:border-zinc-700"
                    )}>
                      <button 
                        onClick={() => setActiveTopicId(topic.id)}
                        className="flex-1 text-left"
                      >
                        <span className={cn(
                          "text-sm transition-colors",
                          activeTopicId === topic.id ? "text-emerald-400 font-bold" : "text-zinc-300 group-hover:text-zinc-100"
                        )}>
                          {topic.name}
                        </span>
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-0.5">
                          <input 
                            type="number" 
                            min="1" 
                            max="10" 
                            value={genCounts[topic.id] || 3}
                            onChange={(e) => {
                              setGenCounts(prev => ({ ...prev, [topic.id]: parseInt(e.target.value) || 1 }));
                            }}
                            className="w-8 bg-transparent text-center text-[10px] font-bold text-zinc-300 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              setAutoGenerateTopicId(topic.id, genCounts[topic.id] || 3);
                              onViewChange('simulados');
                            }}
                            className="p-1 hover:bg-emerald-500/10 text-emerald-500/60 hover:text-emerald-400 rounded transition-all"
                            title="Gerar questões deste assunto"
                          >
                            <Brain className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <select
                          value={topic.status}
                          onChange={(e) => updateTopicStatus(topic.id, e.target.value as TopicStatus)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none focus:ring-1",
                            topic.status === 'NOT_READ' && "bg-zinc-800 border-zinc-700 text-zinc-400 focus:ring-zinc-500",
                            topic.status === 'THEORY_DONE' && "bg-blue-500/10 border-blue-500/20 text-blue-400 focus:ring-blue-500",
                            topic.status === 'SUMMARY_DONE' && "bg-amber-500/10 border-amber-500/20 text-amber-400 focus:ring-amber-500",
                            topic.status === 'REVIEWED' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 focus:ring-emerald-500"
                          )}
                        >
                          {Object.entries(statusLabels).map(([val, label]) => (
                            <option key={val} value={val} className="bg-zinc-900 text-zinc-300">{label}</option>
                          ))}
                        </select>
                        <div className="w-6 h-6 flex items-center justify-center">
                          {statusIcons[topic.status]}
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeSubjectId === subject.id ? (
                    <form onSubmit={(e) => handleAddTopic(e, subject.id)} className="flex gap-2 mt-4">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nome do tópico..."
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-100 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                      />
                      <button type="submit" className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setActiveSubjectId(null)} className="text-zinc-500 hover:text-zinc-300 px-2">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <button 
                      onClick={() => setActiveSubjectId(subject.id)}
                      className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mt-2 px-2 py-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Tópico
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {subjects.length === 0 && (
          <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
            Nenhuma disciplina cadastrada. Comece adicionando uma acima.
          </div>
        )}
      </div>
      {/* Bulk Add Modal */}
      {isBulkAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Plus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-100">Adicionar em Massa</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cole sua lista abaixo</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBulkAddModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                <p className="text-xs text-emerald-400 font-medium">Instruções:</p>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Cole uma lista onde cada linha segue o formato <span className="text-emerald-300 font-bold">Matéria - Assunto</span>. <br/>
                  O sistema criará as disciplinas e tópicos automaticamente.
                </p>
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Exemplo:\nPortuguês - Crase\nPortuguês - Interpretação de Texto\nDireito Constitucional - Artigo 5º\nInformática - Excel`}
                className="w-full h-64 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm font-mono placeholder:text-zinc-700 custom-scrollbar"
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBulkAdd}
                  disabled={!bulkText.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.98]"
                >
                  Importar Conteúdo
                </button>
                <button
                  onClick={() => setIsBulkAddModalOpen(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-6 py-3 rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
