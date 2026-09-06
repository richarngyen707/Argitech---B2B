import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  X,
  Droplets,
  Wind,
  Compass,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  MissionPerformanceReportData,
  exportMissionPerformanceDoc,
  exportMissionPerformanceJson,
  copyMissionReportToClipboard,
} from '../services/missionReportService';
import { calculatePrescriptionTotals } from '../types';
import { WEATHER_SAFETY_LIMITS } from '../services/weatherSafetyService';

interface MissionPerformanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: MissionPerformanceReportData | null;
}

export const MissionPerformanceReportModal: React.FC<MissionPerformanceReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
}) => {
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');

  if (!isOpen || !reportData) return null;

  const totals = calculatePrescriptionTotals(reportData.subZones);
  const activeSectors = reportData.subZones.filter((z) => z.enabled !== false);
  const totalActiveHa = activeSectors.reduce((sum, z) => sum + (z.areaHa || 0), 0);
  const totalLiquidL = totals.canopyWaterVolume + totals.pesticideChemicalVolume;

  const windOk = reportData.telemetry.windSpeed < WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH;
  const rainOk = reportData.telemetry.precipitation < WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH;
  const tempOk = reportData.telemetry.temp >= 10 && reportData.telemetry.temp <= 38;
  const nfzOk = !reportData.hasNfzConflict;

  const handleCopyGoogleDocs = async () => {
    const success = await copyMissionReportToClipboard(reportData);
    if (success) {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2500);
    }
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(reportData, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  return (
    <div
      id="modal-mission-performance-report"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-white truncate">
                  Mission Performance &amp; State Report
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Locked in localStorage
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">
                ID: {reportData.missionId} &bull; {reportData.savedAtFormatted}
              </p>
            </div>
          </div>

          <button
            id="close-mission-report-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOP QUICK ACTION TOOLBAR */}
        <div className="px-4 sm:px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="report-tab-preview"
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Report Preview
            </button>
            <button
              id="report-tab-json"
              type="button"
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'json'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw Recovery JSON
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Download Google Doc (.doc) */}
            <button
              id="download-google-doc-btn"
              type="button"
              onClick={() => exportMissionPerformanceDoc(reportData)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all active:scale-95"
              title="Download Word and Google Docs compatible document with formatted tables and styles"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download Google Doc (.doc)</span>
            </button>

            {/* Copy for Google Docs */}
            <button
              id="copy-for-google-docs-btn"
              type="button"
              onClick={handleCopyGoogleDocs}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-all"
              title="Copy rich HTML table format to clipboard so you can paste directly (Ctrl+V) into docs.google.com"
            >
              {copiedHtml ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">Copied Rich Format!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy for Google Docs</span>
                </>
              )}
            </button>

            {/* Download JSON */}
            <button
              id="download-mission-json-btn"
              type="button"
              onClick={() => exportMissionPerformanceJson(reportData)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-all"
              title="Download machine-readable JSON configuration"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download JSON (.json)</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'preview' ? (
            <>
              {/* STATUS METRICS SUMMARY CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Active Parcels
                  </div>
                  <div className="text-xl font-bold text-white font-mono mt-1">
                    {activeSectors.length} <span className="text-xs text-slate-400 font-normal">/ {reportData.subZones.length}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                    {totalActiveHa.toFixed(2)} ha active
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    Total Spray Fluid
                  </div>
                  <div className="text-xl font-bold text-cyan-300 font-mono mt-1">
                    {totalLiquidL.toFixed(1)} L
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Water + Bio-Pesticide
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Nitrogen Nutrients
                  </div>
                  <div className="text-xl font-bold text-amber-300 font-mono mt-1">
                    {totals.nutrientNitrogenKg.toFixed(1)} kg
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Granular Application
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-teal-400" />
                    Weather Envelope
                  </div>
                  <div className="text-xl font-bold font-mono mt-1 flex items-center gap-1.5">
                    {windOk && rainOk && tempOk ? (
                      <span className="text-emerald-400 text-sm font-semibold">Clear &bull; Optimal</span>
                    ) : (
                      <span className="text-amber-400 text-sm font-semibold">Caution Active</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Wind: {reportData.telemetry.windSpeed.toFixed(1)} km/h
                  </div>
                </div>
              </div>

              {/* 1. SECTOR SUMMARY TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    1. Customized Sector Layout &amp; Orientation
                  </h4>
                  <span className="text-xs text-slate-400">
                    All coordinates and floating-point areas preserved
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
                        <th className="py-2.5 px-3 font-semibold w-8">#</th>
                        <th className="py-2.5 px-3 font-semibold">Sector</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 font-semibold">Condition</th>
                        <th className="py-2.5 px-3 font-semibold">Payload Type</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Area</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Orientation</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Dosage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {reportData.subZones.map((z, idx) => {
                        const isEnabled = z.enabled !== false;
                        const angleVal = (typeof z.rotationAngle === 'number' ? z.rotationAngle : (z.rotationDeg || 0)).toFixed(1);

                        return (
                          <tr
                            key={z.id || idx}
                            className={`hover:bg-slate-900/40 transition-colors ${
                              !isEnabled ? 'opacity-50 bg-slate-950/40' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-200">
                              <div>{z.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{z.id}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              {isEnabled ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                  SKIPPED
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {z.healthType === 'HEALTHY' ? (
                                <span className="text-sky-300 font-medium">Healthy Canopy</span>
                              ) : z.healthType === 'NITROGEN_DEFICIT' ? (
                                <span className="text-amber-300 font-medium">Nitrogen Deficit</span>
                              ) : (
                                <span className="text-rose-300 font-medium">Pest Stress</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                              {z.chemicalType || (z.healthType === 'PEST_STRESS' ? 'bio_pesticide' : 'water_mist')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                              {(z.areaHa || 0.42).toFixed(2)} ha
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-cyan-300">
                              {angleVal}°
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                              {z.dosageRateLPerHa || (z.healthType === 'NITROGEN_DEFICIT' ? 12 : 15)}{' '}
                              {z.healthType === 'NITROGEN_DEFICIT' ? 'kg/ha' : 'L/ha'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. WEATHER SAFETY LIMITS VERIFICATION */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  2. Microclimate Limits &amp; Airspace Clearance
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Wind Velocity Limit</span>
                      <strong className="text-white font-mono">
                        {reportData.telemetry.windSpeed.toFixed(1)} km/h
                      </strong>
                      <span className="text-slate-500 text-[10px]"> (Max: 15.0 km/h)</span>
                    </div>
                    {windOk ? (
                      <span className="text-emerald-400 font-bold text-[11px] bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800">
                        &check; SAFE
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold text-[11px] bg-rose-950/60 px-2 py-1 rounded border border-rose-800">
                        &cross; EXCEEDED
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Precipitation Limit</span>
                      <strong className="text-white font-mono">
                        {reportData.telemetry.precipitation.toFixed(1)} mm/h
                      </strong>
                      <span className="text-slate-500 text-[10px]"> (Max: 1.0 mm/h)</span>
                    </div>
                    {rainOk ? (
                      <span className="text-emerald-400 font-bold text-[11px] bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800">
                        &check; DRY (SAFE)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold text-[11px] bg-rose-950/60 px-2 py-1 rounded border border-rose-800">
                        &cross; RAIN RISK
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Restricted No-Fly Zone (NFZ)</span>
                      <strong className="text-white font-mono">
                        {reportData.nfzPolygon?.length || 4} Boundary Waypoints
                      </strong>
                    </div>
                    {nfzOk ? (
                      <span className="text-emerald-400 font-bold text-[11px] bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800">
                        &check; CLEAR AIRSPACE
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold text-[11px] bg-rose-950/60 px-2 py-1 rounded border border-rose-800">
                        &cross; INTERSECTS NFZ
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Swarm Flight Duration</span>
                      <strong className="text-white font-mono">
                        ~{(totalActiveHa * 7.5).toFixed(1)} min
                      </strong>
                      <span className="text-slate-500 text-[10px]"> (Cruise: 6.5 m/s)</span>
                    </div>
                    <span className="text-cyan-400 font-bold text-[11px] bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800">
                      CALCULATED
                    </span>
                  </div>
                </div>
              </div>

              {/* HOW TO USE WITH GOOGLE DOCS HINT */}
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-200/90 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-white">Opening in Google Docs:</div>
                  <p className="text-[11px] text-cyan-300/80">
                    1. Click <strong>Download Google Doc (.doc)</strong> above, then upload the file to your Google Drive and open it in Google Docs.
                    <br />
                    2. Or click <strong>Copy for Google Docs</strong> and press <code>Ctrl+V</code> (or <code>Cmd+V</code>) inside any open Google Doc to paste formatted tables with high-fidelity styling.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* RAW RECOVERY JSON TAB */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Exact state snapshot saved to <code>localStorage[&quot;agriTwin_saved_mission&quot;]</code>:
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copy Raw JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-[450px] whitespace-pre-wrap word-break-all">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 hidden sm:block">
            Mission state is locked and immediately available on refresh.
          </div>
          <button
            id="close-report-modal-footer-btn"
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs sm:text-sm transition-colors ml-auto"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
