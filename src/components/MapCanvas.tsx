import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Search,
  Crosshair,
  MapPin,
  Wind,
  CloudRain,
  Thermometer,
  BatteryCharging,
  Clock,
  Layers,
  Zap,
  RotateCw,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Droplet,
  ShieldAlert,
  Activity,
  Eye,
  EyeOff,
  Maximize2,
} from 'lucide-react';
import {
  Coordinates,
  FieldZone,
  SupportedLanguage,
  TelemetryData,
  BreakpointMemory,
  SimulationState,
  FleetUnit,
  ZoneHealthType,
  SubZonePolygonData,
  SwarmMissionState,
  generateFlightPathWaypoints,
  isPolygonOverlappingPolygon,
  getNfzRestrictedZone,
  calculatePolygonCenter,
  calculatePolygonAreaHa,
  calculateGeoDistanceMeters,
  generateSubZoneGridPath,
  rotatePolygon,
  scalePolygon,
  resizePolygonToTargetArea,
} from '../types';
import {
  evaluateWeatherSafety,
  isWeatherHazardous,
  WEATHER_SAFETY_LIMITS,
} from '../services/weatherSafetyService';
import { translations } from '../i18n/translations';
import { searchNominatimLocations, SearchResult } from '../services/nominatimService';
import { PrescriptionZonePainter } from './PrescriptionZonePainter';

const DEFAULT_POPUP_OPTIONS: L.PopupOptions = {
  offset: [0, -25],
  autoPan: true,
  closeButton: true,
  autoClose: true,
  closeOnClick: true,
  className: 'agritwin-custom-popup',
};

const DEFAULT_TOOLTIP_OPTIONS: L.TooltipOptions = {
  direction: 'top',
  offset: [0, -25],
  sticky: true,
  className: 'agritwin-custom-tooltip',
};

interface PlacedMarkerSlot {
  id: string;
  coords: Coordinates;
}

