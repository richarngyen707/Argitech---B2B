import React, { useState, useRef } from 'react';
import {
  Upload,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  FileJson,
  Layers,
  MapPin,
  Compass,
} from 'lucide-react';
import {
  AgriTwinSavedMissionState,
  getSavedMissionLayout,
  getMissionSnapshots,
} from '../services/storageService';
import { parseAndValidateMissionFile } from '../services/missionReportService';

interface OpenSavedMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreMission: (state: AgriTwinSavedMissionState) => void;
  onResetToDefault: () => void;
}

export const OpenSavedMissionModal: React.FC<OpenSavedMissionModalProps> = ({
  isOpen,
  onClose,
  onRestoreMission,
  onResetToDefault,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'local'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<AgriTwinSavedMissionState | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentLocalSave = getSavedMissionLayout();
  const historicalSnapshots = getMissionSnapshots();

  const handleFileProcess = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setParsedPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        const validated = parseAndValidateMissionFile(content);
        if (validated) {
          setParsedPreview(validated);
        } else {
          setParseError(
            'Invalid mission configuration format. Please provide a valid AgriTwin .json configuration or .doc mission performance report.'
          );
        }
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleApplyUploaded = () => {
    if (parsedPreview) {
      onRestoreMission(parsedPreview);
      onClose();
    }
  };

  const handleApplyLocal = (state: AgriTwinSavedMissionState) => {
    onRestoreMission(state);
    onClose();
  };

  return (
    <div
      id="modal-open-saved-mission"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Open &amp; Restore Saved Mission
              </h3>
              <p className="text-xs text-slate-400">
                Load custom plot coordinates, floating-point areas, angles, and NFZ boundary
              </p>
            </div>
          </div>

          <button
            id="close-open-saved-mission-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS HEADER */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            <button
              id="open-tab-upload"
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeTab === 'upload'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Mission File (.json / .doc)</span>
            </button>
            <button
              id="open-tab-local"
              type="button"
              onClick={() => setActiveTab('local')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeTab === 'local'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Browser Local Saves</span>
            </button>
          </div>

          <button
            id="modal-reset-to-default-grid-btn"
            type="button"
            onClick={() => {
              onResetToDefault();
              onClose();
            }}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
            title="Restore default 2x3 grid and clear saved storage"
          >
            <RotateCcw className="w-3 h-3 text-cyan-400" />
            <span>Reset to 2x3 Grid</span>
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'upload' ? (
            /* UPLOAD TAB */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.doc,.htm,.html,text/plain,application/json"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload-input"
              />

              <div
                id="dropzone-upload-mission"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-cyan-400 bg-cyan-950/40'
                    : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-950'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-white">
                  Click to select or drag and drop mission file
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Supports exported AgriTwin <code>.json</code> configuration files or <code>.doc</code> state reports
                </p>
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{parseError}</div>
                </div>
              )}

              {parsedPreview && (
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Valid Mission Configuration Detected</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                      {fileName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Parcels</span>
                      <strong className="text-white font-mono">{parsedPreview.subZones.length} Sectors</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Field Area</span>
                      <strong className="text-white font-mono">{parsedPreview.fieldArea.toFixed(2)} ha</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">NFZ Boundary</span>
                      <strong className="text-white font-mono">
                        {parsedPreview.activeNFZGeometry?.length || 0} Points
                      </strong>
                    </div>
                  </div>

                  {parsedPreview.locationName && (
                    <div className="text-xs text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{parsedPreview.locationName}</span>
                    </div>
                  )}

                  <button
                    id="apply-uploaded-mission-btn"
                    type="button"
                    onClick={handleApplyUploaded}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Restore Layout &amp; Exact Coordinates</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* LOCAL STORAGE TAB */
            <div className="space-y-4">
              {/* CURRENT ACTIVE BROWSER SAVE */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Active Browser Layout (`localStorage`)
                </span>

                {currentLocalSave ? (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        <span>{currentLocalSave.subZones?.length || 6} Custom Sectors Saved</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {currentLocalSave.savedAtFormatted || new Date(currentLocalSave.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span>Area: <strong>{currentLocalSave.fieldArea.toFixed(2)} ha</strong></span>
                      <span className="text-slate-600">&bull;</span>
                      <span>NFZ: <strong>{currentLocalSave.activeNFZGeometry?.length || 4} waypoints</strong></span>
                    </div>

                    <button
                      id="restore-current-local-btn"
                      type="button"
                      onClick={() => handleApplyLocal(currentLocalSave)}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Restore This Active Browser Save</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-400">
                    No mission layout currently stored in browser storage.
                  </div>
                )}
              </div>

              {/* SNAPSHOT HISTORY */}
              {historicalSnapshots.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Committed Snapshot History ({historicalSnapshots.length})
                  </span>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {historicalSnapshots.map((snap, idx) => (
                      <div
                        key={snap.timestamp || idx}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">
                            {snap.locationName || 'Agricultural Parcel'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {snap.savedAtFormatted || new Date(snap.timestamp).toLocaleString()} &bull;{' '}
                            {snap.subZones?.length || 6} sectors ({snap.fieldArea.toFixed(1)} ha)
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyLocal(snap)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white font-medium text-xs transition-colors shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end shrink-0">
          <button
            id="close-open-saved-footer-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs sm:text-sm transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
