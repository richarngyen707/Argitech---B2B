import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  CloudOff,
  Cloud,
  History,
  Trash2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { AuditLogEntry, SupportedLanguage } from '../types';
import { translations } from '../i18n/translations';
import { exportLogsToCSV } from '../services/storageService';

interface AuditTrailLogProps {
  language: SupportedLanguage;
  logs: AuditLogEntry[];
  onClearLogs?: () => void;
  onExportVietGapPdf: () => void;
}

export const AuditTrailLog: React.FC<AuditTrailLogProps> = ({
  language,
  logs,
  onClearLogs,
  onExportVietGapPdf,
}) => {
  const t = translations[language];
  const [filterQuery, setFilterQuery] = useState('');

  const filteredLogs = logs.filter((log) => {
    const q = filterQuery.toLowerCase();
    return (
      log.locationName.toLowerCase().includes(q) ||
      log.actionApproved.toLowerCase().includes(q) ||
      log.machinery.toLowerCase().includes(q) ||
      log.syncStatus.toLowerCase().includes(q)
    );
  });

  const handleExportCsv = () => {
    exportLogsToCSV(logs, `AgriTwin_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div
      id="agritwin_audit_trail_section"
      className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-4 text-slate-100"
    >
      {/* Header with Title, Search, and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">{t.auditTrailTitle}</h3>
            <p className="text-xs text-slate-400">
              Immutable operational proof & dispatch compliance records (VietGAP & GlobalGAP)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Filter Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter logs..."
              className="bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48"
            />
          </div>

          {/* Export VietGAP PDF Button */}
          <button
            id="btn_audit_export_pdf"
            onClick={onExportVietGapPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/50 transition-all shadow-sm active:scale-95"
            title="Generate signed VietGAP Compliance PDF"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.exportVietGapPdfBtn}</span>
          </button>

          {/* Export CSV Button */}
          <button
            id="btn_export_csv"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all shadow-sm active:scale-95"
            title="Download full audit log as .csv"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportCsvBtn}</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 shadow-inner">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3.5">{t.tableColTimestamp}</th>
              <th className="py-2.5 px-3.5">{t.tableColLocation}</th>
              <th className="py-2.5 px-3.5 text-center">Plot (ha)</th>
              <th className="py-2.5 px-3.5">{t.tableColWeather}</th>
              <th className="py-2.5 px-3.5">{t.tableColMachinery}</th>
              <th className="py-2.5 px-3.5">{t.tableColAction}</th>
              <th className="py-2.5 px-3.5 text-right">{t.tableColEnergy}</th>
              <th className="py-2.5 px-3.5 text-center">{t.tableColSyncStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300 font-normal">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                  No operational records found. Run a simulation or dispatch a mission to log telemetry.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/60 transition-colors">
                  {/* Timestamp */}
                  <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  {/* Location & Coordinates */}
                  <td className="py-3 px-3.5 max-w-xs">
                    <div className="font-semibold text-slate-100 truncate">{log.locationName}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {(log.coordinates?.lat ?? 10.005).toFixed(4)}°, {(log.coordinates?.lng ?? 105.722).toFixed(4)}°
                    </div>
                  </td>

                  {/* Field Area (ha) */}
                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                      {(log.fieldArea ?? 2.5).toFixed(1)} ha
                    </span>
                  </td>

                  {/* Weather */}
                  <td className="py-3 px-3.5 whitespace-nowrap text-slate-300 text-[11px]">
                    {log.weatherSummary}
                  </td>

                  {/* Machine Unit & Tank */}
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <div className="font-medium text-slate-200">{log.machinery}</div>
                    <div className="text-[10px] text-slate-400">{log.tankLevel}</div>
                  </td>

                  {/* Action Approved */}
                  <td className="py-3 px-3.5">
                    <div className="text-emerald-300 font-medium">{log.actionApproved}</div>
                    <div className="text-[10px] text-slate-400">{log.mission}</div>
                  </td>

                  {/* Energy Saved */}
                  <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                    +{log.energySavedKgCo2.toFixed(1)} kg CO₂
                  </td>

                  {/* Sync Status Badge */}
                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                    {log.syncStatus === 'SYNCED_ONLINE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        <Cloud className="w-3 h-3" />
                        {t.syncedOnline}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800">
                        <CloudOff className="w-3 h-3" />
                        {t.cachedOffline}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
