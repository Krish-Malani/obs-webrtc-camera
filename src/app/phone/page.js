'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera as CameraIcon, RefreshCcw, Wifi, WifiOff } from 'lucide-react';

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

  // Check network type on mount
  useEffect(() => {
    if (navigator.connection) {
      const type = navigator.connection.type;
      if (type !== 'wifi' && type !== 'unknown') {
        setWifiWarning('Warning: You are not on Wi-Fi! Please connect to the PC Hotspot for local WebRTC to work.');
      }
      
      const updateConnection = () => {
        if (navigator.connection.type === 'wifi') {
          setWifiWarning(null);
        } else {
          setWifiWarning('Warning: You are not on Wi-Fi! Please connect to the PC Hotspot for local WebRTC to work.');
        }
      };
      
      navigator.connection.addEventListener('change', updateConnection);
      return () => navigator.connection.removeEventListener('change', updateConnection);
    }
  }, []);

  // Start or switch camera
  useEffect(() => {
    async function startCamera(mode) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 },
            facingMode: mode === 'environment' ? { exact: 'environment' } : 'user'
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        setStream(mediaStream);
        localStreamRef.current = mediaStream;
        setStatus(isConnected ? 'Streaming to receiver' : 'Camera active, waiting to connect...');

        const track = mediaStream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        if (settings.width && settings.height) {
          setResolution({ width: settings.width, height: settings.height });
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
        if (mode === 'environment') {
          startCamera('user');
        } else {
          setError(err.message || 'Failed to access camera.');
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
  }, [facingMode]);

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
    
    // Create an ephemeral peer for the phone
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setStatus(`Calling receiver (PIN: ${receiverPin})...`);
      const targetId = `obs-${receiverPin}`;
      
      const call = peer.call(targetId, localStreamRef.current);
      callRef.current = call;

      call.on('stream', () => {
        // We don't expect a stream back, but it means connection is successful
        setStatus('Streaming to receiver');
        setIsConnected(true);
      });
      
      // If the peer connection state changes, update UI
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

      <div className="flex items-center justify-between mb-6 max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          Back
        </Link>
        <button 
          onClick={toggleCamera}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCcw size={16} />
          Switch Camera
        </button>
      </div>
      
      <div className="max-w-2xl mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
            <div className="w-full">
              <label className="block text-zinc-400 text-sm font-medium mb-2">Receiver PIN</label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={receiverPin}
                  onChange={(e) => setReceiverPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="1234"
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-2xl font-mono text-center w-32 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button 
                  onClick={connectToReceiver}
                  disabled={isConnected}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors rounded-xl font-bold text-lg"
                >
                  {isConnected ? 'Connected' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CameraIcon className="text-purple-500" />
              <h2 className="text-2xl font-bold">Camera Feed</h2>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2 text-green-500 text-sm font-medium bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Live
              </div>
            )}
          </div>
          
          <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 flex items-center justify-center border border-zinc-800 relative">
            {error ? (
              <p className="text-red-500 px-4 text-center">{error}</p>
            ) : (
              <>
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
                  className="w-full h-full object-cover"
                />
                {!stream && <p className="text-zinc-500 absolute z-10">Waiting for camera permission...</p>}
              </>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p className="text-zinc-400 text-sm mb-1">Resolution</p>
              <p className="font-semibold text-lg">{resolution ? `${resolution.width} × ${resolution.height}` : '-'}</p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p className="text-zinc-400 text-sm mb-1">FPS</p>
              <p className="font-semibold text-lg">{fps ? Math.round(fps) : '-'}</p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 md:col-span-1 col-span-2">
              <p className="text-zinc-400 text-sm mb-1">Status</p>
              <p className={`font-semibold text-lg ${status.includes('Error') || status.includes('failed') ? 'text-red-500' : isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
                {status}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
