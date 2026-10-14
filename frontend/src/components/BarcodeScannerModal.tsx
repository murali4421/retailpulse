import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Barcode as BarcodeIcon, Keyboard, Zap, Volume2 } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Barcode & QR Scanner'
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Sample quick barcodes for 1-click simulation
  const sampleBarcodes = [
    { code: '890123456789', name: 'Artisan Dark Roast Beans', category: 'Beverages' },
    { code: '890123456790', name: 'Ceremonial Matcha Tin', category: 'Beverages' },
    { code: '890123456791', name: 'Insulated Tumbler 16oz', category: 'Merchandise' },
    { code: '890123456792', name: 'Rustic Sourdough Boule', category: 'Bakery' },
    { code: '890123456793', name: 'Organic Oat Milk 1L', category: 'Grocery' },
    { code: '890123456795', name: 'Wildflower Honeycomb Jar', category: 'Grocery' }
  ];

  // Play audio beep when barcode is scanned
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High pitch POS beep
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // AudioContext not allowed or not supported
    }
  };

  const handleSuccessfulScan = (code: string) => {
    playBeep();
    onScan(code.trim());
    stopCamera();
    onClose();
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader-container');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // ignore frame errors
        }
      );
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera scanner initialization failed:', err);
      setCameraError('Camera access unavailable or permission denied. You can use manual entry or simulated barcodes below.');
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.error('Stop camera error:', e);
      }
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 p-2 text-indigo-600 dark:text-indigo-400">
              <BarcodeIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live optical scan, laser scanner, or quick simulation</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Camera Viewport */}
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-center relative min-h-[180px] flex flex-col items-center justify-center">
            <div id="qr-reader-container" className="w-full"></div>

            {!cameraActive && (
              <div className="p-6 text-center space-y-3">
                <Camera className="h-10 w-10 text-slate-500 mx-auto" />
                <div className="text-xs text-slate-400 max-w-xs mx-auto">
                  {cameraError || 'Activate your webcam or mobile camera to scan physical barcodes & QR labels directly.'}
                </div>
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 transition-colors shadow"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Camera Scanner</span>
                </button>
              </div>
            )}
          </div>

          {/* Manual Input Field */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5 text-slate-400" />
              <span>Barcode / SKU Manual Entry (or Laser Scanner Wedge)</span>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  handleSuccessfulScan(manualCode);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                autoFocus
                placeholder="e.g. 890123456789 or SKU-COF-01"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 transition-colors"
              >
                Lookup
              </button>
            </form>
          </div>

          {/* 1-Click Barcode Test Simulation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Quick Test Barcodes (Instant Scan)</span>
              </span>
              <span className="text-[11px] text-slate-400">Click to simulate scan</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {sampleBarcodes.map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleSuccessfulScan(item.code)}
                  className="flex flex-col text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-xs"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                    <span className="font-mono">{item.code}</span>
                    <span className="text-indigo-500 font-semibold">Scan ↵</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-5 py-3">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Volume2 className="h-3.5 w-3.5 text-emerald-500" /> Audio confirmation feedback enabled
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
