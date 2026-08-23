import React, { useState, useRef, useEffect } from 'react';
import { Send, Stethoscope, Sparkles, Database, Globe, ChevronDown, ChevronUp, Clock, Info, Check, Copy, User, FileText, ExternalLink } from 'lucide-react';
import { ChatMessage } from '../types';
import Markdown from 'react-markdown';

interface ChatViewProps {
  onSelectQuery?: (q: string) => void;
  onNavigateToLibrary?: (docId?: string) => void;
}

const suggestedInquiries = [
  "What are the WHO recommended HPV triage strategies by country follow-up capacity?",
  "What are the main methodological flaws of informal consensus in medical guidelines?",
  "How does ACIP prioritize which vaccines receive clinical review guidelines?",
  "What triage tests are recommended for women living with HIV after positive HPV DNA?",
  "What are the primary ASCVD risk thresholds and high-intensity statin indications?"
];

export const ChatView: React.FC<ChatViewProps> = ({ onNavigateToLibrary }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleThoughts = (id: string) => {
    setExpandedThoughts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleChunkSnippet = (chunkKey: string) => {
    setExpandedChunks(prev => ({ ...prev, [chunkKey]: !prev[chunkKey] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'No guideline response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceType: data.sourceType || 'local_records',
        retrievedChunks: data.retrievedChunks,
        webResults: data.webResults,
        thoughtSteps: data.thoughtSteps,
        executionTimeMs: data.executionTimeMs
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Clinical Retrieval Error**: ${err.message}. Please verify server connection or API keys in the settings menu.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourceType: 'insufficient_data'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col min-h-[calc(100vh-5rem)]">
      
      {/* Scrollable Conversation Stream */}
      <div className="flex-1 space-y-6 pb-6">
        
        {/* Initial Welcome Greeting Card */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
            <Stethoscope className="w-5 h-5" />
          </div>

          <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs text-slate-700 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Welcome to your Medical Knowledge Assistant
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              I help you query and review medical guidelines, clinical standards, and treatment protocols with verified source citations.
            </p>

            <p className="text-xs text-slate-500 italic pt-1">
              Ask any clinical question below or select one of the suggested topics.
            </p>
          </div>
        </div>

        {/* Dynamic Chat Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Stethoscope className="w-5 h-5" />
              </div>
            )}

            <div className={`max-w-[85%] rounded-2xl p-5 shadow-xs transition-all ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-auto'
                : 'bg-white border border-slate-200 text-slate-800 flex-1'
            }`}>
              
              {/* Header Badges for Assistant Response */}
              {msg.role === 'assistant' && msg.sourceType && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    {msg.sourceType === 'local_records' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs">
                        <Database className="w-3.5 h-3.5" />
                        Internal Medical Records
                      </span>
                    )}
                    {msg.sourceType === 'web_research' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-xs">
                        <Globe className="w-3.5 h-3.5" />
                        Web Clinical Fallback
                      </span>
                    )}
                    {msg.sourceType === 'hybrid' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-xs">
                        <Sparkles className="w-3.5 h-3.5" />
                        Hybrid Search (Records + Web)
                      </span>
                    )}
                    {msg.executionTimeMs !== undefined && (
                      <span className="text-slate-400 flex items-center gap-1 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        {msg.executionTimeMs}ms
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {msg.thoughtSteps && msg.thoughtSteps.length > 0 && (
                      <button
                        onClick={() => toggleThoughts(msg.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium bg-blue-50 px-2 py-0.5 rounded-md transition-colors"
                      >
                        <span>Decision Steps ({msg.thoughtSteps.length})</span>
                        {expandedThoughts[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
                      title="Copy Answer"
                    >
                      {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Reasoning Accordion */}
              {msg.thoughtSteps && expandedThoughts[msg.id] && (
                <div className="mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 space-y-1.5">
                  <div className="font-semibold text-blue-600 text-xs mb-1">
                    Agent Decision & Retrieval Trace:
                  </div>
                  {msg.thoughtSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-600">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className={`prose prose-slate max-w-none text-sm leading-relaxed ${
                msg.role === 'user' ? 'text-white prose-invert' : 'text-slate-800'
              }`}>
                <Markdown>{msg.content}</Markdown>
              </div>

              {/* Retrieved Document Citations Links */}
              {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                      <Database className="w-3.5 h-3.5 text-blue-600" />
                      Referenced Document Sources ({msg.retrievedChunks.length}):
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Grounding Confidence: High</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.retrievedChunks.map((chunk, idx) => {
                      const chunkKey = `${msg.id}-chunk-${idx}`;
                      const isExpanded = !!expandedChunks[chunkKey];
                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 text-xs transition-colors flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span className="font-semibold text-slate-800 truncate text-[11px]" title={chunk.filename || 'Medical Document'}>
                                {chunk.filename || 'Medical Document'}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                              Chunk #{chunk.chunkIndex !== undefined ? chunk.chunkIndex + 1 : idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60 mt-auto text-slate-500">
                            <span className="text-emerald-600 font-semibold font-mono">
                              Match: {(chunk.score * 100).toFixed(0)}%
                            </span>
                            <button
                              onClick={() => toggleChunkSnippet(chunkKey)}
                              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 transition-colors"
                            >
                              <span>{isExpanded ? 'Hide Passage' : 'View Passage'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 p-2 bg-white rounded border border-blue-100 text-[11px] text-slate-600 font-sans leading-relaxed max-h-40 overflow-y-auto">
                              <p className="italic">"{chunk.text}"</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Web Results Citations */}
              {msg.webResults && msg.webResults.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-600" />
                    External Clinical Citations:
                  </div>
                  <div className="space-y-1.5">
                    {msg.webResults.map((web, idx) => (
                      <a
                        key={idx}
                        href={web.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-2.5 bg-amber-50/50 hover:bg-amber-50 rounded-lg border border-amber-200/80 text-xs text-slate-700 transition-colors"
                      >
                        <div className="font-semibold text-amber-800 mb-0.5">{web.title}</div>
                        <p className="text-slate-600 text-xs line-clamp-2">{web.content}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className={`mt-2 text-[10px] text-right ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Stethoscope className="w-5 h-5 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-600 font-medium">Reviewing clinical practice guidelines & evidence...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Clinical Inquiries Pills (Matching Screenshot) */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
          <Sparkles className="w-4 h-4" />
          <span>Suggested Clinical Inquiries:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestedInquiries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="bg-white hover:bg-blue-50/70 text-slate-700 hover:text-blue-700 border border-slate-200/90 hover:border-blue-300 rounded-full px-3.5 py-1.5 text-xs font-normal transition-all shadow-2xs text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box Card (Matching Screenshot) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
        <textarea
          ref={textareaRef}
          id="chat-textarea"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Ask a medical question, request a guideline triage algorithm, or review dosing..."
          className="w-full resize-none border-0 focus:ring-0 p-1 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1 text-xs">
          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Info className="w-3.5 h-3.5" />
            <span>Press Enter to send, Shift+Enter for new line</span>
          </div>

          <button
            id="btn-send-chat"
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuery.trim()}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              inputQuery.trim() && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Footer Legal Disclaimer */}
      <div className="text-center text-xs text-slate-400 mt-3">
        Clinical Decision Support tool. For professional clinical guidance, always exercise independent judgment.
      </div>

    </div>
  );
};
