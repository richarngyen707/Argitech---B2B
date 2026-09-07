import React, { useState } from 'react';
import {
  Droplet,
  Zap,
  ShieldAlert,
  Layers,
  Sparkles,
  Plane,
  RotateCcw,
  RotateCw,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Compass,
  Maximize2,
  Sliders,
  Move,
  ShieldCheck,
  FolderOpen,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  ZoneHealthType,
  ChemicalPayloadType,
  SubZonePolygonData,
  SupportedLanguage,
  SwarmMissionState,
  calculatePolygonCenter,
  calculatePolygonAreaHa,
  rotatePolygon,
  scalePolygon,
  resizePolygonToTargetArea,
} from '../types';
import { translations } from '../i18n/translations';

interface PrescriptionZonePainterProps {
  language: SupportedLanguage;
  subZones: SubZonePolygonData[];
  onSubZoneUpdate: (zones: SubZonePolygonData[]) => void;
  activeBrush: ZoneHealthType;
  onActiveBrushChange: (brush: ZoneHealthType) => void;
  fieldArea: number;
  swarmState: SwarmMissionState;
  onDispatchSwarm: () => void;
  onResetPrescription: () => void;
  hasNfzConflict?: boolean;
  flightDistanceMeters?: number;
  onAcceptSaveMission?: () => void;
  onOpenSavedMission?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const PrescriptionZonePainter: React.FC<PrescriptionZonePainterProps> = ({
  language,
  subZones,
  onSubZoneUpdate,
  activeBrush,
  onActiveBrushChange,
  fieldArea,
  swarmState,
  onDispatchSwarm,
  onResetPrescription,
  hasNfzConflict = false,
  flightDistanceMeters = 340,
  onAcceptSaveMission,
  onOpenSavedMission,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'payloads' | 'transforms'>('payloads');
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(0);

  // Dynamic calculations accounting for repositioned distance from Dock
  const transitMinutes = (flightDistanceMeters * 2) / (7.0 * 60); // 7 m/s transit speed
  const transitBatteryPercent = Math.round((flightDistanceMeters / 100) * 1.8);

  // Dynamic Fleet Generation & Task-Based Resource Consumption (strictly enabled sectors):
  let healthyHa = 0;
  let nitrogenHa = 0;
  let pestHa = 0;

  let pestPlotCount = 0;
  let waterPlotCount = 0;
  let nitrogenPlotCount = 0;

  subZones.forEach((z) => {
    if (z.enabled === false) return; // Skip disabled sectors
    const area = z.areaHa || 0.42;
    if (z.healthType === 'HEALTHY') {
      healthyHa += area;
      waterPlotCount++;
    } else if (z.healthType === 'NITROGEN_DEFICIT') {
      nitrogenHa += area;
      nitrogenPlotCount++;
    } else if (z.healthType === 'PEST_STRESS') {
      pestHa += area;
      pestPlotCount++;
    }
  });

  const totalDronesCount = pestPlotCount + waterPlotCount + nitrogenPlotCount;
  const skippedDronesCount = subZones.length - totalDronesCount;
  const activeFieldArea = healthyHa + nitrogenHa + pestHa;
  const totalEstimatedFlightMinutes = totalDronesCount > 0 ? parseFloat((activeFieldArea * 7.5 + transitMinutes).toFixed(1)) : 0;
  const totalEstimatedBatteryConsumed = totalDronesCount > 0 ? Math.min(100, Math.round(activeFieldArea * 35 + transitBatteryPercent)) : 0;

  const pesticideChemicalVolume = pestHa * 20; // 20 L/ha Chemical Volume
  const canopyWaterVolume = healthyHa * 15; // 15 L/ha Water Volume
  const nitrogenFertilizerKg = nitrogenHa * 12; // 12 kg/ha Fertilizer Granules

  // Toggle sector enable/disable status for spraying
  const handleToggleSectorEnabled = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = [...subZones];
    const current = updated[index];
    if (!current) return;
    const nextEnabled = current.enabled === false ? true : false;
    updated[index] = {
      ...current,
      enabled: nextEnabled,
    };
    onSubZoneUpdate(updated);
  };

  // Direct dropdown payload change for a specific sector
  const handleSectorDropdownChange = (index: number, newHealth: ZoneHealthType) => {
    const updated = [...subZones];
    const current = updated[index];
    if (!current) return;

    const newChem: ChemicalPayloadType =
      newHealth === 'HEALTHY'
        ? 'water_mist'
        : newHealth === 'NITROGEN_DEFICIT'
        ? 'nitrogen_fertilizer'
        : 'bio_pesticide';

    const newDosage = newHealth === 'PEST_STRESS' ? 20 : newHealth === 'HEALTHY' ? 15 : 12;
    const newNozzle = newHealth === 'HEALTHY' ? 200 : newHealth === 'NITROGEN_DEFICIT' ? 180 : 140;

    updated[index] = {
      ...current,
      healthType: newHealth,
      chemicalType: newChem,
      dosageRateLPerHa: newDosage,
      targetNozzleMicrons: newNozzle,
    };

    onSubZoneUpdate(updated);
  };

  // Independent Customization: Customize the maximum area / size of an individual plot (Unrestricted Hectares)
  const handleSectorAreaChange = (index: number, targetAreaHa: number) => {
    const safeTarget = Math.max(0.02, targetAreaHa);
    const updated = [...subZones];
    const current = updated[index];
    if (!current || !current.bounds) return;

    const newBounds = resizePolygonToTargetArea(current.bounds, safeTarget) as [
      { lat: number; lng: number },
      { lat: number; lng: number },
      { lat: number; lng: number },
      { lat: number; lng: number }
    ];

    const actualArea = calculatePolygonAreaHa(newBounds);
    const center = current.center || calculatePolygonCenter(newBounds);

    updated[index] = {
      ...current,
      areaHa: actualArea || safeTarget,
      maxAreaHa: safeTarget,
      bounds: newBounds,
      vertices: newBounds.map((b) => [b.lat, b.lng]),
      centroid: [center.lat, center.lng],
      center,
    };

    onSubZoneUpdate(updated);
  };

  // Independent Customization: Rotate an individual plot to user desired orientation (degrees)
  const handleSectorRotationChange = (index: number, targetAngleDeg: number) => {
    const safeAngle = ((targetAngleDeg % 360) + 360) % 360;
    const updated = [...subZones];
    const current = updated[index];
    if (!current || !current.bounds) return;

    const currentRotation = current.rotationAngle ?? current.rotationDeg ?? 0;
    const deltaAngle = safeAngle - currentRotation;
    const center = current.center || calculatePolygonCenter(current.bounds);

    const newBounds = rotatePolygon(current.bounds, deltaAngle, center) as [
      { lat: number; lng: number },
      { lat: number; lng: number },
      { lat: number; lng: number },
      { lat: number; lng: number }
    ];

    updated[index] = {
      ...current,
      rotationAngle: safeAngle,
      rotationDeg: safeAngle,
      bounds: newBounds,
      vertices: newBounds.map((b) => [b.lat, b.lng]),
      centroid: [center.lat, center.lng],
      center,
    };

    onSubZoneUpdate(updated);
  };

  // Rotate a sector by relative step (e.g. +15° or -15°)
  const handleStepRotation = (index: number, deltaDeg: number) => {
    const current = subZones[index];
    if (!current) return;
    const currentAngle = current.rotationAngle ?? current.rotationDeg ?? 0;
    handleSectorRotationChange(index, currentAngle + deltaDeg);
  };

  // Align all plots to a specific orientation angle (Batch alignment)
  const handleAlignAllPlots = (angleDeg: number) => {
    const safeAngle = ((angleDeg % 360) + 360) % 360;
    const updated = subZones.map((z) => {
      const currentRotation = z.rotationAngle ?? z.rotationDeg ?? 0;
      const deltaAngle = safeAngle - currentRotation;
      const center = z.center || calculatePolygonCenter(z.bounds);
      const newBounds = rotatePolygon(z.bounds, deltaAngle, center) as [
        { lat: number; lng: number },
        { lat: number; lng: number },
        { lat: number; lng: number },
        { lat: number; lng: number }
      ];
      return {
        ...z,
        rotationAngle: safeAngle,
        rotationDeg: safeAngle,
        bounds: newBounds,
        vertices: newBounds.map((b) => [b.lat, b.lng]),
        centroid: [center.lat, center.lng],
        center,
      };
    });
    onSubZoneUpdate(updated);
  };

  // Preset generators
  const applyPreset = (type: 'balanced' | 'pest' | 'nitrogen' | 'water') => {
    const defaultPatterns: Record<string, ZoneHealthType[]> = {
      balanced: ['PEST_STRESS', 'PEST_STRESS', 'PEST_STRESS', 'HEALTHY', 'HEALTHY', 'NITROGEN_DEFICIT'],
      pest: ['PEST_STRESS', 'PEST_STRESS', 'NITROGEN_DEFICIT', 'PEST_STRESS', 'HEALTHY', 'PEST_STRESS'],
      nitrogen: ['NITROGEN_DEFICIT', 'NITROGEN_DEFICIT', 'HEALTHY', 'NITROGEN_DEFICIT', 'NITROGEN_DEFICIT', 'HEALTHY'],
      water: ['HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY'],
    };

    const pattern = defaultPatterns[type];
    const updated = subZones.map((z, idx) => {
      const health = pattern[idx] || 'HEALTHY';
      const chem: ChemicalPayloadType =
        health === 'HEALTHY'
          ? 'water_mist'
          : health === 'NITROGEN_DEFICIT'
          ? 'nitrogen_fertilizer'
          : 'bio_pesticide';
      return {
        ...z,
        healthType: health,
        chemicalType: chem,
        dosageRateLPerHa: health === 'PEST_STRESS' ? 20 : health === 'HEALTHY' ? 15 : 12,
        targetNozzleMicrons: health === 'HEALTHY' ? 200 : health === 'NITROGEN_DEFICIT' ? 180 : 140,
      };
    });

    onSubZoneUpdate(updated);
  };

  return (
    <div
      id="prescription-vra-panel"
      className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl text-slate-100 space-y-4"
    >
      {/* Header & Mode Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-slate-100 flex items-center gap-2">
              Dynamic Plot-to-Drone Task Assignment & Custom Area Geometry
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30 font-medium">
                {totalDronesCount} Drones Allocated
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Drag, resize maximum area bounds, and customize rotation angles for each individual plot
            </p>
          </div>
        </div>

        {/* View Mode Toggle: Task Payloads vs Independent Area Transforms */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            id="tab-payloads-toggle"
            type="button"
            onClick={() => setActiveTab('payloads')}
            className={`text-xs px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'payloads'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Liquid Payloads</span>
          </button>
          <button
            id="tab-transforms-toggle"
            type="button"
            onClick={() => setActiveTab('transforms')}
            className={`text-xs px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'transforms'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Size & Orientation (Rotate)</span>
          </button>
        </div>
      </div>

      {/* QUICK PRESETS & BATCH ACTIONS BAR */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium">Presets:</span>
          <button
            id="preset-balanced-btn"
            type="button"
            onClick={() => applyPreset('balanced')}
            className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 font-medium"
          >
            Example Mix
          </button>
          <button
            id="preset-pest-btn"
            type="button"
            onClick={() => applyPreset('pest')}
            className="text-[11px] px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 transition-colors border border-rose-800/50 font-medium"
          >
            Chemical Outbreak
          </button>
          <button
            id="preset-nitrogen-btn"
            type="button"
            onClick={() => applyPreset('nitrogen')}
            className="text-[11px] px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 transition-colors border border-amber-800/50 font-medium"
          >
            Nitrogen Matrix
          </button>
          <button
            id="preset-hydration-btn"
            type="button"
            onClick={() => applyPreset('water')}
            className="text-[11px] px-2 py-0.5 rounded bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 transition-colors border border-cyan-800/50 font-medium"
          >
            Water Hydration
          </button>
        </div>

        {/* Global Orientation Alignment & Reset Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Quick Undo/Redo Buttons */}
          {onUndo && (
            <button
              id="btn_painter_undo"
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              title="Undo last spatial modification (Ctrl+Z)"
            >
              <Undo2 className="w-3 h-3 text-cyan-400" />
              <span>Undo</span>
            </button>
          )}
          {onRedo && (
            <button
              id="btn_painter_redo"
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              title="Redo modification (Ctrl+Y)"
            >
              <Redo2 className="w-3 h-3 text-cyan-400" />
              <span>Redo</span>
            </button>
          )}

          <div className="h-3 w-px bg-slate-700 hidden sm:block"></div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Align:</span>
            <button
              id="align-all-0deg-btn"
              type="button"
              onClick={() => handleAlignAllPlots(0)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
              title="Align all plots to 0° (North-South standard grid)"
            >
              0° North
            </button>
            <button
              id="align-all-45deg-btn"
              type="button"
              onClick={() => handleAlignAllPlots(45)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
              title="Align all plots to 45° (Diagonal terrain contour)"
            >
              45°
            </button>
            <button
              id="align-all-90deg-btn"
              type="button"
              onClick={() => handleAlignAllPlots(90)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
              title="Align all plots to 90° (East-West crosswind lines)"
            >
              90°
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {onOpenSavedMission && (
              <button
                id="open-saved-mission-top-btn"
                type="button"
                onClick={onOpenSavedMission}
                className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Open saved mission configuration (.json) or browser cache snapshot"
              >
                <FolderOpen className="w-3 h-3 text-cyan-400" />
                <span>Open Saved Mission</span>
              </button>
            )}

            {onAcceptSaveMission && (
              <button
                id="accept-save-mission-top-btn"
                type="button"
                onClick={onAcceptSaveMission}
                className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-sm ring-1 ring-emerald-400/50 active:scale-95"
                title="Confirm & Save Mission Performance (lock layout, save to browser storage, generate Google Doc/report)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-950 font-black" />
                <span>Accept &amp; Save Mission Performance</span>
              </button>
            )}

            <button
              id="reset-plots-to-initial-top-btn"
              type="button"
              onClick={onResetPrescription}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-cyan-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-all shadow-sm"
              title="Restore all sector plot coordinates and geometry to initial default layout"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>{t.resetPlotsToInitialBtn || 'Reset Plots to Initial Position'}</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'payloads' ? (
        /* 1. PAYLOAD BRUSH SELECTOR VIEW */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Liquid Type & Drone Class Mapping:
            </span>
            <span className="text-[11px] text-slate-400">
              Paint or select plots below to dynamically generate drone assignments
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Pesticide Drones (Red) */}
            <button
              id="brush-pest-toggle"
              type="button"
              onClick={() => onActiveBrushChange('PEST_STRESS')}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all relative ${
                activeBrush === 'PEST_STRESS'
                  ? 'bg-rose-950/60 border-rose-500 shadow-md shadow-rose-950/50 ring-2 ring-rose-500/50'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mt-0.5 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300">Pesticide Plots (Red)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-900/80 text-rose-200 font-mono font-bold">
                    {pestPlotCount} Plots → Alpha-XX
                  </span>
                </div>
                <p className="text-[11px] text-rose-200/90 font-medium mt-0.5">
                  Assigns Pesticide Drones (Red icon/trail)
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 font-mono font-semibold">
                    Chemical Tank: 20 L/ha
                  </span>
                  <span className="font-mono text-slate-400">140 µm Droplet</span>
                </div>
              </div>
            </button>

            {/* Water Drones (Green / Blue) */}
            <button
              id="brush-healthy-toggle"
              type="button"
              onClick={() => onActiveBrushChange('HEALTHY')}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all relative ${
                activeBrush === 'HEALTHY'
                  ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-950/50 ring-2 ring-sky-500/50'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mt-0.5 shrink-0">
                <Droplet className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300">Water Plots (Green)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-900/80 text-sky-200 font-mono font-bold">
                    {waterPlotCount} Plots → Beta-XX
                  </span>
                </div>
                <p className="text-[11px] text-sky-200/90 font-medium mt-0.5">
                  Assigns Water Drones (Blue icon/trail)
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300 font-mono font-semibold">
                    Water Tank: 15 L/ha
                  </span>
                  <span className="font-mono text-slate-400">200 µm Droplet</span>
                </div>
              </div>
            </button>

            {/* Nitrogen Spreader Drones (Yellow) */}
            <button
              id="brush-nitrogen-toggle"
              type="button"
              onClick={() => onActiveBrushChange('NITROGEN_DEFICIT')}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all relative ${
                activeBrush === 'NITROGEN_DEFICIT'
                  ? 'bg-amber-950/60 border-amber-500 shadow-md shadow-amber-950/50 ring-2 ring-amber-500/50'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mt-0.5 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">Nitrogen Plots (Yellow)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-900/80 text-amber-200 font-mono font-bold">
                    {nitrogenPlotCount} Plots → Gamma-XX
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 font-medium mt-0.5">
                  Assigns Nitrogen Spreaders (Yellow icon/trail)
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 font-mono font-semibold">
                    Fertilizer: 12 kg/ha
                  </span>
                  <span className="font-mono text-slate-400">Granule Solid</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* 2. INDEPENDENT SIZE & ROTATION ORIENTATION CONTROLS VIEW */
        <div className="space-y-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Independent Plot Size & Orientation Customizer</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Select any plot below or click on the map to rotate/scale
            </span>
          </div>

          {/* Plot Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {subZones.map((zone, idx) => (
              <button
                key={zone.id || idx}
                id={`select-plot-transform-${idx}`}
                type="button"
                onClick={() => setSelectedPlotIndex(idx)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-all border ${
                  selectedPlotIndex === idx
                    ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 shadow-md font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{zone.name.split(' ')[0] || `Plot ${idx + 1}`}</span>
                <span className="ml-1.5 text-[10px] font-mono text-cyan-300">
                  {zone.areaHa.toFixed(2)}ha • {(zone.rotationDeg || 0)}°
                </span>
              </button>
            ))}
          </div>

          {/* Detailed Transform Editor for Active Selected Plot */}
          {selectedPlotIndex !== null && subZones[selectedPlotIndex] && (
            <div
              id="active-plot-transform-card"
              className="bg-slate-900/90 border border-cyan-500/40 rounded-lg p-3.5 space-y-3 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-sm">
                    {subZones[selectedPlotIndex].name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                      subZones[selectedPlotIndex].healthType === 'HEALTHY'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : subZones[selectedPlotIndex].healthType === 'NITROGEN_DEFICIT'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {subZones[selectedPlotIndex].healthType}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                  <span>
                    GPS: ({subZones[selectedPlotIndex]?.center?.lat != null ? subZones[selectedPlotIndex].center.lat.toFixed(4) : (subZones[selectedPlotIndex]?.bounds?.[0]?.lat != null ? subZones[selectedPlotIndex].bounds[0].lat.toFixed(4) : '0.0000')}, {subZones[selectedPlotIndex]?.center?.lng != null ? subZones[selectedPlotIndex].center.lng.toFixed(4) : (subZones[selectedPlotIndex]?.bounds?.[0]?.lng != null ? subZones[selectedPlotIndex].bounds[0].lng.toFixed(4) : '0.0000')})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Direct Sector Area Input & Map Geodesic Area */}
                <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.customAreaSize || 'Sector Area (ha)'}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-300 text-sm">
                      {subZones[selectedPlotIndex].areaHa.toFixed(2)} ha
                    </span>
                  </div>

                  {/* Direct Floating Point Input for Area */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="input-plot-area-direct"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100.00"
                        value={subZones[selectedPlotIndex].areaHa}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            handleSectorAreaChange(selectedPlotIndex, val);
                          }
                        }}
                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder="0.42"
                      />
                      <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs font-mono">ha</span>
                    </div>

                    {/* Quick Area Steppers */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSectorAreaChange(selectedPlotIndex, Math.max(0.01, subZones[selectedPlotIndex].areaHa - 0.1))}
                        className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold"
                        title="-0.1 ha"
                      >
                        -0.1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSectorAreaChange(selectedPlotIndex, Math.min(100.0, subZones[selectedPlotIndex].areaHa + 0.1))}
                        className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold"
                        title="+0.1 ha"
                      >
                        +0.1
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                    <span className="font-mono text-[10px] text-emerald-400/90 font-medium">
                      ≈ {(subZones[selectedPlotIndex].areaHa * 10000).toLocaleString('en-US', { maximumFractionDigits: 0 })} m² (Max: 100.00 ha)
                    </span>
                    <span className="text-[10px] text-slate-400 italic">
                      Drag 4 corner handles or type exact ha
                    </span>
                  </div>
                </div>

                {/* 2. Direct Sector Angle Input & Orientation Dial / Slider */}
                <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t.orientationAngle || 'Sector Angle (deg)'}</span>
                    </span>
                    <div className="flex items-center gap-1 font-mono font-bold text-cyan-300 text-sm">
                      <span>{(subZones[selectedPlotIndex].rotationDeg || 0)}°</span>
                      <span className="text-slate-400 text-xs font-normal">
                        ({(subZones[selectedPlotIndex].rotationDeg || 0) === 0
                          ? 'North 0°'
                          : (subZones[selectedPlotIndex].rotationDeg || 0) === 90
                          ? 'East 90°'
                          : (subZones[selectedPlotIndex].rotationDeg || 0) === 180
                          ? 'South 180°'
                          : (subZones[selectedPlotIndex].rotationDeg || 0) === 270
                          ? 'West 270°'
                          : 'Custom'})
                      </span>
                    </div>
                  </div>

                  {/* Direct Floating Point Input for Angle */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="input-plot-angle-direct"
                        type="number"
                        step="0.1"
                        min="0"
                        max="360"
                        value={subZones[selectedPlotIndex].rotationDeg || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            handleSectorRotationChange(selectedPlotIndex, val);
                          }
                        }}
                        className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        placeholder="0.0"
                      />
                      <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs font-mono">deg</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepRotation(selectedPlotIndex, -15)}
                        className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 text-xs"
                        title="Rotate -15°"
                      >
                        <RotateCcw className="w-2.5 h-2.5 text-cyan-400" />
                        <span>-15°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepRotation(selectedPlotIndex, 15)}
                        className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 text-xs"
                        title="Rotate +15°"
                      >
                        <RotateCw className="w-2.5 h-2.5 text-cyan-400" />
                        <span>+15°</span>
                      </button>
                    </div>
                  </div>

                  <input
                    id={`slider-plot-rotation-${selectedPlotIndex}`}
                    type="range"
                    min="0"
                    max="360"
                    step="0.1"
                    value={subZones[selectedPlotIndex].rotationDeg || 0}
                    onChange={(e) => handleSectorRotationChange(selectedPlotIndex, parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />

                  {/* Quick Angle Presets */}
                  <div className="flex items-center justify-end gap-1 flex-wrap text-[10px] pt-1 border-t border-slate-800/80">
                    {[0, 45, 90, 135, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => handleSectorRotationChange(selectedPlotIndex, deg)}
                        className={`px-1.5 py-0.5 rounded border ${
                          (subZones[selectedPlotIndex].rotationDeg || 0) === deg
                            ? 'bg-cyan-600 text-white border-cyan-400 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Zone Sector Matrix Grid (6 Sectors) with Live Sizing & Orientation Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-300 flex items-center gap-2">
            <span>Field Plot Grid & Drone Assignment Matrix:</span>
            {subZones.length > 4 && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono font-bold">
                2-Col Compact Grid ({subZones.length} Sectors)
              </span>
            )}
          </span>
          <span className="text-[11px] text-slate-400">
            Total Field: <strong className="text-slate-200">{(healthyHa + nitrogenHa + pestHa).toFixed(2)} ha</strong> across {subZones.length} plots
          </span>
        </div>

        <div
          className={
            subZones.length > 4
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5'
          }
        >
          {subZones.map((zone, idx) => {
            const isSectorEnabled = zone.enabled !== false;
            const isHealthy = zone.healthType === 'HEALTHY';
            const isNitrogen = zone.healthType === 'NITROGEN_DEFICIT';
            const isPest = zone.healthType === 'PEST_STRESS';

            // Calculate code name for this plot
            let codeLabel = '';
            let payloadReqStr = '';
            if (!isSectorEnabled) {
              codeLabel = 'SKIPPED';
              payloadReqStr = '0.0 L (Skipped)';
            } else if (isPest) {
              let pestIndex = 1;
              for (let i = 0; i < idx; i++) {
                if (subZones[i].enabled !== false && subZones[i].healthType === 'PEST_STRESS') pestIndex++;
              }
              codeLabel = `Alpha-${String(pestIndex).padStart(2, '0')}`;
              payloadReqStr = `${(zone.areaHa * 20).toFixed(1)} L Chemical`;
            } else if (isHealthy) {
              let waterIndex = 1;
              for (let i = 0; i < idx; i++) {
                if (subZones[i].enabled !== false && subZones[i].healthType === 'HEALTHY') waterIndex++;
              }
              codeLabel = `Beta-${String(waterIndex).padStart(2, '0')}`;
              payloadReqStr = `${(zone.areaHa * 15).toFixed(1)} L Water`;
            } else {
              let nitroIndex = 1;
              for (let i = 0; i < idx; i++) {
                if (subZones[i].enabled !== false && subZones[i].healthType === 'NITROGEN_DEFICIT') nitroIndex++;
              }
              codeLabel = `Gamma-${String(nitroIndex).padStart(2, '0')}`;
              payloadReqStr = `${(zone.areaHa * 12).toFixed(1)} kg Fertilizer`;
            }

            const activeDrone = swarmState.drones?.find(
              (d) => d.targetSectorId === zone.id || d.targetSectorIndex === idx
            );

            return (
              <div
                key={zone.id || idx}
                id={`subsector-grid-item-${idx}`}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedPlotIndex === idx
                    ? 'ring-2 ring-cyan-400 shadow-lg'
                    : ''
                } ${
                  !isSectorEnabled
                    ? 'bg-slate-950/60 border-dashed border-slate-700/80 opacity-75'
                    : isHealthy
                    ? 'bg-sky-950/35 border-sky-800/60'
                    : isNitrogen
                    ? 'bg-amber-950/35 border-amber-800/60'
                    : 'bg-rose-950/35 border-rose-800/60'
                }`}
                onClick={() => setSelectedPlotIndex(idx)}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSectorEnabled ? 'text-slate-200' : 'text-slate-400 line-through'}`}>
                    {zone.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-mono">
                      {(zone.rotationDeg || 0)}°
                    </span>
                    {isSectorEnabled ? (
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono ${
                          isHealthy
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : isNitrogen
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {codeLabel}
                      </span>
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 rounded font-bold font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        SKIPPED - DOCKED
                      </span>
                    )}
                  </div>
                </div>

                {/* Sector Enable / Disable Control Toggle UI */}
                <div className="mt-2 flex items-center justify-between py-1 px-2 rounded bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                    <span>Enable Sector for Spraying:</span>
                    <span className={`text-[10px] font-bold font-mono ${isSectorEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {isSectorEnabled ? 'ON' : 'OFF'}
                    </span>
                  </span>
                  <button
                    id={`toggle-sector-${idx}-btn`}
                    type="button"
                    onClick={(e) => handleToggleSectorEnabled(idx, e)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isSectorEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={isSectorEnabled}
                    title={isSectorEnabled ? 'Sector is ENABLED (Click to Skip)' : 'Sector is DISABLED / SKIPPED (Click to Enable)'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isSectorEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-slate-400">Area:</span>
                    <input
                      id={`input-sector-area-${idx}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100.00"
                      value={zone.areaHa}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          handleSectorAreaChange(idx, val);
                        }
                      }}
                      className="w-16 bg-slate-900 border border-emerald-500/40 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                    <span className="text-[10px] text-slate-400">ha</span>
                  </div>
                  <span className={`font-mono font-bold ${isSectorEnabled ? 'text-cyan-300' : 'text-slate-500'}`}>
                    {payloadReqStr}
                  </span>
                </div>

                {/* In-Card Dynamic Area & Rotation Controls */}
                <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="text-slate-400">Angle:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStepRotation(idx, -15); }}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700"
                        title="-15°"
                      >
                        ↺
                      </button>
                      <input
                        id={`input-sector-angle-${idx}`}
                        type="number"
                        step="0.1"
                        min="0"
                        max="360"
                        value={zone.rotationDeg || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            handleSectorRotationChange(idx, val);
                          }
                        }}
                        className="w-14 bg-slate-900 border border-cyan-500/40 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      />
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="0.1"
                        value={zone.rotationDeg || 0}
                        onChange={(e) => handleSectorRotationChange(idx, parseFloat(e.target.value))}
                        className="w-14 accent-cyan-500 h-1 bg-slate-800 rounded cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStepRotation(idx, 15); }}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700"
                        title="+15°"
                      >
                        ↻
                      </button>
                    </div>
                  </div>

                  {/* Direct Action Dropdown per Sector */}
                  <select
                    id={`subsector-select-${idx}`}
                    value={zone.healthType}
                    onChange={(e) => handleSectorDropdownChange(idx, e.target.value as ZoneHealthType)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-slate-900 text-xs border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="PEST_STRESS">🔴 Pesticide Plot → Drone Alpha-XX (20 L/ha)</option>
                    <option value="HEALTHY">🟢 Water Plot → Drone Beta-XX (15 L/ha)</option>
                    <option value="NITROGEN_DEFICIT">🟡 Nitrogen Plot → Drone Gamma-XX (12 kg/ha)</option>
                  </select>
                </div>

                {activeDrone && swarmState.isSwarmActive && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/60 text-[10px] flex items-center justify-between font-mono">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {activeDrone.status}
                    </span>
                    <span className="text-slate-300">
                      Tank: {activeDrone.tankLevel.toFixed(1)} / {activeDrone.maxTank} ({activeDrone.progress.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Task-Based Resource Consumption Breakdown & Swarm Allocation Summary */}
      <div
        id="prescription-summary-card"
        className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3.5"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              Task-Based Resource Consumption & Swarm Allocation Summary
            </span>
          </div>
          <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center gap-1.5">
            <span>{totalDronesCount} Active Drones ({pestPlotCount} Pesticide, {waterPlotCount} Water, {nitrogenPlotCount} Nitrogen)</span>
            {skippedDronesCount > 0 && (
              <span className="text-slate-400 font-normal">• {skippedDronesCount} Skipped (Docked)</span>
            )}
          </span>
        </div>

        {/* 3 Dedicated Resource Consumption Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Pillar 1: Pesticide Chemical Tank Volume */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-rose-900/50 space-y-2">
            <div className="flex justify-between items-center text-rose-300 font-bold">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Pesticide Chemical Volume</span>
              </span>
              <span className="font-mono text-sm shrink-0">{pesticideChemicalVolume.toFixed(1)} L</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">
              <span className="text-rose-300">{pestHa.toFixed(2)} ha</span> × <span className="text-rose-300">20 L/ha</span> = <strong className="text-white">{pesticideChemicalVolume.toFixed(1)} L Chemical</strong>
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-300"
                style={{ width: pestPlotCount > 0 ? '100%' : '0%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Fleet: <strong>{pestPlotCount} × Pesticide Drone (Alpha-XX)</strong></span>
              <span className="text-rose-400 font-bold">Red Swath Trail</span>
            </div>
          </div>

          {/* Pillar 2: Water Tank Volume */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-sky-900/50 space-y-2">
            <div className="flex justify-between items-center text-sky-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-sky-400" />
                <span>Water Hydration Volume</span>
              </span>
              <span className="font-mono text-sm shrink-0">{canopyWaterVolume.toFixed(1)} L</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">
              <span className="text-sky-300">{healthyHa.toFixed(2)} ha</span> × <span className="text-sky-300">15 L/ha</span> = <strong className="text-white">{canopyWaterVolume.toFixed(1)} L Water</strong>
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-300"
                style={{ width: waterPlotCount > 0 ? '100%' : '0%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Fleet: <strong>{waterPlotCount} × Water Drone (Beta-XX)</strong></span>
              <span className="text-sky-400 font-bold">Blue Swath Trail</span>
            </div>
          </div>

          {/* Pillar 3: Nitrogen Spreader Granules */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-amber-900/50 space-y-2">
            <div className="flex justify-between items-center text-amber-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Nitrogen Fertilizer Granules</span>
              </span>
              <span className="font-mono text-sm shrink-0">{nitrogenFertilizerKg.toFixed(1)} kg</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">
              <span className="text-amber-300">{nitrogenHa.toFixed(2)} ha</span> × <span className="text-amber-300">12 kg/ha</span> = <strong className="text-white">{nitrogenFertilizerKg.toFixed(1)} kg Granules</strong>
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: nitrogenPlotCount > 0 ? '100%' : '0%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Fleet: <strong>{nitrogenPlotCount} × Nitrogen Drone (Gamma-XX)</strong></span>
              <span className="text-amber-400 font-bold">Yellow Swath Trail</span>
            </div>
          </div>
        </div>

        {/* Dynamic Multi-Drone Allocation Roster & Repositioned Flight Metrics */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-slate-300 text-[11px]">
                <strong>Alpha Fleet:</strong> {pestPlotCount} Pesticide Drones (Red)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-slate-300 text-[11px]">
                <strong>Beta Fleet:</strong> {waterPlotCount} Water Drones (Blue)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-slate-300 text-[11px]">
                <strong>Gamma Fleet:</strong> {nitrogenPlotCount} Nitrogen Drones (Yellow)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
              <span>Dock Dist:</span>
              <strong className="text-white">{flightDistanceMeters.toFixed(0)}m</strong>
              <span className="text-slate-500">|</span>
              <span>Time:</span>
              <strong className="text-emerald-300">~{totalEstimatedFlightMinutes}m</strong>
              <span className="text-slate-500">|</span>
              <span>Batt:</span>
              <strong className="text-amber-300">~{totalEstimatedBatteryConsumed}%</strong>
            </div>

            <button
              id="reset-prescription-btn"
              type="button"
              onClick={onResetPrescription}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors font-medium"
              title="Reset all plot positions and prescription matrix to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.resetPlotsToInitialBtn || 'Reset Plots to Initial Position'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Swarm Dispatch Bar & NFZ Safety Interlock Banner */}
      <div className="sticky bottom-0 z-20 -mx-1 px-2 pt-2.5 pb-1 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 shadow-[0_-8px_20px_rgba(0,0,0,0.6)] space-y-2 rounded-b-xl">
        {/* NFZ Safety Interlock Banner */}
        {hasNfzConflict && (
          <div
            id="banner-nfz-blocked-interlock"
            className="bg-red-950/95 border-2 border-red-500 rounded-xl p-3 flex items-start sm:items-center gap-3 text-red-200 shadow-2xl animate-pulse"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-bold text-red-300 tracking-wide uppercase">
                CANNOT DISPATCH: Selected plot area intersects No-Fly Zone (NFZ). Drag plot or NFZ to clear airspace.
              </div>
              <p className="text-[11px] text-red-200/90 font-medium">
                Autonomous flight safety interlock active. Plot polygon must be dragged completely outside the residential buffer zone before swarm launch.
              </p>
            </div>
          </div>
        )}

        {/* 3. Launch Multi-Payload Swarm Task & Mission Performance Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {onAcceptSaveMission && (
            <div className="md:col-span-4 lg:col-span-4">
              <button
                id="accept-save-mission-bottom-btn"
                type="button"
                onClick={onAcceptSaveMission}
                className="w-full h-full min-h-[50px] py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-300 active:scale-[0.99] transition-all"
                title="Lock current mission configuration, save to browser storage, and generate Google Doc / audit report"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950 font-black shrink-0" />
                <span className="font-extrabold">Accept &amp; Save Mission</span>
              </button>
            </div>
          )}

          <div className={onAcceptSaveMission ? 'md:col-span-8 lg:col-span-8' : 'w-full'}>
            <button
              id="dispatch-swarm-simultaneously-btn"
              type="button"
              onClick={onDispatchSwarm}
              disabled={swarmState.isSwarmActive || hasNfzConflict || totalDronesCount === 0}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all shadow-xl ${
                hasNfzConflict
                  ? 'bg-red-950/80 text-red-300 border-2 border-red-500/80 cursor-not-allowed shadow-red-950/40'
                  : totalDronesCount === 0
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : swarmState.isSwarmActive
                  ? 'bg-amber-600/90 text-white cursor-not-allowed shadow-amber-900/30 ring-2 ring-amber-400'
                  : 'bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:via-teal-500 hover:to-emerald-500 text-white shadow-cyan-950/60 hover:shadow-cyan-900/70 active:scale-[0.99]'
              }`}
            >
              <Plane className={`w-5 h-5 ${swarmState.isSwarmActive ? 'animate-spin' : ''}`} />
              {hasNfzConflict ? (
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Launch Blocked: Plot Intersects Restricted Airspace (NFZ)</span>
                </span>
              ) : totalDronesCount === 0 ? (
                <span>Cannot Dispatch: All Sectors Skipped (Enable at least 1 sector)</span>
              ) : swarmState.isSwarmActive ? (
                <span>
                  {swarmState.status === 'RETURNING_HOME'
                    ? `🚁 Coordinated Swarm Auto-RTH: All ${swarmState.drones?.length || 6} Drones Returning to Dock...`
                    : `🚀 Multi-Payload Swarm Active: ${swarmState.drones?.length || 6} Parallel Drones Spraying (${pestPlotCount} Pesticide, ${waterPlotCount} Water, ${nitrogenPlotCount} Nitrogen)...`}
                </span>
              ) : (
                <span>
                  Launch Multi-Payload Swarm Task ({totalDronesCount} Active Drones
                  {skippedDronesCount > 0 ? `, ${skippedDronesCount} Skipped` : ''})
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
