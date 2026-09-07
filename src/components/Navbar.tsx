import React from 'react';
import {
  Activity,
  Globe,
  Wifi,
  WifiOff,
  CloudRain,
  Wind,
  Navigation,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Cpu,
  FileText,
  Radio,
  FolderOpen,
  Undo2,
  Redo2,
  CheckCircle2,
  History,
} from 'lucide-react';
import { SupportedLanguage, TelemetryData } from '../types';
import { translations } from '../i18n/translations';

interface NavbarProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isOnline: boolean;
  onToggleNetwork: () => void;
  telemetry: TelemetryData;
  locationName: string;
  isDetectingLocation: boolean;
  onDetectLocation: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onResetSimulation: () => void;
  onExportVietGapPdf: () => void;
  onAcceptSaveMission: () => void;
  onOpenSavedMission: () => void;
  // History & State Management Controls:
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasUnsavedChanges: boolean;
  onDiscardUnsavedChanges: () => void;
  onRestoreFactoryDefaults: () => void;
  pastCount?: number;
  futureCount?: number;
}

const languageOptions: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'zh', label: '中文 (简体)', flag: '🇨🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

export const Navbar: React.FC<NavbarProps> = ({
  language,
  onLanguageChange,
  isOnline,
  onToggleNetwork,
  telemetry,
  locationName,
  isDetectingLocation,
  onDetectLocation,
  isSimulating,
  onToggleSimulation,
  onResetSimulation,
  onExportVietGapPdf,
  onAcceptSaveMission,
  onOpenSavedMission,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasUnsavedChanges,
  onDiscardUnsavedChanges,
  onRestoreFactoryDefaults,
  pastCount = 0,
  futureCount = 0,
}) => {
  const t = translations[language];

  return (
    <header
      id="agritwin_main_header"
      className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 sticky top-0 z-50 px-4 py-2.5 shadow-xl transition-all"
    >
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand Identity & Operator Role */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40">
            <Cpu className="w-5 h-5 text-slate-950 font-bold" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
                AgriTwin-B2B
              </span>
              <span className="hidden xl:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded-full">
                Global Autonomous Dispatch
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-[240px] md:max-w-xs">{t.userBadgeRole}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Connectivity & Microclimate Status Badge */}
        <div className="hidden lg:flex items-center gap-2.5 bg-slate-950/70 border border-slate-800/90 rounded-xl px-3.5 py-1.5 shadow-inner">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="w-3.5 h-3.5" />
                <span>{t.onlineMode}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                <WifiOff className="w-3.5 h-3.5" />
                <span>{t.offlineMode}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
            <span className="truncate max-w-[140px] text-slate-400">{locationName}</span>
            <div className="flex items-center gap-1 text-slate-200" title="Live Temperature">
              <span className="text-amber-400 font-bold">{telemetry.temp.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300" title="Wind Velocity">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span>{telemetry.windSpeed.toFixed(1)} km/h</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300" title="Precipitation">
              <CloudRain className="w-3.5 h-3.5 text-blue-400" />
              <span>{telemetry.precipitation.toFixed(1)} mm/h</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Buttons & Language Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          {/* Detect Location Button */}
          <button
            id="btn_detect_location"
            onClick={onDetectLocation}
            disabled={isDetectingLocation}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Locate via HTML5 GPS and fetch live weather"
          >
            <Navigation
              className={`w-3.5 h-3.5 text-emerald-400 ${
                isDetectingLocation ? 'animate-spin' : ''
              }`}
            />
            <span className="hidden md:inline">
              {isDetectingLocation ? t.detectingLocation : t.detectLocation}
            </span>
          </button>

          {/* Simulate Network Drop / Restore Network Button */}
          <button
            id="btn_simulate_network_drop"
            onClick={onToggleNetwork}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm active:scale-95 ${
              isOnline
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-amber-300'
                : 'bg-amber-950/80 border-amber-600 text-amber-300 hover:bg-amber-900'
            }`}
            title="Toggle network online/offline to test fail-safe RTH & offline local caching"
          >
            {isOnline ? (
              <>
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">{t.simulateSignalDrop}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">{t.restoreNetwork}</span>
              </>
            )}
          </button>

          {/* Run Daily Field Simulation Button */}
          <button
            id="btn_run_simulation"
            onClick={onToggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${
              isSimulating
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/50'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isSimulating ? 'fill-current' : ''}`} />
            <span>{isSimulating ? 'Pause Simulation' : t.runDailySimulation}</span>
          </button>

          {/* Reset Simulation Button */}
          <button
            id="btn_reset_simulation"
            onClick={onResetSimulation}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all"
            title={t.resetSimulation}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Open Saved Mission Button */}
          <button
            id="btn_open_saved_mission"
            onClick={onOpenSavedMission}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:text-cyan-200 transition-all shadow-sm active:scale-95"
            title="Open a saved mission layout from file (.json) or browser storage snapshot"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Open Saved Mission</span>
          </button>

          {/* Accept & Save Mission Performance (Prominent Primary Button) */}
          <button
            id="btn_accept_save_mission_performance"
            onClick={onAcceptSaveMission}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-300 transition-all active:scale-95"
            title="Lock current mission performance, persist to browser storage, and export audit report / Google Doc"
          >
            <ShieldCheck className="w-4 h-4 text-slate-950 font-extrabold" />
            <span className="whitespace-nowrap">Accept &amp; Save Mission Performance</span>
          </button>

          {/* Export VietGAP PDF Report Button */}
          <button
            id="btn_export_vietgap_pdf"
            onClick={onExportVietGapPdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/50 transition-all shadow-sm active:scale-95"
            title="Generate and download VietGAP / GlobalGAP Compliance Inspection Certificate"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">{t.exportVietGapPdfBtn}</span>
          </button>

          {/* Language Selector Dropdown */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <select
                id="select_app_language"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
                className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer pr-1"
              >
                {languageOptions.map((opt) => (
                  <option
                    key={opt.code}
                    value={opt.code}
                    className="bg-slate-900 text-slate-100 py-1"
                  >
                    {opt.flag} {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Top Action Bar: State History (Undo / Redo / Un-restore) & Saved State Controls */}
      <div
        id="top_state_history_action_bar"
        className="mt-2.5 pt-2 border-t border-slate-800/80 max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs"
      >
        {/* Left: Unsaved Changes Status Indicator & Keyboard Shortcut Hint */}
        <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <div
              id="status_indicator_unsaved"
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold shadow-sm transition-all"
              title="Spatial geometry has been modified since the last confirmed Google Doc / localStorage snapshot"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Unsaved Changes Pending</span>
            </div>
          ) : (
            <div
              id="status_indicator_saved"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold shadow-sm transition-all"
              title="All field parcel geometries and swaths match the latest confirmed mission snapshot"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>All Changes Saved</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="text-slate-700">|</span>
            <span className="text-slate-400 font-sans text-xs">Hotkeys:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px] shadow-sm">
              Ctrl+Z
            </kbd>
            <span className="text-slate-300">Undo</span>
            <span className="text-slate-700">•</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px] shadow-sm">
              Ctrl+Y
            </kbd>
            <span className="text-slate-300">Redo</span>
          </div>
        </div>

        {/* Right: History Navigation & Restore/Discard Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo Button */}
          <button
            id="btn_header_undo"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            title="Undo last change (plot move, resize, rotate, toggle) — Hotkey: Ctrl+Z"
          >
            <Undo2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Undo</span>
            {typeof pastCount === 'number' && pastCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900 text-cyan-300 border border-slate-700">
                {pastCount}
              </span>
            )}
          </button>

          {/* Redo / Un-restore Button */}
          <button
            id="btn_header_redo"
            onClick={onRedo}
            disabled={!canRedo}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            title="Redo un-restored change — Hotkey: Ctrl+Y / Ctrl+Shift+Z"
          >
            <Redo2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Redo</span>
            {typeof futureCount === 'number' && futureCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900 text-cyan-300 border border-slate-700">
                {futureCount}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block mx-1"></div>

          {/* Discard Unsaved Changes Button */}
          <button
            id="btn_header_discard_unsaved"
            onClick={onDiscardUnsavedChanges}
            disabled={!hasUnsavedChanges}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-amber-950/40 border border-slate-700 hover:border-amber-600/60 text-slate-300 hover:text-amber-300 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            title="Revert the workspace back to the last confirmed Google Doc / localStorage snapshot"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Discard Unsaved Changes</span>
          </button>

          {/* Restore Factory Defaults Button */}
          <button
            id="btn_header_restore_defaults"
            onClick={onRestoreFactoryDefaults}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-200 transition-all shadow-sm active:scale-95"
            title="Reset all 6 plots back to the initial contiguous 2x3 grid and NFZ default position"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Restore Factory Defaults</span>
          </button>
        </div>
      </div>
    </header>
  );
};
