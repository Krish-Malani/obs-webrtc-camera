'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, MonitorPlay, FlipHorizontal, Maximize, ExternalLink } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

const ROOM_ID = 'default-room';

// Using Suspense boundary is recommended in Next.js when using useSearchParams
export default function ReceiverPageContainer() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white p-4">Loading...</div>}>
      <ReceiverPage />
    </React.Suspense>
  )
}

function ReceiverPage() {
  const searchParams = useSearchParams();
  const isObsMode = searchParams.get('mode') === 'obs';
  const initialMirror = searchParams.get('mirror') === 'true';
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [status, setStatus] = useState('Connecting to server...');

  const [isMirrored, setIsMirrored] = useState(initialMirror);
  const [receiverId, setReceiverId] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [stream, setStream] = useState(null);
  const peerRef = useRef(null);

  useEffect(() => {
    let peer;
    
    async function initPeer() {
      // Dynamically import PeerJS to avoid SSR window issues
      const { Peer } = await import('peerjs');
      
      const randomId = Math.floor(1000 + Math.random() * 9000).toString();
      const fullId = `obs-${randomId}`;
      
      peer = new Peer(fullId);
      peerRef.current = peer;

      peer.on('open', (id) => {
        setReceiverId(randomId);
        setStatus('Waiting for phone to connect...');
      });

      peer.on('call', (call) => {
        setStatus('Incoming video stream...');
        
        // Answer the call without sending a local stream
        call.answer(null);

        call.on('stream', (remoteStream) => {
          setStream(remoteStream);
          setStatus('Connected and receiving video');
          
          const track = remoteStream.getVideoTracks()[0];
          if (track) {
            const settings = track.getSettings();
            if (settings.width && settings.height) {
              setResolution({ width: settings.width, height: settings.height });
            }
          }
        });

        call.on('close', () => {
          setStatus('Disconnected. Waiting for phone...');
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        });
      });

      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        setStatus('Error: ' + err.message);
      });
    }

    initPeer();

    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, []);

  // Re-attach stream when switching between normal and OBS mode DOMs
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        setResolution({ 
          width: videoRef.current.videoWidth, 
          height: videoRef.current.videoHeight 
        });
      };
    }
  }, [stream, isObsMode]);

  if (isObsMode) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center m-0 p-0">
        <video 
          ref={videoRef}
          className="w-full h-full object-contain"
          style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
          autoPlay 
          playsInline
        />
        {status !== 'Connected and receiving video' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 p-8 text-center">
            <p className="text-zinc-400 text-3xl mb-4">OBS Receiver Ready</p>
            <p className="text-9xl font-mono font-bold tracking-widest text-purple-500 mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400 drop-shadow-lg">
              {receiverId || '....'}
            </p>
            <p className="text-zinc-500 text-2xl">Enter this PIN on your phone to connect</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto h-[auto] lg:h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Camera Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col h-[60vh] lg:h-full w-full lg:w-fit max-w-full mx-auto lg:mx-0 shrink-0">
          <div className="flex items-center justify-between mb-4 relative shrink-0 gap-8">
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors z-10 shrink-0">
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back</span>
            </Link>
            
            <div className="flex items-center gap-2 justify-center flex-1 shrink-0">
              <MonitorPlay className="text-purple-500 hidden sm:block" />
              <h2 className="text-lg sm:text-xl font-bold whitespace-nowrap">Receiver Feed</h2>
              {status === 'Connected and receiving video' && (
                <div className="flex items-center gap-1.5 text-green-500 text-xs font-medium bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20 ml-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  Live
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsMirrored(prev => !prev)}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors z-10 shrink-0"
            >
              <FlipHorizontal size={16} />
              <span className="hidden sm:inline">Mirror</span>
            </button>
          </div>
          
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div 
              className="bg-black rounded-xl overflow-hidden border border-zinc-800 h-full flex justify-center items-center relative transition-all duration-300"
              style={{ aspectRatio: resolution ? `${resolution.width}/${resolution.height}` : '16/9' }}
            >
              <video 
                ref={videoRef}
                className="w-full h-full object-cover block"
                style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
                autoPlay 
                playsInline
              />
              
              {status !== 'Connected and receiving video' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 z-10 backdrop-blur-sm p-6 text-center">
                  <MonitorPlay className="text-zinc-600 mb-4" size={48} />
                  <p className="text-zinc-400 text-lg font-medium">{status}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Controls & Stats */}
        <div className="flex flex-col gap-6 w-full lg:flex-1 h-auto lg:h-full lg:overflow-y-auto shrink-0 pb-4 custom-scrollbar">
          
          {/* PIN Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <h3 className="text-xl font-bold mb-6 text-zinc-100 flex items-center gap-2">
              Connection PIN
            </h3>
            
            <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800 text-center relative overflow-hidden">
              <p className="text-zinc-400 mb-3 text-sm">Enter this code on your phone</p>
              <p className="text-6xl sm:text-7xl font-mono font-bold tracking-[0.2em] text-purple-400 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
                {receiverId || '....'}
              </p>
            </div>
          </div>

          {/* Details Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shrink-0">
            <h3 className="text-xl font-bold mb-4 text-zinc-100">Stream Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 col-span-2">
                <p className="text-zinc-400 text-sm mb-1">Status</p>
                <p className={`font-semibold text-lg ${status === 'Connected and receiving video' ? 'text-green-500' : status.includes('Error') ? 'text-red-500' : 'text-yellow-500'}`}>
                  {status}
                </p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 text-sm mb-1">Resolution</p>
                <p className="font-semibold text-lg">{resolution ? `${resolution.width} × ${resolution.height}` : '-'}</p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 text-sm mb-1">Mirroring</p>
                <p className="font-semibold text-lg">{isMirrored ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </div>
          
          {/* OBS Mode Button */}
          <Link 
            href={`?mode=obs${isMirrored ? '&mirror=true' : ''}`}
            className="group bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 p-6 rounded-2xl shadow-xl border border-purple-500/30 flex items-center justify-between transition-all hover:scale-[1.02] shrink-0"
          >
            <div>
              <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                Enter OBS Mode <ExternalLink size={20} />
              </h3>
              <p className="text-purple-200 text-sm">Switch to full-screen clean feed for capture</p>
            </div>
            <Maximize className="text-white/50 group-hover:text-white transition-colors" size={32} />
          </Link>

        </div>
      </div>
    </div>
  );
}