// Calculate approximate distance in meters between two geographical coordinates
function getGeoDistanceMeters(c1?: Coordinates | null, c2?: Coordinates | null): number {
  if (!c1 || !c2 || typeof c1.lat !== 'number' || typeof c2.lat !== 'number' || isNaN(c1.lat) || isNaN(c2.lat)) return 0;
  const lng1 = typeof c1.lng === 'number' ? c1.lng : 0;
  const lng2 = typeof c2.lng === 'number' ? c2.lng : 0;
  const dLat = (c1.lat - c2.lat) * 111320;
  const dLng = (lng1 - lng2) * (111320 * Math.cos((((c1.lat + c2.lat) / 2) * Math.PI) / 180));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Dynamically resolve marker collision using a radial staggered offset
function resolveMarkerStaggerOffset(
  target?: Coordinates | null,
  placedList?: PlacedMarkerSlot[] | null,
  unitIndex: number = 0,
  minDistMeters: number = 32
): Coordinates {
  if (!target || typeof target.lat !== 'number' || typeof target.lng !== 'number' || isNaN(target.lat) || isNaN(target.lng)) {
    return { lat: 10.005, lng: 105.722 };
  }
  const isNear = (placedList || []).some(
    (p) => p && p.coords && getGeoDistanceMeters(target, p.coords) < minDistMeters
  );
  if (!isNear) return target;

  // Stagger radially around the cluster anchor:
  // Angles: 45°, 105°, 165°, 225°, 285°, 345°
  const angleRad = unitIndex * (Math.PI / 3) + Math.PI / 4;
  const offsetMeters = minDistMeters + 6;
  const meanLatRad = (target.lat * Math.PI) / 180;
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos(meanLatRad);

  return {
    lat: target.lat + (offsetMeters * Math.sin(angleRad)) / metersPerLat,
    lng: target.lng + (offsetMeters * Math.cos(angleRad)) / metersPerLng,
  };
}

interface MapCanvasProps {
  language: SupportedLanguage;
  currentCoords: Coordinates;
  locationName: string;
  onLocationSelect: (coords: Coordinates, name: string) => void;
  telemetry: TelemetryData;
  onTelemetryChange: (telemetry: TelemetryData) => void;
  simulation: SimulationState;
  breakpoint: BreakpointMemory | null;
  onUseGps: () => void;
  isGpsLoading: boolean;
  activeUnit: FleetUnit;
  failSafeNotification?: string | null;
  fieldArea?: number;
  onFieldAreaChange?: (area: number) => void;
  subZones?: SubZonePolygonData[];
  onSubZoneUpdate?: (zones: SubZonePolygonData[]) => void;
  activeBrush?: ZoneHealthType;
  onActiveBrushChange?: (brush: ZoneHealthType) => void;
  swarmState?: SwarmMissionState;
  onDispatchSwarm?: () => void;
  onResetPrescription?: () => void;
  hasNfzConflict?: boolean;
  onNfzConflictChange?: (hasConflict: boolean) => void;
  onPlotRepositioned?: (
    updatedZones: SubZonePolygonData[],
    movedIndex: number,
    newCenter: Coordinates,
    distanceMeters: number,
    hasNfz: boolean
  ) => void;
  nfzPolygon?: Coordinates[];
  onNfzRepositioned?: (
    newNfzPolygon: Coordinates[],
    newNfzCenter: Coordinates,
    hasConflict: boolean
  ) => void;
  onAcceptSaveMission?: () => void;
  onOpenSavedMission?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

interface SubZoneLayerBundle {
  poly: L.Polygon;
  handleMarker: L.Marker;
  cornerMarkers: L.Marker[];
  rotMarker: L.Marker | null;
  gridPolyline: L.Polyline | null;
  zoneId: string;
  cleanupFns: Array<() => void>;
  currentZone: SubZonePolygonData;
  currentBounds: Coordinates[];
  currentCenter: Coordinates;
  currentRotation: number;
}

interface NfzLayerBundle {
  poly: L.Polygon;
  handleMarker: L.Marker;
  cornerMarkers: L.Marker[];
  rotMarker: L.Marker;
  cleanupFns: Array<() => void>;
  currentBounds: Coordinates[];
  currentCenter: Coordinates;
  currentRotation: number;
  currentAreaHa: number;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  language,
  currentCoords,
  locationName,
  onLocationSelect,
  telemetry,
  onTelemetryChange,
  simulation,
  breakpoint,
  onUseGps,
  isGpsLoading,
  activeUnit,
  failSafeNotification,
  fieldArea = 2.5,
  onFieldAreaChange,
  subZones = [],
  onSubZoneUpdate,
  activeBrush = 'HEALTHY',
  onActiveBrushChange,
  swarmState,
  onDispatchSwarm,
  onResetPrescription,
  hasNfzConflict = false,
  onNfzConflictChange,
  onPlotRepositioned,
  nfzPolygon,
  onNfzRepositioned,
  onAcceptSaveMission,
  onOpenSavedMission,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const t = translations[language];
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Markers and layers references
  const fieldMarkerRef = useRef<L.Marker | null>(null);
  const dockMarkerRef = useRef<L.Marker | null>(null);
  const fleetMarkerRef = useRef<L.Marker | null>(null);
  const flightPathLineRef = useRef<L.Polyline | null>(null);
  const rthLineRef = useRef<L.Polyline | null>(null);
  const sprayTrailWideRef = useRef<L.Polyline | null>(null);
  const sprayTrailCoreRef = useRef<L.Polyline | null>(null);
  const breakpointMarkerRef = useRef<L.Marker | null>(null);
  const swarmMarkersRef = useRef<L.Marker[]>([]);

  // Persistent In-Place Sub-Zone Layer Map & Swarm Layer Refs
  const subZonesRef = useRef<SubZonePolygonData[]>(subZones);
  subZonesRef.current = subZones;
  const subZoneLayersMapRef = useRef<Map<string, SubZoneLayerBundle>>(new Map());
  const subZonePolygonsRef = useRef<L.Polygon[]>([]);
  const subZoneHandlesRef = useRef<L.Marker[]>([]);
  const subZoneCornerHandlesRef = useRef<L.Marker[]>([]);
  const subZoneRotationHandlesRef = useRef<L.Marker[]>([]);
  const subZoneFlightGridLinesRef = useRef<L.Polyline[]>([]);
  const dynamicSwarmMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const dynamicSwarmTrailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const swarmAlphaMarkerRef = useRef<L.Marker | null>(null);
  const swarmBetaMarkerRef = useRef<L.Marker | null>(null);
  const swarmGammaMarkerRef = useRef<L.Marker | null>(null);
  const swarmAlphaTrailRef = useRef<L.Polyline | null>(null);
  const swarmBetaTrailRef = useRef<L.Polyline | null>(null);
  const swarmGammaTrailRef = useRef<L.Polyline | null>(null);

  // Selected plot for in-map transform controls & HUD
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(0);
  const [hoveredZoneIndex, setHoveredZoneIndex] = useState<number | null>(null);
  const [isNfzHovered, setIsNfzHovered] = useState<boolean>(false);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const isZoomedOut = mapZoom < 15;

  const [activeTransformHUD, setActiveTransformHUD] = useState<{
    zoneName: string;
    areaHa: number;
    rotationDeg: number;
    isResizing: boolean;
    isRotating: boolean;
    isNfzConflict: boolean;
    pointCount: number;
  } | null>(null);

  // Polygons for NDVI and NFZ
  const ndviPolygonsRef = useRef<L.Polygon[]>([]);
  const nfzPolygonRef = useRef<L.Polygon | null>(null);
  const nfzHandleMarkerRef = useRef<L.Marker | null>(null);
  const nfzCornerHandlesRef = useRef<L.Marker[]>([]);
  const nfzRotationHandleRef = useRef<L.Marker | null>(null);
  const nfzRotationDegRef = useRef<number>(0);
  const activeNfzBoundsRef = useRef<Coordinates[]>([]);
  const nfzLayerBundleRef = useRef<NfzLayerBundle | null>(null);
  const isInteractingWithPlotRef = useRef<boolean>(false);
  const prevCoordsRef = useRef<Coordinates>(currentCoords);

  // Layer Toggles
  const [showNdvi, setShowNdvi] = useState(true);
  const [showNfz, setShowNfz] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);
  const [mapLayerType, setMapLayerType] = useState<'osm' | 'satellite' | 'dark'>('osm');

  // Track icon key to prevent destroying DOM elements every animation tick
  const currentFleetIconKeyRef = useRef<string>('');

  // Generate simulated survey / spray path around current coordinates
  const generateFlightPath = useCallback((center: Coordinates): Coordinates[] => {
    const latSpan = 0.0035;
    const lngSpan = 0.0055;
    const rows = 6;
    const path: Coordinates[] = [];

    for (let i = 0; i <= rows; i++) {
      const lat = center.lat - latSpan / 2 + (i / rows) * latSpan;
      if (i % 2 === 0) {
        path.push({ lat, lng: center.lng - lngSpan / 2 });
        path.push({ lat, lng: center.lng + lngSpan / 2 });
      } else {
        path.push({ lat, lng: center.lng + lngSpan / 2 });
        path.push({ lat, lng: center.lng - lngSpan / 2 });
      }
    }
    return path;
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentCoords.lat, currentCoords.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      closePopupOnClick: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create Dedicated Panes for Strict Stacking & Z-Index Hierarchy
    const ndviPane = map.createPane('ndviPane');
    ndviPane.style.zIndex = '350';

    const prescriptionPane = map.createPane('prescriptionPane');
    prescriptionPane.style.zIndex = '360';

    const flightPathPane = map.createPane('flightPathPane');
    flightPathPane.style.zIndex = '375';

    const spraySwathPane = map.createPane('spraySwathPane');
    spraySwathPane.style.zIndex = '410';

    const nfzPane = map.createPane('nfzPane');
    nfzPane.style.zIndex = '430';

    const dockPane = map.createPane('dockPane');
    dockPane.style.zIndex = '580';

    const swarmPane = map.createPane('swarmPane');
    swarmPane.style.zIndex = '610';

    const activeDronePane = map.createPane('activeDronePane');
    activeDronePane.style.zIndex = '650';

    // Default Tile Layer: OpenStreetMap
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Track zoom changes for dynamic marker scaling on zoom completion
    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    // Interactive Map Pin Dropper: Click to place field marker (Guarded against plot interactions)
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isInteractingWithPlotRef.current) return;
      const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      const fallbackName = `Field Parcel (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`;
      onLocationSelect(newCoords, fallbackName);
    });

    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        map.invalidateSize();
      }
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      // Clean up all layers safely
      if (fieldMarkerRef.current) {
        try { map.removeLayer(fieldMarkerRef.current); } catch (_) {}
        fieldMarkerRef.current = null;
      }
      if (dockMarkerRef.current) {
        try { map.removeLayer(dockMarkerRef.current); } catch (_) {}
        dockMarkerRef.current = null;
      }
      if (fleetMarkerRef.current) {
        try { map.removeLayer(fleetMarkerRef.current); } catch (_) {}
        fleetMarkerRef.current = null;
      }
      if (flightPathLineRef.current) {
        try { map.removeLayer(flightPathLineRef.current); } catch (_) {}
        flightPathLineRef.current = null;
      }
      if (rthLineRef.current) {
        try { map.removeLayer(rthLineRef.current); } catch (_) {}
        rthLineRef.current = null;
      }
      if (sprayTrailWideRef.current) {
        try { map.removeLayer(sprayTrailWideRef.current); } catch (_) {}
        sprayTrailWideRef.current = null;
      }
      if (sprayTrailCoreRef.current) {
        try { map.removeLayer(sprayTrailCoreRef.current); } catch (_) {}
        sprayTrailCoreRef.current = null;
      }
      if (breakpointMarkerRef.current) {
        try { map.removeLayer(breakpointMarkerRef.current); } catch (_) {}
        breakpointMarkerRef.current = null;
      }
      ndviPolygonsRef.current.forEach((poly) => {
        try { map.removeLayer(poly); } catch (_) {}
      });
      ndviPolygonsRef.current = [];
      subZoneLayersMapRef.current.forEach((bundle) => {
        try {
          bundle.cleanupFns.forEach((fn) => fn());
          map.removeLayer(bundle.poly);
          map.removeLayer(bundle.handleMarker);
          bundle.cornerMarkers.forEach((m) => map.removeLayer(m));
          if (bundle.rotMarker) map.removeLayer(bundle.rotMarker);
          if (bundle.gridPolyline) map.removeLayer(bundle.gridPolyline);
        } catch (_) {}
      });
      subZoneLayersMapRef.current.clear();
      if (nfzLayerBundleRef.current) {
        try {
          const bundle = nfzLayerBundleRef.current;
          bundle.cleanupFns.forEach((fn) => fn());
          map.removeLayer(bundle.poly);
          map.removeLayer(bundle.handleMarker);
          bundle.cornerMarkers.forEach((m) => map.removeLayer(m));
          map.removeLayer(bundle.rotMarker);
        } catch (_) {}
        nfzLayerBundleRef.current = null;
      }
      if (nfzPolygonRef.current) {
        try { map.removeLayer(nfzPolygonRef.current); } catch (_) {}
        nfzPolygonRef.current = null;
      }
      if (tileLayerRef.current) {
        try { map.removeLayer(tileLayerRef.current); } catch (_) {}
        tileLayerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Map Layer (OSM vs Satellite vs Dark)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      try {
        map.removeLayer(tileLayerRef.current);
      } catch (_) {}
    }

    let newUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;

    if (mapLayerType === 'satellite') {
      newUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
    } else if (mapLayerType === 'dark') {
      newUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      maxZoom = 19;
    }

    const newLayer = L.tileLayer(newUrl, { maxZoom }).addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapLayerType]);

  // Camera view persistence: Center map on coordinate change only when location changes significantly (e.g. search/preset selection)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const prev = prevCoordsRef.current;
    const distanceDelta = Math.abs(currentCoords.lat - prev.lat) + Math.abs(currentCoords.lng - prev.lng);

    // Only set view if location shifted significantly (> 0.001 deg ~ 100m)
    if (distanceDelta > 0.001) {
      prevCoordsRef.current = currentCoords;
      try {
        map.setView([currentCoords.lat, currentCoords.lng], map.getZoom() || 15, { animate: true });
      } catch (_) {
        map.setView([currentCoords.lat, currentCoords.lng], 15);
      }
    }
  }, [currentCoords.lat, currentCoords.lng]);

  // Render NDVI Polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Clean previous NDVI polygons
    ndviPolygonsRef.current.forEach((poly) => {
      try { map.removeLayer(poly); } catch (_) {}
    });
    ndviPolygonsRef.current = [];

    // 2. Draw NDVI Polygons if enabled (Dynamically scaled with selected fieldArea)
    if (showNdvi) {
      const c = currentCoords || { lat: 10.7769, lng: 106.7009 };
      const scale = Math.sqrt(Math.max(0.5, Math.min(20, fieldArea)) / 2.5);

      // Zone 1: Healthy (Green, NDVI 0.82) - covers ~45% of parcel
      const healthyCoords: [number, number][] = [
        [c.lat - 0.0018 * scale, c.lng - 0.0028 * scale],
        [c.lat + 0.0018 * scale, c.lng - 0.0028 * scale],
        [c.lat + 0.0018 * scale, c.lng - 0.0005 * scale],
        [c.lat - 0.0018 * scale, c.lng - 0.0005 * scale],
      ];
      const healthyPoly = L.polygon(healthyCoords, {
        pane: 'ndviPane',
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.28,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(map).bindTooltip(`🌿 <b>${t.healthyCropNdvi}</b><br/>Parcel Area: ${(fieldArea * 0.45).toFixed(1)} ha • Biomass optimal`, DEFAULT_TOOLTIP_OPTIONS);

      // Zone 2: Nitrogen Deficit (Yellow, NDVI 0.45) - covers ~35% of parcel
      const nitrogenCoords: [number, number][] = [
        [c.lat - 0.0018 * scale, c.lng - 0.0005 * scale],
        [c.lat + 0.0018 * scale, c.lng - 0.0005 * scale],
        [c.lat + 0.0018 * scale, c.lng + 0.0015 * scale],
        [c.lat - 0.0018 * scale, c.lng + 0.0015 * scale],
      ];
      const nitrogenPoly = L.polygon(nitrogenCoords, {
        pane: 'ndviPane',
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.28,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(map).bindTooltip(`🌾 <b>${t.nitrogenDeficitNdvi}</b><br/>Parcel Area: ${(fieldArea * 0.35).toFixed(1)} ha • +18% top-dressing`, DEFAULT_TOOLTIP_OPTIONS);

      // Zone 3: Pest / Stress Area (Red, NDVI 0.22) - covers ~20% of parcel
      const pestCoords: [number, number][] = [
        [c.lat - 0.0018 * scale, c.lng + 0.0015 * scale],
        [c.lat + 0.0018 * scale, c.lng + 0.0015 * scale],
        [c.lat + 0.0018 * scale, c.lng + 0.0028 * scale],
        [c.lat - 0.0018 * scale, c.lng + 0.0028 * scale],
      ];
      const pestPoly = L.polygon(pestCoords, {
        pane: 'ndviPane',
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.32,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(map).bindTooltip(`🐛 <b>${t.pestZoneNdvi}</b><br/>Parcel Area: ${(fieldArea * 0.20).toFixed(1)} ha • Ultra-fine bio-spray`, DEFAULT_TOOLTIP_OPTIONS);

      ndviPolygonsRef.current = [healthyPoly, nitrogenPoly, pestPoly];
    }
  }, [currentCoords, showNdvi, fieldArea, t]);

  // Render Interactive Draggable NFZ (No-Fly Zone) Polygon & Multi-Transform Controls (Independent Spatial Object with In-Place State Lock)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!showNfz) {
      if (nfzLayerBundleRef.current) {
        const bundle = nfzLayerBundleRef.current;
        bundle.cleanupFns.forEach((fn) => fn());
        try {
          map.removeLayer(bundle.poly);
          map.removeLayer(bundle.handleMarker);
          bundle.cornerMarkers.forEach((m) => map.removeLayer(m));
          map.removeLayer(bundle.rotMarker);
        } catch (_) {}
        nfzLayerBundleRef.current = null;
        nfzPolygonRef.current = null;
        nfzHandleMarkerRef.current = null;
        nfzRotationHandleRef.current = null;
        nfzCornerHandlesRef.current = [];
      }
      return;
    }

    const safeCoords = currentCoords || { lat: 10.7769, lng: 106.7009 };
    const rawBounds = (nfzPolygon && nfzPolygon.length >= 3)
      ? nfzPolygon
      : getNfzRestrictedZone(safeCoords);

    const validNfzBounds = rawBounds.filter(
      (b) => b && typeof b.lat === 'number' && typeof b.lng === 'number' && !isNaN(b.lat) && !isNaN(b.lng)
    );

    const initialNfzBounds = validNfzBounds.length >= 3 ? validNfzBounds : getNfzRestrictedZone(safeCoords);
    activeNfzBoundsRef.current = initialNfzBounds;

    // Helper to calculate top rotation anchor coordinate
    const getRotationAnchorCoords = (bounds: Coordinates[], center: Coordinates): Coordinates => {
      const topPt1 = bounds[0] || center;
      const topPt2 = bounds[1] || bounds[0] || center;
      const topMidLat = (topPt1.lat + topPt2.lat) / 2;
      const topMidLng = (topPt1.lng + topPt2.lng) / 2;
      return {
        lat: center.lat + (topMidLat - center.lat) * 1.35,
        lng: center.lng + (topMidLng - center.lng) * 1.35,
      };
    };

    // If an in-place bundle already exists, perform an in-place update rather than recreating layers
    if (nfzLayerBundleRef.current) {
      const bundle = nfzLayerBundleRef.current;
      bundle.currentBounds = initialNfzBounds;
      bundle.currentCenter = calculatePolygonCenter(initialNfzBounds);
      bundle.currentAreaHa = calculatePolygonAreaHa(initialNfzBounds);

      // Update Polygon coordinates and style
      bundle.poly.setLatLngs(initialNfzBounds.map((b) => [b.lat, b.lng]));
      bundle.poly.setStyle({
        color: hasNfzConflict ? '#ef4444' : '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: hasNfzConflict ? 0.55 : 0.35,
        weight: hasNfzConflict ? 3.5 : 2,
      });

      // Update Badge Centroid Marker
      bundle.handleMarker.setLatLng([bundle.currentCenter.lat, bundle.currentCenter.lng]);
      bundle.handleMarker.setIcon(
        L.divIcon({
          className: 'nfz-drag-anchor-marker',
          html: `
            <div class="group relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none">
              <div class="px-2.5 py-1 rounded-full ${
                hasNfzConflict
                  ? 'bg-red-950/95 border-2 border-red-500 text-red-200 shadow-red-900/80 animate-bounce'
                  : 'bg-red-950/90 border border-red-500/80 hover:border-red-400 text-red-100 hover:text-white shadow-2xl'
              } text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-2xl transition-all hover:scale-105">
                <span class="text-red-400 font-extrabold ${hasNfzConflict ? 'animate-pulse' : ''}">🚫</span>
                <span>NFZ</span>
                <span class="text-rose-300 text-[9px] font-normal">${bundle.currentAreaHa.toFixed(2)}ha</span>
                <span class="text-amber-300 text-[9px] font-normal">${bundle.currentRotation}°</span>
                <span class="text-[9px] text-red-300 font-normal">✥ Drag</span>
              </div>
            </div>
          `,
          iconSize: [140, 26],
          iconAnchor: [70, 13],
        })
      );

      // Update Corner Handles
      bundle.cornerMarkers.forEach((m, idx) => {
        if (initialNfzBounds[idx]) {
          m.setLatLng([initialNfzBounds[idx].lat, initialNfzBounds[idx].lng]);
        }
      });

      // Update Rotation Handle
      const rotAnchor = getRotationAnchorCoords(initialNfzBounds, bundle.currentCenter);
      bundle.rotMarker.setLatLng([rotAnchor.lat, rotAnchor.lng]);

      return;
    }

    // Otherwise, create the full bundle for the first time
    const initialCenter = calculatePolygonCenter(initialNfzBounds);
    const initialRotation = nfzRotationDegRef.current || 0;
    const initialAreaHa = calculatePolygonAreaHa(initialNfzBounds);

    const cleanupFns: Array<() => void> = [];

    // 1. NFZ Polygon Layer
    const nfzPoly = L.polygon(initialNfzBounds.map((b) => [b.lat, b.lng]), {
      pane: 'nfzPane',
      color: hasNfzConflict ? '#ef4444' : '#dc2626',
      fillColor: '#dc2626',
      fillOpacity: hasNfzConflict ? 0.55 : 0.35,
      weight: hasNfzConflict ? 3.5 : 2,
      dashArray: '5, 5',
      className: `${hasNfzConflict ? 'animate-pulse' : ''} cursor-grab active:cursor-grabbing`,
    }).addTo(map);

    nfzPoly.bindTooltip(
      `🚫 <b>${t.nfzResidential || 'Residential / Restricted NFZ'}</b> ${
        hasNfzConflict
          ? '<span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[9px]">⚠️ CONFLICT ACTIVE</span>'
          : '<span class="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold text-[9px]">✓ AIRSPACE CLEAR</span>'
      }<br/>Area: <b>${initialAreaHa.toFixed(2)} ha</b> • Orientation: <b>${initialRotation}°</b><br/>Strict 15m buffer altitude ceiling enforced.<br/><span class="text-[10px] text-red-300 font-bold">✥ Drag Surface/Handle to Move • ⟲ Drag Top Anchor to Rotate • ✥ Drag Corners to Resize</span>`,
      DEFAULT_TOOLTIP_OPTIONS
    );

    // Conflict visual update helper
    const updateConflictVisuals = (
      testNfzBounds: Coordinates[],
      isResizing: boolean = false,
      isRotating: boolean = false,
      customArea?: number,
      customDeg?: number
    ) => {
      const currentZones = subZonesRef.current || [];
      const anyConflict = currentZones.some((z) => (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, testNfzBounds));

      if (anyConflict) {
        nfzPoly.setStyle({
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.60,
          weight: 3.5,
          dashArray: '4, 4',
        });
      } else {
        nfzPoly.setStyle({
          color: '#dc2626',
          fillColor: '#dc2626',
          fillOpacity: 0.35,
          weight: 2,
          dashArray: '5, 5',
        });
      }

      // Dynamically update visual styles of all sector polygons on the map
      if (subZoneLayersMapRef.current) {
        subZoneLayersMapRef.current.forEach((subBundle) => {
          const z = subBundle.currentZone;
          const isSectorEnabled = z.enabled !== false;
          const overlapsNfz = isPolygonOverlappingPolygon(subBundle.currentBounds, testNfzBounds);
          const hasConflict = isSectorEnabled && overlapsNfz;

          const isHealthy = z.healthType === 'HEALTHY' || z.chemicalType === 'water_mist';
          const isNitrogen = z.healthType === 'NITROGEN_DEFICIT' || z.chemicalType === 'nitrogen_fertilizer';
          const isPest = z.healthType === 'PEST_STRESS' || z.chemicalType === 'bio_pesticide';
          const baseColor = isHealthy ? '#10b981' : isNitrogen ? '#eab308' : '#ef4444';

          if (!isSectorEnabled) {
            subBundle.poly.setStyle({
              color: '#64748b',
              fillColor: '#334155',
              fillOpacity: 0.2,
              weight: 1.5,
              dashArray: '4, 4',
            });
          } else if (hasConflict) {
            subBundle.poly.setStyle({
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.65,
              weight: 3.5,
              dashArray: '4, 4',
            });
          } else {
            subBundle.poly.setStyle({
              color: baseColor,
              fillColor: baseColor,
              fillOpacity: 0.38,
              weight: isPest ? 3 : 2,
              dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
            });
          }
        });
      }

      setActiveTransformHUD({
        zoneName: 'No-Fly Zone (Restricted Airspace)',
        areaHa: customArea ?? calculatePolygonAreaHa(testNfzBounds),
        rotationDeg: customDeg ?? (nfzLayerBundleRef.current?.currentRotation || 0),
        isResizing,
        isRotating,
        isNfzConflict: anyConflict,
        pointCount: testNfzBounds.length,
      });

      return anyConflict;
    };

    // 2. Centroid Drag Badge Marker
    const nfzHandleIcon = L.divIcon({
      className: 'nfz-drag-anchor-marker',
      html: `
        <div class="group relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none">
          <div class="px-2.5 py-1 rounded-full ${
            hasNfzConflict
              ? 'bg-red-950/95 border-2 border-red-500 text-red-200 shadow-red-900/80 animate-bounce'
              : 'bg-red-950/90 border border-red-500/80 hover:border-red-400 text-red-100 hover:text-white shadow-2xl'
          } text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-2xl transition-all hover:scale-105">
            <span class="text-red-400 font-extrabold ${hasNfzConflict ? 'animate-pulse' : ''}">🚫</span>
            <span>NFZ</span>
            <span class="text-rose-300 text-[9px] font-normal">${initialAreaHa.toFixed(2)}ha</span>
            <span class="text-amber-300 text-[9px] font-normal">${initialRotation}°</span>
            <span class="text-[9px] text-red-300 font-normal">✥ Drag</span>
          </div>
        </div>
      `,
      iconSize: [140, 26],
      iconAnchor: [70, 13],
    });

    const nfzHandleMarker = L.marker([initialCenter.lat, initialCenter.lng], {
      icon: nfzHandleIcon,
      pane: 'dockPane',
      zIndexOffset: 750,
      draggable: true,
    }).addTo(map);

    nfzHandleMarker.bindTooltip(
      `<b>✥ Drag No-Fly Zone (NFZ)</b><br/>Click & drag to reposition restricted airspace.<br/>Real-time collision validation against all field parcels.`,
      DEFAULT_TOOLTIP_OPTIONS
    );

    // 3. Top Rotation Anchor Handle (0° - 360° Drag Rotation)
    const initialRotAnchor = getRotationAnchorCoords(initialNfzBounds, initialCenter);
    const rotHandleIcon = L.divIcon({
      className: 'nfz-rotation-anchor-marker',
      html: `
        <div class="group relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none" title="Rotate NFZ">
          <div class="w-6 h-6 rounded-full bg-rose-600 border-2 border-slate-900 shadow-2xl flex items-center justify-center text-white text-xs font-bold hover:scale-125 transition-transform hover:bg-rose-500 hover:border-white shadow-rose-950/80">
            ↻
          </div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-rose-500/80 text-[8px] font-mono font-bold text-rose-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            ${initialRotation}°
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const nfzRotMarker = L.marker([initialRotAnchor.lat, initialRotAnchor.lng], {
      icon: rotHandleIcon,
      pane: 'dockPane',
      zIndexOffset: 780,
      draggable: true,
    }).addTo(map);

    nfzRotMarker.bindTooltip(
      `<b>⟲ Rotate No-Fly Zone (${initialRotation}°)</b><br/>Drag handle in a circle around center to adjust restricted airspace orientation.`,
      DEFAULT_TOOLTIP_OPTIONS
    );

    let initialRotDeg = initialRotation;
    let rotStartAngle = 0;

    nfzRotMarker.on('dragstart', (e: any) => {
      map.dragging.disable();
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle) return;
      initialRotDeg = currentBundle.currentRotation || 0;
      const markerPt = e.latlng || initialRotAnchor;
      rotStartAngle = (Math.atan2(markerPt.lat - currentBundle.currentCenter.lat, markerPt.lng - currentBundle.currentCenter.lng) * 180) / Math.PI;
      setActiveTransformHUD({
        zoneName: 'No-Fly Zone (Restricted Airspace)',
        areaHa: currentBundle.currentAreaHa,
        rotationDeg: initialRotDeg,
        isResizing: false,
        isRotating: true,
        isNfzConflict: hasNfzConflict || false,
        pointCount: currentBundle.currentBounds.length,
      });
    });

    nfzRotMarker.on('drag', (e: any) => {
      if (!e.latlng) return;
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle) return;
      const currentMouseAngle = (Math.atan2(e.latlng.lat - currentBundle.currentCenter.lat, e.latlng.lng - currentBundle.currentCenter.lng) * 180) / Math.PI;
      const deltaAngle = currentMouseAngle - rotStartAngle;
      const calculatedAngle = Number((((initialRotDeg - deltaAngle) % 360 + 360) % 360).toFixed(1));

      const newBounds = rotatePolygon(currentBundle.currentBounds, calculatedAngle - (currentBundle.currentRotation || 0), currentBundle.currentCenter);
      nfzPoly.setLatLngs(newBounds.map((b) => [b.lat, b.lng]));

      // Sync corner handles
      currentBundle.cornerMarkers.forEach((cornerHandle, cIdx) => {
        if (newBounds[cIdx]) {
          cornerHandle.setLatLng([newBounds[cIdx].lat, newBounds[cIdx].lng]);
        }
      });

      updateConflictVisuals(newBounds, false, true, currentBundle.currentAreaHa, calculatedAngle);
    });

    nfzRotMarker.on('dragend', (e: any) => {
      map.dragging.enable();
      setActiveTransformHUD(null);
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle || !e.latlng) return;
      const currentMouseAngle = (Math.atan2(e.latlng.lat - currentBundle.currentCenter.lat, e.latlng.lng - currentBundle.currentCenter.lng) * 180) / Math.PI;
      const deltaAngle = currentMouseAngle - rotStartAngle;
      const calculatedAngle = Number((((initialRotDeg - deltaAngle) % 360 + 360) % 360).toFixed(1));

      const finalBounds = rotatePolygon(currentBundle.currentBounds, calculatedAngle - (currentBundle.currentRotation || 0), currentBundle.currentCenter);
      currentBundle.currentBounds = finalBounds;
      currentBundle.currentRotation = calculatedAngle;
      activeNfzBoundsRef.current = finalBounds;
      nfzRotationDegRef.current = calculatedAngle;

      const newAnchor = getRotationAnchorCoords(finalBounds, currentBundle.currentCenter);
      nfzRotMarker.setLatLng([newAnchor.lat, newAnchor.lng]);

      // Sync corner handles
      currentBundle.cornerMarkers.forEach((cornerHandle, cIdx) => {
        if (finalBounds[cIdx]) {
          cornerHandle.setLatLng([finalBounds[cIdx].lat, finalBounds[cIdx].lng]);
        }
      });

      // Update badge handle label
      currentBundle.handleMarker.setIcon(
        L.divIcon({
          className: 'nfz-drag-anchor-marker',
          html: `
            <div class="group relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none">
              <div class="px-2.5 py-1 rounded-full ${
                hasNfzConflict
                  ? 'bg-red-950/95 border-2 border-red-500 text-red-200 shadow-red-900/80 animate-bounce'
                  : 'bg-red-950/90 border border-red-500/80 hover:border-red-400 text-red-100 hover:text-white shadow-2xl'
              } text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-2xl transition-all hover:scale-105">
                <span class="text-red-400 font-extrabold ${hasNfzConflict ? 'animate-pulse' : ''}">🚫</span>
                <span>NFZ</span>
                <span class="text-rose-300 text-[9px] font-normal">${currentBundle.currentAreaHa.toFixed(2)}ha</span>
                <span class="text-amber-300 text-[9px] font-normal">${calculatedAngle}°</span>
                <span class="text-[9px] text-red-300 font-normal">✥ Drag</span>
              </div>
            </div>
          `,
          iconSize: [140, 26],
          iconAnchor: [70, 13],
        })
      );

      const currentZones = subZonesRef.current || [];
      const updatedZones = currentZones.map((z) => ({
        ...z,
        hasNfzConflict: (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, finalBounds),
      }));
      const anyConflict = updatedZones.some((z) => z.enabled !== false && z.hasNfzConflict);

      // Sync layer styles for all subzones
      if (subZoneLayersMapRef.current) {
        subZoneLayersMapRef.current.forEach((subBundle) => {
          const z = subBundle.currentZone;
          const isSectorEnabled = z.enabled !== false;
          const overlapsNfz = isPolygonOverlappingPolygon(subBundle.currentBounds, finalBounds);
          const hasConflict = isSectorEnabled && overlapsNfz;

          const isHealthy = z.healthType === 'HEALTHY' || z.chemicalType === 'water_mist';
          const isNitrogen = z.healthType === 'NITROGEN_DEFICIT' || z.chemicalType === 'nitrogen_fertilizer';
          const isPest = z.healthType === 'PEST_STRESS' || z.chemicalType === 'bio_pesticide';
          const baseColor = isHealthy ? '#10b981' : isNitrogen ? '#eab308' : '#ef4444';

          if (!isSectorEnabled) {
            subBundle.poly.setStyle({
              color: '#64748b',
              fillColor: '#334155',
              fillOpacity: 0.2,
              weight: 1.5,
              dashArray: '4, 4',
            });
          } else if (hasConflict) {
            subBundle.poly.setStyle({
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.65,
              weight: 3.5,
              dashArray: '4, 4',
            });
          } else {
            subBundle.poly.setStyle({
              color: baseColor,
              fillColor: baseColor,
              fillOpacity: 0.38,
              weight: isPest ? 3 : 2,
              dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
            });
          }
        });
      }

      onSubZoneUpdate?.(updatedZones);
      onNfzConflictChange?.(anyConflict);
      onNfzRepositioned?.(finalBounds, currentBundle.currentCenter, anyConflict);
    });

    // 4. Corner Drag Handles (4 Corners for Interactive Scaling & Resizing)
    const cornerMarkers: L.Marker[] = [];

    initialNfzBounds.forEach((cornerPt, cornerIdx) => {
      if (!cornerPt || typeof cornerPt.lat !== 'number' || typeof cornerPt.lng !== 'number') return;

      const cornerIcon = L.divIcon({
        className: `nfz-corner-anchor-${cornerIdx}`,
        html: `
          <div class="group relative flex items-center justify-center cursor-nwse-resize select-none" title="Resize NFZ Boundary">
            <div class="w-3.5 h-3.5 rounded-sm bg-rose-500 border-2 border-slate-950 shadow-2xl hover:scale-150 hover:bg-white hover:border-rose-600 transition-all shadow-rose-950/90 flex items-center justify-center">
              <div class="w-1 h-1 rounded-full bg-slate-900"></div>
            </div>
            <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded bg-slate-950/90 border border-rose-500/80 text-[7px] font-mono text-rose-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              P${cornerIdx + 1}
            </div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const cornerMarker = L.marker([cornerPt.lat, cornerPt.lng], {
        icon: cornerIcon,
        pane: 'dockPane',
        zIndexOffset: 760 + cornerIdx,
        draggable: true,
      }).addTo(map);

      cornerMarker.bindTooltip(
        `<b>✥ Resize No-Fly Zone (Corner P${cornerIdx + 1})</b><br/>Drag outward to expand restricted airspace; drag inward to shrink.<br/>Live area & conflict telemetry updated dynamically.`,
        DEFAULT_TOOLTIP_OPTIONS
      );

      let initialCornerBounds = initialNfzBounds;
      let initialCornerCenter = initialCenter;
      let initialDistFromCenter = Math.max(1, calculateGeoDistanceMeters(initialCornerCenter, cornerPt));

      cornerMarker.on('dragstart', () => {
        map.dragging.disable();
        const currentBundle = nfzLayerBundleRef.current;
        if (!currentBundle) return;
        initialCornerBounds = currentBundle.currentBounds;
        initialCornerCenter = currentBundle.currentCenter;
        initialDistFromCenter = Math.max(1, calculateGeoDistanceMeters(initialCornerCenter, cornerPt));
        setActiveTransformHUD({
          zoneName: 'No-Fly Zone (Restricted Airspace)',
          areaHa: currentBundle.currentAreaHa,
          rotationDeg: currentBundle.currentRotation,
          isResizing: true,
          isRotating: false,
          isNfzConflict: hasNfzConflict || false,
          pointCount: currentBundle.currentBounds.length,
        });
      });

      cornerMarker.on('drag', (e: any) => {
        if (!e.latlng) return;
        const currentBundle = nfzLayerBundleRef.current;
        if (!currentBundle) return;
        const newDist = calculateGeoDistanceMeters(initialCornerCenter, { lat: e.latlng.lat, lng: e.latlng.lng });
        const scaleFactor = Math.max(0.05, newDist / initialDistFromCenter);

        const tempBounds = scalePolygon(initialCornerBounds, scaleFactor, initialCornerCenter);
        const tempArea = calculatePolygonAreaHa(tempBounds);

        nfzPoly.setLatLngs(tempBounds.map((b) => [b.lat, b.lng]));

        // Sync other corner markers
        currentBundle.cornerMarkers.forEach((otherMarker, otherIdx) => {
          if (otherIdx !== cornerIdx && tempBounds[otherIdx]) {
            otherMarker.setLatLng([tempBounds[otherIdx].lat, tempBounds[otherIdx].lng]);
          }
        });

        // Sync rotation handle position
        const newRotAnchor = getRotationAnchorCoords(tempBounds, initialCornerCenter);
        currentBundle.rotMarker.setLatLng([newRotAnchor.lat, newRotAnchor.lng]);

        updateConflictVisuals(tempBounds, true, false, tempArea, currentBundle.currentRotation);
      });

      cornerMarker.on('dragend', (e: any) => {
        map.dragging.enable();
        setActiveTransformHUD(null);
        const currentBundle = nfzLayerBundleRef.current;
        if (!currentBundle || !e.latlng) return;
        const newDist = calculateGeoDistanceMeters(initialCornerCenter, { lat: e.latlng.lat, lng: e.latlng.lng });
        const scaleFactor = Math.max(0.05, newDist / initialDistFromCenter);

        const finalBounds = scalePolygon(initialCornerBounds, scaleFactor, initialCornerCenter);
        const finalArea = calculatePolygonAreaHa(finalBounds);

        currentBundle.currentBounds = finalBounds;
        currentBundle.currentAreaHa = finalArea;
        activeNfzBoundsRef.current = finalBounds;

        // Sync all corner markers
        currentBundle.cornerMarkers.forEach((m, idx) => {
          if (finalBounds[idx]) {
            m.setLatLng([finalBounds[idx].lat, finalBounds[idx].lng]);
          }
        });

        // Sync rotation handle
        const newRotAnchor = getRotationAnchorCoords(finalBounds, currentBundle.currentCenter);
        currentBundle.rotMarker.setLatLng([newRotAnchor.lat, newRotAnchor.lng]);

        // Sync badge handle label
        currentBundle.handleMarker.setIcon(
          L.divIcon({
            className: 'nfz-drag-anchor-marker',
            html: `
              <div class="group relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none">
                <div class="px-2.5 py-1 rounded-full ${
                  hasNfzConflict
                    ? 'bg-red-950/95 border-2 border-red-500 text-red-200 shadow-red-900/80 animate-bounce'
                    : 'bg-red-950/90 border border-red-500/80 hover:border-red-400 text-red-100 hover:text-white shadow-2xl'
                } text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-2xl transition-all hover:scale-105">
                  <span class="text-red-400 font-extrabold ${hasNfzConflict ? 'animate-pulse' : ''}">🚫</span>
                  <span>NFZ</span>
                  <span class="text-rose-300 text-[9px] font-normal">${finalArea.toFixed(2)}ha</span>
                  <span class="text-amber-300 text-[9px] font-normal">${currentBundle.currentRotation}°</span>
                  <span class="text-[9px] text-red-300 font-normal">✥ Drag</span>
                </div>
              </div>
            `,
            iconSize: [140, 26],
            iconAnchor: [70, 13],
          })
        );

        const currentZones = subZonesRef.current || [];
        const updatedZones = currentZones.map((z) => ({
          ...z,
          hasNfzConflict: (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, finalBounds),
        }));
        const anyConflict = updatedZones.some((z) => z.enabled !== false && z.hasNfzConflict);

        if (subZoneLayersMapRef.current) {
          subZoneLayersMapRef.current.forEach((subBundle) => {
            const z = subBundle.currentZone;
            const isSectorEnabled = z.enabled !== false;
            const overlapsNfz = isPolygonOverlappingPolygon(subBundle.currentBounds, finalBounds);
            const hasConflict = isSectorEnabled && overlapsNfz;

            const isHealthy = z.healthType === 'HEALTHY' || z.chemicalType === 'water_mist';
            const isNitrogen = z.healthType === 'NITROGEN_DEFICIT' || z.chemicalType === 'nitrogen_fertilizer';
            const isPest = z.healthType === 'PEST_STRESS' || z.chemicalType === 'bio_pesticide';
            const baseColor = isHealthy ? '#10b981' : isNitrogen ? '#eab308' : '#ef4444';

            if (!isSectorEnabled) {
              subBundle.poly.setStyle({
                color: '#64748b',
                fillColor: '#334155',
                fillOpacity: 0.2,
                weight: 1.5,
                dashArray: '4, 4',
              });
            } else if (hasConflict) {
              subBundle.poly.setStyle({
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.65,
                weight: 3.5,
                dashArray: '4, 4',
              });
            } else {
              subBundle.poly.setStyle({
                color: baseColor,
                fillColor: baseColor,
                fillOpacity: 0.38,
                weight: isPest ? 3 : 2,
                dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
              });
            }
          });
        }

        onSubZoneUpdate?.(updatedZones);
        onNfzConflictChange?.(anyConflict);
        onNfzRepositioned?.(finalBounds, currentBundle.currentCenter, anyConflict);
      });

      cornerMarkers.push(cornerMarker);
    });

    // 5. NFZ Centroid Drag Handle Listeners
    nfzHandleMarker.on('dragstart', () => {
      map.dragging.disable();
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle) return;
      setActiveTransformHUD({
        zoneName: 'No-Fly Zone (Restricted Airspace)',
        areaHa: currentBundle.currentAreaHa,
        rotationDeg: currentBundle.currentRotation,
        isResizing: false,
        isRotating: false,
        isNfzConflict: hasNfzConflict || false,
        pointCount: currentBundle.currentBounds.length,
      });
    });

    nfzHandleMarker.on('drag', (e: any) => {
      if (!e.latlng) return;
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle) return;
      const newCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
      const dLat = newCenter.lat - currentBundle.currentCenter.lat;
      const dLng = newCenter.lng - currentBundle.currentCenter.lng;

      const tempBounds = currentBundle.currentBounds.map((pt) => ({
        lat: pt.lat + dLat,
        lng: pt.lng + dLng,
      }));

      nfzPoly.setLatLngs(tempBounds.map((b) => [b.lat, b.lng]));

      // Sync corner handles
      currentBundle.cornerMarkers.forEach((cornerHandle, idx) => {
        if (tempBounds[idx]) {
          cornerHandle.setLatLng([tempBounds[idx].lat, tempBounds[idx].lng]);
        }
      });

      // Sync rotation handle
      const newRotAnchor = getRotationAnchorCoords(tempBounds, newCenter);
      currentBundle.rotMarker.setLatLng([newRotAnchor.lat, newRotAnchor.lng]);

      updateConflictVisuals(tempBounds, false, false, currentBundle.currentAreaHa, currentBundle.currentRotation);
    });

    nfzHandleMarker.on('dragend', (e: any) => {
      map.dragging.enable();
      setActiveTransformHUD(null);
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle || !e.latlng) return;
      const newCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
      const dLat = newCenter.lat - currentBundle.currentCenter.lat;
      const dLng = newCenter.lng - currentBundle.currentCenter.lng;

      const finalBounds = currentBundle.currentBounds.map((pt) => ({
        lat: pt.lat + dLat,
        lng: pt.lng + dLng,
      }));
      currentBundle.currentBounds = finalBounds;
      currentBundle.currentCenter = newCenter;
      activeNfzBoundsRef.current = finalBounds;

      // Sync corner handles
      currentBundle.cornerMarkers.forEach((cornerHandle, idx) => {
        if (finalBounds[idx]) {
          cornerHandle.setLatLng([finalBounds[idx].lat, finalBounds[idx].lng]);
        }
      });

      // Sync rotation handle
      const newRotAnchor = getRotationAnchorCoords(finalBounds, newCenter);
      currentBundle.rotMarker.setLatLng([newRotAnchor.lat, newRotAnchor.lng]);

      const currentZones = subZonesRef.current || [];
      const updatedZones = currentZones.map((z) => ({
        ...z,
        hasNfzConflict: (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, finalBounds),
      }));
      const anyConflict = updatedZones.some((z) => z.enabled !== false && z.hasNfzConflict);

      if (subZoneLayersMapRef.current) {
        subZoneLayersMapRef.current.forEach((subBundle) => {
          const z = subBundle.currentZone;
          const isSectorEnabled = z.enabled !== false;
          const overlapsNfz = isPolygonOverlappingPolygon(subBundle.currentBounds, finalBounds);
          const hasConflict = isSectorEnabled && overlapsNfz;

          const isHealthy = z.healthType === 'HEALTHY' || z.chemicalType === 'water_mist';
          const isNitrogen = z.healthType === 'NITROGEN_DEFICIT' || z.chemicalType === 'nitrogen_fertilizer';
          const isPest = z.healthType === 'PEST_STRESS' || z.chemicalType === 'bio_pesticide';
          const baseColor = isHealthy ? '#10b981' : isNitrogen ? '#eab308' : '#ef4444';

          if (!isSectorEnabled) {
            subBundle.poly.setStyle({
              color: '#64748b',
              fillColor: '#334155',
              fillOpacity: 0.2,
              weight: 1.5,
              dashArray: '4, 4',
            });
          } else if (hasConflict) {
            subBundle.poly.setStyle({
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.65,
              weight: 3.5,
              dashArray: '4, 4',
            });
          } else {
            subBundle.poly.setStyle({
              color: baseColor,
              fillColor: baseColor,
              fillOpacity: 0.38,
              weight: isPest ? 3 : 2,
              dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
            });
          }
        });
      }

      onSubZoneUpdate?.(updatedZones);
      onNfzConflictChange?.(anyConflict);
      onNfzRepositioned?.(finalBounds, newCenter, anyConflict);
    });

    // 6. Direct Polygon Dragging on the NFZ Surface
    let isDraggingNfzPoly = false;
    let nfzDragStartLatLng: L.LatLng | null = null;
    let nfzDragStartBounds = initialNfzBounds;
    let nfzDragStartCenter = initialCenter;

    const handleNfzMouseDown = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.button === 0 && e.latlng) {
        const currentBundle = nfzLayerBundleRef.current;
        if (!currentBundle) return;
        isDraggingNfzPoly = true;
        nfzDragStartLatLng = e.latlng;
        nfzDragStartBounds = currentBundle.currentBounds;
        nfzDragStartCenter = currentBundle.currentCenter;
        map.dragging.disable();
        L.DomEvent.stopPropagation(e);
        setActiveTransformHUD({
          zoneName: 'No-Fly Zone (Restricted Airspace)',
          areaHa: currentBundle.currentAreaHa,
          rotationDeg: currentBundle.currentRotation,
          isResizing: false,
          isRotating: false,
          isNfzConflict: hasNfzConflict || false,
          pointCount: currentBundle.currentBounds.length,
        });
      }
    };

    nfzPoly.on('mousedown', handleNfzMouseDown);

    const handleNfzMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isDraggingNfzPoly || !nfzDragStartLatLng || !e.latlng) return;
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle) return;

      const dLat = e.latlng.lat - nfzDragStartLatLng.lat;
      const dLng = e.latlng.lng - nfzDragStartLatLng.lng;

      const tempBounds = nfzDragStartBounds.map((pt) => ({
        lat: pt.lat + dLat,
        lng: pt.lng + dLng,
      }));
      const tempCenter = {
        lat: nfzDragStartCenter.lat + dLat,
        lng: nfzDragStartCenter.lng + dLng,
      };

      nfzPoly.setLatLngs(tempBounds.map((b) => [b.lat, b.lng]));
      currentBundle.handleMarker.setLatLng([tempCenter.lat, tempCenter.lng]);

      // Sync corner handles
      currentBundle.cornerMarkers.forEach((cornerHandle, idx) => {
        if (tempBounds[idx]) {
          cornerHandle.setLatLng([tempBounds[idx].lat, tempBounds[idx].lng]);
        }
      });

      // Sync rotation handle
      const newRotAnchor = getRotationAnchorCoords(tempBounds, tempCenter);
      currentBundle.rotMarker.setLatLng([newRotAnchor.lat, newRotAnchor.lng]);

      updateConflictVisuals(tempBounds, false, false, currentBundle.currentAreaHa, currentBundle.currentRotation);
    };

    const handleNfzMouseUp = (e: L.LeafletMouseEvent) => {
      if (!isDraggingNfzPoly || !nfzDragStartLatLng || !e.latlng) return;
      isDraggingNfzPoly = false;
      map.dragging.enable();
      setActiveTransformHUD(null);
      const currentBundle = nfzLayerBundleRef.current;
      if (!currentBundle) return;

      const dLat = e.latlng.lat - nfzDragStartLatLng.lat;
      const dLng = e.latlng.lng - nfzDragStartLatLng.lng;
      nfzDragStartLatLng = null;

      const finalBounds = nfzDragStartBounds.map((pt) => ({
        lat: pt.lat + dLat,
        lng: pt.lng + dLng,
      }));
      const finalCenter = {
        lat: nfzDragStartCenter.lat + dLat,
        lng: nfzDragStartCenter.lng + dLng,
      };

      currentBundle.currentBounds = finalBounds;
      currentBundle.currentCenter = finalCenter;
      activeNfzBoundsRef.current = finalBounds;

      // Sync corner handles
      currentBundle.cornerMarkers.forEach((cornerHandle, idx) => {
        if (finalBounds[idx]) {
          cornerHandle.setLatLng([finalBounds[idx].lat, finalBounds[idx].lng]);
        }
      });

      // Sync rotation handle
      const newRotAnchor = getRotationAnchorCoords(finalBounds, finalCenter);
      currentBundle.rotMarker.setLatLng([newRotAnchor.lat, newRotAnchor.lng]);

      const currentZones = subZonesRef.current || [];
      const updatedZones = currentZones.map((z) => ({
        ...z,
        hasNfzConflict: (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, finalBounds),
      }));
      const anyConflict = updatedZones.some((z) => z.enabled !== false && z.hasNfzConflict);

      if (subZoneLayersMapRef.current) {
        subZoneLayersMapRef.current.forEach((subBundle) => {
          const z = subBundle.currentZone;
          const isSectorEnabled = z.enabled !== false;
          const overlapsNfz = isPolygonOverlappingPolygon(subBundle.currentBounds, finalBounds);
          const hasConflict = isSectorEnabled && overlapsNfz;

          const isHealthy = z.healthType === 'HEALTHY' || z.chemicalType === 'water_mist';
          const isNitrogen = z.healthType === 'NITROGEN_DEFICIT' || z.chemicalType === 'nitrogen_fertilizer';
          const isPest = z.healthType === 'PEST_STRESS' || z.chemicalType === 'bio_pesticide';
          const baseColor = isHealthy ? '#10b981' : isNitrogen ? '#eab308' : '#ef4444';

          if (!isSectorEnabled) {
            subBundle.poly.setStyle({
              color: '#64748b',
              fillColor: '#334155',
              fillOpacity: 0.2,
              weight: 1.5,
              dashArray: '4, 4',
            });
          } else if (hasConflict) {
            subBundle.poly.setStyle({
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.65,
              weight: 3.5,
              dashArray: '4, 4',
            });
          } else {
            subBundle.poly.setStyle({
              color: baseColor,
              fillColor: baseColor,
              fillOpacity: 0.38,
              weight: isPest ? 3 : 2,
              dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
            });
          }
        });
      }

      onSubZoneUpdate?.(updatedZones);
      onNfzConflictChange?.(anyConflict);
      onNfzRepositioned?.(finalBounds, finalCenter, anyConflict);
    };

    map.on('mousemove', handleNfzMouseMove);
    map.on('mouseup', handleNfzMouseUp);

    cleanupFns.push(() => {
      nfzPoly.off('mousedown', handleNfzMouseDown);
      map.off('mousemove', handleNfzMouseMove);
      map.off('mouseup', handleNfzMouseUp);
    });

    const bundle: NfzLayerBundle = {
      poly: nfzPoly,
      handleMarker: nfzHandleMarker,
      cornerMarkers,
      rotMarker: nfzRotMarker,
      cleanupFns,
      currentBounds: initialNfzBounds,
      currentCenter: initialCenter,
      currentRotation: initialRotation,
      currentAreaHa: initialAreaHa,
    };

    nfzLayerBundleRef.current = bundle;
    nfzPolygonRef.current = nfzPoly;
    nfzHandleMarkerRef.current = nfzHandleMarker;
    nfzRotationHandleRef.current = nfzRotMarker;
    nfzCornerHandlesRef.current = cornerMarkers;

    return () => {
      // In-place persistent strategy: do not destroy during re-renders unless showNfz changes or unmounted
    };
  }, [
    showNfz,
    currentCoords,
    nfzPolygon,
    hasNfzConflict,
    onNfzConflictChange,
    onNfzRepositioned,
    onSubZoneUpdate,
    t,
  ]);

  // Render Interactive Prescription Sub-Zones (In-Place Draggable Field Polygons, Real-Time Boundary Recalculation & NFZ Validation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const safeCoords = currentCoords || { lat: 10.7769, lng: 106.7009 };
    const dockCoords: Coordinates = {
      lat: safeCoords.lat - 0.003,
      lng: safeCoords.lng - 0.003,
    };
    const activeNfzZone = (activeNfzBoundsRef.current && activeNfzBoundsRef.current.length >= 3)
      ? activeNfzBoundsRef.current
      : (nfzPolygon && nfzPolygon.length >= 3)
      ? nfzPolygon
      : getNfzRestrictedZone(safeCoords);

    const layersMap = subZoneLayersMapRef.current;
    const activeSectorIds = new Set<string>();

    if (subZones && subZones.length > 0) {
      subZones.forEach((zone, idx) => {
        if (!zone || !zone.bounds || !Array.isArray(zone.bounds) || zone.bounds.length === 0) return;

        const validBounds = zone.bounds.filter((b) => b && typeof b.lat === 'number' && typeof b.lng === 'number' && !isNaN(b.lat) && !isNaN(b.lng));
        if (validBounds.length < 3) return;

        const zoneId = zone.id || `sector_${idx}`;
        activeSectorIds.add(zoneId);

        const centerPt = (zone.center && typeof zone.center.lat === 'number' && typeof zone.center.lng === 'number')
          ? zone.center
          : calculatePolygonCenter(validBounds);

        const isSectorEnabled = zone.enabled !== false;
        const isHealthy = zone.healthType === 'HEALTHY';
        const isNitrogen = zone.healthType === 'NITROGEN_DEFICIT';
        const isPest = zone.healthType === 'PEST_STRESS';

        const baseColor = !isSectorEnabled ? '#64748b' : isHealthy ? '#10b981' : isNitrogen ? '#f59e0b' : '#ef4444';
        const isNfz = isSectorEnabled && isPolygonOverlappingPolygon(validBounds, activeNfzZone);
        const isSelected = selectedZoneIndex === idx;
        const color = isNfz ? '#ef4444' : !isSectorEnabled ? '#64748b' : isSelected ? '#38bdf8' : baseColor;

        const payloadName = !isSectorEnabled
          ? 'INACTIVE / SKIPPED - Drone Docked'
          : isHealthy
          ? 'Water / Micro-Hydration Spraying'
          : isNitrogen
          ? 'Bio-Fertilizer / Nitrogen Granule Spreading'
          : 'Targeted Chemical Tank Protection';

        const latLngs: [number, number][] = validBounds.map((b) => [b.lat, b.lng]);
        const sectorVol = (zone.areaHa * zone.dosageRateLPerHa).toFixed(1);
        const rotationLabel = `${(zone.rotationAngle ?? zone.rotationDeg ?? 0)}°`;

        const isSectorActive = (subZones.length <= 1) || selectedZoneIndex === idx || hoveredZoneIndex === idx;

        const buildSectorTooltip = (areaVal: number = zone.areaHa, rotVal: number = (zone.rotationAngle ?? zone.rotationDeg ?? 0), nfzFlag: boolean = isNfz) => `<b>${zone.name}</b> ${
          nfzFlag
            ? '<span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[9px]">⚠️ NFZ CONFLICT</span>'
            : !isSectorEnabled
            ? '<span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-300 font-bold text-[9px]">⏸️ INACTIVE / SKIPPED</span>'
            : ''
        }<br/>${
          !isSectorEnabled
            ? '⏸️ <b class="text-slate-300">Sector Skipped (Drone Docked / Standby)</b>'
            : isHealthy
            ? '🟢 Healthy Canopy (Water)'
            : isNitrogen
            ? '🟡 Nitrogen Deficit (Fertilizer)'
            : '🔴 Pest / Stress Outbreak (Chemical)'
        }<br/><b>Assigned Action:</b> ${payloadName}<br/><b>VRA Rate:</b> ${
          !isSectorEnabled ? 0 : zone.dosageRateLPerHa
        } L/ha • <b>Nozzle:</b> ${zone.targetNozzleMicrons}µm<br/><b>Area:</b> ${areaVal.toFixed(
          2
        )} ha • <b>Orientation:</b> ${rotVal}°<br/><b>Liquid Req:</b> ${
          !isSectorEnabled ? '0.0 L (Skipped)' : `${(areaVal * zone.dosageRateLPerHa).toFixed(1)} L`
        }<br/><span class="text-[10px] text-cyan-300 font-bold">✥ Drag Plot • Rotate Top Anchor • Drag Corners to Resize</span>`;

        const tooltipContent = buildSectorTooltip(zone.areaHa, zone.rotationAngle ?? zone.rotationDeg ?? 0, isNfz);

        // Center Drag Handle Icon Builder
        const buildHandleIcon = (areaVal: number = zone.areaHa, rotVal: number = (zone.rotationAngle ?? zone.rotationDeg ?? 0), nfzFlag: boolean = isNfz) => L.divIcon({
          className: `subzone-drag-anchor-${zone.id}`,
          html: `
            <div class="group relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none ${isZoomedOut ? 'scale-75' : 'scale-100'} transition-transform origin-center">
              <div class="px-2 py-0.5 rounded-full ${
                nfzFlag
                  ? 'bg-red-950/95 border-2 border-red-500 text-red-200 shadow-red-900/60 animate-bounce'
                  : !isSectorEnabled
                  ? 'bg-slate-900/90 border border-dashed border-slate-600 text-slate-400 shadow-lg'
                  : isSelected
                  ? 'bg-cyan-950/95 border-2 border-cyan-400 text-cyan-200 shadow-cyan-950/60 ring-2 ring-cyan-400/30'
                  : 'bg-slate-950/95 border border-slate-700/90 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 shadow-2xl'
              } text-[9px] font-mono font-bold flex items-center gap-1 shadow-xl transition-all">
                <span class="${nfzFlag ? 'text-red-400 font-extrabold' : !isSectorEnabled ? 'text-slate-500' : 'text-cyan-400'}">✥</span>
                <span>${(zone.name || 'Plot').split(' ')[0]}</span>
                <span class="${!isSectorEnabled ? 'text-slate-500' : 'text-cyan-300'} text-[8px] font-bold">${areaVal.toFixed(2)}ha</span>
                <span class="text-amber-300 text-[8px]">${rotVal}°</span>
                ${nfzFlag ? '<span class="px-1 bg-red-700 text-white text-[8px] rounded">NFZ</span>' : !isSectorEnabled ? '<span class="px-1 bg-slate-800 text-slate-400 text-[8px] rounded border border-slate-700">SKIPPED</span>' : ''}
              </div>
            </div>
          `,
          iconSize: [110, 24],
          iconAnchor: [55, 12],
        });

        const handleIcon = buildHandleIcon(zone.areaHa, zone.rotationAngle ?? zone.rotationDeg ?? 0, isNfz);

        // Top Rotation Handle Coordinates
        const topPt1 = validBounds[0] || centerPt;
        const topPt2 = validBounds[1] || validBounds[0] || centerPt;
        const topMidLat = (topPt1.lat + topPt2.lat) / 2;
        const topMidLng = (topPt1.lng + topPt2.lng) / 2;
        const rotAnchorLat = centerPt.lat + (topMidLat - centerPt.lat) * 1.35;
        const rotAnchorLng = centerPt.lng + (topMidLng - centerPt.lng) * 1.35;

        const buildRotIcon = (rotVal: number = (zone.rotationAngle ?? zone.rotationDeg ?? 0)) => L.divIcon({
          className: `subzone-rot-anchor-${zone.id}`,
          html: `
            <div class="relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none group ${isZoomedOut ? 'scale-75' : 'scale-100'} transition-transform origin-center">
              <div class="w-6 h-6 rounded-full bg-amber-500 ring-2 ring-amber-300/60 border border-slate-950 shadow-2xl flex items-center justify-center text-slate-950 text-[10px] font-extrabold hover:scale-110 transition-transform">
                ↻
              </div>
              <span class="absolute -top-5 px-1.5 py-0.5 rounded bg-slate-950/95 text-amber-300 text-[8px] font-mono font-bold border border-slate-700 whitespace-nowrap shadow-xl opacity-80 group-hover:opacity-100 transition-opacity">
                ${rotVal}°
              </span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const rotIcon = buildRotIcon(zone.rotationAngle ?? zone.rotationDeg ?? 0);

        // Flight Raster Grid Path
        const gridWaypoints = isSectorEnabled ? generateSubZoneGridPath(zone, 4) : [];
        const gridLatLngs: [number, number][] = (gridWaypoints && gridWaypoints.length >= 2)
          ? gridWaypoints.map((p) => [p.lat, p.lng])
          : [];

        const existingBundle = layersMap.get(zoneId);

        if (existingBundle) {
          // Update bundle state references so event handlers always have fresh data
          existingBundle.currentZone = zone;
          existingBundle.currentBounds = validBounds;
          existingBundle.currentCenter = centerPt;
          existingBundle.currentRotation = zone.rotationAngle ?? zone.rotationDeg ?? 0;

          // In-Place Layer Mutation: Mutate existing Leaflet polygon instance without destroying/re-instantiating
          existingBundle.poly.setLatLngs(latLngs);
          existingBundle.poly.setStyle({
            color: color,
            fillColor: !isSectorEnabled ? '#475569' : color,
            fillOpacity: !isSectorEnabled ? 0.20 : isNfz ? 0.6 : isSelected ? 0.45 : 0.35,
            weight: isNfz ? 3.5 : isSelected ? 3.0 : !isSectorEnabled ? 2.0 : isPest ? 2.5 : 2,
            dashArray: !isSectorEnabled ? '6, 6' : isNfz ? '4, 4' : isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
            className: isNfz ? 'animate-pulse' : '',
          });
          existingBundle.poly.setTooltipContent(tooltipContent);

          // Update Handle Marker
          existingBundle.handleMarker.setLatLng([centerPt.lat, centerPt.lng]);
          existingBundle.handleMarker.setIcon(handleIcon);

          // Update Rotation Marker
          if (existingBundle.rotMarker) {
            existingBundle.rotMarker.setLatLng([rotAnchorLat, rotAnchorLng]);
            existingBundle.rotMarker.setIcon(rotIcon);
            existingBundle.rotMarker.setOpacity(isSectorActive ? 1 : 0);
          }

          // Update Corner Markers
          validBounds.forEach((cornerPt, cornerIdx) => {
            if (existingBundle.cornerMarkers[cornerIdx]) {
              existingBundle.cornerMarkers[cornerIdx].setLatLng([cornerPt.lat, cornerPt.lng]);
              existingBundle.cornerMarkers[cornerIdx].setOpacity(isSectorActive ? 1 : 0);
            }
          });

          // Update Grid Polyline
          if (existingBundle.gridPolyline) {
            if (isSectorEnabled && gridLatLngs.length >= 2) {
              existingBundle.gridPolyline.setLatLngs(gridLatLngs);
              existingBundle.gridPolyline.setStyle({
                color: isNfz ? '#ef4444' : isHealthy ? '#34d399' : isNitrogen ? '#fbbf24' : '#f87171',
                weight: 1.5,
                opacity: 0.65,
                dashArray: '3, 4',
              });
            } else {
              existingBundle.gridPolyline.setLatLngs([]);
            }
          }
        } else {
          // Instantiate new layer bundle for new sector
          const cleanupFns: Array<() => void> = [];

          // 1. Polygon Layer
          const poly = L.polygon(latLngs, {
            pane: 'prescriptionPane',
            color: color,
            fillColor: !isSectorEnabled ? '#475569' : color,
            fillOpacity: !isSectorEnabled ? 0.20 : isNfz ? 0.6 : isSelected ? 0.45 : 0.35,
            weight: isNfz ? 3.5 : isSelected ? 3.0 : !isSectorEnabled ? 2.0 : isPest ? 2.5 : 2,
            dashArray: !isSectorEnabled ? '6, 6' : isNfz ? '4, 4' : isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
            className: isNfz ? 'animate-pulse' : '',
          }).addTo(map);

          poly.bindTooltip(tooltipContent, DEFAULT_TOOLTIP_OPTIONS);

          poly.on('mouseover', () => {
            setHoveredZoneIndex(idx);
          });
          poly.on('mouseout', () => {
            setHoveredZoneIndex(null);
          });
          poly.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            setSelectedZoneIndex(idx);
          });

          // 2. Flight Grid
          let gridPolyline: L.Polyline | null = null;
          if (isSectorEnabled && gridLatLngs.length >= 2) {
            gridPolyline = L.polyline(gridLatLngs, {
              pane: 'flightPathPane',
              color: isNfz ? '#ef4444' : isHealthy ? '#34d399' : isNitrogen ? '#fbbf24' : '#f87171',
              weight: 1.5,
              opacity: 0.65,
              dashArray: '3, 4',
            }).addTo(map);
          }

          // 3. Center Drag Handle
          const handleMarker = L.marker([centerPt.lat, centerPt.lng], {
            icon: handleIcon,
            pane: 'dockPane',
            zIndexOffset: 500 + idx,
            draggable: true,
          }).addTo(map);

          handleMarker.bindTooltip(
            `<b>✥ Move ${zone.name}</b><br/>Drag to move entire sector.<br/>Click to activate Corner Resize & Rotation handles.`,
            DEFAULT_TOOLTIP_OPTIONS
          );

          handleMarker.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            setSelectedZoneIndex(idx);
          });
          handleMarker.on('mouseover', () => {
            setHoveredZoneIndex(idx);
          });
          handleMarker.on('mouseout', () => {
            setHoveredZoneIndex(null);
          });

          // 4. Top Rotation Marker
          const rotMarker = L.marker([rotAnchorLat, rotAnchorLng], {
            icon: rotIcon,
            pane: 'dockPane',
            zIndexOffset: 650 + idx,
            draggable: true,
            opacity: isSectorActive ? 1 : 0,
          }).addTo(map);

          rotMarker.bindTooltip(
            `<b>↻ Rotate ${zone.name}</b><br/>Drag to rotate plot orientation (0° - 360°).<br/>Realigns drone S-curve flight grid.`,
            DEFAULT_TOOLTIP_OPTIONS
          );

          // 5. Corner Handles (4 Draggable Anchors for Unrestricted Scaling)
          const cornerMarkers: L.Marker[] = [];
          validBounds.forEach((cornerPt, cornerIdx) => {
            if (!cornerPt || typeof cornerPt.lat !== 'number' || typeof cornerPt.lng !== 'number') return;

            const cornerIcon = L.divIcon({
              className: `subzone-corner-anchor-${zone.id}-${cornerIdx}`,
              html: `
                <div class="relative flex items-center justify-center cursor-nwse-resize select-none group ${isZoomedOut ? 'scale-75' : 'scale-100'} transition-transform origin-center">
                  <div class="w-4 h-4 rounded-md bg-cyan-400 border-2 border-slate-950 shadow-2xl hover:scale-125 hover:bg-white transition-all ring-1 ring-black/40"></div>
                </div>
              `,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            });

            const cornerMarker = L.marker([cornerPt.lat, cornerPt.lng], {
              icon: cornerIcon,
              pane: 'dockPane',
              zIndexOffset: 600 + idx * 4 + cornerIdx,
              draggable: true,
              opacity: isSectorActive ? 1 : 0,
            }).addTo(map);

            cornerMarker.bindTooltip(
              `<b>⤢ Resize Corner #${cornerIdx + 1}</b><br/>Drag to expand or shrink plot boundary (Unrestricted Area).<br/>Live Area & NFZ calculated in real-time.`,
              DEFAULT_TOOLTIP_OPTIONS
            );

            cornerMarkers.push(cornerMarker);
          });

          // Construct bundle object first so closures dynamically reference live bundle state
          const bundle: SubZoneLayerBundle = {
            poly,
            handleMarker,
            cornerMarkers,
            rotMarker,
            gridPolyline,
            zoneId,
            cleanupFns,
            currentZone: zone,
            currentBounds: validBounds,
            currentCenter: centerPt,
            currentRotation: zone.rotationAngle ?? zone.rotationDeg ?? 0,
          };

          // Attach Center Drag Handlers
          let centerDragStartCenter = centerPt;
          let centerDragStartBounds = validBounds;

          handleMarker.on('dragstart', () => {
            map.dragging.disable();
            isInteractingWithPlotRef.current = true;
            setSelectedZoneIndex(idx);
            centerDragStartCenter = bundle.currentCenter;
            centerDragStartBounds = bundle.currentBounds;
            setActiveTransformHUD({
              zoneName: bundle.currentZone.name,
              areaHa: bundle.currentZone.areaHa,
              rotationDeg: bundle.currentRotation,
              isResizing: false,
              isRotating: false,
              isNfzConflict: isNfz,
              pointCount: bundle.currentBounds.length,
            });
          });

          handleMarker.on('drag', (e: any) => {
            if (!e.latlng) return;
            const newCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
            const dLat = newCenter.lat - centerDragStartCenter.lat;
            const dLng = newCenter.lng - centerDragStartCenter.lng;

            const tempBounds = centerDragStartBounds.map((pt) => ({
              lat: pt.lat + dLat,
              lng: pt.lng + dLng,
            }));

            const hasNfzOverlap = isPolygonOverlappingPolygon(tempBounds, activeNfzZone);

            if (hasNfzOverlap) {
              poly.setStyle({
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.65,
                weight: 3.5,
                dashArray: '4, 4',
              });
            } else {
              poly.setStyle({
                color: baseColor,
                fillColor: baseColor,
                fillOpacity: 0.38,
                weight: isPest ? 3 : 2,
                dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
              });
            }

            poly.setLatLngs(tempBounds.map((b) => [b.lat, b.lng]));

            // Move corner markers & rotation handle in real time during drag
            bundle.cornerMarkers.forEach((m, cIdx) => {
              if (tempBounds[cIdx]) m.setLatLng([tempBounds[cIdx].lat, tempBounds[cIdx].lng]);
            });

            const topPt1 = tempBounds[0] || newCenter;
            const topPt2 = tempBounds[1] || tempBounds[0] || newCenter;
            const topMidLat = (topPt1.lat + topPt2.lat) / 2;
            const topMidLng = (topPt1.lng + topPt2.lng) / 2;
            const rotLat = newCenter.lat + (topMidLat - newCenter.lat) * 1.35;
            const rotLng = newCenter.lng + (topMidLng - newCenter.lng) * 1.35;
            bundle.rotMarker?.setLatLng([rotLat, rotLng]);

            setActiveTransformHUD({
              zoneName: bundle.currentZone.name,
              areaHa: bundle.currentZone.areaHa,
              rotationDeg: bundle.currentRotation,
              isResizing: false,
              isRotating: false,
              isNfzConflict: hasNfzOverlap,
              pointCount: tempBounds.length,
            });
          });

          handleMarker.on('dragend', (e: any) => {
            map.dragging.enable();
            setActiveTransformHUD(null);
            setTimeout(() => {
              isInteractingWithPlotRef.current = false;
            }, 120);

            if (!e.latlng) return;
            const newCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
            const dLat = newCenter.lat - centerDragStartCenter.lat;
            const dLng = newCenter.lng - centerDragStartCenter.lng;

            const tempBounds: [Coordinates, Coordinates, Coordinates, Coordinates] = centerDragStartBounds.map((pt) => ({
              lat: pt.lat + dLat,
              lng: pt.lng + dLng,
            })) as any;

            const hasNfzOverlap = isPolygonOverlappingPolygon(tempBounds, activeNfzZone);
            bundle.currentCenter = newCenter;
            bundle.currentBounds = tempBounds;
            bundle.currentZone = {
              ...bundle.currentZone,
              center: newCenter,
              bounds: tempBounds,
              centroid: [newCenter.lat, newCenter.lng],
              vertices: tempBounds.map((b) => [b.lat, b.lng]),
              hasNfzConflict: hasNfzOverlap,
            };

            const currentZones = subZonesRef.current || subZones;
            const updated = [...currentZones];
            const rotVal = bundle.currentRotation;
            updated[idx] = {
              ...bundle.currentZone,
              center: newCenter,
              bounds: tempBounds,
              centroid: [newCenter.lat, newCenter.lng],
              vertices: tempBounds.map((b) => [b.lat, b.lng]),
              areaHa: bundle.currentZone.areaHa,
              rotationAngle: rotVal,
              rotationDeg: rotVal,
              hasNfzConflict: hasNfzOverlap,
            };

            const distMeters = calculateGeoDistanceMeters(dockCoords, newCenter);
            const anyConflict = updated.some((z) => (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, activeNfzZone));

            onSubZoneUpdate?.(updated);
            onNfzConflictChange?.(anyConflict);
            onPlotRepositioned?.(updated, idx, newCenter, distMeters, anyConflict);
          });

          // Attach Rotation Marker Handlers
          let rotStartAngle = 0;
          let initialRotDeg = bundle.currentRotation;
          let initialRotCenter = bundle.currentCenter;
          let initialRotBounds = bundle.currentBounds;

          rotMarker.on('dragstart', (e: any) => {
            map.dragging.disable();
            isInteractingWithPlotRef.current = true;
            setSelectedZoneIndex(idx);
            initialRotDeg = bundle.currentRotation;
            initialRotCenter = bundle.currentCenter;
            initialRotBounds = bundle.currentBounds;
            const markerPt = e.latlng || { lat: rotAnchorLat, lng: rotAnchorLng };
            rotStartAngle = (Math.atan2(markerPt.lat - initialRotCenter.lat, markerPt.lng - initialRotCenter.lng) * 180) / Math.PI;
            setActiveTransformHUD({
              zoneName: bundle.currentZone.name,
              areaHa: bundle.currentZone.areaHa,
              rotationDeg: initialRotDeg,
              isResizing: false,
              isRotating: true,
              isNfzConflict: isNfz,
              pointCount: initialRotBounds.length,
            });
          });

          rotMarker.on('drag', (e: any) => {
            if (!e.latlng) return;
            const currentMouseAngle = (Math.atan2(e.latlng.lat - initialRotCenter.lat, e.latlng.lng - initialRotCenter.lng) * 180) / Math.PI;
            const deltaAngle = currentMouseAngle - rotStartAngle;
            let calculatedAngle = Number((((initialRotDeg - deltaAngle) % 360 + 360) % 360).toFixed(1));

            const newBounds = rotatePolygon(initialRotBounds, calculatedAngle - initialRotDeg, initialRotCenter);
            const hasNfzOverlap = isPolygonOverlappingPolygon(newBounds, activeNfzZone);

            poly.setLatLngs(newBounds.map((b) => [b.lat, b.lng]));
            poly.setStyle({
              color: hasNfzOverlap ? '#ef4444' : '#38bdf8',
              fillColor: hasNfzOverlap ? '#ef4444' : '#38bdf8',
              fillOpacity: hasNfzOverlap ? 0.65 : 0.45,
              weight: 3.0,
              dashArray: hasNfzOverlap ? '4, 4' : undefined,
            });

            bundle.cornerMarkers.forEach((m, cIdx) => {
              if (newBounds[cIdx]) m.setLatLng([newBounds[cIdx].lat, newBounds[cIdx].lng]);
            });

            // Dynamically update rotation badge and inner center sector badge in real time
            rotMarker.setIcon(buildRotIcon(calculatedAngle));
            handleMarker.setIcon(buildHandleIcon(bundle.currentZone.areaHa, calculatedAngle, hasNfzOverlap));
            poly.setTooltipContent(buildSectorTooltip(bundle.currentZone.areaHa, calculatedAngle, hasNfzOverlap));

            setActiveTransformHUD({
              zoneName: bundle.currentZone.name,
              areaHa: bundle.currentZone.areaHa,
              rotationDeg: calculatedAngle,
              isResizing: false,
              isRotating: true,
              isNfzConflict: hasNfzOverlap,
              pointCount: newBounds.length,
            });
          });

          rotMarker.on('dragend', (e: any) => {
            map.dragging.enable();
            setActiveTransformHUD(null);
            setTimeout(() => {
              isInteractingWithPlotRef.current = false;
            }, 120);

            if (!e.latlng) return;
            const currentMouseAngle = (Math.atan2(e.latlng.lat - initialRotCenter.lat, e.latlng.lng - initialRotCenter.lng) * 180) / Math.PI;
            const deltaAngle = currentMouseAngle - rotStartAngle;
            let calculatedAngle = Number((((initialRotDeg - deltaAngle) % 360 + 360) % 360).toFixed(1));

            const newBounds = rotatePolygon(initialRotBounds, calculatedAngle - initialRotDeg, initialRotCenter) as [
              Coordinates,
              Coordinates,
              Coordinates,
              Coordinates
            ];
            const hasNfzOverlap = isPolygonOverlappingPolygon(newBounds, activeNfzZone);

            rotMarker.setIcon(buildRotIcon(calculatedAngle));
            handleMarker.setIcon(buildHandleIcon(bundle.currentZone.areaHa, calculatedAngle, hasNfzOverlap));
            poly.setTooltipContent(buildSectorTooltip(bundle.currentZone.areaHa, calculatedAngle, hasNfzOverlap));

            bundle.currentBounds = newBounds;
            bundle.currentRotation = calculatedAngle;
            bundle.currentZone = {
              ...bundle.currentZone,
              rotationAngle: calculatedAngle,
              rotationDeg: calculatedAngle,
              bounds: newBounds,
              center: initialRotCenter,
              centroid: [initialRotCenter.lat, initialRotCenter.lng],
              vertices: newBounds.map((b) => [b.lat, b.lng]),
              hasNfzConflict: hasNfzOverlap,
            };

            const currentZones = subZonesRef.current || subZones;
            const updated = [...currentZones];
            updated[idx] = {
              ...bundle.currentZone,
              rotationAngle: calculatedAngle,
              rotationDeg: calculatedAngle,
              bounds: newBounds,
              center: initialRotCenter,
              centroid: [initialRotCenter.lat, initialRotCenter.lng],
              vertices: newBounds.map((b) => [b.lat, b.lng]),
              areaHa: bundle.currentZone.areaHa,
              hasNfzConflict: hasNfzOverlap,
            };

            const anyConflict = updated.some((z) => (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, activeNfzZone));
            const distMeters = calculateGeoDistanceMeters(dockCoords, initialRotCenter);
            onSubZoneUpdate?.(updated);
            onNfzConflictChange?.(anyConflict);
            onPlotRepositioned?.(updated, idx, initialRotCenter, distMeters, anyConflict);
          });

          // Attach 4-Corner Draggable Handlers (Unrestricted Hectares Scaling)
          cornerMarkers.forEach((cornerMarker, cornerIdx) => {
            let initialCornerBounds = validBounds;
            let initialCenter = centerPt;
            let initialDistFromCenter = 1;

            cornerMarker.on('dragstart', () => {
              map.dragging.disable();
              isInteractingWithPlotRef.current = true;
              setSelectedZoneIndex(idx);
              initialCornerBounds = bundle.currentBounds;
              initialCenter = bundle.currentCenter;
              const currentCornerPt = initialCornerBounds[cornerIdx] || initialCenter;
              initialDistFromCenter = Math.max(1, calculateGeoDistanceMeters(initialCenter, currentCornerPt));
              setActiveTransformHUD({
                zoneName: bundle.currentZone.name,
                areaHa: bundle.currentZone.areaHa,
                rotationDeg: bundle.currentRotation,
                isResizing: true,
                isRotating: false,
                isNfzConflict: isNfz,
                pointCount: initialCornerBounds.length,
              });
            });

            cornerMarker.on('drag', (e: any) => {
              if (!e.latlng) return;
              const currentCornerDist = calculateGeoDistanceMeters(initialCenter, { lat: e.latlng.lat, lng: e.latlng.lng });
              // Unrestricted Area Scaling: No artificial upper ceiling limit
              const scaleFactor = Math.max(0.05, currentCornerDist / initialDistFromCenter);

              const tempBounds = scalePolygon(initialCornerBounds, scaleFactor, initialCenter);
              const tempArea = calculatePolygonAreaHa(tempBounds);
              const hasNfzOverlap = isPolygonOverlappingPolygon(tempBounds, activeNfzZone);

              poly.setLatLngs(tempBounds.map((b) => [b.lat, b.lng]));
              poly.setStyle({
                color: hasNfzOverlap ? '#ef4444' : '#38bdf8',
                fillColor: hasNfzOverlap ? '#ef4444' : '#38bdf8',
                fillOpacity: hasNfzOverlap ? 0.65 : 0.45,
                weight: 3.0,
                dashArray: hasNfzOverlap ? '4, 4' : undefined,
              });

              bundle.cornerMarkers.forEach((m, cIdx) => {
                if (tempBounds[cIdx]) m.setLatLng([tempBounds[cIdx].lat, tempBounds[cIdx].lng]);
              });

              const topPt1 = tempBounds[0] || initialCenter;
              const topPt2 = tempBounds[1] || tempBounds[0] || initialCenter;
              const topMidLat = (topPt1.lat + topPt2.lat) / 2;
              const topMidLng = (topPt1.lng + topPt2.lng) / 2;
              const rotLat = initialCenter.lat + (topMidLat - initialCenter.lat) * 1.35;
              const rotLng = initialCenter.lng + (topMidLng - initialCenter.lng) * 1.35;
              bundle.rotMarker?.setLatLng([rotLat, rotLng]);

              // Real-Time Inner Sector Map Badge Update during drag
              handleMarker.setIcon(buildHandleIcon(tempArea, bundle.currentRotation, hasNfzOverlap));
              poly.setTooltipContent(buildSectorTooltip(tempArea, bundle.currentRotation, hasNfzOverlap));

              setActiveTransformHUD({
                zoneName: bundle.currentZone.name,
                areaHa: tempArea,
                rotationDeg: bundle.currentRotation,
                isResizing: true,
                isRotating: false,
                isNfzConflict: hasNfzOverlap,
                pointCount: tempBounds.length,
              });
            });

            cornerMarker.on('dragend', (e: any) => {
              map.dragging.enable();
              setActiveTransformHUD(null);
              setTimeout(() => {
                isInteractingWithPlotRef.current = false;
              }, 120);

              if (!e.latlng) return;
              const currentCornerDist = calculateGeoDistanceMeters(initialCenter, { lat: e.latlng.lat, lng: e.latlng.lng });
              const scaleFactor = Math.max(0.05, currentCornerDist / initialDistFromCenter);

              const newBounds = scalePolygon(initialCornerBounds, scaleFactor, initialCenter) as [
                Coordinates,
                Coordinates,
                Coordinates,
                Coordinates
              ];
              const newAreaHa = calculatePolygonAreaHa(newBounds);
              const hasNfzOverlap = isPolygonOverlappingPolygon(newBounds, activeNfzZone);
              const rotVal = bundle.currentRotation;

              // Immediate Permanent Inner Badge & Tooltip Commit on Map
              handleMarker.setIcon(buildHandleIcon(newAreaHa, rotVal, hasNfzOverlap));
              poly.setTooltipContent(buildSectorTooltip(newAreaHa, rotVal, hasNfzOverlap));

              bundle.currentBounds = newBounds;
              bundle.currentZone = {
                ...bundle.currentZone,
                bounds: newBounds,
                vertices: newBounds.map((b) => [b.lat, b.lng]),
                centroid: [initialCenter.lat, initialCenter.lng],
                center: initialCenter,
                areaHa: newAreaHa,
                maxAreaHa: newAreaHa,
                rotationAngle: rotVal,
                rotationDeg: rotVal,
                hasNfzConflict: hasNfzOverlap,
              };

              const currentZones = subZonesRef.current || subZones;
              const updated = [...currentZones];
              updated[idx] = {
                ...bundle.currentZone,
                bounds: newBounds,
                vertices: newBounds.map((b) => [b.lat, b.lng]),
                centroid: [initialCenter.lat, initialCenter.lng],
                center: initialCenter,
                areaHa: newAreaHa,
                maxAreaHa: newAreaHa,
                rotationAngle: rotVal,
                rotationDeg: rotVal,
                hasNfzConflict: hasNfzOverlap,
              };

              const anyConflict = updated.some((z) => (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, activeNfzZone));
              const distMeters = calculateGeoDistanceMeters(dockCoords, initialCenter);
              onSubZoneUpdate?.(updated);
              onNfzConflictChange?.(anyConflict);
              onPlotRepositioned?.(updated, idx, initialCenter, distMeters, anyConflict);
            });
          });

          // 6. Direct Polygon Surface Drag & Click Interactions
          let isDraggingDirectPoly = false;
          let dragStartLatLng: L.LatLng | null = null;
          let directPolyStartBounds = validBounds;
          let directPolyStartCenter = centerPt;

          const applyZonePaint = () => {
            const currentZones = subZonesRef.current || subZones;
            if (onSubZoneUpdate && currentZones) {
              const updated = [...currentZones];
              const currentZone = updated[idx];
              if (!currentZone) return;

              const fallbackHealth: ZoneHealthType =
                currentZone.healthType === 'HEALTHY'
                  ? 'NITROGEN_DEFICIT'
                  : currentZone.healthType === 'NITROGEN_DEFICIT'
                  ? 'PEST_STRESS'
                  : 'HEALTHY';

              const nextHealth: ZoneHealthType = (activeBrush || fallbackHealth) as ZoneHealthType;
              const nextChem =
                nextHealth === 'HEALTHY'
                  ? 'water_mist'
                  : nextHealth === 'NITROGEN_DEFICIT'
                  ? 'nitrogen_fertilizer'
                  : 'bio_pesticide';

              const nextDosage = nextHealth === 'PEST_STRESS' ? 20 : 15;
              const nextNozzle = nextHealth === 'HEALTHY' ? 200 : nextHealth === 'NITROGEN_DEFICIT' ? 180 : 140;

              updated[idx] = {
                ...currentZone,
                healthType: nextHealth,
                chemicalType: nextChem,
                dosageRateLPerHa: nextDosage,
                targetNozzleMicrons: nextNozzle,
              };

              onSubZoneUpdate(updated);
            }
          };

          const handlePolyMouseDown = (e: L.LeafletMouseEvent) => {
            if (e.originalEvent.button === 0 && e.latlng) {
              isDraggingDirectPoly = true;
              isInteractingWithPlotRef.current = true;
              dragStartLatLng = e.latlng;
              directPolyStartBounds = bundle.currentBounds;
              directPolyStartCenter = bundle.currentCenter;
              map.dragging.disable();
              setSelectedZoneIndex(idx);
              setActiveTransformHUD({
                zoneName: bundle.currentZone.name,
                areaHa: bundle.currentZone.areaHa,
                rotationDeg: bundle.currentRotation,
                isResizing: false,
                isRotating: false,
                isNfzConflict: isNfz,
                pointCount: bundle.currentBounds.length,
              });
              L.DomEvent.stopPropagation(e);
            }
          };

          poly.on('mousedown', handlePolyMouseDown);

          const handleMapMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDraggingDirectPoly || !dragStartLatLng || !e.latlng) return;

            const dLat = e.latlng.lat - dragStartLatLng.lat;
            const dLng = e.latlng.lng - dragStartLatLng.lng;

            const tempBounds: [Coordinates, Coordinates, Coordinates, Coordinates] = directPolyStartBounds.map((pt) => ({
              lat: pt.lat + dLat,
              lng: pt.lng + dLng,
            })) as any;
            const tempCenter = { lat: directPolyStartCenter.lat + dLat, lng: directPolyStartCenter.lng + dLng };

            const hasNfzOverlap = isPolygonOverlappingPolygon(tempBounds, activeNfzZone);

            if (hasNfzOverlap) {
              poly.setStyle({
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.65,
                weight: 3.5,
                dashArray: '4, 4',
              });
            } else {
              poly.setStyle({
                color: baseColor,
                fillColor: baseColor,
                fillOpacity: 0.38,
                weight: isPest ? 3 : 2,
                dashArray: isHealthy ? undefined : isNitrogen ? '4, 4' : '2, 2',
              });
            }

            poly.setLatLngs(tempBounds.map((b) => [b.lat, b.lng]));
            handleMarker.setLatLng([tempCenter.lat, tempCenter.lng]);

            bundle.cornerMarkers.forEach((m, cIdx) => {
              if (tempBounds[cIdx]) m.setLatLng([tempBounds[cIdx].lat, tempBounds[cIdx].lng]);
            });

            const topPt1 = tempBounds[0] || tempCenter;
            const topPt2 = tempBounds[1] || tempBounds[0] || tempCenter;
            const topMidLat = (topPt1.lat + topPt2.lat) / 2;
            const topMidLng = (topPt1.lng + topPt2.lng) / 2;
            const rotLat = tempCenter.lat + (topMidLat - tempCenter.lat) * 1.35;
            const rotLng = tempCenter.lng + (topMidLng - tempCenter.lng) * 1.35;
            bundle.rotMarker?.setLatLng([rotLat, rotLng]);

            setActiveTransformHUD({
              zoneName: bundle.currentZone.name,
              areaHa: bundle.currentZone.areaHa,
              rotationDeg: bundle.currentRotation,
              isResizing: false,
              isRotating: false,
              isNfzConflict: hasNfzOverlap,
              pointCount: tempBounds.length,
            });
          };

          const handleMapMouseUp = (e: L.LeafletMouseEvent) => {
            if (!isDraggingDirectPoly || !dragStartLatLng || !e.latlng) return;
            isDraggingDirectPoly = false;
            map.dragging.enable();
            setActiveTransformHUD(null);
            setTimeout(() => {
              isInteractingWithPlotRef.current = false;
            }, 120);

            const dLat = e.latlng.lat - dragStartLatLng.lat;
            const dLng = e.latlng.lng - dragStartLatLng.lng;
            dragStartLatLng = null;

            // If tiny mouse movement, treat as paint click
            if (Math.abs(dLat) < 0.00004 && Math.abs(dLng) < 0.00004) {
              applyZonePaint();
              return;
            }

            const tempBounds: [Coordinates, Coordinates, Coordinates, Coordinates] = directPolyStartBounds.map((pt) => ({
              lat: pt.lat + dLat,
              lng: pt.lng + dLng,
            })) as any;
            const tempCenter = { lat: directPolyStartCenter.lat + dLat, lng: directPolyStartCenter.lng + dLng };

            const hasNfzOverlap = isPolygonOverlappingPolygon(tempBounds, activeNfzZone);
            bundle.currentBounds = tempBounds;
            bundle.currentCenter = tempCenter;
            bundle.currentZone = {
              ...bundle.currentZone,
              center: tempCenter,
              bounds: tempBounds,
              centroid: [tempCenter.lat, tempCenter.lng],
              vertices: tempBounds.map((b) => [b.lat, b.lng]),
              hasNfzConflict: hasNfzOverlap,
            };

            const currentZones = subZonesRef.current || subZones;
            const updated = [...currentZones];
            const rotVal = bundle.currentRotation;
            updated[idx] = {
              ...bundle.currentZone,
              center: tempCenter,
              bounds: tempBounds,
              centroid: [tempCenter.lat, tempCenter.lng],
              vertices: tempBounds.map((b) => [b.lat, b.lng]),
              areaHa: bundle.currentZone.areaHa,
              rotationAngle: rotVal,
              rotationDeg: rotVal,
              hasNfzConflict: hasNfzOverlap,
            };

            const distMeters = calculateGeoDistanceMeters(dockCoords, tempCenter);
            const anyConflict = updated.some((z) => (z.enabled !== false) && isPolygonOverlappingPolygon(z.bounds, activeNfzZone));

            onSubZoneUpdate?.(updated);
            onNfzConflictChange?.(anyConflict);
            onPlotRepositioned?.(updated, idx, tempCenter, distMeters, anyConflict);
          };

          map.on('mousemove', handleMapMouseMove);
          map.on('mouseup', handleMapMouseUp);

          cleanupFns.push(() => {
            poly.off('mousedown', handlePolyMouseDown);
            map.off('mousemove', handleMapMouseMove);
            map.off('mouseup', handleMapMouseUp);
          });

          layersMap.set(zoneId, bundle);
        }
      });
    }

    // Clean up any sectors that were removed
    Array.from(layersMap.entries()).forEach(([id, bundle]) => {
      if (!activeSectorIds.has(id)) {
        bundle.cleanupFns.forEach((fn) => {
          try {
            fn();
          } catch (_) {}
        });
        try { map.removeLayer(bundle.poly); } catch (_) {}
        try { map.removeLayer(bundle.handleMarker); } catch (_) {}
        bundle.cornerMarkers.forEach((m) => {
          try { map.removeLayer(m); } catch (_) {}
        });
        if (bundle.rotMarker) {
          try { map.removeLayer(bundle.rotMarker); } catch (_) {}
        }
        if (bundle.gridPolyline) {
          try { map.removeLayer(bundle.gridPolyline); } catch (_) {}
        }
        layersMap.delete(id);
      }
    });
  }, [
    subZones,
    activeBrush,
    selectedZoneIndex,
    hoveredZoneIndex,
    isZoomedOut,
    onSubZoneUpdate,
    currentCoords,
    onPlotRepositioned,
    onNfzConflictChange,
    hasNfzConflict,
    nfzPolygon,
  ]);

  // Swarm Dynamic Multi-Drone Animation & Ribbon Spray Trail rendering
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (swarmState && swarmState.isSwarmActive) {
      // Collect active drones array (either dynamic drones or legacy fallback)
      const activeSwarmDrones =
        swarmState.drones && swarmState.drones.length > 0
          ? swarmState.drones
          : [
              swarmState.droneAlpha,
              swarmState.droneBeta,
              swarmState.droneGamma,
            ].filter(Boolean) as typeof swarmState.droneAlpha[];

      const activeDroneIds = new Set(activeSwarmDrones.map((d) => d.id));

      // Remove stale markers and trails
      dynamicSwarmMarkersRef.current.forEach((marker, id) => {
        if (!activeDroneIds.has(id)) {
          try {
            map.removeLayer(marker);
          } catch (_) {}
          dynamicSwarmMarkersRef.current.delete(id);
        }
      });

      dynamicSwarmTrailsRef.current.forEach((polyline, id) => {
        if (!activeDroneIds.has(id)) {
          try {
            map.removeLayer(polyline);
          } catch (_) {}
          dynamicSwarmTrailsRef.current.delete(id);
        }
      });

      // Render each dynamic drone
      activeSwarmDrones.forEach((drone, index) => {
        if (!drone || !drone.coords || typeof drone.coords.lat !== 'number' || typeof drone.coords.lng !== 'number' || isNaN(drone.coords.lat) || isNaN(drone.coords.lng)) {
          return;
        }
        const pos = drone.coords;
        const isSkipped = drone.status === 'STANDBY / SECTOR_SKIPPED';
        const isPesticide = drone.taskType === 'PESTICIDE' || drone.codeName?.startsWith('Alpha');
        const isNitrogen = drone.taskType === 'NITROGEN' || drone.codeName?.startsWith('Gamma');
        const isWater = !isPesticide && !isNitrogen;

        const pingBg = isSkipped ? 'bg-slate-600/30' : isPesticide ? 'bg-rose-500/50' : isNitrogen ? 'bg-amber-400/50' : 'bg-sky-400/50';
        const coreBg = isSkipped ? 'bg-slate-700' : isPesticide ? 'bg-rose-600' : isNitrogen ? 'bg-amber-600' : 'bg-sky-600';
        const ringBorder = isSkipped ? 'border-slate-500 ring-1 ring-slate-600' : isPesticide ? 'border-white ring-2 ring-rose-400' : isNitrogen ? 'border-white ring-2 ring-amber-400' : 'border-white ring-2 ring-sky-400';
        const tagText = isSkipped ? 'text-slate-400 border-slate-700' : isPesticide ? 'text-rose-300 border-rose-500/80' : isNitrogen ? 'text-amber-300 border-amber-500/80' : 'text-sky-300 border-sky-500/80';
        const swathHex = isPesticide ? '#ef4444' : isNitrogen ? '#eab308' : '#0ea5e9';
        const unitSymbol = isNitrogen ? 'kg' : 'L';

        const codeLabel = drone.codeName || `Drone-${index + 1}`;
        const statusLabel =
          isSkipped
            ? 'STANDBY (SKIPPED)'
            : drone.status === 'RETURNING_HOME'
            ? 'RTH'
            : drone.status === 'DOCKED_COMPLETED'
            ? 'DOCKED'
            : `${(drone.tankLevel ?? 0).toFixed(1)}${unitSymbol}`;

        const droneIcon = L.divIcon({
          className: `custom-swarm-dyn-${drone.id}`,
          html: `
            <div class="relative flex flex-col items-center select-none" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); -webkit-filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
              <div class="relative flex items-center justify-center">
                ${!isSkipped ? `<div class="absolute w-8 h-8 rounded-full ${pingBg} animate-ping"></div>` : ''}
                <div class="w-7 h-7 rounded-full ${coreBg} border-2 ${ringBorder} shadow-xl flex items-center justify-center text-white text-xs font-bold">
                  ${isSkipped ? '⏸️' : isPesticide ? '🛸' : isNitrogen ? '🚜' : '🚁'}
                </div>
              </div>
              <span class="mt-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 ${tagText} font-mono text-[8px] font-bold border whitespace-nowrap shadow-2xl z-30">
                ${codeLabel} • ${statusLabel}
              </span>
            </div>
          `,
          iconSize: [130, 48],
          iconAnchor: [65, 16],
        });

        // Update or create marker
        const existingMarker = dynamicSwarmMarkersRef.current.get(drone.id);
        if (existingMarker && (existingMarker as any)._map) {
          existingMarker.setLatLng([pos.lat, pos.lng]);
          existingMarker.setIcon(droneIcon);
        } else {
          const newMarker = L.marker([pos.lat, pos.lng], {
            icon: droneIcon,
            pane: 'activeDronePane',
            zIndexOffset: 1200 + index * 10,
          }).addTo(map);

          newMarker.bindPopup(
            `<b>${drone.name}</b> (${drone.model})<br/>` +
            `<b>Code:</b> <span class="font-mono font-bold">${drone.codeName}</span><br/>` +
            `<b>Task:</b> ${drone.role}<br/>` +
            `<b>Altitude:</b> ${(drone.altitudeMeters ?? 0).toFixed(1)}m AGL<br/>` +
            `<b>Payload:</b> ${(drone.tankLevel ?? 0).toFixed(1)} / ${drone.maxTank ?? 40} ${unitSymbol} (${drone.unitRateLabel ?? ''})<br/>` +
            `<b>Status:</b> ${drone.status} (${(drone.progress ?? 0).toFixed(0)}%)`,
            DEFAULT_POPUP_OPTIONS
          );

          dynamicSwarmMarkersRef.current.set(drone.id, newMarker);
        }

        // Update or create spray swath trail
        if (drone.sprayTrail && drone.sprayTrail.length >= 2) {
          const trailLatLngs: [number, number][] = drone.sprayTrail
            .filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng))
            .map((p) => [p.lat, p.lng]);
          if (trailLatLngs.length >= 2) {
            const existingTrail = dynamicSwarmTrailsRef.current.get(drone.id);
            if (existingTrail && (existingTrail as any)._map) {
              existingTrail.setLatLngs(trailLatLngs);
            } else {
              const newTrail = L.polyline(trailLatLngs, {
                pane: 'spraySwathPane',
                color: swathHex,
                weight: 15,
                opacity: 0.55,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(map);
              dynamicSwarmTrailsRef.current.set(drone.id, newTrail);
            }
          }
        }
      });
    } else {
      // Swarm inactive -> clean up all dynamic markers and trails
      dynamicSwarmMarkersRef.current.forEach((marker) => {
        try {
          map.removeLayer(marker);
        } catch (_) {}
      });
      dynamicSwarmMarkersRef.current.clear();

      dynamicSwarmTrailsRef.current.forEach((polyline) => {
        try {
          map.removeLayer(polyline);
        } catch (_) {}
      });
      dynamicSwarmTrailsRef.current.clear();

      if (swarmAlphaMarkerRef.current) {
        try { map.removeLayer(swarmAlphaMarkerRef.current); } catch (_) {}
        swarmAlphaMarkerRef.current = null;
      }
      if (swarmBetaMarkerRef.current) {
        try { map.removeLayer(swarmBetaMarkerRef.current); } catch (_) {}
        swarmBetaMarkerRef.current = null;
      }
      if (swarmGammaMarkerRef.current) {
        try { map.removeLayer(swarmGammaMarkerRef.current); } catch (_) {}
        swarmGammaMarkerRef.current = null;
      }
      if (swarmAlphaTrailRef.current) {
        try { map.removeLayer(swarmAlphaTrailRef.current); } catch (_) {}
        swarmAlphaTrailRef.current = null;
      }
      if (swarmBetaTrailRef.current) {
        try { map.removeLayer(swarmBetaTrailRef.current); } catch (_) {}
        swarmBetaTrailRef.current = null;
      }
      if (swarmGammaTrailRef.current) {
        try { map.removeLayer(swarmGammaTrailRef.current); } catch (_) {}
        swarmGammaTrailRef.current = null;
      }
    }
  }, [swarmState]);

  // Update Markers & Flight Paths with Dynamic Collision Avoidance & Staggered Positioning
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Registry of placed markers for collision avoidance
    const placedMarkerSlots: PlacedMarkerSlot[] = [];

    const dockCoords: Coordinates = {
      lat: currentCoords.lat - 0.0022,
      lng: currentCoords.lng - 0.0035,
    };

    // 1. Field Center Marker
    placedMarkerSlots.push({ id: 'field_center', coords: currentCoords });

    if (fieldMarkerRef.current && (fieldMarkerRef.current as any)._map) {
      fieldMarkerRef.current.setLatLng([currentCoords.lat, currentCoords.lng]);
    } else {
      const fieldIcon = L.divIcon({
        className: 'custom-field-pin',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping"></div>
              <div class="w-6 h-6 rounded-full bg-emerald-500 ring-2 ring-emerald-300/40 border-2 border-white shadow-xl flex items-center justify-center text-slate-950 font-bold text-xs">
                🌾
              </div>
            </div>
            <span class="mt-1 px-1.5 py-0.5 rounded-full bg-slate-950/95 text-emerald-300 font-mono text-[8px] font-bold border border-slate-700/90 whitespace-nowrap shadow-2xl z-30 ring-1 ring-black/50">
              PARCEL CENTER
            </span>
          </div>
        `,
        iconSize: [80, 42],
        iconAnchor: [40, 12],
      });

      const marker = L.marker([currentCoords.lat, currentCoords.lng], {
        icon: fieldIcon,
        pane: 'dockPane',
        zIndexOffset: 400,
        draggable: true,
      })
        .addTo(map)
        .bindPopup(`<b>${locationName}</b><br/>Area: ${fieldArea.toFixed(1)} Ha • Crop: Active Matrix<br/><span class="text-cyan-300 text-[10px]">✥ Drag to move whole parcel</span>`, DEFAULT_POPUP_OPTIONS);

      marker.on('dragstart', () => {
        map.dragging.disable();
      });

      marker.on('dragend', (e: any) => {
        map.dragging.enable();
        const newCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
        const dLat = newCenter.lat - currentCoords.lat;
        const dLng = newCenter.lng - currentCoords.lng;

        const updated = subZones.map((z) => ({
          ...z,
          center: { lat: z.center.lat + dLat, lng: z.center.lng + dLng },
          bounds: z.bounds.map((b) => ({ lat: b.lat + dLat, lng: b.lng + dLng })) as [
            Coordinates,
            Coordinates,
            Coordinates,
            Coordinates
          ],
        }));

        const nfzZone = getNfzRestrictedZone(newCenter);
        const anyConflict = updated.some((z) => isPolygonOverlappingPolygon(z.bounds, nfzZone));
        const distM = calculateGeoDistanceMeters(dockCoords, newCenter);

        onLocationSelect(newCenter, locationName);
        onSubZoneUpdate?.(updated);
        onNfzConflictChange?.(anyConflict);
        onPlotRepositioned?.(updated, -1, newCenter, distM, anyConflict);
      });

      fieldMarkerRef.current = marker;
    }

    // 2. Charging Dock Station 01 Marker
    placedMarkerSlots.push({ id: 'dock_base', coords: dockCoords });

    if (dockMarkerRef.current && (dockMarkerRef.current as any)._map) {
      dockMarkerRef.current.setLatLng([dockCoords.lat, dockCoords.lng]);
    } else {
      const dockIcon = L.divIcon({
        className: 'custom-dock-pin',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 ring-2 ring-amber-300/40 border-2 border-slate-900 shadow-xl text-slate-950 font-bold text-xs">
              ⚡
            </div>
            <span class="mt-1 px-1.5 py-0.5 rounded-full bg-slate-950/95 text-amber-300 font-mono text-[8px] font-bold border border-slate-700/90 whitespace-nowrap shadow-2xl z-30 ring-1 ring-black/50">
              HOME DOCK 01
            </span>
          </div>
        `,
        iconSize: [80, 48],
        iconAnchor: [40, 16],
      });

      const dockMarker = L.marker([dockCoords.lat, dockCoords.lng], {
        icon: dockIcon,
        pane: 'dockPane',
        zIndexOffset: 450,
      })
        .addTo(map)
        .bindPopup(`<b>${t.chargingStationLabel}</b><br/>Fast Swap & Water Refill Dock • RTK Base`, DEFAULT_POPUP_OPTIONS);
      dockMarkerRef.current = dockMarker;
    }

    // 3. Planned Flight Path (Scaled with fieldArea)
    const plannedPath = generateFlightPathWaypoints(currentCoords, fieldArea);
    const pathLatLngs: [number, number][] = plannedPath.map((p) => [p.lat, p.lng]);

    if (flightPathLineRef.current && (flightPathLineRef.current as any)._map) {
      flightPathLineRef.current.setLatLngs(pathLatLngs);
    } else {
      flightPathLineRef.current = L.polyline(pathLatLngs, {
        pane: 'flightPathPane',
        color: '#10b981',
        weight: 2.5,
        opacity: 0.6,
        dashArray: '6, 8',
      }).addTo(map);
    }

    // 4. Spray Swath Trail (Semi-transparent continuous dispersion coverage)
    if (simulation.sprayTrail && simulation.sprayTrail.length >= 2) {
      const trailLatLngs: [number, number][] = simulation.sprayTrail.map((p) => [p.lat, p.lng]);

      // Wide swath dispersion layer (6.0m effective swath ribbon)
      if (sprayTrailWideRef.current && (sprayTrailWideRef.current as any)._map) {
        sprayTrailWideRef.current.setLatLngs(trailLatLngs);
      } else {
        sprayTrailWideRef.current = L.polyline(trailLatLngs, {
          pane: 'spraySwathPane',
          color: '#06b6d4',
          weight: 16,
          opacity: 0.38,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }

      // Core swath center trajectory
      if (sprayTrailCoreRef.current && (sprayTrailCoreRef.current as any)._map) {
        sprayTrailCoreRef.current.setLatLngs(trailLatLngs);
      } else {
        sprayTrailCoreRef.current = L.polyline(trailLatLngs, {
          pane: 'spraySwathPane',
          color: '#10b981',
          weight: 2.5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    } else {
      if (sprayTrailWideRef.current) {
        try { map.removeLayer(sprayTrailWideRef.current); } catch (_) {}
        sprayTrailWideRef.current = null;
      }
      if (sprayTrailCoreRef.current) {
        try { map.removeLayer(sprayTrailCoreRef.current); } catch (_) {}
        sprayTrailCoreRef.current = null;
      }
    }

    // 5. Breakpoint Memory Marker (Register in collision slots early so other markers stagger around it)
    if (breakpoint && breakpoint.coordinates && typeof breakpoint.coordinates.lat === 'number' && typeof breakpoint.coordinates.lng === 'number' && !isNaN(breakpoint.coordinates.lat) && !isNaN(breakpoint.coordinates.lng)) {
      placedMarkerSlots.push({ id: 'breakpoint', coords: breakpoint.coordinates });

      const bpIcon = L.divIcon({
        className: 'custom-bp-pin',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-600 ring-2 ring-rose-400/40 text-white text-[10px] font-bold border border-white shadow-xl whitespace-nowrap">
              📍 Breakpoint (${(breakpoint.progressPercent ?? 0).toFixed(0)}%)
            </div>
          </div>
        `,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });

      if (breakpointMarkerRef.current && (breakpointMarkerRef.current as any)._map) {
        breakpointMarkerRef.current.setLatLng([breakpoint.coordinates.lat, breakpoint.coordinates.lng]);
      } else {
        breakpointMarkerRef.current = L.marker(
          [breakpoint.coordinates.lat, breakpoint.coordinates.lng],
          { icon: bpIcon, zIndexOffset: 1500 }
        )
          .addTo(map)
          .bindPopup(
            `<b>Breakpoint Saved (${(breakpoint.progressPercent ?? 0).toFixed(0)}%)</b><br/>Reason: ${breakpoint.reason || 'Safety Hold'}<br/>Battery: ${(breakpoint.batteryAtBreakpoint ?? 100).toFixed(0)}% • Tank: ${(breakpoint.tankAtBreakpoint ?? 40).toFixed(1)}L`,
            DEFAULT_POPUP_OPTIONS
          );
      }
    } else if (breakpointMarkerRef.current) {
      try {
        map.removeLayer(breakpointMarkerRef.current);
      } catch (_) {}
      breakpointMarkerRef.current = null;
    }

    // 6. Fleet Active Unit Marker (Resolve collision if docked or at parcel center)
    const isDrone = activeUnit.category === 'drone';
    const machineryEmoji = isDrone ? (activeUnit.id === 'drone_alpha' ? '🛸' : '🚁') : '🚜';
    const currentIconKey = `${activeUnit.id}_${simulation.isRTHActive}_${simulation.isRecharging}`;

    const activeRawPos = (simulation && simulation.currentPos && typeof simulation.currentPos.lat === 'number' && typeof simulation.currentPos.lng === 'number' && !isNaN(simulation.currentPos.lat))
      ? simulation.currentPos
      : currentCoords;

    // Calculate collision-resolved position for active unit
    const resolvedActivePos = resolveMarkerStaggerOffset(
      activeRawPos,
      placedMarkerSlots,
      1,
      28
    );
    placedMarkerSlots.push({ id: activeUnit.id, coords: resolvedActivePos });

    const createFleetIcon = () =>
      L.divIcon({
        className: 'custom-drone-pin',
        html: `
          <div class="relative flex flex-col items-center select-none" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); -webkit-filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
            <div class="flex items-center justify-center w-9 h-9 rounded-full ${
              simulation.isRTHActive
                ? 'bg-amber-500 ring-4 ring-amber-400/40 animate-bounce'
                : simulation.isRecharging
                ? 'bg-amber-400 ring-4 ring-amber-300/30'
                : 'bg-cyan-500 ring-4 ring-cyan-400/30'
            } border-2 border-white shadow-2xl text-white font-bold text-sm">
              ${machineryEmoji}
            </div>
            <span class="mt-1 px-2 py-0.5 rounded-full bg-slate-950/95 text-emerald-300 font-mono text-[9px] font-bold border border-slate-700/90 whitespace-nowrap shadow-2xl z-30 ring-1 ring-black/50">
              ${
                simulation.isRTHActive
                  ? 'RTH IN-TRANSIT'
                  : simulation.isRecharging
                  ? 'CHARGING / REFILL'
                  : activeUnit.name
              }
            </span>
          </div>
        `,
        iconSize: [120, 52],
        iconAnchor: [60, 18],
      });

    if (fleetMarkerRef.current && (fleetMarkerRef.current as any)._map) {
      if (currentFleetIconKeyRef.current !== currentIconKey) {
        fleetMarkerRef.current.setIcon(createFleetIcon());
        currentFleetIconKeyRef.current = currentIconKey;
      }
      fleetMarkerRef.current.setLatLng([resolvedActivePos.lat, resolvedActivePos.lng]);
    } else {
      currentFleetIconKeyRef.current = currentIconKey;
      fleetMarkerRef.current = L.marker([resolvedActivePos.lat, resolvedActivePos.lng], {
        icon: createFleetIcon(),
        pane: 'activeDronePane',
        zIndexOffset: 1200,
      })
        .addTo(map)
        .bindPopup(
          `<b>${activeUnit.name}</b> (${activeUnit.model})<br/>` +
          `<b>Status:</b> ${simulation.isRTHActive ? 'Return-To-Home Transit' : simulation.isRecharging ? 'Dock Charging & Refill' : activeUnit.status}<br/>` +
          `<b>Telemetry:</b> Battery ${telemetry.battery.toFixed(0)}% • Tank ${telemetry.tankLevel.toFixed(1)}L / ${activeUnit.maxTankCapacity}L`,
          DEFAULT_POPUP_OPTIONS
        );
    }

    // 7. RTH Emergency Return Trajectory Line (Temporary visual orange dashed line)
    if (simulation.isRTHActive) {
      const rthLatLngs: [number, number][] = [
        [resolvedActivePos.lat, resolvedActivePos.lng],
        [dockCoords.lat, dockCoords.lng],
      ];
      if (rthLineRef.current && (rthLineRef.current as any)._map) {
        rthLineRef.current.setLatLngs(rthLatLngs);
      } else {
        rthLineRef.current = L.polyline(rthLatLngs, {
          pane: 'flightPathPane',
          color: '#f97316',
          weight: 3.5,
          dashArray: '6, 8',
          opacity: 0.95,
        }).addTo(map);
      }
    } else if (rthLineRef.current) {
      try {
        map.removeLayer(rthLineRef.current);
      } catch (_) {}
      rthLineRef.current = null;
    }

    // 8. Swarm Fleet Units (Simultaneous multi-drone & machinery swarm display with radial stagger)
    swarmMarkersRef.current.forEach((m) => {
      try {
        map.removeLayer(m);
      } catch (_) {}
    });
    swarmMarkersRef.current = [];

    const companionUnits: {
      id: string;
      name: string;
      role: string;
      icon: string;
      baseCoords: Coordinates;
      status: string;
      color: string;
    }[] = [];

    if (activeUnit.id !== 'drone_beta') {
      companionUnits.push({
        id: 'drone_beta',
        name: 'DJI Agras T40 (Beta)',
        role: 'Swarm Wingman 02 • Water Sprayer RTK',
        icon: '🚁',
        baseCoords: { lat: dockCoords.lat + 0.0006, lng: dockCoords.lng + 0.0014 },
        status: 'STANDBY / SWARM READY',
        color: 'bg-teal-600',
      });
    }

    if (activeUnit.id !== 'tractor_yanmar') {
      companionUnits.push({
        id: 'tractor_yanmar',
        name: 'Yanmar YK1200',
        role: 'Perimeter Soil Monitor & Tillage',
        icon: '🚜',
        baseCoords: { lat: currentCoords.lat - 0.0024, lng: currentCoords.lng + 0.0028 },
        status: 'AUTONOMOUS PATROL',
        color: 'bg-amber-600',
      });
    }

    if (activeUnit.id !== 'drone_alpha') {
      companionUnits.push({
        id: 'drone_alpha',
        name: 'DJI Agras T40 (Alpha)',
        role: 'Swarm Lead • Water Sprayer RTK',
        icon: '🛸',
        baseCoords: { lat: dockCoords.lat - 0.0004, lng: dockCoords.lng - 0.0008 },
        status: 'STANDBY / BASE DOCK',
        color: 'bg-cyan-600',
      });
    }

    companionUnits.forEach((u, index) => {
      // Calculate dynamic radial offset to prevent any collision with dock, field center, or active unit
      const resolvedCompanionPos = resolveMarkerStaggerOffset(
        u.baseCoords,
        placedMarkerSlots,
        index + 2,
        28
      );
      placedMarkerSlots.push({ id: u.id, coords: resolvedCompanionPos });

      const companionIcon = L.divIcon({
        className: 'custom-swarm-pin',
        html: `
          <div class="relative flex flex-col items-center opacity-90 hover:opacity-100 transition-opacity">
            <div class="flex items-center justify-center w-7 h-7 rounded-full ${u.color} ring-2 ring-white/30 border-2 border-slate-900 shadow-xl text-white font-bold text-xs">
              ${u.icon}
            </div>
            <span class="mt-1 px-1.5 py-0.5 rounded-full bg-slate-950/95 text-slate-200 font-mono text-[8px] font-bold border border-slate-700/90 whitespace-nowrap shadow-2xl z-30 ring-1 ring-black/50">
              ${u.name}
            </span>
          </div>
        `,
        iconSize: [100, 44],
        iconAnchor: [50, 14],
      });

      const companionMarker = L.marker([resolvedCompanionPos.lat, resolvedCompanionPos.lng], {
        icon: companionIcon,
        pane: 'swarmPane',
        zIndexOffset: 700 + index * 40,
      })
        .addTo(map)
        .bindPopup(
          `<b>${u.name}</b><br/>${u.role}<br/><span class="text-xs text-emerald-400 font-mono">Status: ${u.status}</span>`,
          DEFAULT_POPUP_OPTIONS
        );

      swarmMarkersRef.current.push(companionMarker);
    });
  }, [
    currentCoords,
    simulation.currentPos,
    simulation.isRTHActive,
    simulation.isRecharging,
    simulation.sprayTrail,
    breakpoint,
    activeUnit,
    telemetry,
    locationName,
    fieldArea,
    t,
  ]);

  // Handle Search Query with Debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      const results = await searchNominatimLocations(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowResultsDropdown(results.length > 0);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      onLocationSelect({ lat, lng }, result.display_name);
      setSearchQuery(result.display_name.split(',')[0]);
      setShowResultsDropdown(false);
    }
  };

  return (
    <div
      id="agritwin_map_section"
      className="relative flex flex-col h-full bg-slate-900 border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Top Search & Geolocation Controls Header Bar */}
      <div
        id="agritwin_map_header_bar"
        className="bg-slate-900/95 border-b border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 z-30"
      >
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-md focus-within:ring-2 focus-within:ring-emerald-500/50">
            <Search className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              id="input_global_nominatim_search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResultsDropdown(true)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            {isSearching && (
              <RotateCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showResultsDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50">
              {searchResults.map((item) => (
                <button
                  key={item.place_id}
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/90 border-b border-slate-800/60 last:border-0 flex items-start gap-2.5 transition-all text-xs text-slate-200"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="truncate">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls Group: GPS Center, Layer Overlays & Map Style */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* GPS Centering Button */}
          <button
            id="btn_gps_center"
            onClick={onUseGps}
            disabled={isGpsLoading}
            className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
            title="Locate via GPS"
          >
            <Crosshair className={`w-3.5 h-3.5 text-cyan-400 ${isGpsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.useGpsButton}</span>
          </button>

          {/* NDVI Crop Health Toggle */}
          <button
            id="btn_toggle_ndvi"
            onClick={() => setShowNdvi(!showNdvi)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-md active:scale-95 ${
              showNdvi
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80 shadow-emerald-950/30'
                : 'bg-slate-950/80 text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
            title="Toggle NDVI Crop Health heatmap polygons"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">NDVI Layer</span>
          </button>

          {/* NFZ Restricted Airspace Toggle */}
          <button
            id="btn_toggle_nfz"
            onClick={() => setShowNfz(!showNfz)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-md active:scale-95 ${
              showNfz
                ? 'bg-red-950/90 text-red-300 border-red-500/80 shadow-red-950/30'
                : 'bg-slate-950/80 text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
            title="Toggle No-Fly Zone (NFZ) safety geofencing"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden md:inline">NFZ Geofence</span>
          </button>

          {/* Map Layer Switcher */}
          <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-xl p-0.5 shadow-md">
            <button
              onClick={() => setMapLayerType('osm')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                mapLayerType === 'osm'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vector
            </button>
            <button
              onClick={() => setMapLayerType('satellite')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                mapLayerType === 'satellite'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapLayerType('dark')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                mapLayerType === 'dark'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tactical
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Field Area & Payload Calculation Toolbar */}
      <div
        id="agritwin_field_area_toolbar"
        className="bg-slate-950/60 border-b border-slate-800 px-3.5 py-2.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs"
      >
        {/* Left: Field Area Presets & Slider */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="text-slate-200">{t.targetFieldArea}:</span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
            <button
              id="btn_preset_alpha"
              type="button"
              onClick={() => onFieldAreaChange?.(1.5)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                Math.abs(fieldArea - 1.5) < 0.05
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.plotAlphaPreset}
            </button>
            <button
              id="btn_preset_beta"
              type="button"
              onClick={() => onFieldAreaChange?.(3.0)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                Math.abs(fieldArea - 3.0) < 0.05
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.plotBetaPreset}
            </button>
            <button
              id="btn_preset_gamma"
              type="button"
              onClick={() => onFieldAreaChange?.(5.0)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                Math.abs(fieldArea - 5.0) < 0.05
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.plotGammaPreset}
            </button>
          </div>

          {/* Slider & Direct Number Input */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg">
            <input
              id="slider_field_area"
              type="range"
              min="0.01"
              max="100.00"
              step="0.01"
              value={fieldArea}
              onChange={(e) => onFieldAreaChange?.(parseFloat(e.target.value))}
              className="w-20 sm:w-28 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1 font-mono font-bold text-emerald-300">
              <input
                id="input_field_area"
                type="number"
                min="0.01"
                max="100.00"
                step="0.01"
                value={fieldArea}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) onFieldAreaChange?.(Math.min(100.0, Math.max(0.01, val)));
                }}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400 font-normal">ha</span>
            </div>
          </div>
        </div>

        {/* Right: Dynamic Real-time Calculations for Payload & Battery */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-teal-300">
            <Droplet className="w-3 h-3 text-teal-400" />
            <span className="text-slate-400 font-sans text-[10px]">{t.requiredSprayVolume}:</span>
            <span className="font-bold">{(fieldArea * 16).toFixed(1)} L</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-cyan-300">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400 font-sans text-[10px]">{t.estimatedFlightTime}:</span>
            <span className="font-bold">{(fieldArea * 7.5).toFixed(1)} min</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-amber-300">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-slate-400 font-sans text-[10px]">{t.estimatedEnergyConsumed}:</span>
            <span className="font-bold">~{Math.round(fieldArea * 35)}%</span>
          </div>
        </div>
      </div>

      {/* Dynamic Inline Heavy Mission Alert Banner */}
      {(fieldArea * 16 > activeUnit.maxTankCapacity ||
        fieldArea * 35 > telemetry.battery ||
        fieldArea > 2.5) && (
        <div
          id="banner_heavy_mission_alert"
          className="bg-amber-950/70 border-b border-amber-500/50 px-3.5 py-2 text-amber-200 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <b className="font-bold text-amber-300 tracking-wide uppercase text-[10px] mr-1.5 px-1.5 py-0.5 rounded bg-amber-900/80 border border-amber-600">
                {t.heavyMissionAlert}
              </b>
              <span>
                {fieldArea.toFixed(1)} ha requires {(fieldArea * 16).toFixed(0)}L spray &amp;{' '}
                {Math.round(fieldArea * 35)}% battery. System will schedule{' '}
                {Math.max(1, Math.ceil((fieldArea * 16) / activeUnit.maxTankCapacity) - 1)} auto-refill
                &amp; recharge stop(s) during flight.
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Field Prescription & Zone Painting Toolbar Component */}
      {subZones && subZones.length > 0 && onSubZoneUpdate && (
        <div className="p-3 bg-slate-950/70 border-b border-slate-800">
          <PrescriptionZonePainter
            language={language}
            subZones={subZones}
            onSubZoneUpdate={onSubZoneUpdate}
            activeBrush={activeBrush}
            onActiveBrushChange={onActiveBrushChange || (() => {})}
            fieldArea={fieldArea}
            swarmState={
              swarmState || {
                isSwarmActive: false,
                droneAlpha: {
                  id: 'drone_alpha',
                  coords: currentCoords,
                  battery: 88,
                  tankLevel: 36.5,
                  sprayTrail: [],
                  targetSectorId: 'sector_n1',
                },
                droneBeta: {
                  id: 'drone_beta',
                  coords: currentCoords,
                  battery: 94,
                  tankLevel: 48.0,
                  sprayTrail: [],
                  targetSectorId: 'sector_s1',
                },
                status: 'IDLE',
              }
            }
            onDispatchSwarm={onDispatchSwarm || (() => {})}
            onResetPrescription={onResetPrescription || (() => {})}
            hasNfzConflict={hasNfzConflict}
            onAcceptSaveMission={onAcceptSaveMission}
            onOpenSavedMission={onOpenSavedMission}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            flightDistanceMeters={
              calculateGeoDistanceMeters(
                { lat: (currentCoords?.lat ?? 10.7769) - 0.003, lng: (currentCoords?.lng ?? 106.7009) - 0.003 },
                subZones && subZones.length > 0
                  ? calculatePolygonCenter(subZones.map((z) => z?.center).filter((c): c is Coordinates => !!c && typeof c.lat === 'number'))
                  : (currentCoords || { lat: 10.7769, lng: 106.7009 })
              ) || 340
            }
          />
        </div>
      )}

      {/* Main Map Container */}
      <div className="relative flex-1 w-full min-h-[380px] lg:min-h-[460px]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live Swarm Execution HUD Overlay */}
        {swarmState && swarmState.isSwarmActive && (
          <div
            id="swarm-live-telemetry-hud"
            className="absolute top-3 left-3 z-[920] bg-slate-950/95 border border-cyan-500/60 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs text-slate-100 space-y-2 max-w-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-bold text-cyan-300">DUAL-DRONE SWARM ACTIVE</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-700">
                Tandem Spraying
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* Drone Alpha */}
              <div className="bg-slate-900/90 p-2 rounded-lg border border-cyan-800/60">
                <div className="font-bold text-cyan-400 flex items-center justify-between">
                  <span>Alpha (T40)</span>
                  <span className="text-[10px] text-slate-400">3.5m AGL</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-300 space-y-0.5 font-mono">
                  <div>Batt: {swarmState.droneAlpha.battery.toFixed(0)}%</div>
                  <div>Tank: {swarmState.droneAlpha.tankLevel.toFixed(1)}L</div>
                  <div>Alt: 3.5m • 6.2 m/s</div>
                </div>
              </div>

              {/* Drone Beta */}
              <div className="bg-slate-900/90 p-2 rounded-lg border border-rose-800/60">
                <div className="font-bold text-rose-400 flex items-center justify-between">
                  <span>Wingman (P100)</span>
                  <span className="text-[10px] text-slate-400">4.5m AGL</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-300 space-y-0.5 font-mono">
                  <div>Batt: {swarmState.droneBeta.battery.toFixed(0)}%</div>
                  <div>Tank: {swarmState.droneBeta.tankLevel.toFixed(1)}L</div>
                  <div>Alt: 4.5m • 6.2 m/s</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
              <span>RTK Centimeter Lock (±2.5cm)</span>
              <span className="text-emerald-400 font-bold">Parallel Swath</span>
            </div>
          </div>
        )}

        {/* Live Numeric Overlay HUD on Plot / NFZ Resize & Rotation Transformation */}
        {activeTransformHUD && (
          <div
            id="hud_live_plot_transform"
            className={`absolute top-20 left-1/2 -translate-x-1/2 z-[980] bg-slate-950/95 border ${
              activeTransformHUD.zoneName.includes('No-Fly')
                ? 'border-rose-500/90 shadow-rose-950/80'
                : 'border-cyan-500/80 shadow-cyan-950/80'
            } backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 sm:gap-4 animate-in fade-in zoom-in-95 pointer-events-none`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeTransformHUD.zoneName.includes('No-Fly') ? 'bg-rose-500' : 'bg-cyan-400'
                } animate-ping`}
              ></span>
              <span className="font-bold text-xs text-white uppercase tracking-wider">
                {activeTransformHUD.zoneName}
              </span>
              {activeTransformHUD.isResizing && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-900/80 text-cyan-300 text-[9px] font-mono font-bold">
                  RESIZING
                </span>
              )}
              {activeTransformHUD.isRotating && (
                <span className="px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-300 text-[9px] font-mono font-bold">
                  ROTATING
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            {/* Active Area (ha) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Area:</span>
              <span
                className={`font-mono text-sm font-bold ${
                  activeTransformHUD.zoneName.includes('No-Fly') ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                {activeTransformHUD.areaHa.toFixed(2)} ha
              </span>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            {/* Rotation Angle (°) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Orientation:</span>
              <span className="font-mono text-sm font-bold text-amber-300">
                {activeTransformHUD.rotationDeg}°
              </span>
            </div>

            {/* Conflict status */}
            {activeTransformHUD.isNfzConflict && (
              <>
                <div className="h-4 w-px bg-slate-700"></div>
                <div className="px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <span>⚠️ NFZ Interlock</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pin Drop User Guidance Overlay Tag */}
        <div className="absolute bottom-3 left-3 z-[900] bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-lg pointer-events-none">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.pinDropHint}</span>
        </div>

        {/* NFZ Geofence Warning Overlay Banner */}
        {showNfz && (
          <div className="absolute top-16 right-3.5 z-[900] bg-slate-950/90 border border-slate-700 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2 text-[11px] text-slate-300 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{t.nfzViolationWarning}</span>
          </div>
        )}

        {/* Dynamic Safety & Weather Deterioration Notification Banner Over Map */}
        {failSafeNotification && (
          <div
            id="map_weather_emergency_banner"
            className={`absolute top-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-md z-[950] backdrop-blur-md rounded-xl p-3 shadow-2xl border flex items-start gap-2.5 ${
              failSafeNotification.includes('MISSION ACCOMPLISHED') ||
              failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
              failSafeNotification.includes('MISIÓN CUMPLIDA') ||
              failSafeNotification.includes('MISSION ACCOMPLIE') ||
              failSafeNotification.includes('作业任务圆满完成') ||
              failSafeNotification.includes('MISSÃO CONCLUÍDA') ||
              failSafeNotification.includes('BREAKPOINT REACHED') ||
              failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
              failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
              failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
              failSafeNotification.includes('已抵达断点坐标') ||
              failSafeNotification.includes('RESTORED') ||
              failSafeNotification.includes('CLEARANCE')
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                : failSafeNotification.includes('SIGNAL LOSS FAIL-SAFE') ||
                  failSafeNotification.includes('GROUNDED') ||
                  failSafeNotification.includes('Awaiting')
                ? 'bg-amber-950/95 border-amber-500 text-amber-100'
                : 'bg-red-950/95 border-red-500 text-red-100 animate-pulse'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                failSafeNotification.includes('MISSION ACCOMPLISHED') ||
                failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
                failSafeNotification.includes('MISIÓN CUMPLIDA') ||
                failSafeNotification.includes('MISSION ACCOMPLIE') ||
                failSafeNotification.includes('作业任务圆满完成') ||
                failSafeNotification.includes('MISSÃO CONCLUÍDA') ||
                failSafeNotification.includes('BREAKPOINT REACHED') ||
                failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
                failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
                failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
                failSafeNotification.includes('已抵达断点坐标') ||
                failSafeNotification.includes('RESTORED') ||
                failSafeNotification.includes('CLEARANCE')
                  ? 'text-emerald-400'
                  : failSafeNotification.includes('SIGNAL LOSS FAIL-SAFE') ||
                    failSafeNotification.includes('GROUNDED') ||
                    failSafeNotification.includes('Awaiting')
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            />
            <div className="text-xs leading-snug">
              <span
                className={`font-bold block uppercase tracking-wider text-[10px] ${
                  failSafeNotification.includes('MISSION ACCOMPLISHED') ||
                  failSafeNotification.includes('HOÀN THÀNH NHIỆM VỤ') ||
                  failSafeNotification.includes('MISIÓN CUMPLIDA') ||
                  failSafeNotification.includes('MISSION ACCOMPLIE') ||
                  failSafeNotification.includes('作业任务圆满完成') ||
                  failSafeNotification.includes('MISSÃO CONCLUÍDA') ||
                  failSafeNotification.includes('BREAKPOINT REACHED') ||
                  failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
                  failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
                  failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
                  failSafeNotification.includes('已抵达断点坐标') ||
                  failSafeNotification.includes('RESTORED') ||
                  failSafeNotification.includes('CLEARANCE')
                    ? 'text-emerald-300'
                    : failSafeNotification.includes('SIGNAL LOSS FAIL-SAFE') ||
                      failSafeNotification.includes('GROUNDED') ||
                      failSafeNotification.includes('Awaiting')
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
                  : failSafeNotification.includes('BREAKPOINT REACHED') ||
                  failSafeNotification.includes('ĐÃ ĐẾN ĐIỂM NGẮT') ||
                  failSafeNotification.includes('PUNTO DE INTERRUPCIÓN ALCANZADO') ||
                  failSafeNotification.includes('POINT D’ARRÊT ATTEINT') ||
                  failSafeNotification.includes('已抵达断点坐标')
                  ? 'Waypoint Reached • Mission Resumed'
                  : failSafeNotification.includes('CRITICAL WEATHER HAZARD') ||
                    failSafeNotification.includes('Takeoff blocked') ||
                    failSafeNotification.includes('CẢNH BÁO NGUY HIỂM THỜI TIẾT')
                  ? 'Critical Weather Hazard • Takeoff Interlock Blocked'
                  : failSafeNotification.includes('RESTORED')
                  ? 'Telemetry Link Restored'
                  : failSafeNotification.includes('CLEARANCE')
                  ? 'Weather Clearance Verified'
                  : simulation.isNetworkLossHold || failSafeNotification.includes('SIGNAL LOSS FAIL-SAFE')
                  ? 'Signal Loss Fail-Safe Hold'
                  : simulation.isGroundLocked
                  ? 'Post-Landing Ground Lock Active'
                  : failSafeNotification.includes('SIGNAL LOSS')
                  ? 'Signal Loss Emergency RTH'
                  : 'In-Flight Emergency Warning'}
              </span>
              <p className="mt-0.5 font-medium">{failSafeNotification}</p>
            </div>
          </div>
        )}

        {/* Dynamic Simulation Live Banner */}
        {simulation.isRunning && !failSafeNotification && (
          <div className="absolute top-16 left-3.5 z-[900] bg-emerald-950/95 border border-emerald-500/80 backdrop-blur-md rounded-xl px-3.5 py-2 shadow-2xl flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-xs">
              <span className="font-bold text-emerald-300">
                {simulation.isRTHActive
                  ? 'RTH Protocol Active'
                  : simulation.isRecharging
                  ? t.dockingAtCharger
                  : t.simulatingPath}
              </span>
              <span className="ml-2 font-mono text-emerald-400 font-bold">
                {simulation.progress.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Telemetry Sliders Bar (Bottom of Map Panel) */}
      <div
        id="agritwin_telemetry_bar"
        className="bg-slate-950 border-t border-slate-800 p-3 md:p-3.5 text-slate-200"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.telemetryTitle}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            GPS: {currentCoords.lat.toFixed(4)}° N, {currentCoords.lng.toFixed(4)}° E
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1. Wind Velocity Slider */}
          <div
            className={`rounded-xl p-2.5 flex flex-col justify-between transition-all ${
              telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH
                ? 'bg-red-950/90 border-2 border-red-500 shadow-lg shadow-red-950/50 ring-1 ring-red-400'
                : 'bg-slate-900/80 border border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <div className="flex items-center gap-1.5">
                <Wind
                  className={`w-3.5 h-3.5 ${
                    telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH
                      ? 'text-red-400 animate-pulse'
                      : 'text-cyan-400'
                  }`}
                />
                <span className="text-[11px] font-medium">{t.windSpeedLabel}</span>
              </div>
              <span
                className={`font-mono font-bold text-xs ${
                  telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH
                    ? 'text-red-300'
                    : 'text-cyan-300'
                }`}
              >
                {telemetry.windSpeed.toFixed(1)} km/h
              </span>
            </div>
            {telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH && (
              <div className="text-[9px] font-bold text-red-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                <span>UNSAFE (≥ 15 km/h)</span>
              </div>
            )}
            <input
              id="slider_wind_speed"
              type="range"
              min="0"
              max="45"
              step="0.5"
              value={telemetry.windSpeed}
              onChange={(e) =>
                onTelemetryChange({ ...telemetry, windSpeed: parseFloat(e.target.value) })
              }
              onInput={(e) =>
                onTelemetryChange({ ...telemetry, windSpeed: parseFloat((e.target as HTMLInputElement).value) })
              }
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH
                  ? 'accent-red-500 bg-red-950'
                  : 'accent-cyan-500 bg-slate-800'
              }`}
            />
          </div>

          {/* 2. Rainfall / Precipitation Slider */}
          <div
            className={`rounded-xl p-2.5 flex flex-col justify-between transition-all ${
              telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH
                ? 'bg-red-950/90 border-2 border-red-500 shadow-lg shadow-red-950/50 ring-1 ring-red-400'
                : 'bg-slate-900/80 border border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <div className="flex items-center gap-1.5">
                <CloudRain
                  className={`w-3.5 h-3.5 ${
                    telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH
                      ? 'text-red-400 animate-pulse'
                      : 'text-blue-400'
                  }`}
                />
                <span className="text-[11px] font-medium">{t.rainfallLabel}</span>
              </div>
              <span
                className={`font-mono font-bold text-xs ${
                  telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH
                    ? 'text-red-300'
                    : 'text-blue-300'
                }`}
              >
                {telemetry.precipitation.toFixed(1)} mm/h
              </span>
            </div>
            {telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH && (
              <div className="text-[9px] font-bold text-red-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                <span>UNSAFE (≥ 1.0 mm/h)</span>
              </div>
            )}
            <input
              id="slider_rainfall"
              type="range"
              min="0"
              max="25"
              step="0.1"
              value={telemetry.precipitation}
              onChange={(e) =>
                onTelemetryChange({ ...telemetry, precipitation: parseFloat(e.target.value) })
              }
              onInput={(e) =>
                onTelemetryChange({ ...telemetry, precipitation: parseFloat((e.target as HTMLInputElement).value) })
              }
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH
                  ? 'accent-red-500 bg-red-950'
                  : 'accent-blue-500 bg-slate-800'
              }`}
            />
          </div>

          {/* 3. Ambient Temperature Slider */}
          <div
            className={`rounded-xl p-2.5 flex flex-col justify-between transition-all ${
              telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS ||
              telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS
                ? 'bg-red-950/90 border-2 border-red-500 shadow-lg shadow-red-950/50 ring-1 ring-red-400'
                : 'bg-slate-900/80 border border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <div className="flex items-center gap-1.5">
                <Thermometer
                  className={`w-3.5 h-3.5 ${
                    telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS ||
                    telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS
                      ? 'text-red-400 animate-pulse'
                      : 'text-amber-400'
                  }`}
                />
                <span className="text-[11px] font-medium">{t.temperatureLabel}</span>
              </div>
              <span
                className={`font-mono font-bold text-xs ${
                  telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS ||
                  telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS
                    ? 'text-red-300'
                    : 'text-amber-300'
                }`}
              >
                {telemetry.temp.toFixed(1)}°C
              </span>
            </div>
            {(telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS ||
              telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS) && (
              <div className="text-[9px] font-bold text-red-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                <span>UNSAFE (&lt;5°C or &gt;40°C)</span>
              </div>
            )}
            <input
              id="slider_temperature"
              type="range"
              min="-10"
              max="55"
              step="0.5"
              value={telemetry.temp}
              onChange={(e) =>
                onTelemetryChange({ ...telemetry, temp: parseFloat(e.target.value) })
              }
              onInput={(e) =>
                onTelemetryChange({ ...telemetry, temp: parseFloat((e.target as HTMLInputElement).value) })
              }
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS ||
                telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS
                  ? 'accent-red-500 bg-red-950'
                  : 'accent-amber-500 bg-slate-800'
              }`}
            />
          </div>

          {/* 4. Relative Humidity Slider */}
          <div
            className={`rounded-xl p-2.5 flex flex-col justify-between transition-all ${
              telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT
                ? 'bg-red-950/90 border-2 border-red-500 shadow-lg shadow-red-950/50 ring-1 ring-red-400'
                : 'bg-slate-900/80 border border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <div className="flex items-center gap-1.5">
                <Droplet
                  className={`w-3.5 h-3.5 ${
                    telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT
                      ? 'text-red-400 animate-pulse'
                      : 'text-indigo-400'
                  }`}
                />
                <span className="text-[11px] font-medium">{t.humidityLabel}</span>
              </div>
              <span
                className={`font-mono font-bold text-xs ${
                  telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT
                    ? 'text-red-300'
                    : 'text-indigo-300'
                }`}
              >
                {telemetry.humidity.toFixed(0)}%
              </span>
            </div>
            {telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT && (
              <div className="text-[9px] font-bold text-red-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                <span>UNSAFE (&gt; 90%)</span>
              </div>
            )}
            <input
              id="slider_humidity"
              type="range"
              min="10"
              max="100"
              step="1"
              value={telemetry.humidity}
              onChange={(e) =>
                onTelemetryChange({ ...telemetry, humidity: parseInt(e.target.value, 10) })
              }
              onInput={(e) =>
                onTelemetryChange({ ...telemetry, humidity: parseInt((e.target as HTMLInputElement).value, 10) })
              }
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT
                  ? 'accent-red-500 bg-red-950'
                  : 'accent-indigo-500 bg-slate-800'
              }`}
            />
          </div>

          {/* 5. Battery / Fuel Level Slider */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <div className="flex items-center gap-1.5">
                <BatteryCharging
                  className={`w-3.5 h-3.5 ${
                    telemetry.battery <= 20
                      ? 'text-red-400 animate-pulse'
                      : telemetry.battery < 45
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                />
                <span className="text-[11px] font-medium">{t.batteryLabel}</span>
              </div>
              <span
                className={`font-mono font-bold text-xs ${
                  telemetry.battery <= 20
                    ? 'text-red-400'
                    : telemetry.battery < 45
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {telemetry.battery}%
              </span>
            </div>
            <input
              id="slider_battery_fuel"
              type="range"
              min="0"
              max="100"
              step="1"
              value={telemetry.battery}
              onChange={(e) =>
                onTelemetryChange({ ...telemetry, battery: parseInt(e.target.value, 10) })
              }
              onInput={(e) =>
                onTelemetryChange({ ...telemetry, battery: parseInt((e.target as HTMLInputElement).value, 10) })
              }
              className={`w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer ${
                telemetry.battery <= 20
                  ? 'accent-red-500'
                  : telemetry.battery < 45
                  ? 'accent-amber-500'
                  : 'accent-emerald-500'
              }`}
            />
          </div>

          {/* 6. Chemical Tank Volume Slider */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <div className="flex items-center gap-1.5">
                <Droplet
                  className={`w-3.5 h-3.5 ${
                    telemetry.tankLevel === 0
                      ? 'text-red-400 animate-pulse'
                      : telemetry.tankLevel < 10
                      ? 'text-amber-400'
                      : 'text-teal-400'
                  }`}
                />
                <span className="text-[11px] font-medium">{t.tankLevelLabel}</span>
              </div>
              <span
                className={`font-mono font-bold text-xs ${
                  telemetry.tankLevel === 0
                    ? 'text-red-400'
                    : telemetry.tankLevel < 10
                    ? 'text-amber-400'
                    : 'text-teal-300'
                }`}
              >
                {telemetry.tankLevel.toFixed(1)} L / {activeUnit.maxTankCapacity}L
              </span>
            </div>
            <input
              id="slider_tank_volume"
              type="range"
              min="0"
              max={activeUnit.maxTankCapacity}
              step="0.5"
              value={telemetry.tankLevel}
              onChange={(e) =>
                onTelemetryChange({ ...telemetry, tankLevel: parseFloat(e.target.value) })
              }
              onInput={(e) =>
                onTelemetryChange({ ...telemetry, tankLevel: parseFloat((e.target as HTMLInputElement).value) })
              }
              className={`w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer ${
                telemetry.tankLevel === 0
                  ? 'accent-red-500'
                  : telemetry.tankLevel < 10
                  ? 'accent-amber-500'
                  : 'accent-teal-500'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
