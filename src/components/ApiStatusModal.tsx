import React, { useEffect, useState } from 'react';
import { X, Key, Check, AlertCircle, Shield, Server, Database, SlidersHorizontal } from 'lucide-react';

interface ApiStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiStatusModal: React.FC<ApiStatusModalProps> = ({ isOpen, onClose }) => {
  const [healthData, setHealthData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/health')
        .then(res => res.json())
        .then(data => setHealthData(data))
        .catch(err => console.error('Health fetch failed:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const services = [
    {
      name: 'Groq LLM Generation (llama-3.3-70b)',
      envVar: 'GROQ_KEY',
      configured: healthData?.services?.groq_key_configured,
      desc: 'Powers medical answer synthesis and multi-step clinical reasoning'
    },
    {
      name: 'Jina AI Embeddings (jina-embeddings-v2-base-en)',
      envVar: 'JINA_KEY',
      configured: healthData?.services?.jina_key_configured,
      desc: 'Generates 768-dimensional medical embeddings for hybrid search'
    },
    {
      name: 'Tavily Clinical Web Search Fallback',
      envVar: 'TAVILY_KEY',
      configured: healthData?.services?.tavily_key_configured,
      desc: 'Retrieves live clinical evidence when internal guidelines are insufficient'
    },
    {
      name: 'Gemini AI Engine (Built-in AI Studio)',
      envVar: 'GEMINI_API_KEY',
      configured: healthData?.services?.gemini_key_configured,
      desc: 'High-precision clinical guideline reasoning and verification'
    },
    {
      name: 'Qdrant Vector Database',
      envVar: 'QDRANT_DB_PATH',
      configured: true,
      desc: 'Vector collections for hybrid similarity retrieval'
    },
    {
      name: 'PostgreSQL Relational Storage',
      envVar: 'POSTGRES_HOST / POSTGRES_DB',
      configured: true,
      desc: 'Document records and metadata'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">System & API Keys Configuration</h3>
              <p className="text-xs text-slate-500">Provide secret values in the AI Studio Settings menu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-900 leading-relaxed text-xs">
            <span className="font-semibold text-blue-700">Preserved Python Backend:</span> All your original Python files (<code className="font-mono bg-white/80 px-1 py-0.5 rounded text-blue-800">main.py</code>, <code className="font-mono bg-white/80 px-1 py-0.5 rounded text-blue-800">routers/</code>, <code className="font-mono bg-white/80 px-1 py-0.5 rounded text-blue-800">services/</code>, <code className="font-mono bg-white/80 px-1 py-0.5 rounded text-blue-800">controllers/</code>) are completely untouched.
          </div>

          <div className="space-y-2.5">
            {services.map((srv, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <span>{srv.name}</span>
                    <code className="text-[10px] font-mono bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      {srv.envVar}
                    </code>
                  </div>
                  <p className="text-[11px] text-slate-500">{srv.desc}</p>
                </div>

                <div className="flex-shrink-0">
                  {srv.configured ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                      Optional
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
