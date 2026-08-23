import React from 'react';
import { Stethoscope, MessageSquare, BookOpen, ShieldCheck, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
  activeTab: 'consultation' | 'library';
  setActiveTab: (tab: 'consultation' | 'library') => void;
  onOpenSettings: () => void;
  totalDocs: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  totalDocs
}) => {
  return (
    <header id="clinical-header" className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-2">
          
          {/* Brand Left */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white flex-shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Medical Knowledge Assistant
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                  Clinical Evidence
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Evidence-based medical consultation and guideline search
              </p>
            </div>
          </div>

          {/* Center Tabs */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              id="tab-consultation"
              onClick={() => setActiveTab('consultation')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'consultation'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Consultation</span>
            </button>

            <button
              id="tab-library"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'library'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Reference Library</span>
              <span className="ml-0.5 px-2 py-0.2 rounded-full text-xs bg-slate-200 text-slate-700 font-semibold">
                {totalDocs}
              </span>
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            <button
              id="btn-settings-config"
              onClick={onOpenSettings}
              title="System Configuration & API Keys"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
