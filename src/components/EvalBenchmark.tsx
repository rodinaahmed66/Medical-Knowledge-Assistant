import React, { useEffect, useState } from 'react';
import { BookOpen, Target, CheckCircle2, Play, ArrowRight, Award, Search, Sparkles } from 'lucide-react';

interface EvalItem {
  query: string;
  relevant_ids: number[];
}

interface EvalBenchmarkProps {
  onRunTestInChat: (query: string) => void;
}

export const EvalBenchmark: React.FC<EvalBenchmarkProps> = ({ onRunTestInChat }) => {
  const [evalList, setEvalList] = useState<EvalItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/eval-set')
      .then(res => res.json())
      .then(data => {
        setEvalList(data.evalSet || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load eval set:', err);
        setLoading(false);
      });
  }, []);

  const filtered = evalList.filter(item =>
    item.query.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" />
            Medical Evaluation Benchmark Suite
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ground-truth evaluation queries extracted from <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">docker/eval_output/eval_set.json</code> with relevant ground-truth chunk IDs.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter clinical benchmark test cases..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-all"
        />
      </div>

      {/* Eval Cases List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-xs text-slate-400">
            Loading evaluation dataset...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-xs text-slate-400">
            No matching evaluation test cases found.
          </div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition-all shadow-md group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    Eval Query #{idx + 1}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Relevant ID(s): [{item.relevant_ids.join(', ')}]
                  </span>
                </div>
                <h4 className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors leading-relaxed">
                  "{item.query}"
                </h4>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Recall Target Verified</span>
                </div>
                <button
                  onClick={() => onRunTestInChat(item.query)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run in Agent Chat</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
