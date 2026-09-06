import React, { useState } from 'react';
import {
  Radio,
  Sliders,
  ShieldAlert,
  Zap,
  BatteryCharging,
  Satellite,
  Gauge,
  Power,
  RotateCcw,
  CheckCircle,
  AlertOctagon,
  Sparkles,
  RefreshCw,
  Droplet,
  Plane,
  Tractor,
  WifiOff,
  Play,
  CloudSun,
  Timer,
  CheckSquare,
  Square,
  Wind,
  CloudRain,
  Thermometer,
} from 'lucide-react';
import {
  HardwareState,
  SupportedLanguage,
  TelemetryData,
  BreakpointMemory,
  FleetUnit,
  FleetUnitId,
  SwarmMissionState,
  SubZonePolygonData,
  SwarmDroneFlight,
} from '../types';
import { translations, getLocalizedStatus } from '../i18n/translations';
import { HardwareModal } from './HardwareModal';

interface HardwareFleetPanelProps {
  language: SupportedLanguage;
  hardwareState: HardwareState;
  onUpdateHardwareState: (state: Partial<HardwareState>) => void;
  telemetry: TelemetryData;
  activeUnit: FleetUnit;
  onSelectFleetUnit: (id: FleetUnitId) => void;
  onEmergencyRTH: () => void;
  isRTHActive: boolean;
  breakpoint: BreakpointMemory | null;
  isAutoResuming: boolean;
  failSafeNotification: string | null;
  isGroundLocked?: boolean;
  isNetworkLossHold?: boolean;
  isManualEmergencyHold?: boolean;
  onResumeMission?: () => void;
  autoResumeWeatherEnabled?: boolean;
  onToggleAutoResumeWeather?: () => void;
  autoResumeCountdown?: number | null;
  onCancelAutoResumeCountdown?: () => void;
  isFlightActive?: boolean;
  swarmState?: SwarmMissionState;
  subZones?: SubZonePolygonData[];
}

