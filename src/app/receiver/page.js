'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

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
          if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
            setStatus('Connected and receiving video');
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
          <div className="absolute top-4 left-4 text-white/50 font-mono text-xl z-50">
            PIN: {receiverId || '...'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6">
        <ArrowLeft size={20} />
        Back to Home
      </Link>
      
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">PC Receiver</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-zinc-300 text-sm cursor-pointer">
              <input 
                type="checkbox" 
                checked={isMirrored} 
                onChange={(e) => setIsMirrored(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800"
              />
              Mirror Video
            </label>
            <Link 
              href={`?mode=obs${isMirrored ? '&mirror=true' : ''}`}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 transition-colors rounded-lg font-medium text-sm"
            >
              Enter OBS Mode
            </Link>
          </div>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 flex items-center justify-center border border-zinc-800 relative">
            <video 
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
              autoPlay 
              playsInline
            />
            {status !== 'Connected and receiving video' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                <p className="text-zinc-400 mb-2">Your Receiver PIN</p>
                <p className="text-6xl font-mono font-bold tracking-widest text-purple-500 mb-4">
                  {receiverId || '....'}
                </p>
                <p className="text-zinc-500 text-sm">Enter this PIN on your phone to connect.</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 max-w-xl">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p className="text-zinc-400 text-sm mb-1">Connection Status</p>
              <p className={`font-semibold text-lg ${status === 'Connected and receiving video' ? 'text-green-500' : status.includes('Error') ? 'text-red-500' : 'text-yellow-500'}`}>
                {status}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
