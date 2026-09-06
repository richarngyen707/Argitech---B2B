import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { MapCanvas } from './components/MapCanvas';
import { HardwareFleetPanel } from './components/HardwareFleetPanel';
import { AIAdvisoryPanel } from './components/AIAdvisoryPanel';
import { AuditTrailLog } from './components/AuditTrailLog';
import { MissionPerformanceReportModal } from './components/MissionPerformanceReportModal';
import { OpenSavedMissionModal } from './components/OpenSavedMissionModal';
import {
  SupportedLanguage,
  TelemetryData,
  Coordinates,
  HardwareState,
  AIAdvisoryReport,
  AuditLogEntry,
  MachineryType,
  MissionType,
  SimulationState,
  BreakpointMemory,
  FleetUnit,
  FleetUnitId,
  FailSafeReason,
  ZoneHealthType,
  SubZonePolygonData,
  SwarmMissionState,
  SwarmDroneFlight,
  UserCustomizedPlotsStore,
  generateFieldSubZones,
  calculatePrescriptionTotals,
  generateSwarmDualPaths,
  generateSwarmTriPaths,
  generateDynamicPlotSwarmPlan,
  generateSubZoneGridPath,
  generateFlightPathWaypoints,
  interpolateFlightPath,
  getNfzRestrictedZone,
  calculatePolygonCenter,
  isPolygonOverlappingPolygon,
  subZonesToCustomizedPlotsStore,
  applyCustomizedPlotsToSubZones,
} from './types';
import { translations } from './i18n/translations';
import { fetchOpenMeteoWeather } from './services/weatherService';
import {
  getCachedAuditLogs,
  addAuditLog,
  syncOfflineLogsToOnline,
  getCachedLanguage,
  setCachedLanguage,
  getCachedBreakpoint,
  setCachedBreakpoint,
  saveActiveMissionLayout,
  getSavedMissionLayout,
  clearSavedMissionLayout,
  AgriTwinSavedMissionState,
} from './services/storageService';
import {
  MissionPerformanceReportData,
  buildMissionReportData,
} from './services/missionReportService';
import { exportVietGapPdf } from './services/pdfService';
import { playVoiceAlert } from './services/voiceAlertService';
import {
  WEATHER_SAFETY_LIMITS,
  CRITICAL_WEATHER_HAZARD_BANNER,
  WEATHER_ABORT_VOICE_ALERT,
  WEATHER_TAKEOFF_BLOCKED_VOICE_ALERT,
  evaluateWeatherSafety,
  isWeatherHazardous,
} from './services/weatherSafetyService';

// Default initial location: Cần Thơ, Vietnam (Mekong Delta Rice Granary)
const DEFAULT_COORDS: Coordinates = {
  lat: 10.005,
  lng: 105.722,
};
const DEFAULT_LOCATION_NAME = 'Cần Thơ Rice Matrix, Mekong Delta, Vietnam';

const FLEET_UNITS: Record<FleetUnitId, FleetUnit> = {
  drone_alpha: {
    id: 'drone_alpha',
    name: 'DJI Agras T40 Sprayer Drone',
    model: 'Agras T40 Quad-Rotor RTK',
    machineryType: 'DJI Agras T40 Sprayer Drone',
    battery: 88,
    tankLevel: 40.0,
    maxTankCapacity: 40,
    rssiPercent: 96,
    voltage: 52.8,
    rtkStatus: 'RTK_FIX_CENTIMETER',
    satellites: 32,
    status: 'ACTIVE',
    category: 'drone',
  },
  drone_beta: {
    id: 'drone_beta',
    name: 'DJI Agras T40 Sprayer Drone',
    model: 'Agras T40 Quad-Rotor RTK',
    machineryType: 'DJI Agras T40 Sprayer Drone',
    battery: 94,
    tankLevel: 40.0,
    maxTankCapacity: 40,
    rssiPercent: 92,
    voltage: 53.1,
    rtkStatus: 'RTK_FIX_CENTIMETER',
    satellites: 29,
    status: 'IDLE',
    category: 'drone',
  },
  drone_gamma: {
    id: 'drone_gamma',
    name: 'DJI Agras T40 Sprayer Drone',
    model: 'Agras T40 Quad-Rotor RTK',
    machineryType: 'DJI Agras T40 Sprayer Drone',
    battery: 92,
    tankLevel: 40.0,
    maxTankCapacity: 40,
    rssiPercent: 94,
    voltage: 53.0,
    rtkStatus: 'RTK_FIX_CENTIMETER',
    satellites: 31,
    status: 'IDLE',
    category: 'drone',
  },
  tractor_yanmar: {
    id: 'tractor_yanmar',
    name: 'Yanmar YK1200 Autonomous Tractor',
    model: 'YK1200 Auto-Steer RTK Diesel',
    machineryType: 'Yanmar YK1200 Autonomous Tractor',
    battery: 75,
    tankLevel: 95.0,
    maxTankCapacity: 120,
    rssiPercent: 88,
    voltage: 48.5,
    rtkStatus: 'RTK_FIX_CENTIMETER',
    satellites: 26,
    status: 'ACTIVE',
    category: 'tractor',
  },
};

