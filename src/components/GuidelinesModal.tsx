import React from 'react';
import { X, ShieldCheck, CheckCircle2, BookOpen, ExternalLink } from 'lucide-react';

interface GuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidelinesModal: React.FC<GuidelinesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const standards = [
    {
      title: 'World Health Organization (WHO)',
      scope: 'Cervical Cancer Screening & HPV DNA Triage Algorithms',
      version: 'WHO Guideline 2021 Update',
      criteria: 'Evidence-based algorithmic recommendation for follow-up testing and colposcopy referral.'
    },
    {
      title: 'Advisory Committee on Immunization Practices (ACIP / CDC)',
      scope: 'Vaccine Schedules & Routine Adolescent Immunization',
      version: 'CDC MMWR 2023-2024 Standards',
      criteria: 'GRADE methodology guidelines for HPV, COVID-19, and pediatric/adult immunization schedules.'
    },
    {
      title: 'Institute of Medicine (IOM / National Academy of Medicine)',
      scope: 'Criteria for Trustworthy Clinical Practice Guidelines',
      version: 'IOM 8 Standard Criteria',
      criteria: 'Transparency, conflict of interest management, systematic reviews, and rating recommendations.'
    },
    {
      title: 'American College of Cardiology / AHA (ACC/AHA)',
      scope: 'Atherosclerotic Cardiovascular Disease (ASCVD) & Statin Guidelines',
      version: 'AHA/ACC 2019/2023 Primary Prevention Standards',
      criteria: 'Risk-stratified indications for high-intensity vs. moderate-intensity statin therapy.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Verified Clinical Practice Guidelines</h3>
              <p className="text-xs text-slate-500">Benchmark evidence standards integrated into vector search</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Guidelines */}
        <div className="p-6 overflow-y-auto space-y-3.5 text-xs">
          {standards.map((std, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  {std.title}
                </span>
                <span className="text-[10px] font-mono bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  {std.version}
                </span>
              </div>
              <div className="font-medium text-blue-700">{std.scope}</div>
              <p className="text-slate-600 text-xs leading-relaxed">{std.criteria}</p>
            </div>
          ))}
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
