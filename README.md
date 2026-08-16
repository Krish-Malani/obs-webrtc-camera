# WebRTC OBS Camera

Turn any smartphone into a high-quality, ultra-low latency wireless webcam for OBS Studio (or any PC) using pure WebRTC.

🌐 **Live Demo / Hosted App:** [https://obs-webrtc-camera.vercel.app](https://obs-webrtc-camera.vercel.app)

## Features

- **Ultra-Low Latency:** Uses WebRTC (via PeerJS) for peer-to-peer streaming directly over your local network. No video data ever touches a remote server.
- **Dynamic Camera Controls:** Swap between front and back cameras on the fly, with dynamic hardware-based lens tracking.
- **Smart Mirroring:** Reads your physical camera lens data to automatically handle video mirroring (mirrors selfie cameras, leaves rear cameras raw). Both Sender and Receiver have manual overrides.
- **Dedicated OBS Mode:** A specialized, full-screen receiver UI perfectly designed to be captured as a "Browser Source" in OBS Studio. 
- **Network Awareness:** Automatically detects if you fall back to cellular data and warns you to connect to the same Wi-Fi network for optimal local performance.
- **Modern UI/UX:** Built with Tailwind CSS and Lucide React for a gorgeous, responsive, premium dark-mode interface.

## How to Use

1. **Open the Receiver (PC):**
   - On your PC, navigate to `https://obs-webrtc-camera.vercel.app`.
   - Click "Receiver".
   - A 4-digit Connection PIN will be generated on screen.
   - *(If using OBS, you can click "Enter OBS Mode" to expand this to a full-screen clean UI).*
2. **Open the Sender (Phone):**
   - On your smartphone, navigate to `https://obs-webrtc-camera.vercel.app`.
   - Click "Sender".
3. **Connect:**
   - Enter the 4-digit PIN on your smartphone.
   - Accept the camera permissions.
   - Your high-quality camera feed will instantly transmit to your PC!

## Local Development

First, clone the repository and install the dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
*Note: To test WebRTC between two physical devices locally, they must be on the same network.*

## Tech Stack

- **Framework:** Next.js (App Router)
- **WebRTC Signalling:** PeerJS
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
