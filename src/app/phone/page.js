'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera as CameraIcon, RefreshCcw, Wifi, WifiOff, CheckCircle, XCircle, HelpCircle, Maximize, Minimize, QrCode } from 'lucide-react';
import jsQR from "jsqr";

export default function PhonePage() {
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  
  const [resolution, setResolution] = useState(null);
  const [fps, setFps] = useState(null);
  const [status, setStatus] = useState('Camera off');
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // Default to back camera
  
  const [receiverPin, setReceiverPin] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [wifiWarning, setWifiWarning] = useState(null);

  const [isMirrored, setIsMirrored] = useState(false);
  const [actualCameraName, setActualCameraName] = useState('-');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(true);
  const [wifiPermission, setWifiPermission] = useState('unknown');
  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [retryCount, setRetryCount] = useState(0);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const [targetQuality, setTargetQuality] = useState('1080p');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef(null);

  const [isScanningQR, setIsScanningQR] = useState(false);
  const scanAnimationFrame = useRef(null);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (videoContainerRef.current?.requestFullscreen) {
        videoContainerRef.current.requestFullscreen().catch(e => console.error("Fullscreen error:", e));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Check network type and device on mount
  useEffect(() => {
    const updateNetworkStatus = () => {
      // 1. Check if entirely offline
      if (!navigator.onLine) {
        setWifiPermission('denied');
        setWifiWarning('Warning: You are offline! Please connect to Wi-Fi.');
        return;
      }
      
      // 2. If online, check connection API if available
      if (navigator.connection) {
        const type = navigator.connection.type;
        if (type === 'cellular' || type === 'none') {
          setWifiPermission('denied');
          setWifiWarning('Warning: You are on Mobile Data! Please connect to the PC Hotspot for local WebRTC to work.');
          return;
        }
      }
      
      // 3. Otherwise assume granted
      setWifiPermission('granted');
      setWifiWarning(null);
    };

    // Run initial check
    updateNetworkStatus();

    // Add event listeners for network changes
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    if (navigator.connection) {
      navigator.connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  // Start or switch camera
  useEffect(() => {
    async function startCamera(mode) {
      setError(null);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        await new Promise(resolve => setTimeout(resolve, 300)); // Give mobile hardware time to fully release the lens
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser blocked camera access because this network connection is not secure (HTTP). You must use HTTPS or localhost to access the camera, or enable insecure origins in chrome://flags.");
        }

        const RESOLUTIONS = {
          '4K': { width: { ideal: 3840 }, height: { ideal: 2160 } },
          '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
          '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
          '480p': { width: { ideal: 854 }, height: { ideal: 480 } }
        };
        const targetRes = RESOLUTIONS[targetQuality] || RESOLUTIONS['1080p'];

        // Request chosen resolution
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: targetRes.width,
            height: targetRes.height
          },
          audio: false
        });

        // Force WebRTC to prioritize resolution over framerate during network drops
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack && 'contentHint' in videoTrack) {
          videoTrack.contentHint = 'detail';
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        setStream(mediaStream);
        localStreamRef.current = mediaStream;
        setStatus(callRef.current ? 'Streaming to receiver' : 'Camera active, waiting to connect...');
        setCameraPermission('granted');

        // Seamless hot-swap: if actively streaming, replace the video track
        if (callRef.current) {
          const senders = callRef.current.peerConnection.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(mediaStream.getVideoTracks()[0]).catch(e => console.error('Error replacing track:', e));
          }
        }

        const track = mediaStream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        // Dynamically determine mirroring based on hardware reporting
        if (settings.facingMode === 'user') {
          setIsMirrored(true);
          setActualCameraName('Front');
        } else if (settings.facingMode === 'environment') {
          setIsMirrored(false);
          setActualCameraName('Back');
        } else {
          // Desktops usually omit facingMode. Desktop webcams are front-facing, so mirror them.
          setIsMirrored(true);
          setActualCameraName('Front');
        }

        // Check hardware for multiple cameras
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          
          // Deduplicate by label to avoid browser bugs where the same camera is listed multiple times
          const uniqueLabels = new Set();
          const realCameras = videoInputs.filter(d => {
            const label = d.label.toLowerCase();
            // Filter out virtual software cameras
            if (label.includes('obs') || label.includes('virtual') || label.includes('snap')) return false;
            
            // Filter out exact duplicates
            if (uniqueLabels.has(label)) return false;
            uniqueLabels.add(label);
            
            return true;
          });
          
          setHasMultipleCameras(realCameras.length > 1);
        });

        if (settings.width && settings.height) {
          setResolution({ width: settings.width, height: settings.height });
        }
        
        // Wait for metadata to load to get true video dimensions (fixes portrait/landscape aspect ratio calculations)
        if (videoRef.current) {
          const videoEl = videoRef.current;
          videoEl.onloadedmetadata = () => {
            setResolution({ width: videoEl.videoWidth, height: videoEl.videoHeight });
          };
          // Also listen for resize events (fired when a mobile device is physically rotated)
          videoEl.onresize = () => {
            setResolution({ width: videoEl.videoWidth, height: videoEl.videoHeight });
          };
        }
        if (settings.frameRate) {
          setFps(settings.frameRate);
        }

        // If a call is active, seamlessly replace the video track
        if (callRef.current) {
          const sender = callRef.current.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(track);
          }
        }

      } catch (err) {
        console.warn(`Failed to access ${mode} camera, falling back...`, err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraPermission('denied');
        }
        if (mode === 'environment') {
          startCamera('user');
        } else {
          let msg = "Could not access the camera. It might be in use by another app.";
          if (err.name === 'NotReadableError') msg = "Camera is currently in use by another application.";
          else if (err.name === 'NotAllowedError') msg = "Camera permission was denied.";
          else if (err.name === 'OverconstrainedError') msg = "Camera constraints not supported.";
          else if (err.message && err.message !== 'null') msg = err.message;
          
          setError(msg);
          console.error("Camera access error:", err);
        }
      }
    }

    if (wifiPermission !== 'unknown' && cameraPermission !== 'denied') {
      startCamera(facingMode);
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      stopQRScanner();
    };
  }, [facingMode, cameraPermission, wifiPermission, retryCount, targetQuality]);

  const isScanningRef = useRef(false);

  // QR Scanning Logic
  const startQRScanner = () => {
    if (!localStreamRef.current || !videoRef.current) return;
    setIsScanningQR(true);
    isScanningRef.current = true;
    scanQRCode();
  };

  const stopQRScanner = () => {
    setIsScanningQR(false);
    isScanningRef.current = false;
    if (scanAnimationFrame.current) {
      cancelAnimationFrame(scanAnimationFrame.current);
      scanAnimationFrame.current = null;
    }
  };

  const scanQRCode = () => {
    if (!isScanningRef.current) return; // Prevent race conditions synchronously
    
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      scanAnimationFrame.current = requestAnimationFrame(scanQRCode);
      return;
    }
    
    // Create hidden canvas for jsQR analysis
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    
    if (context) {
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code && code.data && code.data.startsWith("obs-")) {
        // Success! Found the peer ID
        stopQRScanner();
        
        const scannedId = code.data;
        const pinPart = scannedId.replace('obs-', '');
        setReceiverPin(pinPart);
        
        // Connect directly
        connectToPeerJS(scannedId, pinPart);
        return;
      }
    }
    
    // Keep scanning
    scanAnimationFrame.current = requestAnimationFrame(scanQRCode);
  };

  // Shared Connection Logic
  const connectToPeerJS = async (targetId, pinToDisplay) => {
    if (!localStreamRef.current) return;

    setStatus('Connecting to PeerJS server...');
    const { Peer } = await import('peerjs');
    
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setStatus(`Calling receiver (PIN: ${pinToDisplay})...`);
      
      const call = peer.call(targetId, localStreamRef.current, {
        sdpTransform: (sdp) => {
          return sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:8000\r\n');
        }
      });
      callRef.current = call;

      call.on('stream', () => {
        setStatus('Streaming to receiver');
        setIsConnected(true);
        setReceiverPin('');
      });
      
      call.peerConnection.addEventListener('connectionstatechange', () => {
        const state = call.peerConnection.connectionState;
        if (state === 'connected') {
          setStatus('Streaming to receiver');
          setIsConnected(true);
          setReceiverPin('');

          // Force WebRTC connection to NEVER downscale resolution dynamically
          try {
            const senders = call.peerConnection.getSenders();
            senders.forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                const params = sender.getParameters();
                params.degradationPreference = 'maintain-resolution';
                
                if (params.encodings && params.encodings.length > 0) {
                  params.encodings[0].maxBitrate = 8000000;
                }
                
                sender.setParameters(params).catch(e => console.log('Notice: Could not set RTCPeerConnection parameters:', e));
              }
            });
          } catch (e) {
            console.log('Notice: RTCRtpSender degradationPreference not supported on this browser.');
          }

        } else if (state === 'disconnected' || state === 'failed') {
          setStatus('Disconnected from receiver. Check Hotspot connection.');
          setIsConnected(false);
        }
      });

      call.on('close', () => {
        setStatus('Call closed by receiver.');
        setIsConnected(false);
      });
      
      call.on('error', (err) => {
        console.error('Call error:', err);
        setStatus('Call failed: ' + err.message);
        setIsConnected(false);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'peer-unavailable') {
        setStatus('Receiver not found. Is the PC page open?');
      } else {
        setStatus('Connection error: ' + err.message);
      }
      setIsConnected(false);
    });
  };

  const connectToReceiver = () => {
    if (!receiverPin || receiverPin.length !== 4) {
      alert('Please enter a valid 4-digit PIN');
      return;
    }
    connectToPeerJS(`obs-${receiverPin}`, receiverPin);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      {wifiWarning && (
        <div className="bg-orange-500/20 border border-orange-500 text-orange-400 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 max-w-2xl mx-auto">
          <WifiOff className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm leading-tight">{wifiWarning}</p>
        </div>
      )}

      {/* Permission Instructions Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowPermissionModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-2 rounded-full transition-colors"
            >
              <XCircle size={20} />
            </button>
            
            <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mb-6">
              <CameraIcon size={32} />
            </div>
            
            <h2 className="text-2xl font-bold mb-3 text-white">Camera Access Blocked</h2>
            
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Your browser has blocked camera access for this site. To use this app, you need to manually allow camera access in your browser settings.
            </p>
            
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 mb-8">
              <ol className="text-sm text-zinc-300 space-y-4 font-medium">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs">1</span>
                  <span>Tap the <strong>settings icon</strong> (aA, padlock, or tune) in your browser's address bar.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs">2</span>
                  <span>Find <strong>Camera</strong> in the site settings.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs">3</span>
                  <span>Change the permission to <strong>Allow</strong>.</span>
                </li>
              </ol>
            </div>
            
            <button 
              onClick={() => {
                setShowPermissionModal(false);
                setError(null);
                setRetryCount(c => c + 1);
              }}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg shadow-purple-900/20"
            >
              I've Allowed It, Try Again
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto h-auto lg:h-[calc(100vh-2rem)] flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Camera Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col w-full lg:flex-1 h-auto lg:h-full min-w-0">
          <div className="flex items-center justify-between mb-4 relative shrink-0">
            {/* Left: Back Button */}
            <div className="flex-1 flex justify-start">
              <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors z-10 shrink-0">
                <ArrowLeft size={20} />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </div>
            
            {/* Center: Title */}
            <div className="flex-1 flex items-center justify-center gap-2 shrink-0">
              <CameraIcon className="text-purple-500 hidden sm:block" />
              <h2 className="text-lg sm:text-xl font-bold whitespace-nowrap">Camera Feed</h2>
              {isConnected && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-wide uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </div>
              )}
            </div>
            
            {/* Right: Buttons */}
            <div className="flex-1 flex justify-end items-center gap-2 shrink-0">
              <button 
                onClick={toggleFullscreen}
                className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors z-10 shrink-0 bg-zinc-800 hover:bg-zinc-700"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
              </button>
              
              <button 
                onClick={toggleCamera}
                disabled={!hasMultipleCameras}
                className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors z-10 shrink-0 ${hasMultipleCameras ? 'bg-zinc-800 hover:bg-zinc-700' : 'opacity-0 pointer-events-none'}`}
              >
                <RefreshCcw size={16} />
                <span className="hidden sm:inline">Switch</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 w-full relative">
            <div 
              ref={videoContainerRef}
              className="bg-black rounded-xl overflow-hidden border border-zinc-800 w-full h-full relative flex items-center justify-center lg:!aspect-auto"
              style={{ aspectRatio: resolution ? `${resolution.width}/${resolution.height}` : '16/9' }}
            >
              {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90 z-20">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <CameraIcon className="text-red-500" size={32} />
                  </div>
                  <p className="text-red-400 font-medium mb-6 max-w-sm">{error}</p>
                  <button 
                    onClick={() => { 
                      if (cameraPermission === 'denied' || (typeof error === 'string' && error.toLowerCase().includes("denied"))) {
                        setShowPermissionModal(true);
                      } else {
                        setError(null); 
                        setRetryCount(c => c + 1); 
                      }
                    }}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted
                    style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
                    className="w-full h-full object-contain block absolute inset-0"
                  />
                  {!stream && <p className="text-zinc-500 absolute py-12">Waiting for camera permission...</p>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Controls & Stats */}
        <div className="flex flex-col gap-6 w-full lg:w-[400px] shrink-0 h-auto lg:h-full lg:overflow-y-auto pb-4 custom-scrollbar">
          
          {/* Connection Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shrink-0">
            <label className="block text-zinc-400 text-sm font-medium mb-3">Receiver PIN</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={receiverPin}
                onChange={(e) => setReceiverPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="1234"
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-2xl font-mono text-center w-full focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button 
                onClick={connectToReceiver}
                disabled={!receiverPin || receiverPin.length !== 4 || isConnected || !localStreamRef.current || isScanningQR}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shrink-0"
              >
                {isConnected ? 'Connected' : 'Connect'}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="h-px bg-zinc-800 flex-1"></div>
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">or</span>
              <div className="h-px bg-zinc-800 flex-1"></div>
            </div>
            
            <button 
              onClick={isScanningQR ? stopQRScanner : startQRScanner}
              disabled={isConnected || !localStreamRef.current}
              className={`mt-4 w-full font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 border disabled:opacity-50 ${isScanningQR ? 'bg-purple-600/20 text-purple-400 border-purple-500/30 hover:bg-purple-600/30 animate-pulse' : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'}`}
            >
              {isScanningQR ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                  Scanning... Point camera at PC
                </>
              ) : (
                <>
                  <QrCode size={18} />
                  Scan QR Code to Connect
                </>
              )}
            </button>
          </div>

          {/* Permissions Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shrink-0">
            <h3 className="text-xl font-bold mb-4 text-zinc-100">Permissions</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg"><Wifi className="text-zinc-400" size={20} /></div>
                  <div>
                    <p className="font-medium text-sm">Wi-Fi Connection</p>
                    <p className="text-xs text-zinc-500">Required for local WebRTC</p>
                  </div>
                </div>
                <div>
                  {wifiPermission === 'granted' ? <CheckCircle className="text-green-500" size={20} /> : 
                   wifiPermission === 'denied' ? <XCircle className="text-red-500" size={20} /> : 
                   <HelpCircle className="text-yellow-500" size={20} title="Cannot detect network type" />}
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg"><CameraIcon className="text-zinc-400" size={20} /></div>
                  <div>
                    <p className="font-medium text-sm">Camera Access</p>
                    <p className="text-xs text-zinc-500">Required to broadcast</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {cameraPermission === 'granted' ? <CheckCircle className="text-green-500" size={20} /> : 
                   cameraPermission === 'denied' ? <XCircle className="text-red-500" size={20} /> : null}
                   
                  {(cameraPermission === 'prompt' || cameraPermission === 'denied' || error) && (
                    <button 
                      onClick={() => {
                        setCameraPermission('prompt');
                        setError(null);
                        setRetryCount(prev => prev + 1);
                      }} 
                      className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-zinc-700"
                    >
                      Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shrink-0">
            <h3 className="text-xl font-bold mb-4 text-zinc-100">Stream Details</h3>
            
            <div className="mb-4">
              <label className="block text-zinc-400 text-xs font-medium mb-2">Target Quality</label>
              <select 
                value={targetQuality}
                onChange={(e) => setTargetQuality(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-medium text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                <option value="4K">4K Ultra HD (3840×2160)</option>
                <option value="1080p">1080p Full HD (1920×1080)</option>
                <option value="720p">720p HD (1280×720)</option>
                <option value="480p">480p SD (854×480)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 text-xs font-medium mb-1">Actual Resolution</p>
                <p className="font-mono font-bold">{resolution ? `${resolution.width} × ${resolution.height}` : 'Calculating...'}</p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 text-sm mb-1">Camera</p>
                <p className="font-semibold text-lg">{actualCameraName}</p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 col-span-2">
                <p className="text-zinc-400 text-sm mb-1">Status</p>
                <p className={`font-semibold text-lg ${status.includes('Error') || status.includes('failed') ? 'text-red-500' : isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
                  {status}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

