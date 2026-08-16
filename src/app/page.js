import Link from 'next/link';
import { Camera, MonitorPlay } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-purple-500/20 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Camera size={32} />
        </div>
        <h1 className="text-3xl font-bold mb-2">WebRTC OBS Camera</h1>
        <p className="text-zinc-400 mb-8">Use your phone as a high-quality wireless webcam for OBS Studio.</p>
        
        <div className="space-y-4 flex flex-col">
          <Link 
            href="/phone" 
            className="group flex items-center justify-center gap-3 w-full py-4 px-6 bg-purple-600 hover:bg-purple-500 transition-colors rounded-xl font-medium text-lg"
          >
            <Camera className="group-hover:scale-110 transition-transform" />
            Use Phone as Camera
          </Link>
          
          <Link 
            href="/receiver" 
            className="group flex items-center justify-center gap-3 w-full py-4 px-6 bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 rounded-xl font-medium text-lg"
          >
            <MonitorPlay className="group-hover:scale-110 transition-transform" />
            Use PC as Receiver
          </Link>
        </div>
      </div>
    </div>
  );
}