export const HardwareFleetPanel: React.FC<HardwareFleetPanelProps> = ({
  language,
  hardwareState,
  onUpdateHardwareState,
  telemetry,
  activeUnit,
  onSelectFleetUnit,
  onEmergencyRTH,
  isRTHActive,
  breakpoint,
  isAutoResuming,
  failSafeNotification,
  isGroundLocked = false,
  isNetworkLossHold = false,
  isManualEmergencyHold = false,
  onResumeMission,
  autoResumeWeatherEnabled = true,
  onToggleAutoResumeWeather,
  autoResumeCountdown = null,
  onCancelAutoResumeCountdown,
  isFlightActive = false,
  swarmState,
  subZones,
}) => {
  const t = translations[language];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'swarm'>('swarm');

  const handleProtocolConnected = (protocol: any, deviceName: string) => {
    onUpdateHardwareState({
      isConnected: true,
      protocol,
      deviceModel: deviceName,
      isLiveHardware: true,
      rssiPercent: 96,
      voltage: 52.8,
      rtkStatus: 'RTK_FIX_CENTIMETER',
      satellites: 32,
    });
  };

  const toggleHardwareMode = () => {
    const nextMode = !hardwareState.isLiveHardware;
    onUpdateHardwareState({
      isLiveHardware: nextMode,
      isConnected: nextMode,
      rssiPercent: nextMode ? 94 : 0,
      voltage: nextMode ? 52.2 : 0,
      rtkStatus: nextMode ? 'RTK_FIX_CENTIMETER' : '3D_FIX',
    });
  };

  const swarmDrones: SwarmDroneFlight[] = swarmState?.drones && swarmState.drones.length > 0
    ? swarmState.drones
    : [
        {
          id: 'drone_alpha_01',
          codeName: 'Alpha-01',
          name: 'Alpha-01 (DJI T40)',
          model: 'DJI Agras T40',
          role: 'Bio-Pesticide Sprayer',
          taskType: 'PESTICIDE',
          chemicalType: 'bio_pesticide',
          color: '#f43f5e',
          swathColor: '#fda4af',
          targetSectorId: 'sector_n1',
          targetSectorIndex: 1,
          targetSectorName: 'Sector N-1 (North-West)',
          coords: { lat: 10.7769, lng: 106.7009 },
          battery: 88,
          tankLevel: 36.5,
          maxTank: 40.0,
          unitRateLabel: '20 L/ha Pesticide',
          unitConsumed: 8.4,
          dosageRate: 20,
          sprayTrail: [],
          status: 'IDLE',
          progress: 0,
          altitudeMeters: 3.5,
          microclimate: { temp: 29.5, windSpeed: 6.2, precipitation: 0.0 },
        },
        {
          id: 'drone_alpha_02',
          codeName: 'Alpha-02',
          name: 'Alpha-02 (DJI T40)',
          model: 'DJI Agras T40',
          role: 'Bio-Pesticide Sprayer',
          taskType: 'PESTICIDE',
          chemicalType: 'bio_pesticide',
          color: '#f43f5e',
          swathColor: '#fda4af',
          targetSectorId: 'sector_n2',
          targetSectorIndex: 2,
          targetSectorName: 'Sector N-2 (North-East)',
          coords: { lat: 10.7769, lng: 106.7009 },
          battery: 92,
          tankLevel: 38.0,
          maxTank: 40.0,
          unitRateLabel: '20 L/ha Pesticide',
          unitConsumed: 8.4,
          dosageRate: 20,
          sprayTrail: [],
          status: 'IDLE',
          progress: 0,
          altitudeMeters: 3.5,
          microclimate: { temp: 29.6, windSpeed: 6.8, precipitation: 0.0 },
        },
        {
          id: 'drone_beta_01',
          codeName: 'Beta-01',
          name: 'Beta-01 (DJI T40)',
          model: 'DJI Agras T40',
          role: 'Water Mist Hydrator',
          taskType: 'WATER',
          chemicalType: 'water_mist',
          color: '#06b6d4',
          swathColor: '#67e8f9',
          targetSectorId: 'sector_c1',
          targetSectorIndex: 3,
          targetSectorName: 'Sector C-1 (Central-West)',
          coords: { lat: 10.7769, lng: 106.7009 },
          battery: 95,
          tankLevel: 40.0,
          maxTank: 40.0,
          unitRateLabel: '15 L/ha Water',
          unitConsumed: 6.3,
          dosageRate: 15,
          sprayTrail: [],
          status: 'IDLE',
          progress: 0,
          altitudeMeters: 3.5,
          microclimate: { temp: 29.4, windSpeed: 7.1, precipitation: 0.0 },
        },
        {
          id: 'drone_beta_02',
          codeName: 'Beta-02',
          name: 'Beta-02 (DJI T40)',
          model: 'DJI Agras T40',
          role: 'Water Mist Hydrator',
          taskType: 'WATER',
          chemicalType: 'water_mist',
          color: '#06b6d4',
          swathColor: '#67e8f9',
          targetSectorId: 'sector_c2',
          targetSectorIndex: 4,
          targetSectorName: 'Sector C-2 (Central-East)',
          coords: { lat: 10.7769, lng: 106.7009 },
          battery: 91,
          tankLevel: 39.2,
          maxTank: 40.0,
          unitRateLabel: '15 L/ha Water',
          unitConsumed: 6.3,
          dosageRate: 15,
          sprayTrail: [],
          status: 'IDLE',
          progress: 0,
          altitudeMeters: 3.5,
          microclimate: { temp: 29.5, windSpeed: 6.5, precipitation: 0.0 },
        },
        {
          id: 'drone_gamma_01',
          codeName: 'Gamma-01',
          name: 'Gamma-01 (DJI T40)',
          model: 'DJI Agras T40',
          role: 'Nitrogen Fertilizer Dispenser',
          taskType: 'NITROGEN',
          chemicalType: 'nitrogen_fertilizer',
          color: '#f59e0b',
          swathColor: '#fcd34d',
          targetSectorId: 'sector_s1',
          targetSectorIndex: 5,
          targetSectorName: 'Sector S-1 (South-West)',
          coords: { lat: 10.7769, lng: 106.7009 },
          battery: 89,
          tankLevel: 37.8,
          maxTank: 40.0,
          unitRateLabel: '12 L/ha Nitrogen',
          unitConsumed: 5.0,
          dosageRate: 12,
          sprayTrail: [],
          status: 'IDLE',
          progress: 0,
          altitudeMeters: 3.5,
          microclimate: { temp: 29.7, windSpeed: 7.4, precipitation: 0.0 },
        },
        {
          id: 'drone_gamma_02',
          codeName: 'Gamma-02',
          name: 'Gamma-02 (DJI T40)',
          model: 'DJI Agras T40',
          role: 'Nitrogen Fertilizer Dispenser',
          taskType: 'NITROGEN',
          chemicalType: 'nitrogen_fertilizer',
          color: '#f59e0b',
          swathColor: '#fcd34d',
          targetSectorId: 'sector_s2',
          targetSectorIndex: 6,
          targetSectorName: 'Sector S-2 (South-East)',
          coords: { lat: 10.7769, lng: 106.7009 },
          battery: 94,
          tankLevel: 40.0,
          maxTank: 40.0,
          unitRateLabel: '12 L/ha Nitrogen',
          unitConsumed: 5.0,
          dosageRate: 12,
          sprayTrail: [],
          status: 'IDLE',
          progress: 0,
          altitudeMeters: 3.5,
          microclimate: { temp: 29.5, windSpeed: 6.9, precipitation: 0.0 },
        },
      ];

  return (
    <div
      id="agritwin_hardware_module"
      className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col justify-between gap-4"
    >
      {/* 1. Multi-Fleet Unit Selector Tabs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            {t.fleetUnitSelector}
          </span>
          <span
            className={`text-[10px] font-mono border px-2 py-0.5 rounded-full ${
              isManualEmergencyHold
                ? 'text-rose-300 bg-rose-950/90 border-rose-500 animate-pulse font-bold'
                : isNetworkLossHold
                ? 'text-amber-300 bg-amber-950/90 border-amber-500 animate-pulse font-bold'
                : isGroundLocked
                ? 'text-amber-300 bg-amber-950/90 border-amber-600 animate-pulse font-bold'
                : 'text-emerald-400 bg-emerald-950/80 border-emerald-800'
            }`}
          >
            {isManualEmergencyHold
              ? (t.manualHoldBadge || 'MANUAL EMERGENCY HOLD')
              : isNetworkLossHold
              ? (t.networkLossHold || 'NETWORK LOSS HOLD')
              : isGroundLocked
              ? (t.groundLockedWeather || 'GROUND LOCKED (WEATHER)')
              : getLocalizedStatus(activeUnit.status, language)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            id="tab_drone_alpha"
            onClick={() => onSelectFleetUnit('drone_alpha')}
            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeUnit.id === 'drone_alpha'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Plane className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t.droneAlphaName || 'Drone Alpha (T40)'}</span>
          </button>

          <button
            id="tab_drone_beta"
            onClick={() => onSelectFleetUnit('drone_beta')}
            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeUnit.id === 'drone_beta'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Plane className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t.droneBetaName || 'Drone Beta (T40)'}</span>
          </button>

          <button
            id="tab_drone_gamma"
            onClick={() => onSelectFleetUnit('drone_gamma')}
            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeUnit.id === 'drone_gamma'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Plane className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t.droneGammaName || 'Drone Gamma (T40)'}</span>
          </button>

          <button
            id="tab_tractor_yanmar"
            onClick={() => onSelectFleetUnit('tractor_yanmar')}
            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeUnit.id === 'tractor_yanmar'
                ? 'bg-gradient-to-r from-orange-600 to-amber-700 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Tractor className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t.tractorName || 'Yanmar YK1200'}</span>
          </button>
        </div>
      </div>

      {/* 2. Fail-Safe Alert Banners (Battery <= 20%, Tank = 0L, Signal Drop, Weather Emergency, Ground Lock, Mission Accomplished) */}
      {failSafeNotification && (
        <div
          id="alert_failsafe_rth"
          className={`p-3.5 rounded-xl border flex items-start gap-3 shadow-2xl ${
            failSafeNotification.includes('MISSION ACCOMPLISHED') ||
            failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
            failSafeNotification.includes('MISIÓN CUMPLIDA') ||
            failSafeNotification.includes('MISSION ACCOMPLIE') ||
            failSafeNotification.includes('作业任务圆满完成') ||
            failSafeNotification.includes('MISSÃO CONCLUÍDA') ||
            failSafeNotification.includes('CLEARANCE') ||
            failSafeNotification.includes('BREAKPOINT REACHED') ||
            failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
            failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
            failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
            failSafeNotification.includes('已抵达断点坐标')
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
              : failSafeNotification.includes('GROUNDED') || failSafeNotification.includes('Awaiting')
              ? 'bg-amber-950/90 border-amber-500 text-amber-100'
              : 'bg-red-950/90 border-red-500 text-red-100 animate-pulse'
          }`}
        >
          <AlertOctagon
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              failSafeNotification.includes('MISSION ACCOMPLISHED') ||
              failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
              failSafeNotification.includes('MISIÓN CUMPLIDA') ||
              failSafeNotification.includes('MISSION ACCOMPLIE') ||
              failSafeNotification.includes('作业任务圆满完成') ||
              failSafeNotification.includes('MISSÃO CONCLUÍDA') ||
              failSafeNotification.includes('CLEARANCE') ||
              failSafeNotification.includes('BREAKPOINT REACHED') ||
              failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
              failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
              failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
              failSafeNotification.includes('已抵达断点坐标')
                ? 'text-emerald-400'
                : failSafeNotification.includes('GROUNDED') || failSafeNotification.includes('Awaiting')
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          />
          <div className="flex-1 text-xs">
            <span
              className={`font-bold uppercase tracking-wide block mb-0.5 ${
                failSafeNotification.includes('MISSION ACCOMPLISHED') ||
                failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
                failSafeNotification.includes('MISIÓN CUMPLIDA') ||
                failSafeNotification.includes('MISSION ACCOMPLIE') ||
                failSafeNotification.includes('作业任务圆满完成') ||
                failSafeNotification.includes('MISSÃO CONCLUÍDA')
                  ? 'text-emerald-300'
                  : failSafeNotification.includes('CLEARANCE')
                  ? 'text-emerald-300'
                  : failSafeNotification.includes('BREAKPOINT REACHED') ||
                    failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
                    failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
                    failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
                    failSafeNotification.includes('已抵达断点坐标')
                  ? 'text-emerald-300'
                  : failSafeNotification.includes('GROUNDED') || failSafeNotification.includes('Awaiting')
                  ? 'text-amber-300'
                  : 'text-red-200'
              }`}
            >
              {failSafeNotification.includes('MISSION ACCOMPLISHED') ||
              failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
              failSafeNotification.includes('MISIÓN CUMPLIDA') ||
              failSafeNotification.includes('MISSION ACCOMPLIE') ||
              failSafeNotification.includes('作业任务圆满完成') ||
              failSafeNotification.includes('MISSÃO CONCLUÍDA')
                ? 'Mission Accomplished • 100% Coverage Complete'
                : failSafeNotification.includes('CLEARANCE')
                ? 'Weather Clearance Verified'
                : failSafeNotification.includes('BREAKPOINT REACHED') ||
                  failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
                  failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
                  failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
                  failSafeNotification.includes('已抵达断点坐标')
                ? 'Waypoint Reached • Mission Resumed'
                : isGroundLocked
                ? 'Post-Landing Ground Lock Active'
                : 'Automated Safety Protocol Active'}
            </span>
            <p className="leading-relaxed">{failSafeNotification}</p>
          </div>
        </div>
      )}

      {breakpoint && !isRTHActive && !failSafeNotification && (
        <div
          id="alert_breakpoint_saved"
          className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-200 flex items-center justify-between gap-2 text-xs shadow-md"
        >
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Saved Breakpoint: Lat {breakpoint.coordinates.lat.toFixed(4)}, Lng{' '}
              {breakpoint.coordinates.lng.toFixed(4)} ({breakpoint.progressPercent.toFixed(0)}%
              progress)
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-900/90 border border-amber-700 text-[10px] font-mono font-bold text-amber-300 whitespace-nowrap">
            {isManualEmergencyHold ? 'MANUAL HOLD' : 'AUTO-RESUME ARMED'}
          </span>
        </div>
      )}

      {/* 3. Manual Emergency Standby & Weather Auto-Resume Sentinel Module */}
      {isManualEmergencyHold && (
        <div
          id="manual_emergency_hold_section"
          className="bg-slate-950/90 border border-rose-500/60 rounded-xl p-3.5 flex flex-col gap-3 shadow-inner ring-1 ring-rose-500/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                {t.manualHoldBadge || 'MANUAL EMERGENCY HOLD'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300">
              SAFE AT DOCK
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            {t.manualEmergencyStandby ||
              'Drone safely grounded at Home Dock. Waiting for manual resume command or weather auto-sentinel.'}
          </p>

          {/* Smart Weather Detection Toggle & Countdown Sensor */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={onToggleAutoResumeWeather}
            >
              <div className="flex items-center gap-2">
                <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-slate-200">
                  {t.autoResumeWeatherToggle || 'Auto-Resume When Weather Safe'}
                </span>
              </div>
              <button
                type="button"
                className="text-emerald-400 focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAutoResumeWeather?.();
                }}
              >
                {autoResumeWeatherEnabled ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </button>
            </div>

            {/* Weather status readout */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
              <span>
                Wind:{' '}
                <strong className={telemetry.windSpeed > 18 ? 'text-rose-400' : 'text-emerald-400'}>
                  {telemetry.windSpeed.toFixed(1)} km/h
                </strong>{' '}
                (Max: 18)
              </span>
              <span>
                Rain:{' '}
                <strong className={telemetry.precipitation > 5 ? 'text-rose-400' : 'text-emerald-400'}>
                  {telemetry.precipitation.toFixed(1)} mm/h
                </strong>{' '}
                (Max: 5)
              </span>
            </div>

            {/* Weather Auto-Resume Countdown Indicator */}
            {autoResumeWeatherEnabled && autoResumeCountdown !== null && autoResumeCountdown !== undefined && (
              <div className="mt-1 p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 text-xs flex flex-col gap-1.5 animate-pulse">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Timer className="w-3.5 h-3.5 text-emerald-400" />
                    {t.autoResumeWeatherCountdown
                      ? t.autoResumeWeatherCountdown.replace('{seconds}', autoResumeCountdown.toString())
                      : `Safe weather detected! Auto-resuming flight in ${autoResumeCountdown}s`}
                  </span>
                  <span className="font-mono font-bold text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-600">
                    {autoResumeCountdown}s
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-emerald-950 rounded-full h-1.5 overflow-hidden border border-emerald-800">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(autoResumeCountdown / 10) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onCancelAutoResumeCountdown}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700 font-semibold transition-all"
                  >
                    {t.cancelAutoResumeBtn || 'Cancel Auto'}
                  </button>
                  <button
                    type="button"
                    onClick={onResumeMission}
                    className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] text-slate-950 font-bold shadow-md transition-all active:scale-95"
                  >
                    {t.runNowBtn || 'Run Now'}
                  </button>
                </div>
              </div>
            )}

            {(telemetry.windSpeed > 18 || telemetry.precipitation > 5) && (
              <div className="p-1.5 rounded bg-amber-950/60 border border-amber-600/50 text-[10px] text-amber-300 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Weather unsafe (Wind &gt; 18 km/h or Rain &gt; 5 mm/h). Aircraft remains safely parked at dock.</span>
              </div>
            )}
          </div>

          {/* Large prominent RUN AGAIN button */}
          <button
            id="btn_run_again_from_hold"
            onClick={onResumeMission}
            className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50 transition-all active:scale-98 animate-pulse"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{t.resumeMissionBtn || 'RESUME MISSION (RUN AGAIN FROM BREAKPOINT)'}</span>
          </button>
        </div>
      )}

      {/* 3. Hardware Mode Switch & Connect Hardware Modal Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {t.hardwareModeToggle}
            </h4>
            <span className="text-[11px] text-slate-400">
              {hardwareState.isLiveHardware ? t.liveHardwareMode : t.simulationMode}
            </span>
          </div>
        </div>

        {/* Toggle Mode & Connect Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn_toggle_hardware_mode"
            onClick={toggleHardwareMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 border ${
              hardwareState.isLiveHardware
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
            }`}
          >
            {hardwareState.isLiveHardware ? 'SWITCH TO SIM' : 'GO LIVE HARDWARE'}
          </button>

          <button
            id="btn_open_hardware_modal"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.connectHardwareBtn}</span>
          </button>
        </div>
      </div>

      {/* 4. Real-Time Hardware Status Indicators (Single Unit or 6-Drone Independent Fleet Swarm Grid) */}
      <div className="space-y-3">
        {/* Toggle between Single Unit Hardware & 6-Drone Fleet Telemetry Monitor */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Independent Fleet Telemetry Monitor (6 Aircraft)</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('swarm')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                activeTab === 'swarm'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6-Drone Swarm Grid
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                activeTab === 'single'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Unit Detail
            </button>
          </div>
        </div>

        {activeTab === 'single' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
            {/* Signal Strength RSSI */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-cyan-400" />
                {t.signalStrength}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-sm font-mono font-bold ${
                    hardwareState.rssiPercent === 0
                      ? 'text-red-400'
                      : 'text-cyan-300'
                  }`}
                >
                  {hardwareState.rssiPercent}%
                </span>
                <span className="text-[10px] text-slate-400">
                  {hardwareState.rssiPercent === 0 ? 'NO SIGNAL' : '-54 dBm'}
                </span>
              </div>
            </div>

            {/* Hardware Voltage */}
            <div className="flex flex-col sm:border-l sm:border-slate-800 sm:pl-2.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-amber-400" />
                {t.batteryVoltage}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-sm font-mono font-bold ${
                    telemetry.battery <= 15
                      ? 'text-red-400'
                      : telemetry.battery < 45
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {(44.0 + (telemetry.battery / 100) * 8.4).toFixed(1)}V
                </span>
                <span className="text-[10px] text-slate-400">14S Lipo</span>
              </div>
            </div>

            {/* Chemical Tank Level */}
            <div className="flex flex-col sm:border-l sm:border-slate-800 sm:pl-2.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Droplet className="w-3 h-3 text-teal-400" />
                {t.tankVolume}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-sm font-mono font-bold ${
                    telemetry.tankLevel === 0
                      ? 'text-red-400'
                      : telemetry.tankLevel < 10
                      ? 'text-amber-400'
                      : 'text-teal-300'
                  }`}
                >
                  {telemetry.tankLevel.toFixed(1)} L
                </span>
                <span className="text-[10px] text-slate-400">/ {activeUnit.maxTankCapacity}L</span>
              </div>
            </div>

            {/* GNSS RTK Lock */}
            <div className="flex flex-col sm:border-l sm:border-slate-800 sm:pl-2.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Satellite className="w-3 h-3 text-emerald-400" />
                {t.gpsLock}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs font-mono font-bold text-emerald-400 truncate">
                  {t.rtkCentimeter}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* 6-Drone Independent Swarm Telemetry & Fail-Safe Sentinel Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {swarmDrones.map((drone, dIdx) => {
              const matchedZone = subZones?.find((z) => z.id === drone.targetSectorId);
              const isSkipped = drone.status === 'STANDBY / SECTOR_SKIPPED' || matchedZone?.enabled === false;
              const batteryLow = drone.battery <= 15;
              const tankEmpty = drone.tankLevel <= 0;
              const windHazard = (drone.microclimate?.windSpeed ?? telemetry.windSpeed) >= 15;
              const rainHazard = (drone.microclimate?.precipitation ?? telemetry.precipitation) >= 1.0;

              return (
                <div
                  key={drone.id || dIdx}
                  id={`telemetry-card-${drone.id}`}
                  className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                    isSkipped
                      ? 'bg-slate-950/60 border-slate-800/80 opacity-70'
                      : batteryLow || tankEmpty || windHazard || rainHazard
                      ? 'bg-slate-950 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Header: Name & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Plane
                        className={`w-3.5 h-3.5 ${
                          isSkipped
                            ? 'text-slate-500'
                            : drone.chemicalType === 'bio_pesticide'
                            ? 'text-rose-400'
                            : drone.chemicalType === 'water_mist'
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-white tracking-tight">
                        {drone.name || `Unit #${dIdx + 1}`}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSkipped
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : drone.status === 'SPRAYING'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 animate-pulse'
                          : drone.status === 'RETURNING_HOME'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500 animate-pulse'
                          : drone.status === 'WEATHER_WAIT'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                          : 'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isSkipped ? 'STANDBY / SKIPPED' : drone.status || 'IDLE'}
                    </span>
                  </div>

                  {/* Target Sector Info */}
                  <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono pt-1 border-t border-slate-800/80">
                    <span className="truncate max-w-[130px]" title={drone.targetSectorName}>
                      {drone.targetSectorName || `Sector #${dIdx + 1}`}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {matchedZone?.areaHa ? `${matchedZone.areaHa.toFixed(2)} ha` : '0.42 ha'}
                    </span>
                  </div>

                  {/* Battery & Tank Gauges */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                    {/* Battery */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <BatteryCharging className="w-3 h-3 text-amber-400" />
                          <span>Battery:</span>
                        </span>
                        <span
                          className={`font-bold ${
                            drone.battery <= 15
                              ? 'text-rose-400 animate-pulse'
                              : drone.battery < 45
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {drone.battery.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1 mt-0.5 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            drone.battery <= 15
                              ? 'bg-rose-500'
                              : drone.battery < 45
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, drone.battery))}%` }}
                        />
                      </div>
                    </div>

                    {/* Liquid Tank */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Droplet className="w-3 h-3 text-teal-400" />
                          <span>Tank:</span>
                        </span>
                        <span
                          className={`font-bold ${
                            drone.tankLevel <= 0
                              ? 'text-rose-400 animate-pulse'
                              : drone.tankLevel < 10
                              ? 'text-amber-400'
                              : 'text-teal-300'
                          }`}
                        >
                          {drone.tankLevel.toFixed(1)} / {drone.maxTank.toFixed(0)} L
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1 mt-0.5 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            drone.tankLevel <= 0
                              ? 'bg-rose-500'
                              : drone.tankLevel < 10
                              ? 'bg-amber-500'
                              : 'bg-teal-400'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, (drone.tankLevel / drone.maxTank) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Microclimate Readout */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-0.5">
                      <Wind className="w-2.5 h-2.5 text-cyan-400" />
                      <strong className={windHazard ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {(drone.microclimate?.windSpeed ?? telemetry.windSpeed).toFixed(1)}k
                      </strong>
                    </span>
                    <span className="flex items-center gap-0.5">
                      <CloudRain className="w-2.5 h-2.5 text-blue-400" />
                      <strong className={rainHazard ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {(drone.microclimate?.precipitation ?? telemetry.precipitation).toFixed(1)}m
                      </strong>
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Thermometer className="w-2.5 h-2.5 text-amber-400" />
                      <strong className="text-slate-300">
                        {(drone.microclimate?.temp ?? telemetry.temp).toFixed(0)}°C
                      </strong>
                    </span>
                  </div>

                  {/* Fail-Safe Trigger Badge if any interlock is active */}
                  {(batteryLow || tankEmpty || windHazard || rainHazard) && !isSkipped && (
                    <div className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-600/80 text-[8px] font-mono font-bold text-rose-300 flex items-center justify-between">
                      <span>FAIL-SAFE INTERLOCK:</span>
                      <span>
                        {batteryLow ? '15% BATTERY' : tankEmpty ? 'EMPTY TANK' : 'WEATHER INTERLOCK'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Safety Controls: Emergency Abort / Return-to-Home (RTH) Button */}
      {!isManualEmergencyHold && (
        <button
          id="btn_emergency_rth"
          onClick={onEmergencyRTH}
          className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-98 ${
            isRTHActive
              ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-500/50'
              : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-900/30'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{isRTHActive ? t.rthInitiated : t.emergencyRthBtn}</span>
        </button>
      )}

      {/* Hardware Connection Modal */}
      <HardwareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        language={language}
        onConnect={handleProtocolConnected}
      />
    </div>
  );
};
