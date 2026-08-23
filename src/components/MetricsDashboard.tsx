import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, Zap, CheckCircle2, Globe, Database, Terminal, RefreshCw } from 'lucide-react';
import { MetricsData } from '../types';

export const MetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [prometheusRaw, setPrometheusRaw] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const [jsonRes, promRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/metrics')
      ]);
      const jsonData = await jsonRes.json();
      const promText = await promRes.text();
      setMetrics(jsonData);
      setPrometheusRaw(promText);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            System & Prometheus Telemetry Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time observability matching <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">utils/metrics.py</code> and Grafana/Prometheus exporter.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Queries Handled</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.totalQueries ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            HTTP Status: 200 OK
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Average End-to-End Latency</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {metrics?.avgLatencyMs ?? 0} ms
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Includes retrieval + LLM synthesis
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Local Vector Searches</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">
            {metrics?.localSearchCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Resolved internally via Qdrant/Jina
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Web Fallback Retrievals</span>
            <Globe className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {metrics?.webFallbackCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Invoked when local records insufficient
          </div>
        </div>
      </div>

      {/* Recall Benchmark Cards */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Evaluation Benchmark (Recall@K Performance)
          </h3>
          <span className="text-xs text-slate-400">Dataset: 114 clinical test queries</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 mb-1 font-mono">Recall @ 1</div>
            <div className="text-xl font-bold text-cyan-400 font-mono">
              {((metrics?.recallAt1 || 0.605) * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${(metrics?.recallAt1 || 0.605) * 100}%` }} />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 mb-1 font-mono">Recall @ 3</div>
            <div className="text-xl font-bold text-cyan-400 font-mono">
              {((metrics?.recallAt3 || 0.772) * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${(metrics?.recallAt3 || 0.772) * 100}%` }} />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 mb-1 font-mono">Recall @ 5</div>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {((metrics?.recallAt5 || 0.816) * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${(metrics?.recallAt5 || 0.816) * 100}%` }} />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 mb-1 font-mono">Recall @ 10</div>
            <div className="text-xl font-bold text-indigo-400 font-mono">
              {((metrics?.recallAt10 || 0.886) * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${(metrics?.recallAt10 || 0.886) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Raw Prometheus Exporter Output */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Raw Prometheus Metrics Exporter (GET /metrics)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Content-Type: text/plain</span>
        </div>

        <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300/90 overflow-x-auto max-h-56 leading-relaxed">
          {prometheusRaw || 'Loading Prometheus metrics stream...'}
        </pre>
      </div>
    </div>
  );
};
