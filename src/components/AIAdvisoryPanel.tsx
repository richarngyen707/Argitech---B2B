import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Send,
  Tractor,
  Layers,
  Cpu,
} from 'lucide-react';
import {
  AIAdvisoryReport,
  MachineryType,
  MissionType,
  SupportedLanguage,
  RiskLevel,
} from '../types';
import { translations, getLocalizedMachineryName, getLocalizedMissionName } from '../i18n/translations';

interface AIAdvisoryPanelProps {
  language: SupportedLanguage;
  advisory: AIAdvisoryReport;
  onRefreshAdvisory: () => void;
  machineryType: MachineryType;
  onMachineryTypeChange: (type: MachineryType) => void;
  missionType: MissionType;
  onMissionTypeChange: (mission: MissionType) => void;
  isLiveHardware: boolean;
  onDispatchMission: () => void;
  isDispatching: boolean;
}

const machineryOptions: MachineryType[] = [
  'DJI Agras T40 Sprayer Drone',
  'Yanmar YK1200 Autonomous Tractor',
  'John Deere 8R Autonomous Tractor',
];

const missionOptions: MissionType[] = [
  'Precision Bio-Spraying',
  'Soil Aeration & Subsoiling',
  'Multispectral Crop Survey',
  'Ultra-Low Volume (ULV) Seeding',
  'Variable Rate Nitrogen Top-Dressing',
];

export const AIAdvisoryPanel: React.FC<AIAdvisoryPanelProps> = ({
  language,
  advisory,
  onRefreshAdvisory,
  machineryType,
  onMachineryTypeChange,
  missionType,
  onMissionTypeChange,
  isLiveHardware,
  onDispatchMission,
  isDispatching,
}) => {
  const t = translations[language];

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-950 border border-red-500 text-red-300 flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            {t.riskCritical}
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-950 border border-orange-500 text-orange-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            {t.riskHigh}
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 border border-amber-500 text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {t.riskModerate}
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 border border-emerald-500 text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {t.riskOptimal}
          </span>
        );
    }
  };

  return (
    <div
      id="agritwin_ai_advisory_panel"
      className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col justify-between gap-4 h-full"
    >
      {/* Header & Refresh */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{t.aiAdvisoryTitle}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                {advisory.source === 'gemini_ai' ? 'Gemini 3.7 Flash' : 'Edge Hybrid Engine'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Autonomous microclimate analysis & variable-rate flight optimization
            </p>
          </div>
        </div>

        <button
          id="btn_refresh_advisory"
          onClick={onRefreshAdvisory}
          disabled={advisory.loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          title="Regenerate Advisory Analysis"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${advisory.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* AI Advisory Card Content */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">{t.riskLevelLabel}:</span>
          {getRiskBadge(advisory.riskLevel)}
        </div>

        {advisory.summary && (
          <div className="text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 leading-relaxed">
            {advisory.summary}
          </div>
        )}

        {/* 3-Bullet Action Plan */}
        <div className="space-y-2">
          {advisory.loading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <span>{t.generatingAdvisory}</span>
            </div>
          ) : (
            advisory.bullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200"
              >
                <div className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-slate-700">
                  {idx + 1}
                </div>
                <p className="leading-relaxed flex-1">{bullet}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mission Protocol Configuration Selectors */}
      <div className="space-y-3">
        {/* Machinery Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Tractor className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.machineryTypeLabel}</span>
          </label>
          <select
            id="select_machinery_type"
            value={machineryType}
            onChange={(e) => onMachineryTypeChange(e.target.value as MachineryType)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {machineryOptions.map((opt) => (
              <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                {getLocalizedMachineryName(opt, language)}
              </option>
            ))}
          </select>
        </div>

        {/* Mission Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.missionTypeLabel}</span>
          </label>
          <select
            id="select_mission_type"
            value={missionType}
            onChange={(e) => onMissionTypeChange(e.target.value as MissionType)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {missionOptions.map((opt) => (
              <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                {getLocalizedMissionName(opt, language)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Dispatch Action Button */}
      <button
        id="btn_dispatch_action"
        onClick={onDispatchMission}
        disabled={isDispatching}
        className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-98 ${
          isLiveHardware
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-900/40'
            : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-900/40'
        } disabled:opacity-50`}
      >
        <Send className="w-4 h-4" />
        <span>{isLiveHardware ? t.dispatchBtnLive : t.dispatchBtnSim}</span>
      </button>
    </div>
  );
};