export default function App() {
  // 1. Language State
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    const cached = getCachedLanguage();
    if (cached && ['en', 'vi', 'es', 'fr', 'zh', 'pt'].includes(cached)) {
      return cached as SupportedLanguage;
    }
    return 'en';
  });

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    setCachedLanguage(newLang);
  };

  // 2. Connectivity State & Offline Fault-Tolerance
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  // 3. Location & Microclimate Telemetry State
  const [currentCoords, setCurrentCoords] = useState<Coordinates>(() => {
    const saved = getSavedMissionLayout();
    if (saved?.currentCoords?.lat && saved?.currentCoords?.lng) {
      return saved.currentCoords;
    }
    return DEFAULT_COORDS;
  });
  const [locationName, setLocationName] = useState<string>(() => {
    const saved = getSavedMissionLayout();
    if (saved?.locationName) {
      return saved.locationName;
    }
    return DEFAULT_LOCATION_NAME;
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [fieldArea, setFieldArea] = useState<number>(() => {
    const saved = getSavedMissionLayout();
    if (saved && typeof saved.fieldArea === 'number' && saved.fieldArea > 0) {
      return saved.fieldArea;
    }
    return 2.5; // Target Field Area in hectares (0.5 - 20.0 ha)
  });

  // 4. Fleet Selection & Machine Configuration
  const [fleetUnits, setFleetUnits] = useState<Record<FleetUnitId, FleetUnit>>(FLEET_UNITS);
  const [activeUnitId, setActiveUnitId] = useState<FleetUnitId>('drone_alpha');
  const activeUnit = fleetUnits[activeUnitId];
  const [machineryType, setMachineryType] = useState<MachineryType>(
    'DJI Agras T40 Sprayer Drone'
  );
  const [missionType, setMissionType] = useState<MissionType>('Precision Bio-Spraying');

  // 5. Telemetry with Wind, Rain, Battery, Tank Volume & Cumulative Working Hours
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    temp: 28.5,
    windSpeed: 11.2,
    precipitation: 0.0,
    humidity: 78,
    battery: 88,
    tankLevel: 36.5,
    workingHours: 14.5,
  });

  // Switch fleet unit handler
  const handleSelectFleetUnit = (id: FleetUnitId) => {
    setActiveUnitId(id);
    const unit = fleetUnits[id];
    setMachineryType(unit.machineryType);
    setTelemetry((prev) => ({
      ...prev,
      battery: unit.battery,
      tankLevel: unit.tankLevel,
    }));
  };

  // 6. Hardware State
  const [hardwareState, setHardwareState] = useState<HardwareState>({
    isLiveHardware: false,
    isConnected: false,
    protocol: 'DJI_CLOUD',
    deviceModel: 'Simulated Autonomous Gateway',
    rssiPercent: 95,
    voltage: 52.4,
    rtkStatus: 'RTK_FIX_CENTIMETER',
    satellites: 28,
  });
  const hardwareStateRef = useRef(hardwareState);
  hardwareStateRef.current = hardwareState;

  // 7. Breakpoint Memory & Safety State
  const [breakpoint, setBreakpoint] = useState<BreakpointMemory | null>(() => getCachedBreakpoint());
  const [failSafeNotification, setFailSafeNotification] = useState<string | null>(null);

  // 8. Simulation State
  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    speedMultiplier: 1.0,
    progress: 0,
    currentPos: DEFAULT_COORDS,
    activePath: [],
    isRTHActive: false,
    isRecharging: false,
    isAutoResuming: false,
    isGroundLocked: false,
    isNetworkLossHold: false,
    isManualEmergencyHold: false,
    isWeatherEmergencyInFlight: false,
    weatherAlertBanner: null,
    statusMessage: 'Ready for Autonomous Dispatch',
  });

  // Manual Emergency & Weather Sentinel State
  const [autoResumeWeatherEnabled, setAutoResumeWeatherEnabled] = useState<boolean>(true);
  const [autoResumeCountdown, setAutoResumeCountdown] = useState<number | null>(null);

  // Async Timers & Live State Refs for Telemetry Polling
  const rthTransitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rthAnimFrameIdRef = useRef<number | null>(null);
  const rechargeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bannerClearTimerRef = useRef<NodeJS.Timeout | null>(null);

  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const breakpointRef = useRef(breakpoint);
  breakpointRef.current = breakpoint;
  const simulationRef = useRef(simulation);
  simulationRef.current = simulation;

  // 9. AI Advisory State
  const [advisory, setAdvisory] = useState<AIAdvisoryReport>({
    loading: false,
    riskLevel: 'LOW',
    summary: 'Autonomous mission parameters calculated for Mekong Rice Cooperative.',
    bullets: [
      'Atmospheric conditions optimal (Wind: 11.2 km/h, Temp: 28.5°C). Set spray droplet size to 180µm.',
      'Energy reserves sufficient for complete 24.5 Ha swath coverage at 6.0m row spacing.',
      'RTK centimeter positioning locked (±2.5cm). 15m virtual geofence active along parcel boundary.',
    ],
    source: 'gemini_ai',
    lastUpdated: new Date().toLocaleTimeString(),
  });

  // 10. Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getCachedAuditLogs());
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // 11. Field Prescription Sub-Zones & Swarm State
  const [subZones, setSubZones] = useState<SubZonePolygonData[]>(() => {
    const saved = getSavedMissionLayout();
    if (saved && Array.isArray(saved.subZones) && saved.subZones.length > 0) {
      return saved.subZones;
    }
    return generateFieldSubZones(DEFAULT_COORDS, 2.5);
  });

  const [userCustomizedPlots, setUserCustomizedPlots] = useState<UserCustomizedPlotsStore>(() => {
    const saved = getSavedMissionLayout();
    if (saved?.plotGeometryState && Object.keys(saved.plotGeometryState).length > 0) {
      return saved.plotGeometryState;
    }
    if (saved?.subZones && saved.subZones.length > 0) {
      return subZonesToCustomizedPlotsStore(saved.subZones);
    }
    return {};
  });
  const userCustomizedPlotsRef = useRef<UserCustomizedPlotsStore>(userCustomizedPlots);
  userCustomizedPlotsRef.current = userCustomizedPlots;

  const [customPlotCoordinates, setCustomPlotCoordinates] = useState<SubZonePolygonData[] | null>(() => {
    const saved = getSavedMissionLayout();
    return saved?.subZones && saved.subZones.length > 0 ? saved.subZones : null;
  });
  const [hasCustomPlotCoordinates, setHasCustomPlotCoordinates] = useState<boolean>(() => {
    const saved = getSavedMissionLayout();
    return !!(saved && saved.subZones && saved.subZones.length > 0);
  });
  const [activeBrush, setActiveBrush] = useState<ZoneHealthType>('HEALTHY');
  const [hasNfzConflict, setHasNfzConflict] = useState<boolean>(false);
  const [nfzPolygon, setNfzPolygon] = useState<Coordinates[]>(() => {
    const saved = getSavedMissionLayout();
    if (saved?.activeNFZGeometry && saved.activeNFZGeometry.length >= 3) {
      return saved.activeNFZGeometry;
    }
    return getNfzRestrictedZone(DEFAULT_COORDS);
  });
  const nfzPolygonRef = useRef(nfzPolygon);
  nfzPolygonRef.current = nfzPolygon;
  const subZonesRef = useRef(subZones);
  subZonesRef.current = subZones;

  // 12. Mission Performance Report & Open Saved Mission Modal States
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isOpenSavedModalOpen, setIsOpenSavedModalOpen] = useState<boolean>(false);
  const [currentReportData, setCurrentReportData] = useState<MissionPerformanceReportData | null>(null);

  const [swarmState, setSwarmState] = useState<SwarmMissionState>({
    isSwarmActive: false,
    droneAlpha: {
      id: 'drone_alpha',
      name: 'Drone Alpha (T40)',
      model: 'DJI Agras T40',
      role: 'West Corridor Water Spraying & Micro-Hydration',
      color: '#10b981',
      swathColor: '#10b981',
      coords: DEFAULT_COORDS,
      battery: 95,
      tankLevel: 40.0,
      maxTank: 40.0,
      sprayTrail: [],
      targetSectorId: 'west_corridor_water',
      targetSectorName: 'West Sector Water Hydration & Canopy Swath',
    },
    droneBeta: {
      id: 'drone_beta',
      name: 'Drone Beta (T40)',
      model: 'DJI Agras T40',
      role: 'Center Corridor Water-Soluble Nutrient Dispersion',
      color: '#f59e0b',
      swathColor: '#f59e0b',
      coords: DEFAULT_COORDS,
      battery: 94,
      tankLevel: 40.0,
      maxTank: 40.0,
      sprayTrail: [],
      targetSectorId: 'center_corridor_nutrient',
      targetSectorName: 'Center Sector Nutrient Dispersion Swath',
    },
    droneGamma: {
      id: 'drone_gamma',
      name: 'Drone Gamma (T40)',
      model: 'DJI Agras T40',
      role: 'East Corridor Precision Bio-Protection Shield',
      color: '#f43f5e',
      swathColor: '#f43f5e',
      coords: DEFAULT_COORDS,
      battery: 96,
      tankLevel: 40.0,
      maxTank: 40.0,
      sprayTrail: [],
      targetSectorId: 'east_corridor_bioprotect',
      targetSectorName: 'East Sector Precision Bio-Protection Swath',
    },
    status: 'IDLE',
  });
  const swarmAnimFrameIdRef = useRef<number | null>(null);
  const swarmStateRef = useRef(swarmState);
  swarmStateRef.current = swarmState;

  const debounceAdvisoryTimerRef = useRef<any>(null);

  // Keep subzones synced with coordinates and fieldArea ONLY if user has not customized plot positions
  useEffect(() => {
    if (
      (hasCustomPlotCoordinates && customPlotCoordinates && customPlotCoordinates.length > 0) ||
      Object.keys(userCustomizedPlotsRef.current).length > 0
    ) {
      return;
    }
    setSubZones((prev) => {
      const fresh = generateFieldSubZones(currentCoords, fieldArea);
      const merged = fresh.map((nz, idx) => ({
        ...nz,
        healthType: prev[idx]?.healthType || nz.healthType,
        chemicalType: prev[idx]?.chemicalType || nz.chemicalType,
        dosageRateLPerHa: prev[idx]?.dosageRateLPerHa || nz.dosageRateLPerHa,
        targetNozzleMicrons: prev[idx]?.targetNozzleMicrons || nz.targetNozzleMicrons,
      }));
      subZonesRef.current = merged;
      return merged;
    });
  }, [currentCoords, fieldArea, hasCustomPlotCoordinates, customPlotCoordinates]);

  // On initial mount: notify user that saved mission was automatically restored from browser storage
  useEffect(() => {
    const saved = getSavedMissionLayout();
    if (saved && Array.isArray(saved.subZones) && saved.subZones.length > 0) {
      const activeCount = saved.subZones.filter((z) => z.enabled !== false).length;
      setFailSafeNotification(
        `Auto-restored saved mission layout from browser storage: ${saved.subZones.length} sectors (${activeCount} active, ${(saved.fieldArea || 2.5).toFixed(1)} ha).`
      );
      const timer = setTimeout(() => setFailSafeNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Helper: Fetch AI Advisory (Enhanced with VRA Prescription & Swarm Parameters)
  const fetchAdvisoryReport = useCallback(
    async (
      coords = currentCoords,
      weather = telemetryRef.current,
      batt = telemetryRef.current.battery,
      tank = telemetryRef.current.tankLevel,
      area = fieldArea,
      currentSubZones = subZonesRef.current
    ) => {
      setAdvisory((prev) => ({ ...prev, loading: true }));
      try {
        const prescriptionTotals = calculatePrescriptionTotals(currentSubZones);

        const response = await fetch('/api/advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weather: {
              temp: weather.temp,
              windSpeed: weather.windSpeed,
              precipitation: weather.precipitation,
            },
            battery: batt,
            tankLevel: tank,
            machinery: machineryType,
            mission: missionType,
            coordinates: coords,
            locationName,
            language,
            fieldArea: area,
            prescription: prescriptionTotals,
          }),
        });

        if (!response.ok) {
          throw new Error(`Advisory endpoint status: ${response.status}`);
        }

        const data = await response.json();
        setAdvisory({
          loading: false,
          riskLevel: data.riskLevel || (batt <= 20 || tank === 0 ? 'CRITICAL' : 'LOW'),
          summary: data.summary || `Autonomous advisory updated for ${locationName}`,
          bullets: Array.isArray(data.bullets) && data.bullets.length > 0 ? data.bullets : [],
          source: data.source || 'gemini_ai',
          lastUpdated: new Date().toLocaleTimeString(),
        });
      } catch (err) {
        setAdvisory((prev) => ({
          ...prev,
          loading: false,
          riskLevel: batt <= 20 || tank === 0 ? 'CRITICAL' : 'LOW',
          lastUpdated: new Date().toLocaleTimeString(),
        }));
      }
    },
    [currentCoords, machineryType, missionType, locationName, language, fieldArea]
  );

  // Trigger advisory when machinery, mission, language, or fieldArea change (debounced)
  useEffect(() => {
    if (debounceAdvisoryTimerRef.current) {
      clearTimeout(debounceAdvisoryTimerRef.current);
    }
    debounceAdvisoryTimerRef.current = setTimeout(() => {
      fetchAdvisoryReport();
    }, 500);

    return () => {
      if (debounceAdvisoryTimerRef.current) {
        clearTimeout(debounceAdvisoryTimerRef.current);
      }
    };
  }, [machineryType, missionType, language, fieldArea, fetchAdvisoryReport]);

  // Handler for Updating Sub-Zones & Re-triggering Advisory
  const handleSubZoneUpdate = useCallback(
    (updatedZones: SubZonePolygonData[]) => {
      setSubZones(updatedZones);
      subZonesRef.current = updatedZones;
      const customStore = subZonesToCustomizedPlotsStore(updatedZones);
      setUserCustomizedPlots(customStore);
      userCustomizedPlotsRef.current = customStore;
      setCustomPlotCoordinates(updatedZones);
      setHasCustomPlotCoordinates(true);

      // Immediately stringify and save the complete active layout state into localStorage
      saveActiveMissionLayout({
        subZones: updatedZones,
        nfzPolygon: nfzPolygonRef.current,
        fieldArea,
        locationName,
        currentCoords,
        isExplicitCommit: false,
      });

      if (debounceAdvisoryTimerRef.current) {
        clearTimeout(debounceAdvisoryTimerRef.current);
      }
      debounceAdvisoryTimerRef.current = setTimeout(() => {
        fetchAdvisoryReport(currentCoords, telemetryRef.current, telemetryRef.current.battery, telemetryRef.current.tankLevel, fieldArea, updatedZones);
      }, 600);
    },
    [currentCoords, fieldArea, locationName, fetchAdvisoryReport]
  );

  // Handler for Interactive Field Plot Repositioning & Real-Time NFZ Validation
  const handlePlotRepositioned = useCallback(
    (
      updatedZones: SubZonePolygonData[],
      movedIndex: number,
      newCenter: Coordinates,
      distanceMeters: number,
      hasNfz: boolean
    ) => {
      setSubZones(updatedZones);
      subZonesRef.current = updatedZones;
      const customStore = subZonesToCustomizedPlotsStore(updatedZones);
      setUserCustomizedPlots(customStore);
      userCustomizedPlotsRef.current = customStore;
      setCustomPlotCoordinates(updatedZones);
      setHasCustomPlotCoordinates(true);
      setHasNfzConflict(hasNfz);

      // Immediately stringify and save the complete active layout state into localStorage
      saveActiveMissionLayout({
        subZones: updatedZones,
        nfzPolygon: nfzPolygonRef.current,
        fieldArea,
        locationName,
        currentCoords,
        isExplicitCommit: false,
      });

      const safeCoords = currentCoords || { lat: 10.7769, lng: 106.7009 };
      const dockCoords: Coordinates = {
        lat: safeCoords.lat - 0.0022,
        lng: safeCoords.lng - 0.0035,
      };

      // 1. Dynamic Waypoint & Swarm Flight Path Recalculation
      if (swarmStateRef.current.isSwarmActive && swarmStateRef.current.drones) {
        const freshPlan = generateDynamicPlotSwarmPlan(dockCoords, updatedZones);
        setSwarmState((prev) => ({
          ...prev,
          drones: freshPlan.drones.map((d, i) => ({
            ...d,
            coords: prev.drones?.[i]?.coords || d.coords,
            progress: prev.drones?.[i]?.progress || d.progress,
            sprayTrail: prev.drones?.[i]?.sprayTrail || d.sprayTrail,
            status: prev.drones?.[i]?.status || d.status,
          })),
          summary: freshPlan.summary,
        }));
      }

      // 2. Audit Trail Logging with GPS coordinates and recalculated flight distance
      const now = new Date();
      const timestampFormatted = now.toISOString().replace('T', ' ').substring(0, 19);
      const plotLabel =
        movedIndex >= 0
          ? `Sector ${updatedZones[movedIndex]?.name || movedIndex + 1}`
          : 'Entire Field Parcel';
      const safeCenter = newCenter || safeCoords;
      const logEntry: Omit<AuditLogEntry, 'id'> = {
        timestamp: timestampFormatted,
        locationName: `${locationName} (${plotLabel})`,
        coordinates: safeCenter,
        fieldArea,
        weatherSummary: `${telemetryRef.current.temp.toFixed(1)}°C • Wind: ${telemetryRef.current.windSpeed.toFixed(
          1
        )} km/h • Precip: ${telemetryRef.current.precipitation.toFixed(1)} mm/h`,
        machinery: machineryType,
        mission: missionType,
        tankLevel: `${telemetryRef.current.tankLevel.toFixed(1)} L / ${activeUnit.maxTankCapacity}L`,
        actionApproved: `Plot Repositioned | New GPS Center: (${safeCenter.lat.toFixed(5)}, ${safeCenter.lng.toFixed(
          5
        )}) | Recalculated Flight Dist: ${distanceMeters.toFixed(0)}m ${
          hasNfz ? '[NFZ_OVERLAP_DETECTED]' : '[CLEAR_AIRSPACE]'
        }`,
        energySavedKgCo2: parseFloat((8.5 + fieldArea * 2.8).toFixed(1)),
        syncStatus: isOnlineRef.current ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE',
      };
      const newLogs = addAuditLog(logEntry);
      setAuditLogs(newLogs);

      // 3. Debounced Advisory Engine Refresh
      if (debounceAdvisoryTimerRef.current) {
        clearTimeout(debounceAdvisoryTimerRef.current);
      }
      debounceAdvisoryTimerRef.current = setTimeout(() => {
        fetchAdvisoryReport(
          newCenter,
          telemetryRef.current,
          telemetryRef.current.battery,
          telemetryRef.current.tankLevel,
          fieldArea,
          updatedZones
        );
      }, 400);

      // 4. NFZ Warning Banner Interlock
      if (hasNfz) {
        const nfzMsg =
          'CANNOT DISPATCH: Selected plot area intersects No-Fly Zone (NFZ). Drag plot or NFZ to clear airspace.';
        setFailSafeNotification(nfzMsg);
        playVoiceAlert('Warning: Plot repositioned into restricted No-Fly Zone.', language);
      } else if (
        failSafeNotification?.includes('No-Fly Zone') ||
        failSafeNotification?.includes('CANNOT DISPATCH')
      ) {
        setFailSafeNotification(null);
      }
    },
    [
      currentCoords,
      fieldArea,
      locationName,
      machineryType,
      missionType,
      activeUnit.maxTankCapacity,
      fetchAdvisoryReport,
      failSafeNotification,
      language,
    ]
  );

  // Handler for Interactive No-Fly Zone Repositioning & Conflict Verification
  const handleNfzRepositioned = useCallback(
    (newNfzPolygon: Coordinates[], newNfzCenter: Coordinates, hasNfz: boolean) => {
      setNfzPolygon(newNfzPolygon);
      nfzPolygonRef.current = newNfzPolygon;
      setHasNfzConflict(hasNfz);

      // Immediately stringify and save active layout with new NFZ geometry
      saveActiveMissionLayout({
        subZones: subZonesRef.current,
        nfzPolygon: newNfzPolygon,
        fieldArea,
        locationName,
        currentCoords,
        isExplicitCommit: false,
      });

      // Audit Trail Logging
      const now = new Date();
      const timestampFormatted = now.toISOString().replace('T', ' ').substring(0, 19);
      const safeCenter = newNfzCenter || calculatePolygonCenter(newNfzPolygon);
      const logEntry: Omit<AuditLogEntry, 'id'> = {
        timestamp: timestampFormatted,
        locationName: `${locationName} (No-Fly Zone Restriction)`,
        coordinates: safeCenter,
        fieldArea,
        weatherSummary: `${telemetryRef.current.temp.toFixed(1)}°C • Wind: ${telemetryRef.current.windSpeed.toFixed(
          1
        )} km/h • Precip: ${telemetryRef.current.precipitation.toFixed(1)} mm/h`,
        machinery: machineryType,
        mission: missionType,
        tankLevel: `${telemetryRef.current.tankLevel.toFixed(1)} L / ${activeUnit.maxTankCapacity}L`,
        actionApproved: `No-Fly Zone Repositioned | New GPS Center: (${safeCenter.lat.toFixed(5)}, ${safeCenter.lng.toFixed(
          5
        )}) | Status: ${hasNfz ? '[NFZ_OVERLAP_DETECTED]' : '[CLEAR_AIRSPACE]'}`,
        energySavedKgCo2: parseFloat((8.5 + fieldArea * 2.8).toFixed(1)),
        syncStatus: isOnlineRef.current ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE',
      };
      const newLogs = addAuditLog(logEntry);
      setAuditLogs(newLogs);

      // NFZ Warning Banner Interlock
      if (hasNfz) {
        const nfzMsg =
          'CANNOT DISPATCH: No-Fly Zone (NFZ) intersects field parcel. Drag NFZ or plots to clear airspace.';
        setFailSafeNotification(nfzMsg);
        playVoiceAlert('Warning: No-Fly Zone boundary intersects agricultural parcel.', language);
      } else if (
        failSafeNotification?.includes('No-Fly Zone') ||
        failSafeNotification?.includes('CANNOT DISPATCH')
      ) {
        setFailSafeNotification(null);
      }
    },
    [
      currentCoords,
      fieldArea,
      locationName,
      machineryType,
      missionType,
      activeUnit.maxTankCapacity,
      failSafeNotification,
      language,
    ]
  );

  // Handler for Resetting Prescription to Default Balanced Matrix
  const handleResetPrescription = useCallback(() => {
    // Clear saved mission layout so default 2x3 grid is restored
    clearSavedMissionLayout();

    const safeCoords = currentCoords || { lat: 10.7769, lng: 106.7009 };
    const fresh = generateFieldSubZones(safeCoords, fieldArea);
    setSubZones(fresh);
    subZonesRef.current = fresh;
    setUserCustomizedPlots({});
    userCustomizedPlotsRef.current = {};
    setCustomPlotCoordinates(null);
    setHasCustomPlotCoordinates(false);
    const freshNfz = getNfzRestrictedZone(safeCoords);
    setNfzPolygon(freshNfz);
    nfzPolygonRef.current = freshNfz;
    setHasNfzConflict(false);
    fetchAdvisoryReport(safeCoords, telemetryRef.current, telemetryRef.current.battery, telemetryRef.current.tankLevel, fieldArea, fresh);
    setFailSafeNotification('Restored plots to initial default 2x3 grid layout.');
    setTimeout(() => setFailSafeNotification(null), 3500);
  }, [currentCoords, fieldArea, fetchAdvisoryReport]);

  // Handler for Explicitly Resetting Plots to Initial Position
  const handleResetPlotPositions = useCallback(() => {
    // Clear saved mission layout so default 2x3 grid is restored
    clearSavedMissionLayout();

    const safeCoords = currentCoords || { lat: 10.7769, lng: 106.7009 };
    const fresh = generateFieldSubZones(safeCoords, fieldArea);
    setSubZones(fresh);
    subZonesRef.current = fresh;
    setUserCustomizedPlots({});
    userCustomizedPlotsRef.current = {};
    setCustomPlotCoordinates(null);
    setHasCustomPlotCoordinates(false);
    const freshNfz = getNfzRestrictedZone(safeCoords);
    setNfzPolygon(freshNfz);
    nfzPolygonRef.current = freshNfz;
    setHasNfzConflict(false);

    // Audit log entry
    const now = new Date();
    const timestampFormatted = now.toISOString().replace('T', ' ').substring(0, 19);
    const logEntry: Omit<AuditLogEntry, 'id'> = {
      timestamp: timestampFormatted,
      locationName: `${locationName} (Plot Positions Reset)`,
      coordinates: safeCoords,
      fieldArea,
      weatherSummary: `${telemetryRef.current.temp.toFixed(1)}°C • Wind: ${telemetryRef.current.windSpeed.toFixed(1)} km/h`,
      machinery: machineryType,
      mission: missionType,
      tankLevel: `${telemetryRef.current.tankLevel.toFixed(1)} L / ${activeUnit.maxTankCapacity}L`,
      actionApproved: 'Restored all sector plot coordinates and geometry to initial default grid layout.',
      energySavedKgCo2: parseFloat((8.5 + fieldArea * 2.8).toFixed(1)),
      syncStatus: isOnlineRef.current ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE',
    };
    const newLogs = addAuditLog(logEntry);
    setAuditLogs(newLogs);

    fetchAdvisoryReport(safeCoords, telemetryRef.current, telemetryRef.current.battery, telemetryRef.current.tankLevel, fieldArea, fresh);
    setFailSafeNotification('Restored plots to initial default 2x3 grid layout.');
    setTimeout(() => setFailSafeNotification(null), 3500);
  }, [currentCoords, fieldArea, locationName, machineryType, missionType, activeUnit.maxTankCapacity, fetchAdvisoryReport]);

  // Handler for "Confirm & Save Mission Performance"
  const handleAcceptSaveMissionPerformance = useCallback(() => {
    const activePlots = subZonesRef.current || subZones;
    const activeNfz = nfzPolygonRef.current || nfzPolygon;

    // 1. Immediately stringify and save complete active layout into localStorage
    const saved = saveActiveMissionLayout({
      subZones: activePlots,
      nfzPolygon: activeNfz,
      fieldArea,
      locationName,
      currentCoords,
      isExplicitCommit: true,
    });

    // 2. Build comprehensive mission performance report data
    const report = buildMissionReportData({
      locationName,
      coordinates: currentCoords,
      fieldArea,
      subZones: activePlots,
      nfzPolygon: activeNfz,
      telemetry: telemetryRef.current,
      activeUnitName: activeUnit.name,
      hasNfzConflict,
    });

    setCurrentReportData(report);
    setIsReportModalOpen(true);

    // 3. Audit trail log
    const now = new Date();
    const timestampFormatted = now.toISOString().replace('T', ' ').substring(0, 19);
    const activePlotsCount = activePlots.filter((z) => z.enabled !== false).length;
    const targetAreaSumHa = activePlots
      .filter((z) => z.enabled !== false)
      .reduce((sum, z) => sum + (z.areaHa || 0), 0)
      .toFixed(2);
    const logEntry: Omit<AuditLogEntry, 'id'> = {
      timestamp: timestampFormatted,
      locationName: `${locationName} (Mission Performance Committed)`,
      coordinates: currentCoords,
      fieldArea,
      weatherSummary: `${telemetryRef.current.temp.toFixed(1)}°C • Wind: ${telemetryRef.current.windSpeed.toFixed(1)} km/h`,
      machinery: machineryType,
      mission: missionType,
      tankLevel: `${telemetryRef.current.tankLevel.toFixed(1)} L / ${activeUnit.maxTankCapacity}L`,
      actionApproved: `Mission Performance Committed | ID: ${report.missionId} | ${activePlotsCount}/${activePlots.length} Sectors (${targetAreaSumHa} ha) Persisted to Storage`,
      energySavedKgCo2: parseFloat((8.5 + fieldArea * 2.8).toFixed(1)),
      syncStatus: isOnlineRef.current ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE',
    };
    const newLogs = addAuditLog(logEntry);
    setAuditLogs(newLogs);

    playVoiceAlert('Mission performance confirmed and saved to browser storage.', language);
  }, [
    subZones,
    nfzPolygon,
    fieldArea,
    locationName,
    currentCoords,
    activeUnit.name,
    activeUnit.maxTankCapacity,
    hasNfzConflict,
    machineryType,
    missionType,
    language,
  ]);

  // Handler for Opening Saved Mission Modal
  const handleOpenSavedMission = useCallback(() => {
    setIsOpenSavedModalOpen(true);
  }, []);

  // Handler for Restoring Saved Mission (from file or cache snapshot)
  const handleRestoreSavedMission = useCallback(
    (savedState: AgriTwinSavedMissionState) => {
      if (!savedState || !Array.isArray(savedState.subZones) || savedState.subZones.length === 0) {
        return;
      }

      // 1. Update Subzones
      setSubZones(savedState.subZones);
      subZonesRef.current = savedState.subZones;

      // 2. Update Custom Store
      const store =
        savedState.plotGeometryState && Object.keys(savedState.plotGeometryState).length > 0
          ? savedState.plotGeometryState
          : subZonesToCustomizedPlotsStore(savedState.subZones);
      setUserCustomizedPlots(store);
      userCustomizedPlotsRef.current = store;
      setCustomPlotCoordinates(savedState.subZones);
      setHasCustomPlotCoordinates(true);

      // 3. Update NFZ
      if (Array.isArray(savedState.activeNFZGeometry) && savedState.activeNFZGeometry.length >= 3) {
        setNfzPolygon(savedState.activeNFZGeometry);
        nfzPolygonRef.current = savedState.activeNFZGeometry;
      }

      // 4. Update Field Area
      const targetArea =
        typeof savedState.fieldArea === 'number' && savedState.fieldArea > 0
          ? savedState.fieldArea
          : fieldArea;
      if (typeof savedState.fieldArea === 'number' && savedState.fieldArea > 0) {
        setFieldArea(savedState.fieldArea);
      }

      // 5. Update Location & Coords
      const targetCoords = savedState.currentCoords || currentCoords;
      if (savedState.currentCoords && typeof savedState.currentCoords.lat === 'number') {
        setCurrentCoords(savedState.currentCoords);
      }
      if (savedState.locationName) {
        setLocationName(savedState.locationName);
      }

      // 6. Check NFZ Conflict
      const activeNfz = savedState.activeNFZGeometry || nfzPolygonRef.current;
      const hasConflict = savedState.subZones.some(
        (z) => z.enabled !== false && isPolygonOverlappingPolygon(z.bounds, activeNfz)
      );
      setHasNfzConflict(hasConflict);

      // 7. Auto-save this as active layout in localStorage
      saveActiveMissionLayout({
        subZones: savedState.subZones,
        nfzPolygon: activeNfz,
        fieldArea: targetArea,
        locationName: savedState.locationName || locationName,
        currentCoords: targetCoords,
        isExplicitCommit: false,
      });

      // 8. Trigger Advisory Update
      fetchAdvisoryReport(
        targetCoords,
        telemetryRef.current,
        telemetryRef.current.battery,
        telemetryRef.current.tankLevel,
        targetArea,
        savedState.subZones
      );

      // 9. Audio and UI notification
      const activeCount = savedState.subZones.filter((z) => z.enabled !== false).length;
      setFailSafeNotification(
        `Successfully restored mission layout: ${savedState.subZones.length} sectors (${activeCount} active, ${targetArea.toFixed(1)} ha).`
      );
      setTimeout(() => setFailSafeNotification(null), 4500);
      playVoiceAlert('Saved mission performance restored successfully.', language);
    },
    [currentCoords, fieldArea, locationName, fetchAdvisoryReport, language]
  );

  // Handler for Dispatching 6-Drone Water Spraying Machinery Swarm
  const handleDispatchSwarm = useCallback((isResuming: boolean = false) => {
    // Safety check: Cannot dispatch if any active/enabled plot intersects No-Fly Zone
    const currentSubZones = subZonesRef.current || subZones;
    const activeNfzZone = (nfzPolygonRef.current && nfzPolygonRef.current.length >= 3)
      ? nfzPolygonRef.current
      : (nfzPolygon && nfzPolygon.length >= 3)
      ? nfzPolygon
      : getNfzRestrictedZone(currentCoords);

    const hasActivePlotNfzConflict = currentSubZones?.some(
      (z) => (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, activeNfzZone)
    );

    if (hasActivePlotNfzConflict) {
      const nfzMsg =
        'CANNOT DISPATCH: Active plot area intersects No-Fly Zone (NFZ). Drag plot or NFZ to clear airspace.';
      setFailSafeNotification(nfzMsg);
      playVoiceAlert('Swarm takeoff blocked: Active plot boundary intersects restricted No-Fly Zone.', language);
      setTimeout(() => setFailSafeNotification(null), 5000);
      return;
    }

    // Pre-flight weather safety check for all swarm drones
    const weatherEval = evaluateWeatherSafety(telemetryRef.current);
    if (!weatherEval.isSafe) {
      setFailSafeNotification(CRITICAL_WEATHER_HAZARD_BANNER);
      playVoiceAlert(WEATHER_TAKEOFF_BLOCKED_VOICE_ALERT, language);
      setSimulation((prev) => ({
        ...prev,
        weatherAlertBanner: CRITICAL_WEATHER_HAZARD_BANNER,
        statusMessage: CRITICAL_WEATHER_HAZARD_BANNER,
      }));
      setTimeout(() => setFailSafeNotification(null), 7000);
      return;
    }

    if (!currentSubZones || currentSubZones.length === 0) return;

    if (swarmAnimFrameIdRef.current) {
      cancelAnimationFrame(swarmAnimFrameIdRef.current);
      swarmAnimFrameIdRef.current = null;
    }

    const dockCoords: Coordinates = {
      lat: currentCoords.lat - 0.0022,
      lng: currentCoords.lng - 0.0035,
    };

    // 1. Dynamic Fleet Generation (Uniform 6 Water Spraying DJI Agras T40 Machinery Units)
    const { drones: initialDrones, summary } = generateDynamicPlotSwarmPlan(dockCoords, currentSubZones);
    if (initialDrones.length === 0) return;

    // Check if we are resuming from existing saved breakpoints
    const existingDrones = swarmStateRef.current.drones;
    const isActuallyResuming = isResuming && existingDrones && existingDrones.length > 0 && existingDrones.some(d => (d.progress || 0) > 0);

    const dronesToUse: SwarmDroneFlight[] = isActuallyResuming
      ? existingDrones.map((d, idx) => ({
          ...initialDrones[idx],
          coords: dockCoords,
          progress: d.progress || 0,
          tankLevel: d.tankLevel ?? 40.0,
          battery: 100,
          sprayTrail: d.sprayTrail || [],
          savedBreakpointCoords: d.savedBreakpointCoords || d.coords,
          savedBreakpointProgress: d.savedBreakpointProgress ?? d.progress ?? 0,
        }))
      : initialDrones.map((d) => ({
          ...d,
          coords: dockCoords,
          progress: 0,
          tankLevel: 40.0,
          battery: 100,
          sprayTrail: [],
        }));

    setSwarmState({
      isSwarmActive: true,
      drones: dronesToUse,
      droneAlpha: dronesToUse[0],
      droneBeta: dronesToUse[1],
      droneGamma: dronesToUse[2],
      status: isActuallyResuming ? 'TRANSIT_OUT' : 'SPRAYING_PARALLEL',
      isNetworkLossHold: false,
      isWeatherEmergencyHold: false,
      isManualEmergencyHold: false,
      summary,
    });

    const initialDronesCopy = dronesToUse.map((d) => ({ ...d }));

    // Helper for executing coordinated Swarm Fail-Safe Abort to Home Dock
    const executeSwarmFailSafeAbort = (
      reason: FailSafeReason,
      reasonMessage: string,
      voiceMessage: string
    ) => {
      if (swarmAnimFrameIdRef.current) {
        cancelAnimationFrame(swarmAnimFrameIdRef.current);
        swarmAnimFrameIdRef.current = null;
      }

      // Capture current positions & progress as breakpoints for all 6 drones
      const frozenPositions = initialDronesCopy.map((d) => ({ ...d.coords }));
      const savedBreakpoints = initialDronesCopy.map((d) => ({
        coords: { ...d.coords },
        progress: d.progress || 0,
      }));

      // Record global primary breakpoint memory for sentinel & resume controls
      const primaryBp: BreakpointMemory = {
        waypointIndex: Math.floor(initialDronesCopy[0]?.progress || 50),
        coordinates: { ...(initialDronesCopy[0]?.coords || currentCoords) },
        batteryAtBreakpoint: initialDronesCopy[0]?.battery || telemetryRef.current.battery,
        tankAtBreakpoint: initialDronesCopy[0]?.tankLevel || 40,
        unitId: 'swarm_fleet_all',
        machineryType: `DJI Agras T40 Swarm (${summary.totalDeployed} Units: ${summary.pesticideCount} Alpha Pesticide, ${summary.waterCount} Beta Water, ${summary.nitrogenCount} Gamma Nitrogen)`,
        missionType: 'MULTI_PAYLOAD_SWARM_MISSION',
        reason: reason === 'CRITICAL_WEATHER' ? 'WEATHER_EMERGENCY_ABORT' : reason,
        timestamp: new Date().toISOString(),
        progressPercent: initialDronesCopy[0]?.progress || 50,
      };
      setBreakpoint(primaryBp);
      setCachedBreakpoint(primaryBp);
      breakpointRef.current = primaryBp;

      setFailSafeNotification(reasonMessage);
      playVoiceAlert(voiceMessage, language);

      setSwarmState((prev) => ({
        ...prev,
        status: 'RETURNING_HOME',
        isNetworkLossHold: reason === 'SIGNAL_LOSS',
        isWeatherEmergencyHold: reason === 'CRITICAL_WEATHER' || reason === 'WEATHER_EMERGENCY_ABORT',
        isManualEmergencyHold: reason === 'MANUAL_EMERGENCY',
        drones: prev.drones?.map((d, i) => ({
          ...d,
          savedBreakpointCoords: savedBreakpoints[i]?.coords,
          savedBreakpointProgress: savedBreakpoints[i]?.progress,
          status: 'RETURNING_HOME',
        })) || [],
      }));

      const rthStartTime = performance.now();
      const rthDuration = 4500; // 4.5 seconds smooth parallel flight to Home Dock

      const animateSwarmAbortRTH = (rthTime: number) => {
        const rthElapsed = rthTime - rthStartTime;
        const rthProgress = Math.min(1, rthElapsed / rthDuration);

        const updatedDrones = initialDronesCopy.map((drone, idx) => {
          const startP = frozenPositions[idx] || drone.coords;
          const rthPos: Coordinates = {
            lat: startP.lat + (dockCoords.lat - startP.lat) * rthProgress,
            lng: startP.lng + (dockCoords.lng - startP.lng) * rthProgress,
          };
          return {
            ...drone,
            coords: rthPos,
            status: (rthProgress >= 1 ? 'DOCKED_COMPLETED' : 'RETURNING_HOME') as any,
          };
        });

        setSwarmState((prev) => ({
          ...prev,
          drones: updatedDrones,
          droneAlpha: updatedDrones[0],
          droneBeta: updatedDrones[1],
          droneGamma: updatedDrones[2],
          status: rthProgress >= 1 ? (reason === 'MANUAL_EMERGENCY' ? 'MANUAL_EMERGENCY_HOLD' : 'IDLE') : 'RETURNING_HOME',
        }));

        if (rthProgress < 1) {
          swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarmAbortRTH);
        } else {
          swarmAnimFrameIdRef.current = null;

          // Docking servicing: replenish all 6 units to 100% battery & 40L water tank
          const refilledDrones = updatedDrones.map((d, i) => ({
            ...d,
            coords: dockCoords,
            battery: 100,
            tankLevel: 40.0,
            savedBreakpointCoords: savedBreakpoints[i]?.coords,
            savedBreakpointProgress: savedBreakpoints[i]?.progress,
            status: 'DOCKED_COMPLETED' as any,
          }));

          setSwarmState((prev) => ({
            ...prev,
            drones: refilledDrones,
            droneAlpha: refilledDrones[0],
            droneBeta: refilledDrones[1],
            droneGamma: refilledDrones[2],
            status: reason === 'MANUAL_EMERGENCY' ? 'MANUAL_EMERGENCY_HOLD' : 'IDLE',
            isNetworkLossHold: reason === 'SIGNAL_LOSS',
            isWeatherEmergencyHold: reason === 'CRITICAL_WEATHER',
            isManualEmergencyHold: reason === 'MANUAL_EMERGENCY',
          }));

          if (reason === 'SIGNAL_LOSS') {
            const groundMsg =
              '⚠️ SIGNAL LOSS GROUND LOCK: All 6 DJI Agras T40 units safely grounded at Home Dock (100% refilled). Awaiting network reconnection before resuming mission.';
            setSimulation((prev) => ({
              ...prev,
              isRunning: false,
              isRTHActive: false,
              isGroundLocked: true,
              isNetworkLossHold: true,
              failSafeReason: 'NETWORK_LOSS_HOLD',
              statusMessage: groundMsg,
            }));
            setFailSafeNotification(groundMsg);
          } else if (reason === 'CRITICAL_WEATHER' || reason === 'WEATHER_EMERGENCY_ABORT') {
            const weatherMsg =
              translations[language].criticalWeatherGroundLock ||
              '⚠️ WEATHER GROUND LOCK: All 6 DJI Agras T40 units safely grounded at Home Dock (100% refilled). Awaiting weather clearance before resuming mission.';
            setSimulation((prev) => ({
              ...prev,
              isRunning: false,
              isRTHActive: false,
              isGroundLocked: true,
              isNetworkLossHold: false,
              failSafeReason: 'WEATHER_GROUND_LOCK',
              statusMessage: weatherMsg,
            }));
            setFailSafeNotification(weatherMsg);
          } else {
            const manualMsg =
              '⚠️ MANUAL EMERGENCY STANDBY: All 6 DJI Agras T40 units safely docked at Home Dock (100% refilled). Awaiting resume command.';
            setSimulation((prev) => ({
              ...prev,
              isRunning: false,
              isRTHActive: false,
              isGroundLocked: true,
              isManualEmergencyHold: true,
              failSafeReason: 'MANUAL_EMERGENCY_HOLD',
              statusMessage: manualMsg,
            }));
            setFailSafeNotification(manualMsg);
          }
        }
      };

      swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarmAbortRTH);
    };

    function startParallelSprayingLoop() {
      const sprayStartTime = performance.now();
      const sprayDuration = 10000; // 10s parallel spray pass across plots

      const animateSwarm = (time: number) => {
        // 1. In-flight weather fail-safe interlock (all 6 drones return home automatically)
        const currWeather = telemetryRef.current;
        if (isWeatherHazardous(currWeather)) {
          const evalRes = evaluateWeatherSafety(currWeather);
          executeSwarmFailSafeAbort(
            'WEATHER_EMERGENCY_ABORT',
            `⚠️ CRITICAL WEATHER HAZARD: ${evalRes.summary}. All aircraft aborting and executing emergency Auto-RTH to Home Dock.`,
            WEATHER_ABORT_VOICE_ALERT
          );
          return;
        }

        // 2. In-flight signal loss fail-safe interlock (all 6 drones return home automatically)
        const isOfflineOrNoSignal = !isOnlineRef.current || hardwareStateRef.current.rssiPercent === 0;
        if (isOfflineOrNoSignal) {
          executeSwarmFailSafeAbort(
            'SIGNAL_LOSS',
            '⚠️ SIGNAL LOSS DETECTED (0% RSSI): Halting forward spray route for all 6 drone machinery units. Executing coordinated fail-safe Return-to-Home to Home Dock.',
            'Warning: Telemetry signal lost for all 6 aircraft. Fail-safe Return-to-Home engaged.'
          );
          return;
        }

        const elapsed = time - sprayStartTime;
        const incrementalRatio = Math.min(1, elapsed / sprayDuration);

        // Update each drone in parallel
        const updatedDrones = initialDronesCopy.map((drone) => {
          if (drone.status === 'STANDBY / SECTOR_SKIPPED') {
            return {
              ...drone,
              coords: dockCoords,
              sprayTrail: [],
              progress: 0,
              tankLevel: 0,
              status: 'STANDBY / SECTOR_SKIPPED' as const,
            };
          }

          const startProg = (drone.savedBreakpointProgress ?? 0) / 100;
          const currentTotalProgress = Math.min(1, startProg + incrementalRatio * (1 - startProg));
          const waypoints = drone.gridCoveragePath || [];
          let currCoords = drone.coords;
          let trail: Coordinates[] = drone.sprayTrail || [];

          const validWaypoints = waypoints.filter(
            (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)
          );

          if (validWaypoints.length > 0) {
            if (validWaypoints.length === 1) {
              currCoords = validWaypoints[0];
              trail = [currCoords];
            } else {
              const numSegments = validWaypoints.length - 1;
              const totalRatio = currentTotalProgress * numSegments;
              const segIndex = Math.max(0, Math.min(numSegments - 1, Math.floor(totalRatio)));
              const segT = totalRatio - segIndex;

              const p1 = validWaypoints[segIndex] || validWaypoints[0];
              const p2 = validWaypoints[segIndex + 1] || p1;

              if (p1 && p2) {
                currCoords = {
                  lat: p1.lat + (p2.lat - p1.lat) * segT,
                  lng: p1.lng + (p2.lng - p1.lng) * segT,
                };
                trail = validWaypoints.slice(0, segIndex + 1).concat([currCoords]);
              }
            }
          }

          // Decrement individual payload tank level (40.0L water capacity)
          const totalPayloadNeeded = drone.unitConsumed;
          const currentTank = Math.max(0, drone.maxTank - currentTotalProgress * totalPayloadNeeded);
          const currentBattery = Math.max(25, drone.battery - currentTotalProgress * 15);

          drone.coords = currCoords;
          drone.progress = currentTotalProgress * 100;

          return {
            ...drone,
            coords: currCoords,
            sprayTrail: trail,
            tankLevel: currentTank,
            battery: currentBattery,
            progress: currentTotalProgress * 100,
            status: 'SPRAYING' as const,
          };
        });

        setSwarmState((prev) => ({
          ...prev,
          drones: updatedDrones,
          droneAlpha: updatedDrones[0],
          droneBeta: updatedDrones[1],
          droneGamma: updatedDrones[2],
          status: 'SPRAYING_PARALLEL',
        }));

        // 3. Low Battery (<=15%) or Empty Tank (0L) Auto-RTH Interlock
        const criticalDrone = updatedDrones.find(
          (d) => d.status === 'SPRAYING' && (d.battery <= 15 || d.tankLevel <= 0)
        );
        if (criticalDrone) {
          const reasonMsg = criticalDrone.battery <= 15
            ? `⚠️ LOW BATTERY INTERLOCK (≤15% on ${criticalDrone.name}): Saving Breakpoint Memory and executing Auto-RTH to Home Dock for rapid charging.`
            : `⚠️ EMPTY TANK INTERLOCK (0L on ${criticalDrone.name}): Saving Breakpoint Memory and executing Auto-RTH to Home Dock for automated chemical replenishment.`;
          executeSwarmFailSafeAbort(
            criticalDrone.battery <= 15 ? 'LOW_BATTERY' : 'EMPTY_TANK',
            reasonMsg,
            'Warning: Critical threshold reached. Auto-RTH fail-safe triggered.'
          );
          return;
        }

        if (incrementalRatio < 1) {
          swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarm);
        } else {
          // Spraying Complete -> Initiate Coordinated Auto-RTH Transit back to Home Dock for all 6 Drones
          const finalPositions = updatedDrones.map((d) => ({ ...d.coords }));

          setSwarmState((prev) => ({
            ...prev,
            status: 'RETURNING_HOME',
            drones: prev.drones?.map((d) => ({
              ...d,
              status: d.status === 'STANDBY / SECTOR_SKIPPED' ? ('STANDBY / SECTOR_SKIPPED' as const) : ('RETURNING_HOME' as const),
            })) || [],
          }));

          setFailSafeNotification(
            `🚁 ALL ACTIVE DRONE MACHINERY UNITS COVERAGE 100% COMPLETE: Initiating Coordinated Automated Return to Base (Auto-RTH)...`
          );
          playVoiceAlert(`Swarm coverage complete. All active aircraft returning to home dock.`, language);

          const rthStartTime = performance.now();
          const rthDuration = 4500; // 4.5 seconds smooth return flight to dock

          const animateSwarmRTH = (rthTime: number) => {
            const rthElapsed = rthTime - rthStartTime;
            const rthProgress = Math.min(1, rthElapsed / rthDuration);

            const rthDrones = updatedDrones.map((drone, idx) => {
              if (drone.status === 'STANDBY / SECTOR_SKIPPED') {
                return {
                  ...drone,
                  coords: dockCoords,
                  progress: 0,
                  status: 'STANDBY / SECTOR_SKIPPED' as const,
                };
              }
              const startP = finalPositions[idx] || drone.coords;
              const rthPos: Coordinates = {
                lat: startP.lat + (dockCoords.lat - startP.lat) * rthProgress,
                lng: startP.lng + (dockCoords.lng - startP.lng) * rthProgress,
              };
              return {
                ...drone,
                coords: rthPos,
                progress: 100,
                status: (rthProgress >= 1 ? 'DOCKED_COMPLETED' : 'RETURNING_HOME') as any,
              };
            });

            setSwarmState((prev) => ({
              ...prev,
              drones: rthDrones,
              droneAlpha: rthDrones[0],
              droneBeta: rthDrones[1],
              droneGamma: rthDrones[2],
              status: rthProgress >= 1 ? 'COMPLETED' : 'RETURNING_HOME',
            }));

            if (rthProgress < 1) {
              swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarmRTH);
            } else {
              swarmAnimFrameIdRef.current = null;

              // Mission Accomplished & Live Structured Audit Trail Logging
              const now = new Date();
              const timestampFormatted = now.toISOString().replace('T', ' ').substring(0, 19);

              const deliveredList: string[] = [];
              if (summary.totalPesticideLiters > 0) deliveredList.push(`${summary.totalPesticideLiters.toFixed(1)} L Bio-Pesticide`);
              if (summary.totalWaterLiters > 0) deliveredList.push(`${summary.totalWaterLiters.toFixed(1)} L Water`);
              if (summary.totalNitrogenKg > 0) deliveredList.push(`${summary.totalNitrogenKg.toFixed(1)} kg Nitrogen`);
              const deliveredStr = deliveredList.join(' + ') || 'Targeted Prescription Spray';

              const totalActiveArea = summary.totalActiveAreaHa ?? fieldArea;
              const skippedCount = summary.totalSkipped ?? 0;
              const deployedCount = summary.totalDeployed ?? 0;
              const syncStatusValue = isOnlineRef.current ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE';

              const swarmAuditEntry: Omit<AuditLogEntry, 'id'> = {
                timestamp: timestampFormatted,
                locationName: `${locationName} • Selective Plot Swarm Mission`,
                coordinates: dockCoords,
                weatherSummary: `${telemetryRef.current.temp.toFixed(1)}°C • Wind: ${telemetryRef.current.windSpeed.toFixed(
                  1
                )} km/h • Precip: ${telemetryRef.current.precipitation.toFixed(1)} mm/h`,
                machinery: `DJI Agras T40 Multi-Payload Swarm (${deployedCount} Deployed, ${skippedCount} Skipped)`,
                mission: `[${timestampFormatted} | Deployed: ${deployedCount} Drones (${skippedCount} Skipped) | Active Area: ${totalActiveArea.toFixed(2)} ha | Status: ${syncStatusValue}]`,
                tankLevel: `Delivered: ${deliveredStr}`,
                actionApproved: `Targeted Dynamic Plot Matching (${summary.totalPlots} Active Sectors Treated @ 1-to-1 Drone-to-Plot Tailored Formulation)`,
                energySavedKgCo2: parseFloat((28.0 + totalActiveArea * 4.5).toFixed(1)),
                syncStatus: syncStatusValue,
              };

              const updatedLogs = addAuditLog(swarmAuditEntry);
              setAuditLogs(updatedLogs);

              const completeMsg = `🚀 MULTI-PAYLOAD SWARM MISSION COMPLETED: Deployed ${deployedCount} DJI Agras T40 Units (${skippedCount} Skipped) across ${summary.totalPlots} active plots (${totalActiveArea.toFixed(2)} ha). Delivered ${deliveredStr}. All active units safely docked.`;

              setFailSafeNotification(completeMsg);
              playVoiceAlert(`Multi-payload swarm mission complete. All deployed units safely docked and audit synchronized.`, language);

              setTimeout(() => {
                setSwarmState((prev) => ({
                  ...prev,
                  isSwarmActive: false,
                  status: 'IDLE',
                }));
              }, 6000);

              if (bannerClearTimerRef.current) clearTimeout(bannerClearTimerRef.current);
              bannerClearTimerRef.current = setTimeout(() => {
                setFailSafeNotification(null);
              }, 10000);
            }
          };

          swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarmRTH);
        }
      };

      swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarm);
    }

    // Stage 1: Transit from Dock to Breakpoints if Resuming, or start spraying directly
    if (isActuallyResuming) {
      setFailSafeNotification('🚀 RESUMING SWARM MISSION: All 6 DJI Agras T40 units transiting from Home Dock to saved breakpoints...');
      playVoiceAlert('Resuming swarm mission. All 6 aircraft departing home dock.', language);

      const transitStartTime = performance.now();
      const transitDuration = 4500;

      const animateResumeTransit = (transitTime: number) => {
        const transitElapsed = transitTime - transitStartTime;
        const transitRatio = Math.min(1, transitElapsed / transitDuration);

        const updated = initialDronesCopy.map((drone) => {
          if (drone.status === 'STANDBY / SECTOR_SKIPPED') {
            return {
              ...drone,
              coords: dockCoords,
              status: 'STANDBY / SECTOR_SKIPPED' as any,
            };
          }
          const targetBp = drone.savedBreakpointCoords || drone.coords;
          const curLat = dockCoords.lat + (targetBp.lat - dockCoords.lat) * transitRatio;
          const curLng = dockCoords.lng + (targetBp.lng - dockCoords.lng) * transitRatio;
          return {
            ...drone,
            coords: { lat: curLat, lng: curLng },
            status: (transitRatio >= 1 ? 'SPRAYING' : 'TRANSIT_OUT') as any,
          };
        });

        setSwarmState((prev) => ({
          ...prev,
          drones: updated,
          droneAlpha: updated[0],
          droneBeta: updated[1],
          droneGamma: updated[2],
          status: transitRatio >= 1 ? 'SPRAYING_PARALLEL' : 'TRANSIT_OUT',
        }));

        if (transitRatio < 1) {
          swarmAnimFrameIdRef.current = requestAnimationFrame(animateResumeTransit);
        } else {
          // Breakpoints reached -> proceed to spraying
          startParallelSprayingLoop();
        }
      };

      swarmAnimFrameIdRef.current = requestAnimationFrame(animateResumeTransit);
    } else {
      startParallelSprayingLoop();
    }
  }, [currentCoords, fieldArea, locationName, language]);

  // Handle Location Selection (from Search or Map Pin Click)
  const handleLocationSelect = useCallback(
    async (coords: Coordinates, name: string) => {
      setCurrentCoords(coords);
      setLocationName(name);
      const freshSubZones = generateFieldSubZones(coords, fieldArea);
      setSubZones(freshSubZones);
      subZonesRef.current = freshSubZones;
      setUserCustomizedPlots({});
      userCustomizedPlotsRef.current = {};
      setCustomPlotCoordinates(null);
      setHasCustomPlotCoordinates(false);
      const freshNfz = getNfzRestrictedZone(coords);
      setNfzPolygon(freshNfz);
      nfzPolygonRef.current = freshNfz;
      setHasNfzConflict(false);
      setSimulation((prev) => ({ ...prev, currentPos: coords, progress: 0 }));

      // Fetch live weather for newly selected location via zero-cost Open-Meteo API
      const weather = await fetchOpenMeteoWeather(coords.lat, coords.lng);
      const updatedTelemetry = {
        ...telemetry,
        temp: weather.temp,
        windSpeed: weather.windSpeed,
        precipitation: weather.precipitation,
        humidity: weather.humidity,
      };
      setTelemetry(updatedTelemetry);

      // Trigger Gemini AI advisory with new weather & coordinate context
      fetchAdvisoryReport(coords, updatedTelemetry, updatedTelemetry.battery, updatedTelemetry.tankLevel, fieldArea, freshSubZones);
    },
    [fieldArea, telemetry, fetchAdvisoryReport]
  );

  // Handle "Detect My Location" via HTML5 Geolocation API
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const detectedName = `GPS Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
        setIsDetectingLocation(false);
        handleLocationSelect(coords, detectedName);
      },
      (err) => {
        setIsDetectingLocation(false);
        console.warn('Geolocation access fallback:', err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [handleLocationSelect]);

  // Helper: Cancel any active flight animation / timers
  const cancelAllFlightTimers = useCallback(() => {
    if (rthTransitTimerRef.current) {
      clearTimeout(rthTransitTimerRef.current);
      rthTransitTimerRef.current = null;
    }
    if (rthIntervalRef.current) {
      clearInterval(rthIntervalRef.current);
      rthIntervalRef.current = null;
    }
    if (rthAnimFrameIdRef.current) {
      cancelAnimationFrame(rthAnimFrameIdRef.current);
      rthAnimFrameIdRef.current = null;
    }
    if (rechargeTimerRef.current) {
      clearTimeout(rechargeTimerRef.current);
      rechargeTimerRef.current = null;
    }
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  // Helper: Resume mission from saved waypoint breakpoint (Transit from Home Dock -> Saved Waypoint)
  const resumeMissionFromBreakpoint = useCallback(
    (customNotification?: string) => {
      // Pre-flight weather safety check: Cannot resume if weather is currently hazardous
      const weatherEval = evaluateWeatherSafety(telemetryRef.current);
      if (!weatherEval.isSafe) {
        setFailSafeNotification(CRITICAL_WEATHER_HAZARD_BANNER);
        playVoiceAlert(WEATHER_TAKEOFF_BLOCKED_VOICE_ALERT, language);
        setSimulation((prev) => ({
          ...prev,
          weatherAlertBanner: CRITICAL_WEATHER_HAZARD_BANNER,
          statusMessage: CRITICAL_WEATHER_HAZARD_BANNER,
        }));
        setTimeout(() => setFailSafeNotification(null), 7000);
        return;
      }

      const targetBp = breakpointRef.current;
      const resumeCoords: Coordinates =
        targetBp && targetBp.coordinates && typeof targetBp.coordinates.lat === 'number' && typeof targetBp.coordinates.lng === 'number'
          ? targetBp.coordinates
          : currentCoords;
      const dockCoords: Coordinates = {
        lat: currentCoords.lat - 0.0022,
        lng: currentCoords.lng - 0.0035,
      };

      const notification =
        customNotification ||
        translations[language].networkRestoredResume ||
        'NETWORK RESTORED: Re-establishing telemetry link. Resuming mission from saved waypoint.';
      setFailSafeNotification(notification);

      cancelAllFlightTimers();

      setAutoResumeCountdown(null);

      // If swarm was active or in hold, resume 6-drone swarm mission from saved breakpoints
      const isSwarmHold =
        swarmStateRef.current.isSwarmActive ||
        swarmStateRef.current.isManualEmergencyHold ||
        swarmStateRef.current.isNetworkLossHold ||
        swarmStateRef.current.isWeatherEmergencyHold ||
        swarmStateRef.current.status === 'MANUAL_EMERGENCY_HOLD' ||
        targetBp?.machineryType?.includes('Swarm') ||
        (swarmStateRef.current.drones && swarmStateRef.current.drones.some((d) => (d.progress || 0) > 0 && (d.progress || 0) < 100));

      if (isSwarmHold) {
        setSwarmState((prev) => ({
          ...prev,
          isManualEmergencyHold: false,
          isNetworkLossHold: false,
          isWeatherEmergencyHold: false,
          status: 'TRANSIT_OUT',
        }));
        setSimulation((prev) => ({
          ...prev,
          isGroundLocked: false,
          isNetworkLossHold: false,
          isManualEmergencyHold: false,
          isAutoResuming: false,
          failSafeReason: undefined,
          statusMessage: notification,
        }));
        handleDispatchSwarm(true);
        return;
      }

      setSimulation((prev) => ({
        ...prev,
        isGroundLocked: false,
        isNetworkLossHold: false,
        isManualEmergencyHold: false,
        isAutoResuming: true,
        failSafeReason: undefined,
        statusMessage: notification,
      }));

      // Smoothly animate drone marker from Home Dock back to last_breakpoint_waypoint (6s)
      const startLat = dockCoords.lat;
      const startLng = dockCoords.lng;
      const startTime = performance.now();
      const duration = 6000;

      const animateResumeTransit = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const tRatio = Math.min(1, elapsed / duration);
        const curLat = startLat + (resumeCoords.lat - startLat) * tRatio;
        const curLng = startLng + (resumeCoords.lng - startLng) * tRatio;

        setSimulation((prev) => ({
          ...prev,
          currentPos: { lat: curLat, lng: curLng },
        }));

        if (tRatio < 1) {
          rthAnimFrameIdRef.current = requestAnimationFrame(animateResumeTransit);
        } else {
          rthAnimFrameIdRef.current = null;
          const resumeAlert =
            translations[language].breakpointReachedResume ||
            'BREAKPOINT REACHED: Resuming remaining crop spraying route.';
          setFailSafeNotification(resumeAlert);

          setSimulation((prev) => ({
            ...prev,
            isAutoResuming: false,
            isRunning: true,
            isGroundLocked: false,
            isNetworkLossHold: false,
            isRTHActive: false,
            isRecharging: false,
            failSafeReason: undefined,
            currentPos: resumeCoords,
            progress: targetBp ? targetBp.progressPercent : prev.progress,
            statusMessage: resumeAlert,
          }));

          if (bannerClearTimerRef.current) clearTimeout(bannerClearTimerRef.current);
          bannerClearTimerRef.current = setTimeout(() => {
            setFailSafeNotification(null);
          }, 4500);
        }
      };

      rthAnimFrameIdRef.current = requestAnimationFrame(animateResumeTransit);
    },
    [currentCoords, language, cancelAllFlightTimers]
  );

  // Helper: Handle Arrival at Home Dock, Battery/Tank Replenishment, and Post-Landing Weather & Signal Check
  const handleDockAndRecharge = useCallback(
    (dockCoords: Coordinates, bp: BreakpointMemory) => {
      cancelAllFlightTimers();

      setSimulation((prev) => ({
        ...prev,
        currentPos: dockCoords,
        isRunning: false,
        isRTHActive: false,
        isWeatherEmergencyInFlight: false,
        isRecharging: true,
        statusMessage: `${translations[language].dockingAtCharger} • Servicing...`,
      }));

      rechargeTimerRef.current = setTimeout(() => {
        // Full battery & chemical tank replenishment at base dock
        setTelemetry((prev) => {
          const updated = {
            ...prev,
            battery: 100,
            tankLevel: activeUnit.maxTankCapacity,
          };
          telemetryRef.current = updated;
          return updated;
        });

        // 0. Manual Emergency Hold Check
        if (bp.reason === 'MANUAL_EMERGENCY' || bp.reason === 'MANUAL_ABORT') {
          const manualStandbyMsg =
            translations[language].manualEmergencyStandby ||
            'MANUAL EMERGENCY STANDBY: Aircraft safely docked. Waiting for manual resume command or weather auto-sentinel.';
          setSimulation((prev) => ({
            ...prev,
            isRecharging: false,
            isRTHActive: false,
            isAutoResuming: false,
            isGroundLocked: true,
            isManualEmergencyHold: true,
            failSafeReason: 'MANUAL_EMERGENCY_HOLD',
            statusMessage: manualStandbyMsg,
          }));
          setFailSafeNotification(manualStandbyMsg);
          return;
        }

        // 1. Network Disruption Ground Lock (NETWORK_LOSS_HOLD State)
        const isOfflineOrNoSignal =
          !isOnlineRef.current ||
          hardwareStateRef.current.rssiPercent === 0 ||
          bp.reason === 'SIGNAL_LOSS';

        if (
          isOfflineOrNoSignal &&
          (!isOnlineRef.current || hardwareStateRef.current.rssiPercent === 0)
        ) {
          const signalLockMsg =
            translations[language].signalLossGroundLock ||
            'SIGNAL LOSS FAIL-SAFE: Drone safely grounded at Home Dock. Awaiting network reconnection before resuming mission.';
          setSimulation((prev) => ({
            ...prev,
            isRecharging: false,
            isRTHActive: false,
            isAutoResuming: false,
            isGroundLocked: true,
            isNetworkLossHold: true,
            failSafeReason: 'NETWORK_LOSS_HOLD',
            statusMessage: signalLockMsg,
          }));
          setFailSafeNotification(signalLockMsg);
          return;
        }

        // 2. Post-Landing Weather Check (WEATHER_GROUND_LOCK / CRITICAL_WEATHER_GROUND_LOCK)
        const isBadWeather = isWeatherHazardous(telemetryRef.current);

        if (isBadWeather || bp.reason === 'WEATHER_EMERGENCY_ABORT' || bp.reason === 'CRITICAL_WEATHER') {
          const lockMsg =
            translations[language].criticalWeatherGroundLock ||
            'DRONE GROUNDED & RECHARGED (100%): Awaiting weather clearance before resuming mission.';
          setSimulation((prev) => ({
            ...prev,
            isRecharging: false,
            isRTHActive: false,
            isAutoResuming: false,
            isGroundLocked: true,
            isNetworkLossHold: false,
            failSafeReason: 'WEATHER_GROUND_LOCK',
            statusMessage: lockMsg,
          }));
          setFailSafeNotification(lockMsg);
        } else {
          // Weather and Network are safe: proceed to auto-resume back to saved breakpoint
          setFailSafeNotification(translations[language].batterySwappedNotification);
          resumeTimerRef.current = setTimeout(() => {
            resumeMissionFromBreakpoint(translations[language].batterySwappedNotification);
          }, 1400);
        }
      }, 1400);
    },
    [activeUnit.maxTankCapacity, language, cancelAllFlightTimers, resumeMissionFromBreakpoint]
  );

  // Instant Frame-Level & Drag Emergency Weather Abort (< 100ms Latency)
  const triggerEmergencyWeatherAbort = useCallback(() => {
    const dockCoords: Coordinates = {
      lat: currentCoords.lat - 0.0022,
      lng: currentCoords.lng - 0.0035,
    };

    const currentPos = simulationRef.current.currentPos;
    const currentProgress = simulationRef.current.progress;
    const currentBatt = telemetryRef.current.battery;
    const currentTank = telemetryRef.current.tankLevel;

    // 1. Immediately freeze forward progress & record exact GPS coordinates as last_breakpoint_waypoint (< 100ms)
    const bp: BreakpointMemory = {
      waypointIndex: Math.floor(currentProgress),
      coordinates: { ...currentPos },
      batteryAtBreakpoint: currentBatt,
      tankAtBreakpoint: currentTank,
      unitId: activeUnitId,
      machineryType,
      missionType,
      reason: 'WEATHER_EMERGENCY_ABORT',
      timestamp: new Date().toISOString(),
      progressPercent: currentProgress,
    };
    setBreakpoint(bp);
    setCachedBreakpoint(bp);
    breakpointRef.current = bp;

    // 2. Display Immediate UI Alert Banner & Speech Synthesis Voice Alert
    const alertMsg =
      translations[language].midFlightAbortAlert ||
      'MID-FLIGHT ABORT ENGAGED: Severe weather detected en route! Returning immediately to Home Dock.';
    setFailSafeNotification(alertMsg);
    playVoiceAlert(WEATHER_ABORT_VOICE_ALERT, language);

    // Cancel prior timers and animations
    cancelAllFlightTimers();

    // 3. Instantly engage RTH state and set target destination to Home Dock at maximum return speed
    setSimulation((prev) => ({
      ...prev,
      isRunning: false,
      isRTHActive: true,
      rthOrigin: { ...currentPos },
      isRecharging: false,
      isAutoResuming: false,
      isGroundLocked: false,
      isWeatherEmergencyInFlight: true,
      failSafeReason: 'WEATHER_EMERGENCY_ABORT',
      statusMessage: alertMsg,
    }));

    // 4. Smooth Visual Return Animation: Animate marker smoothly along straight-line vector to dock at maximum return speed
    const startLat = currentPos.lat;
    const startLng = currentPos.lng;
    const startTime = performance.now();
    const duration = 3000; // 3s fast return straight-line vector

    const animateRTH = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const tRatio = Math.min(1, elapsed / duration);
      // Direct straight-line vector interpolation back to Home Dock
      const curLat = startLat + (dockCoords.lat - startLat) * tRatio;
      const curLng = startLng + (dockCoords.lng - startLng) * tRatio;

      setSimulation((prev) => ({
        ...prev,
        currentPos: { lat: curLat, lng: curLng },
      }));

      if (tRatio < 1) {
        rthAnimFrameIdRef.current = requestAnimationFrame(animateRTH);
      } else {
        rthAnimFrameIdRef.current = null;
        handleDockAndRecharge(dockCoords, bp);
      }
    };

    rthAnimFrameIdRef.current = requestAnimationFrame(animateRTH);
  }, [
    currentCoords,
    activeUnitId,
    machineryType,
    missionType,
    language,
    handleDockAndRecharge,
    cancelAllFlightTimers,
  ]);

  // Instant Signal Loss In-Flight Abort (< 100ms Latency)
  const triggerSignalLossAbort = useCallback(() => {
    const dockCoords: Coordinates = {
      lat: currentCoords.lat - 0.0022,
      lng: currentCoords.lng - 0.0035,
    };

    const currentPos = simulationRef.current.currentPos;
    const currentProgress = simulationRef.current.progress;
    const currentBatt = telemetryRef.current.battery;
    const currentTank = telemetryRef.current.tankLevel;

    // 1. Immediately halt current route progression within 100ms and record current GPS coordinates as last_breakpoint_waypoint
    const bp: BreakpointMemory = {
      waypointIndex: Math.floor(currentProgress),
      coordinates: { ...currentPos },
      batteryAtBreakpoint: currentBatt,
      tankAtBreakpoint: currentTank,
      unitId: activeUnitId,
      machineryType,
      missionType,
      reason: 'SIGNAL_LOSS',
      timestamp: new Date().toISOString(),
      progressPercent: currentProgress,
    };
    setBreakpoint(bp);
    setCachedBreakpoint(bp);
    breakpointRef.current = bp;

    const alertMsg =
      translations[language].signalLossInFlightAbort ||
      'SIGNAL LOSS DETECTED (0% RSSI): Halting current route and returning immediately to Home Dock.';
    setFailSafeNotification(alertMsg);
    playVoiceAlert('Warning: Telemetry signal lost. Fail-safe Return-to-Home engaged.', language);

    // Cancel prior flight timers and animations
    cancelAllFlightTimers();

    // 2. Set target destination to Home Dock and engage RTH
    setSimulation((prev) => ({
      ...prev,
      isRunning: false,
      isRTHActive: true,
      rthOrigin: { ...currentPos },
      isRecharging: false,
      isAutoResuming: false,
      isGroundLocked: false,
      isNetworkLossHold: false,
      isWeatherEmergencyInFlight: false,
      failSafeReason: 'SIGNAL_LOSS',
      statusMessage: alertMsg,
    }));

    // 3. Animate drone marker flying directly back to base
    const startLat = currentPos.lat;
    const startLng = currentPos.lng;
    const startTime = performance.now();
    const duration = 6000;

    const animateSignalLossRTH = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const tRatio = Math.min(1, elapsed / duration);
      const curLat = startLat + (dockCoords.lat - startLat) * tRatio;
      const curLng = startLng + (dockCoords.lng - startLng) * tRatio;

      setSimulation((prev) => ({
        ...prev,
        currentPos: { lat: curLat, lng: curLng },
      }));

      if (tRatio < 1) {
        rthAnimFrameIdRef.current = requestAnimationFrame(animateSignalLossRTH);
      } else {
        rthAnimFrameIdRef.current = null;
        handleDockAndRecharge(dockCoords, bp);
      }
    };

    rthAnimFrameIdRef.current = requestAnimationFrame(animateSignalLossRTH);
  }, [
    currentCoords,
    activeUnitId,
    machineryType,
    missionType,
    language,
    handleDockAndRecharge,
    cancelAllFlightTimers,
  ]);

  // Fail-Safe Return-To-Home (RTH) Execution Protocol for Low-Batt, Empty-Tank, Signal-Loss, Manual
  const triggerAutoRTH = useCallback(
    (reason: FailSafeReason = 'MANUAL_ABORT') => {
      const t = translations[language];
      const dockCoords: Coordinates = {
        lat: currentCoords.lat - 0.0022,
        lng: currentCoords.lng - 0.0035,
      };

      const isBadWeather =
        telemetryRef.current.windSpeed > 18 || telemetryRef.current.precipitation > 5;

      if (isBadWeather || reason === 'CRITICAL_WEATHER') {
        triggerEmergencyWeatherAbort();
        return;
      }

      if (reason === 'SIGNAL_LOSS') {
        triggerSignalLossAbort();
        return;
      }

      // 1. Save precise waypoint break-point memory
      const currentPos = simulationRef.current.currentPos;
      const currentProgress = simulationRef.current.progress;
      const bp: BreakpointMemory = {
        waypointIndex: Math.floor(currentProgress),
        coordinates: { ...currentPos },
        batteryAtBreakpoint: telemetryRef.current.battery,
        tankAtBreakpoint: telemetryRef.current.tankLevel,
        unitId: activeUnitId,
        machineryType,
        missionType,
        reason,
        timestamp: new Date().toISOString(),
        progressPercent: currentProgress,
      };
      setBreakpoint(bp);
      setCachedBreakpoint(bp);
      breakpointRef.current = bp;

      let alertMsg = `${t.emergencyRthBtn} - Returning to Dock Station 01`;
      let voiceText = 'Manual abort engaged. Returning to dock.';
      if (reason === 'LOW_BATTERY') {
        alertMsg = t.criticalBatteryWarning;
        voiceText = 'Critical battery level. Returning to charging station.';
      } else if (reason === 'EMPTY_TANK') {
        alertMsg = t.emptyTankWarning;
        voiceText = 'Chemical tank depleted. Returning to dock for refill.';
      }
      setFailSafeNotification(alertMsg);
      playVoiceAlert(voiceText, language);

      cancelAllFlightTimers();

      // 2. Initiate RTH Animation Protocol
      setSimulation((prev) => ({
        ...prev,
        isRunning: false,
        isRTHActive: true,
        rthOrigin: { ...currentPos },
        isRecharging: false,
        isAutoResuming: false,
        isGroundLocked: false,
        isNetworkLossHold: false,
        isWeatherEmergencyInFlight: false,
        failSafeReason: reason,
        statusMessage: `Auto-RTH in progress: ${reason}`,
      }));

      // Direct trajectory animation back to dock
      const startLat = currentPos.lat;
      const startLng = currentPos.lng;
      const startTime = performance.now();
      const duration = 5000;

      const animateStandardRTH = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const tRatio = Math.min(1, elapsed / duration);
        const curLat = startLat + (dockCoords.lat - startLat) * tRatio;
        const curLng = startLng + (dockCoords.lng - startLng) * tRatio;

        setSimulation((prev) => ({
          ...prev,
          currentPos: { lat: curLat, lng: curLng },
        }));

        if (tRatio < 1) {
          rthAnimFrameIdRef.current = requestAnimationFrame(animateStandardRTH);
        } else {
          rthAnimFrameIdRef.current = null;
          handleDockAndRecharge(dockCoords, bp);
        }
      };

      rthAnimFrameIdRef.current = requestAnimationFrame(animateStandardRTH);
    },
    [
      currentCoords,
      activeUnitId,
      machineryType,
      missionType,
      language,
      handleDockAndRecharge,
      triggerEmergencyWeatherAbort,
      triggerSignalLossAbort,
      cancelAllFlightTimers,
    ]
  );

  // Dedicated Manual Emergency RTH Protocol (Swarm + Single Aircraft)
  const handleEmergencyRTH = useCallback(() => {
    // 1. If swarm mission is actively running or spraying
    if (swarmState.isSwarmActive && swarmState.status === 'SPRAYING_PARALLEL') {
      cancelAllFlightTimers();
      if (swarmAnimFrameIdRef.current) {
        cancelAnimationFrame(swarmAnimFrameIdRef.current);
        swarmAnimFrameIdRef.current = null;
      }
      const currentDrones = swarmState.drones || [];
      const dockCoords: Coordinates = {
        lat: currentCoords.lat - 0.0022,
        lng: currentCoords.lng - 0.0035,
      };

      const bp: BreakpointMemory = {
        waypointIndex: Math.floor(currentDrones[0]?.progress || 50),
        coordinates: { ...(currentDrones[0]?.coords || currentCoords) },
        batteryAtBreakpoint: telemetryRef.current.battery,
        tankAtBreakpoint: telemetryRef.current.tankLevel,
        unitId: activeUnitId,
        machineryType,
        missionType,
        reason: 'MANUAL_EMERGENCY',
        timestamp: new Date().toISOString(),
        progressPercent: currentDrones[0]?.progress || 50,
      };
      setBreakpoint(bp);
      setCachedBreakpoint(bp);
      breakpointRef.current = bp;

      const alertMsg = `${translations[language].emergencyRthBtn} - All swarm aircraft returning to base`;
      setFailSafeNotification(alertMsg);
      playVoiceAlert('Manual emergency abort engaged. All aircraft returning to dock.', language);

      setSwarmState((prev) => ({
        ...prev,
        status: 'RETURNING_HOME',
        isManualEmergencyHold: false,
      }));

      const startPositions = currentDrones.map((d) => ({ ...d.coords }));
      const startTime = performance.now();
      const duration = 4500;

      const animateSwarmManualRTH = (time: number) => {
        const elapsed = time - startTime;
        const tRatio = Math.min(1, elapsed / duration);
        const updated = currentDrones.map((d, i) => {
          const startP = startPositions[i] || d.coords;
          return {
            ...d,
            coords: {
              lat: startP.lat + (dockCoords.lat - startP.lat) * tRatio,
              lng: startP.lng + (dockCoords.lng - startP.lng) * tRatio,
            },
            status: (tRatio >= 1 ? 'DOCKED_COMPLETED' : 'RETURNING_HOME') as any,
          };
        });

        setSwarmState((prev) => ({
          ...prev,
          drones: updated,
          droneAlpha: updated[0],
          droneBeta: updated[1],
          droneGamma: updated[2],
          status: tRatio >= 1 ? 'MANUAL_EMERGENCY_HOLD' : 'RETURNING_HOME',
          isManualEmergencyHold: tRatio >= 1,
        }));

        if (tRatio < 1) {
          swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarmManualRTH);
        } else {
          swarmAnimFrameIdRef.current = null;
          setSimulation((prev) => ({
            ...prev,
            isRunning: false,
            isRTHActive: false,
            isManualEmergencyHold: true,
            isGroundLocked: true,
            failSafeReason: 'MANUAL_EMERGENCY_HOLD',
            statusMessage: translations[language].manualEmergencyStandby,
          }));
          setFailSafeNotification(translations[language].manualEmergencyStandby);
        }
      };

      swarmAnimFrameIdRef.current = requestAnimationFrame(animateSwarmManualRTH);
      return;
    }

    // 2. Single unit emergency abort:
    triggerAutoRTH('MANUAL_EMERGENCY');
  }, [
    swarmState,
    currentCoords,
    activeUnitId,
    machineryType,
    missionType,
    language,
    cancelAllFlightTimers,
    triggerAutoRTH,
  ]);

  // Cancel Auto-Resume Countdown Helper
  const handleCancelAutoResumeCountdown = useCallback(() => {
    setAutoResumeCountdown(null);
    setAutoResumeWeatherEnabled(false);
  }, []);

  // 12. Smart Weather Sentinel: Auto-detect safe weather & trigger auto-resume countdown if in Manual Emergency Hold
  useEffect(() => {
    if (!simulation.isManualEmergencyHold || !breakpoint || !autoResumeWeatherEnabled) {
      if (autoResumeCountdown !== null) {
        setAutoResumeCountdown(null);
      }
      return;
    }

    const isSafe =
      !isWeatherHazardous(telemetry) &&
      isOnline &&
      (hardwareState.rssiPercent > 0 || !hardwareState.isLiveHardware);

    if (!isSafe) {
      if (autoResumeCountdown !== null) {
        setAutoResumeCountdown(null);
      }
      return;
    }

    // Weather is safe: start countdown if not already started
    if (autoResumeCountdown === null) {
      setAutoResumeCountdown(10);
      return;
    }

    if (autoResumeCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoResumeCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (autoResumeCountdown === 0) {
      // Countdown finished -> trigger auto-resume!
      setAutoResumeCountdown(null);
      const sentinelMsg =
        translations[language].weatherClearanceVerified ||
        'WEATHER SENTINEL: Safe atmospheric conditions detected. Auto-resuming mission from saved breakpoint coordinate.';
      resumeMissionFromBreakpoint(sentinelMsg);
    }
  }, [
    simulation.isManualEmergencyHold,
    breakpoint,
    autoResumeWeatherEnabled,
    autoResumeCountdown,
    telemetry.windSpeed,
    telemetry.precipitation,
    isOnline,
    hardwareState.rssiPercent,
    hardwareState.isLiveHardware,
    language,
    resumeMissionFromBreakpoint,
  ]);

  // Post-Mission Automated Return-to-Home (Auto-RTH) on 100% Field Coverage
  const triggerMissionCompletedAutoRTH = useCallback(
    (finalFieldCoords: Coordinates) => {
      const t = translations[language];
      const dockCoords: Coordinates = {
        lat: currentCoords.lat - 0.0022,
        lng: currentCoords.lng - 0.0035,
      };

      // 1. 100% Mission Completion Detection: Update state to MISSION_COMPLETED & display success banner
      const successMsg = `MISSION COMPLETE: Covered 100% of target field area (${fieldArea.toFixed(1)} ha). Returning to Home Dock.`;
      setFailSafeNotification(successMsg);
      playVoiceAlert('Mission accomplished: 100% field coverage complete. Returning to Home Dock.', language);

      // Clear any pending breakpoint memory since mission is 100% complete
      setBreakpoint(null);
      setCachedBreakpoint(null);
      breakpointRef.current = null;

      // Update unit status to MISSION_COMPLETED
      setFleetUnits((prev) => ({
        ...prev,
        [activeUnitId]: {
          ...prev[activeUnitId],
          status: 'MISSION_COMPLETED',
        },
      }));

      cancelAllFlightTimers();

      // 2. Automated Return Transit: Animate drone marker flying from final coordinate directly back to Home Dock
      setSimulation((prev) => ({
        ...prev,
        isRunning: false,
        progress: 100,
        isRTHActive: true,
        rthOrigin: { ...finalFieldCoords },
        isRecharging: false,
        isAutoResuming: false,
        isGroundLocked: false,
        isNetworkLossHold: false,
        isWeatherEmergencyInFlight: false,
        failSafeReason: undefined,
        statusMessage: successMsg,
      }));

      const startLat = finalFieldCoords.lat;
      const startLng = finalFieldCoords.lng;
      const startTime = performance.now();
      const duration = 6000; // Smooth steady return transit

      const animateCompletedReturnTransit = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const tRatio = Math.min(1, elapsed / duration);
        const curLat = startLat + (dockCoords.lat - startLat) * tRatio;
        const curLng = startLng + (dockCoords.lng - startLng) * tRatio;

        setSimulation((prev) => ({
          ...prev,
          currentPos: { lat: curLat, lng: curLng },
        }));

        if (tRatio < 1) {
          rthAnimFrameIdRef.current = requestAnimationFrame(animateCompletedReturnTransit);
        } else {
          rthAnimFrameIdRef.current = null;

          // 3. Landing & Mission Summary Sync: Set unit state to PARKED_READY and recharge/refill back to 100%
          setFleetUnits((prev) => ({
            ...prev,
            [activeUnitId]: {
              ...prev[activeUnitId],
              status: 'PARKED_READY',
              battery: 100,
              tankLevel: prev[activeUnitId].maxTankCapacity,
            },
          }));

          setSimulation((prev) => ({
            ...prev,
            isRunning: false,
            isRTHActive: false,
            currentPos: dockCoords,
            progress: 100,
            statusMessage: 'Mission Accomplished • Drone Parked at Home Dock',
          }));

          setTelemetry((prev) => {
            const updated = {
              ...prev,
              battery: 100,
              tankLevel: activeUnit.maxTankCapacity,
            };
            telemetryRef.current = updated;
            return updated;
          });

          // Append a final summary row to the Live Audit Log:
          // [Timestamp | Mission Completed | 100% Coverage Reached | Drone Returned to Home Dock | SYNCED_ONLINE]
          const now = new Date();
          const summaryEntry: Omit<AuditLogEntry, 'id'> = {
            timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
            locationName: `${locationName} • Home Dock`,
            coordinates: dockCoords,
            weatherSummary: `${telemetryRef.current.temp.toFixed(1)}°C • Wind: ${telemetryRef.current.windSpeed.toFixed(1)} km/h • Precip: ${telemetryRef.current.precipitation.toFixed(1)} mm/h`,
            machinery: machineryType,
            mission: `100% Coverage Reached (${fieldArea.toFixed(1)} ha)`,
            tankLevel: `Completed • ${(fieldArea * 16).toFixed(1)}L spray used`,
            actionApproved: 'Drone Returned to Home Dock',
            energySavedKgCo2: parseFloat((14.2 + fieldArea * 3.5).toFixed(1)),
            syncStatus: isOnlineRef.current ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE',
          };

          const updatedLogs = addAuditLog(summaryEntry);
          setAuditLogs(updatedLogs);

          if (bannerClearTimerRef.current) clearTimeout(bannerClearTimerRef.current);
          bannerClearTimerRef.current = setTimeout(() => {
            setFailSafeNotification(null);
          }, 8000);
        }
      };

      rthAnimFrameIdRef.current = requestAnimationFrame(animateCompletedReturnTransit);
    },
    [
      currentCoords,
      activeUnitId,
      machineryType,
      activeUnit.maxTankCapacity,
      locationName,
      language,
      fieldArea,
      cancelAllFlightTimers,
    ]
  );

  // Dynamic Telemetry Handler with Instant Zero-Latency Trigger on Manual Slider Drag
  const handleTelemetryChange = useCallback(
    (newTelemetry: TelemetryData) => {
      telemetryRef.current = newTelemetry;
      setTelemetry(newTelemetry);

      const isBadWeather = isWeatherHazardous(newTelemetry);
      const sim = simulationRef.current;

      // 1. Instant Pause & Emergency Abort on Manual Slider Drag while in flight (< 50ms)
      if (
        (sim.isRunning || sim.isAutoResuming) &&
        !sim.isRTHActive &&
        !sim.isRecharging &&
        !sim.isGroundLocked
      ) {
        if (isBadWeather) {
          triggerEmergencyWeatherAbort();
          return;
        }
      }

      // 2. Real-Time Telemetry Polling During RTH Transit & Dynamic Emergency Priority Escalation
      if (sim.isRTHActive && isBadWeather && !sim.isWeatherEmergencyInFlight) {
        const emergencyMsg =
          translations[language].midFlightAbortAlert ||
          'MID-FLIGHT ABORT ENGAGED: Severe weather detected en route! Returning immediately to Home Dock.';
        setFailSafeNotification(emergencyMsg);
        setSimulation((prev) => ({
          ...prev,
          isWeatherEmergencyInFlight: true,
          failSafeReason: 'WEATHER_EMERGENCY_ABORT',
          statusMessage: emergencyMsg,
        }));
      }

      // 3. Automated Cleared-Weather Resume (WEATHER_GROUND_LOCK / CRITICAL_WEATHER_GROUND_LOCK -> Cleared Resume)
      // Only auto-resume if NOT locked by network disconnection and online and autoResumeWeatherEnabled!
      if (
        sim.isGroundLocked &&
        !sim.isNetworkLossHold &&
        !sim.isManualEmergencyHold &&
        isOnlineRef.current &&
        !isBadWeather &&
        autoResumeWeatherEnabled
      ) {
        resumeMissionFromBreakpoint(
          translations[language].weatherClearanceVerified ||
            'WEATHER CLEARANCE VERIFIED: Resuming mission from Saved Break-Point.'
        );
      }
    },
    [triggerEmergencyWeatherAbort, language, resumeMissionFromBreakpoint, autoResumeWeatherEnabled]
  );

  // Network Connectivity Event Listeners (Online / Offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      setHardwareState((prev) => {
        const updated = { ...prev, rssiPercent: 95 };
        hardwareStateRef.current = updated;
        return updated;
      });
      const updated = syncOfflineLogsToOnline();
      setAuditLogs(updated);

      const sim = simulationRef.current;
      const isLockedByNetwork =
        sim.isNetworkLossHold ||
        (sim.isGroundLocked && breakpointRef.current?.reason === 'SIGNAL_LOSS');

      if (isLockedByNetwork) {
        const isBadWeather =
          telemetryRef.current.windSpeed > 18 || telemetryRef.current.precipitation > 5;
        if (!isBadWeather) {
          resumeMissionFromBreakpoint();
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      isOnlineRef.current = false;
      setHardwareState((prev) => {
        const updated = { ...prev, rssiPercent: 0 };
        hardwareStateRef.current = updated;
        return updated;
      });
      const sim = simulationRef.current;
      const isInFlight = sim.isRunning || sim.isAutoResuming || sim.isRTHActive;
      if (isInFlight) {
        triggerSignalLossAbort();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSignalLossAbort, resumeMissionFromBreakpoint]);

  // Watch for Automatic Fail-Safe Triggers: Low Battery (<=20%) or Empty Tank (0L)
  useEffect(() => {
    if (
      simulation.isRTHActive ||
      simulation.isRecharging ||
      simulation.isGroundLocked ||
      simulation.isAutoResuming
    ) {
      return;
    }

    if (telemetry.battery <= 20) {
      triggerAutoRTH('LOW_BATTERY');
    } else if (telemetry.tankLevel <= 0) {
      triggerAutoRTH('EMPTY_TANK');
    }
  }, [
    telemetry.battery,
    telemetry.tankLevel,
    simulation.isRTHActive,
    simulation.isRecharging,
    simulation.isGroundLocked,
    simulation.isAutoResuming,
    triggerAutoRTH,
  ]);

  // Frame-Level Emergency Interlock & Steady Realistic Crop Field Spraying Loop (Reduced Speed ~65-70%)
  useEffect(() => {
    if (
      !simulation.isRunning ||
      simulation.isRTHActive ||
      simulation.isRecharging ||
      simulation.isGroundLocked ||
      simulation.isAutoResuming
    ) {
      return;
    }

    const waypoints = generateFlightPathWaypoints(currentCoords, fieldArea, subZonesRef.current);

    // 40ms high-frequency smooth tick with 60-70% reduced progress velocity
    const interval = setInterval(() => {
      // 1. Frame-level weather evaluation on EVERY tick (zero latency, < 40ms)
      const currWeather = telemetryRef.current;
      if (isWeatherHazardous(currWeather)) {
        clearInterval(interval);
        triggerEmergencyWeatherAbort();
        return;
      }

      if (currWeather.battery <= 20) {
        clearInterval(interval);
        triggerAutoRTH('LOW_BATTERY');
        return;
      }

      if (currWeather.tankLevel <= 0) {
        clearInterval(interval);
        triggerAutoRTH('EMPTY_TANK');
        return;
      }

      // 2. Advance forward progress steadily along realistic boustrophedon crop swath (65% slower)
      const currentProg = simulationRef.current.progress;
      const nextProgress = currentProg + 0.045 * simulationRef.current.speedMultiplier;

      if (nextProgress >= 100) {
        clearInterval(interval);
        const finalPos = interpolateFlightPath(waypoints, 100);
        setSimulation((prev) => ({
          ...prev,
          isRunning: false,
          progress: 100,
          currentPos: finalPos,
          sprayTrail: [...(prev.sprayTrail || []), finalPos],
          statusMessage: '100% Field Coverage Achieved - Initiating Auto-RTH',
        }));
        triggerMissionCompletedAutoRTH(finalPos);
        return;
      }

      setSimulation((prev) => {
        const newPos = interpolateFlightPath(waypoints, nextProgress);

        // Update spray swath trail
        const currentTrail = prev.sprayTrail || [];
        let newTrail = currentTrail;

        if (currentTrail.length === 0) {
          newTrail = [newPos];
        } else {
          const lastPoint = currentTrail[currentTrail.length - 1];
          const distSq =
            Math.pow(newPos.lat - lastPoint.lat, 2) + Math.pow(newPos.lng - lastPoint.lng, 2);
          // Only add point if moved a measurable distance (preserves high performance)
          if (distSq > 0.00000002) {
            // Keep maximum 800 trail points
            newTrail = currentTrail.length > 800 ? [...currentTrail.slice(-700), newPos] : [...currentTrail, newPos];
          }
        }

        return {
          ...prev,
          progress: nextProgress,
          currentPos: newPos,
          sprayTrail: newTrail,
        };
      });

      // 3. Incrementally consume battery and spray chemicals realistically
      setTelemetry((prev) => {
        const newBatt = Math.max(0, prev.battery - 0.015);
        const newTank = Math.max(0, prev.tankLevel - 0.012);
        const updated = {
          ...prev,
          battery: parseFloat(newBatt.toFixed(2)),
          tankLevel: parseFloat(newTank.toFixed(2)),
          workingHours: parseFloat((prev.workingHours + 0.0008).toFixed(4)),
        };
        telemetryRef.current = updated;
        return updated;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [
    simulation.isRunning,
    simulation.isRTHActive,
    simulation.isRecharging,
    simulation.isGroundLocked,
    simulation.isAutoResuming,
    currentCoords,
    fieldArea,
    triggerEmergencyWeatherAbort,
    triggerAutoRTH,
    triggerMissionCompletedAutoRTH,
  ]);

  // Handle Simulate Network Drop Toggle
  const handleToggleNetwork = () => {
    const nextOnline = !isOnline;
    setIsOnline(nextOnline);
    isOnlineRef.current = nextOnline;
    setHardwareState((prev) => {
      const updated = {
        ...prev,
        rssiPercent: nextOnline ? 95 : 0,
      };
      hardwareStateRef.current = updated;
      return updated;
    });

    if (!nextOnline) {
      // 1. Immediate Signal Loss In-Flight Abort (< 100ms)
      const sim = simulationRef.current;
      const isInFlight = sim.isRunning || sim.isAutoResuming || sim.isRTHActive;
      if (isInFlight) {
        triggerSignalLossAbort();
      }
    } else {
      // 2. Network Reconnection & Mission Resume Interlock
      const updatedLogs = syncOfflineLogsToOnline();
      setAuditLogs(updatedLogs);

      const sim = simulationRef.current;
      const isLockedByNetwork =
        sim.isNetworkLossHold ||
        (sim.isGroundLocked && breakpointRef.current?.reason === 'SIGNAL_LOSS');

      if (isLockedByNetwork) {
        const isBadWeather = isWeatherHazardous(telemetryRef.current);
        if (isBadWeather) {
          setSimulation((prev) => ({
            ...prev,
            isNetworkLossHold: false,
            failSafeReason: 'WEATHER_GROUND_LOCK',
            statusMessage: translations[language].criticalWeatherGroundLock,
          }));
          setFailSafeNotification(translations[language].criticalWeatherGroundLock);
        } else {
          resumeMissionFromBreakpoint();
        }
      }
    }
  };

  // Handle Mission Dispatch
  const handleDispatchMission = () => {
    // Pre-flight weather safety check for all drones
    const weatherEval = evaluateWeatherSafety(telemetryRef.current);
    if (!weatherEval.isSafe) {
      setFailSafeNotification(CRITICAL_WEATHER_HAZARD_BANNER);
      playVoiceAlert(WEATHER_TAKEOFF_BLOCKED_VOICE_ALERT, language);
      setSimulation((prev) => ({
        ...prev,
        weatherAlertBanner: CRITICAL_WEATHER_HAZARD_BANNER,
        statusMessage: CRITICAL_WEATHER_HAZARD_BANNER,
      }));
      setTimeout(() => setFailSafeNotification(null), 7000);
      return;
    }

    setIsDispatching(true);

    setTimeout(() => {
      setIsDispatching(false);
      // Start simulation
      setFleetUnits((prev) => ({
        ...prev,
        [activeUnitId]: {
          ...prev[activeUnitId],
          status: 'ACTIVE',
        },
      }));
      setSimulation((prev) => ({
        ...prev,
        isRunning: true,
        progress: 0,
        currentPos: currentCoords,
        sprayTrail: [currentCoords],
        rthOrigin: null,
        statusMessage: 'Autonomous Swath Dispersion in Progress',
      }));

      // Add to Audit Log with Tank & Machine metadata
      const now = new Date();
      const weatherSummary = `${telemetry.temp.toFixed(1)}°C • Wind: ${telemetry.windSpeed.toFixed(
        1
      )} km/h • Precip: ${telemetry.precipitation.toFixed(1)} mm/h`;
      const actionText = hardwareState.isLiveHardware
        ? 'Waypoints Uploaded to Physical Unit (RTK RTCM3)'
        : 'Approved Simulation Route Synchronized';

      const updatedLogs = addAuditLog({
        timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
        locationName,
        coordinates: currentCoords,
        fieldArea,
        weatherSummary,
        machinery: machineryType,
        mission: missionType,
        tankLevel: `${telemetry.tankLevel.toFixed(1)} L / ${activeUnit.maxTankCapacity}L`,
        actionApproved: actionText,
        energySavedKgCo2: parseFloat((8.5 + fieldArea * 2.8).toFixed(1)),
        syncStatus: isOnline ? 'SYNCED_ONLINE' : 'CACHED_OFFLINE',
      });
      setAuditLogs(updatedLogs);
    }, 600);
  };

  // Handle Run Daily Simulation
  const handleToggleSimulation = () => {
    // Pre-flight weather safety check
    if (!simulation.isRunning) {
      const weatherEval = evaluateWeatherSafety(telemetryRef.current);
      if (!weatherEval.isSafe) {
        setFailSafeNotification(CRITICAL_WEATHER_HAZARD_BANNER);
        playVoiceAlert(WEATHER_TAKEOFF_BLOCKED_VOICE_ALERT, language);
        setSimulation((prev) => ({
          ...prev,
          weatherAlertBanner: CRITICAL_WEATHER_HAZARD_BANNER,
          statusMessage: CRITICAL_WEATHER_HAZARD_BANNER,
        }));
        setTimeout(() => setFailSafeNotification(null), 7000);
        return;
      }
    }

    setFleetUnits((prev) => ({
      ...prev,
      [activeUnitId]: {
        ...prev[activeUnitId],
        status: !simulation.isRunning ? 'ACTIVE' : 'IDLE',
      },
    }));

    setSimulation((prev) => ({
      ...prev,
      isRunning: !prev.isRunning,
      statusMessage: !prev.isRunning ? 'Running Daily Simulation' : 'Simulation Paused',
    }));
  };

  const handleResetSimulation = () => {
    cancelAllFlightTimers();
    setFleetUnits((prev) => ({
      ...prev,
      [activeUnitId]: {
        ...prev[activeUnitId],
        status: 'IDLE',
        battery: 90,
        tankLevel: prev[activeUnitId].maxTankCapacity,
      },
    }));
    setSimulation({
      isRunning: false,
      isPaused: false,
      speedMultiplier: 1.0,
      progress: 0,
      currentPos: currentCoords,
      activePath: [],
      sprayTrail: [],
      rthOrigin: null,
      isRTHActive: false,
      isRecharging: false,
      isAutoResuming: false,
      isGroundLocked: false,
      isNetworkLossHold: false,
      isManualEmergencyHold: false,
      isWeatherEmergencyInFlight: false,
      statusMessage: 'Simulation Reset',
    });
    setBreakpoint(null);
    setCachedBreakpoint(null);
    setFailSafeNotification(null);
    setTelemetry((prev) => ({
      ...prev,
      battery: 90,
      tankLevel: activeUnit.maxTankCapacity,
    }));
  };

  // Handle Export VietGAP PDF Compliance Report
  const handleExportVietGapPdf = () => {
    exportVietGapPdf({
      cooperativeName: 'Mekong Agri-Tech Cooperative Alliance (VIETGAP-COOP-08)',
      operatorName: 'Senior Chief Agronomist & Drone Dispatcher',
      fieldLocation: locationName,
      coordinates: currentCoords,
      cropType: 'ST25 Premium Fragrant Paddy Rice',
      areaHectares: fieldArea,
      activeUnit,
      telemetry,
      advisory,
      auditLogs,
      language,
      subZones: subZonesRef.current,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Header & Navigation Bar */}
      <Navbar
        language={language}
        onLanguageChange={handleLanguageChange}
        isOnline={isOnline}
        onToggleNetwork={handleToggleNetwork}
        telemetry={telemetry}
        locationName={locationName}
        isDetectingLocation={isDetectingLocation}
        onDetectLocation={handleDetectLocation}
        isSimulating={simulation.isRunning}
        onToggleSimulation={handleToggleSimulation}
        onResetSimulation={handleResetSimulation}
        onExportVietGapPdf={handleExportVietGapPdf}
        onAcceptSaveMission={handleAcceptSaveMissionPerformance}
        onOpenSavedMission={handleOpenSavedMission}
      />

      {/* Main Workspace Dashboard */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 md:p-5 flex flex-col gap-4 md:gap-5">
        {/* Top Grid: Interactive Map (60%) + Hardware & AI Advisory (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 min-h-[580px]">
          {/* Left Column: Interactive Global Map Canvas (60% ~ 7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 h-[500px] lg:h-full flex flex-col">
            <MapCanvas
              language={language}
              currentCoords={currentCoords}
              locationName={locationName}
              onLocationSelect={handleLocationSelect}
              telemetry={telemetry}
              onTelemetryChange={handleTelemetryChange}
              simulation={simulation}
              breakpoint={breakpoint}
              onUseGps={handleDetectLocation}
              isGpsLoading={isDetectingLocation}
              activeUnit={activeUnit}
              failSafeNotification={failSafeNotification}
              fieldArea={fieldArea}
              onFieldAreaChange={setFieldArea}
              subZones={subZones}
              onSubZoneUpdate={handleSubZoneUpdate}
              activeBrush={activeBrush}
              onActiveBrushChange={setActiveBrush}
              swarmState={swarmState}
              onDispatchSwarm={handleDispatchSwarm}
              onResetPrescription={handleResetPrescription}
              hasNfzConflict={hasNfzConflict}
              onNfzConflictChange={setHasNfzConflict}
              onPlotRepositioned={handlePlotRepositioned}
              nfzPolygon={nfzPolygon}
              onNfzRepositioned={handleNfzRepositioned}
              onAcceptSaveMission={handleAcceptSaveMissionPerformance}
              onOpenSavedMission={handleOpenSavedMission}
            />
          </div>

          {/* Right Column: Hardware Fleet Center & AI Advisory Panel (40% ~ 5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 md:gap-5">
            {/* Physical Hardware Connection Module with Multi-Unit Tabs */}
            <HardwareFleetPanel
              language={language}
              hardwareState={hardwareState}
              onUpdateHardwareState={(st) => {
                setHardwareState((prev) => {
                  const updated = { ...prev, ...st };
                  hardwareStateRef.current = updated;
                  if (st.rssiPercent === 0 && prev.rssiPercent > 0) {
                    const sim = simulationRef.current;
                    if (sim.isRunning || sim.isAutoResuming || sim.isRTHActive) {
                      setTimeout(() => triggerSignalLossAbort(), 0);
                    }
                  } else if (st.rssiPercent && st.rssiPercent > 0 && prev.rssiPercent === 0) {
                    const sim = simulationRef.current;
                    if (
                      isOnlineRef.current &&
                      (sim.isNetworkLossHold ||
                        (sim.isGroundLocked && breakpointRef.current?.reason === 'SIGNAL_LOSS'))
                    ) {
                      const isBadWeather =
                        telemetryRef.current.windSpeed > 18 || telemetryRef.current.precipitation > 5;
                      if (!isBadWeather) {
                        setTimeout(() => resumeMissionFromBreakpoint(), 0);
                      }
                    }
                  }
                  return updated;
                });
              }}
              telemetry={telemetry}
              activeUnit={activeUnit}
              onSelectFleetUnit={handleSelectFleetUnit}
              onEmergencyRTH={handleEmergencyRTH}
              isRTHActive={simulation.isRTHActive}
              breakpoint={breakpoint}
              isAutoResuming={simulation.isAutoResuming}
              failSafeNotification={failSafeNotification}
              isGroundLocked={simulation.isGroundLocked}
              isNetworkLossHold={simulation.isNetworkLossHold}
              isManualEmergencyHold={simulation.isManualEmergencyHold}
              onResumeMission={() => resumeMissionFromBreakpoint()}
              autoResumeWeatherEnabled={autoResumeWeatherEnabled}
              onToggleAutoResumeWeather={() => setAutoResumeWeatherEnabled((prev) => !prev)}
              autoResumeCountdown={autoResumeCountdown}
              onCancelAutoResumeCountdown={handleCancelAutoResumeCountdown}
              isFlightActive={
                simulation.isRunning ||
                simulation.isRTHActive ||
                simulation.isAutoResuming ||
                swarmState.isSwarmActive
              }
              swarmState={swarmState}
              subZones={subZones}
            />

            {/* AI Advisory Engine */}
            <div className="flex-1">
              <AIAdvisoryPanel
                language={language}
                advisory={advisory}
                onRefreshAdvisory={() => fetchAdvisoryReport()}
                machineryType={machineryType}
                onMachineryTypeChange={setMachineryType}
                missionType={missionType}
                onMissionTypeChange={setMissionType}
                isLiveHardware={hardwareState.isLiveHardware}
                onDispatchMission={handleDispatchMission}
                isDispatching={isDispatching}
              />
            </div>
          </div>
        </div>

        {/* Bottom Section: Live Audit Trail & Telemetry Records */}
        <div className="w-full">
          <AuditTrailLog
            language={language}
            logs={auditLogs}
            onExportVietGapPdf={handleExportVietGapPdf}
          />
        </div>
      </main>

      {/* Mission Performance Report & Persistence Confirmation Modal */}
      <MissionPerformanceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        reportData={currentReportData}
      />

      {/* Open / Restore Saved Mission Modal */}
      <OpenSavedMissionModal
        isOpen={isOpenSavedModalOpen}
        onClose={() => setIsOpenSavedModalOpen(false)}
        onRestoreMission={handleRestoreSavedMission}
        onResetToDefault={handleResetPrescription}
      />
    </div>
  );
}
