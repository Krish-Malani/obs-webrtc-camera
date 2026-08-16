'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera as CameraIcon, RefreshCcw, Wifi, WifiOff, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

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
        // Request the absolute highest resolution using 'ideal' constraints. 
        // The browser will gracefully step down to the max resolution supported by the hardware (e.g. 1080p or 720p) without throwing errors.
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 3840 },
            height: { ideal: 2160 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        setStream(mediaStream);
        localStreamRef.current = mediaStream;
        setStatus(callRef.current ? 'Streaming to receiver' : 'Camera active, waiting to connect...');
        setCameraPermission('granted');

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
        
        // Wait for metadata to load to get true video dimensions (fixes portrait/landscape aspect ratio layout explosions)
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            setResolution({ 
              width: videoRef.current.videoWidth, 
              height: videoRef.current.videoHeight 
            });
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
          setStatus('Error');
        }
      }
    }

    startCamera(facingMode);

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, retryCount]);

  // Connect to Receiver
  const connectToReceiver = async () => {
    if (!receiverPin || receiverPin.length !== 4) {
      alert('Please enter a valid 4-digit PIN');
      return;
    }
    if (!localStreamRef.current) {
      alert('Camera is not ready yet');
      return;
    }

    setStatus('Connecting to PeerJS server...');
    const { Peer } = await import('peerjs');
    
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setStatus(`Calling receiver (PIN: ${receiverPin})...`);
      const targetId = `obs-${receiverPin}`;
      
      const call = peer.call(targetId, localStreamRef.current);
      callRef.current = call;

      call.on('stream', () => {
        setStatus('Streaming to receiver');
        setIsConnected(true);
      });
      
      call.peerConnection.addEventListener('connectionstatechange', () => {
        const state = call.peerConnection.connectionState;
        if (state === 'connected') {
          setStatus('Streaming to receiver');
          setIsConnected(true);
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

      <div className="max-w-[1600px] mx-auto h-[auto] lg:h-[calc(100vh-2rem)] flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Camera Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col h-[60vh] lg:h-full w-full lg:w-fit max-w-full mx-auto lg:mx-0 shrink-0">
          <div className="flex items-center justify-between mb-4 relative shrink-0 gap-8">
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors z-10 shrink-0">
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back</span>
            </Link>
            
            <div className="flex items-center gap-2 justify-center flex-1 shrink-0">
              <CameraIcon className="text-purple-500 hidden sm:block" />
              <h2 className="text-lg sm:text-xl font-bold whitespace-nowrap">Camera Feed</h2>
              {isConnected && (
                <div className="flex items-center gap-1.5 text-green-500 text-xs font-medium bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20 ml-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  Live
                </div>
              )}
            </div>

            <button 
              onClick={toggleCamera}
              disabled={!hasMultipleCameras}
              className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors z-10 shrink-0 ${hasMultipleCameras ? 'bg-zinc-800 hover:bg-zinc-700' : 'opacity-0 pointer-events-none'}`}
            >
              <RefreshCcw size={16} />
              <span className="hidden sm:inline">Switch</span>
            </button>
          </div>
          
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div 
              className="bg-black rounded-xl overflow-hidden border border-zinc-800 h-full flex justify-center items-center relative"
              style={{ aspectRatio: resolution ? `${resolution.width}/${resolution.height}` : '16/9' }}
            >
              {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90 z-20">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <CameraIcon className="text-red-500" size={32} />
                  </div>
                  <p className="text-red-400 font-medium mb-6 max-w-sm">{error}</p>
                  <button 
                    onClick={() => { setError(null); setRetryCount(c => c + 1); }}
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
                    className="w-full h-full object-cover block"
                  />
                  {!stream && <p className="text-zinc-500 absolute py-12">Waiting for camera permission...</p>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Controls & Stats */}
        <div className="flex flex-col gap-6 w-full lg:flex-1 h-auto lg:h-full lg:overflow-y-auto shrink-0 pb-4 custom-scrollbar">
          
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
                disabled={isConnected}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors rounded-xl font-bold text-lg px-6"
              >
                {isConnected ? 'Connected' : 'Connect'}
              </button>
            </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 text-sm mb-1">Resolution</p>
                <p className="font-semibold text-lg">{resolution ? `${resolution.width} × ${resolution.height}` : '-'}</p>
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

