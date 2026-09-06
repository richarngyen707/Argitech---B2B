import React, { useState } from 'react';
import { Radio, X, Cpu, Wifi, Bluetooth, Cable, CheckCircle2, ShieldAlert } from 'lucide-react';
import { HardwareConnectionProtocol, SupportedLanguage } from '../types';
import { translations } from '../i18n/translations';

interface HardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
  onConnect: (protocol: HardwareConnectionProtocol, deviceName: string) => void;
}

export const HardwareModal: React.FC<HardwareModalProps> = ({
  isOpen,
  onClose,
  language,
  onConnect,
}) => {
  const t = translations[language];
  const [selectedProtocol, setSelectedProtocol] = useState<HardwareConnectionProtocol>('DJI_CLOUD');
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceKey, setDeviceKey] = useState('DJI-AGRAS-T40-AGRITWIN-GW');

  if (!isOpen) return null;

  const handleEstablishConnection = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      onConnect(selectedProtocol, deviceKey);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-2xl p-6 shadow-2xl text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{t.modalConnectTitle}</h3>
            <p className="text-xs text-slate-400">{t.modalSelectProtocol}</p>
          </div>
        </div>

        {/* Protocol Selection Radio Cards */}
        <div className="space-y-3 mb-6">
          {/* 1. DJI Cloud API */}
          <div
            onClick={() => setSelectedProtocol('DJI_CLOUD')}
            className={`cursor-pointer flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
              selectedProtocol === 'DJI_CLOUD'
                ? 'bg-emerald-950/60 border-emerald-500/80 ring-1 ring-emerald-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Wifi
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                selectedProtocol === 'DJI_CLOUD' ? 'text-emerald-400' : 'text-slate-400'
              }`}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-100">{t.djiCloudOption}</span>
                {selectedProtocol === 'DJI_CLOUD' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                MQTT v5 Cloud Telemetry Gateway with DJI Agras T40 / T20P live flight state.
              </p>
            </div>
          </div>

          {/* 2. Web Bluetooth */}
          <div
            onClick={() => setSelectedProtocol('WEB_BLUETOOTH')}
            className={`cursor-pointer flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
              selectedProtocol === 'WEB_BLUETOOTH'
                ? 'bg-cyan-950/60 border-cyan-500/80 ring-1 ring-cyan-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Bluetooth
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                selectedProtocol === 'WEB_BLUETOOTH' ? 'text-cyan-400' : 'text-slate-400'
              }`}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-100">{t.webBluetoothOption}</span>
                {selectedProtocol === 'WEB_BLUETOOTH' && (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Low-latency direct Bluetooth Low Energy (BLE 5.2) to Handheld Ground Controller.
              </p>
            </div>
          </div>

          {/* 3. MAVLink Serial / USB */}
          <div
            onClick={() => setSelectedProtocol('MAVLINK_SERIAL')}
            className={`cursor-pointer flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
              selectedProtocol === 'MAVLINK_SERIAL'
                ? 'bg-amber-950/60 border-amber-500/80 ring-1 ring-amber-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Cable
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                selectedProtocol === 'MAVLINK_SERIAL' ? 'text-amber-400' : 'text-slate-400'
              }`}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-100">{t.mavlinkOption}</span>
                {selectedProtocol === 'MAVLINK_SERIAL' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Web Serial API 115200 baud for Pixhawk / ArduPilot / PX4 tractor autosteer.
              </p>
            </div>
          </div>
        </div>

        {/* Device Identifier / Key Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Gateway Endpoint / Device UID
          </label>
          <input
            type="text"
            value={deviceKey}
            onChange={(e) => setDeviceKey(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
          >
            {t.modalCancel}
          </button>
          <button
            onClick={handleEstablishConnection}
            disabled={isConnecting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isConnecting ? (
              <span className="animate-pulse">Connecting...</span>
            ) : (
              <span>{t.modalConnectAction}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
