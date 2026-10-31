import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Flashlight, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isScanning: boolean;
  onToggleScanning: () => void;
}

export function BarcodeScanner({ onScan, isScanning, onToggleScanning }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [lastDetected, setLastDetected] = useState<string | null>(null);

  const lastScannedRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  // Crisp audio beep using Web Audio API oscillator
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio playback may be restricted by browser until first user interaction
    }
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {
      // Haptics not available
    }
  }, []);

  // Process decoded barcode with frame debouncing and leading-zero preservation
  const handleDecodedBarcode = useCallback(
    (barcodeRaw: string) => {
      // Ensure barcode is kept as exact string preserving leading zeros
      const barcode = String(barcodeRaw).trim();
      if (!barcode) return;

      const now = Date.now();
      const last = lastScannedRef.current;

      // Duplicate frame suppression: require at least 1800ms before re-triggering the same barcode
      if (last.barcode === barcode && now - last.time < 1800) {
        return;
      }

      lastScannedRef.current = { barcode, time: now };
      setLastDetected(barcode);
      playBeep();
      triggerHaptic();
      onScan(barcode);

      // Reset flash feedback after 1.2s
      setTimeout(() => {
        setLastDetected(null);
      }, 1200);
    },
    [onScan, playBeep, triggerHaptic]
  );

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Ignore
      }
      controlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  // Start camera stream preferring rear camera (environment)
  const startCamera = useCallback(async () => {
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unsupported');
      setErrorMessage('Camera access is not supported by this browser. Please use manual product search.');
      return;
    }

    setPermissionState('requesting');
    setErrorMessage('');

    try {
      // Prefer rear environment camera
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = typeof videoTrack.getCapabilities === 'function' ? videoTrack.getCapabilities() : {};
        setTorchAvailable(Boolean(capabilities?.torch));
      }

      setPermissionState('active');

      // Check if native BarcodeDetector is available
      if (typeof (window as any).BarcodeDetector === 'function') {
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];
        const detector = new (window as any).BarcodeDetector({ formats });

        let isScanningFrames = true;
        const scanFrame = async () => {
          if (!isScanningFrames || !videoRef.current || videoRef.current.readyState < 2) {
            if (isScanningFrames) requestAnimationFrame(scanFrame);
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                handleDecodedBarcode(code);
              }
            }
          } catch {
            // Frame error; continue scanning next frame
          }
          if (isScanningFrames) {
            requestAnimationFrame(scanFrame);
          }
        };

        requestAnimationFrame(scanFrame);
        controlsRef.current = {
          stop: () => {
            isScanningFrames = false;
          },
        };
      } else {
        // Fallback to ZXing BrowserMultiFormatReader
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }

        const reader = readerRef.current;
        const controls = await reader.decodeFromVideoElement(videoRef.current!, (result: any, _err: any) => {
          if (result) {
            handleDecodedBarcode(result.getText());
          }
        });
        controlsRef.current = controls;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage('Camera permission was denied. Allow camera access in your browser settings or use manual search.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionState('unsupported');
        setErrorMessage('No camera found on this device. Please use manual product search.');
      } else {
        setPermissionState('error');
        setErrorMessage(err.message || 'Unable to access camera.');
      }
    }
  }, [stopCamera, handleDecodedBarcode]);

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // Torch toggle failed
    }
  };

  // Start or stop on isScanning prop change
  useEffect(() => {
    if (isScanning) {
      startCamera();
    } else {
      stopCamera();
      setPermissionState('idle');
    }

    return () => {
      stopCamera();
    };
  }, [isScanning, startCamera, stopCamera]);

  // Handle visibility change (pause camera if page is hidden to preserve battery)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isScanning) {
        stopCamera();
      } else if (!document.hidden && isScanning) {
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isScanning, startCamera, stopCamera]);

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <div className="scanner-title">
          <Camera size={18} className="scanner-icon" />
          <span>Barcode Scanner</span>
          {permissionState === 'active' && <span className="scanner-live-pill">LIVE</span>}
        </div>
        <div className="scanner-controls">
          {torchAvailable && permissionState === 'active' && (
            <button
              type="button"
              className={`scanner-torch-btn ${torchOn ? 'active' : ''}`}
              onClick={toggleTorch}
              title={torchOn ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
            >
              <Flashlight size={16} />
            </button>
          )}
          <button
            type="button"
            className={`scanner-toggle-btn ${isScanning ? 'active' : ''}`}
            onClick={onToggleScanning}
          >
            {isScanning ? (
              <>
                <CameraOff size={16} />
                <span>Stop Scanner</span>
              </>
            ) : (
              <>
                <Camera size={16} />
                <span>Start Scanner</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isScanning && (
        <div className="scanner-viewport">
          <video ref={videoRef} playsInline muted className="scanner-video" />

          {/* Viewfinder Reticle & Target Box */}
          <div className="scanner-overlay">
            <div className={`scanner-reticle ${lastDetected ? 'detected' : ''}`}>
              <div className="scanner-laser" />
              <div className="reticle-corner top-left" />
              <div className="reticle-corner top-right" />
              <div className="reticle-corner bottom-left" />
              <div className="reticle-corner bottom-right" />
              {lastDetected && (
                <div className="detected-badge">
                  <Check size={14} />
                  <span>{lastDetected}</span>
                </div>
              )}
            </div>
            <p className="scanner-hint">Align barcode inside the green frame</p>
          </div>

          {/* Permission / Error States */}
          {permissionState === 'requesting' && (
            <div className="scanner-overlay-message">
              <RefreshCw size={24} className="spin-animation" />
              <p>Requesting camera access…</p>
            </div>
          )}

          {permissionState === 'denied' && (
            <div className="scanner-overlay-message error">
              <AlertCircle size={24} />
              <h4>Camera Permission Denied</h4>
              <p>{errorMessage}</p>
              <button className="btn-secondary" onClick={startCamera}>
                Try Again
              </button>
            </div>
          )}

          {permissionState === 'unsupported' && (
            <div className="scanner-overlay-message error">
              <AlertCircle size={24} />
              <h4>Camera Unavailable</h4>
              <p>{errorMessage}</p>
            </div>
          )}

          {permissionState === 'error' && (
            <div className="scanner-overlay-message error">
              <AlertCircle size={24} />
              <h4>Scanner Error</h4>
              <p>{errorMessage}</p>
              <button className="btn-secondary" onClick={startCamera}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
