# WebRTC OBS Camera

Turn any smartphone into a high-quality, ultra-low latency wireless webcam for OBS Studio (or any PC) using pure WebRTC.

🌐 **Live Demo / Hosted App:** [https://webcam-obs.vercel.app](https://webcam-obs.vercel.app)

## Features

- **Ultra-Low Latency:** Uses WebRTC (via PeerJS) for peer-to-peer streaming directly over your local network. No video data ever touches a remote server.
- **Lightning Fast QR Connection:** Instantly connect your phone to your PC by pointing your camera at the automatically generated QR code on the receiver screen. No typing required!
- **High Quality & Resolution Control:** Hot-swap between 4K, 1080p, 720p, and 480p on the fly. The WebRTC connection is strictly optimized to prioritize high resolution over framerate (perfect for crisp OBS sources).
- **Dynamic Orientation & Fullscreen:** The app automatically handles mobile screen rotation flawlessly, ensuring your video feed always retains its correct aspect ratio without black bars.
- **Dynamic Camera Controls:** Swap between front and back cameras, and easily toggle mirroring to fit your setup.
- **Dedicated OBS Mode:** A specialized, full-screen receiver UI perfectly designed to be captured as a "Browser Source" in OBS Studio. 
- **Network Awareness:** Automatically detects if you fall back to cellular data and warns you to connect to the same Wi-Fi network for optimal local performance.
- **Modern UI/UX:** Built with Tailwind CSS and Lucide React for a gorgeous, responsive, premium dark-mode interface.

## How to Use

1. **Open the Receiver (PC):**
   - On your PC, navigate to `https://webcam-obs.vercel.app`.
   - Click "Receiver".
   - A scannable QR Code and a 4-digit Connection PIN will be generated on screen.
   - *(If using OBS, you can click "Enter OBS Mode" to expand this to a full-screen clean UI).*
2. **Open the Sender (Phone):**
   - On your smartphone, navigate to `https://webcam-obs.vercel.app`.
   - Click "Sender".
3. **Connect:**
   - Tap **"Scan QR Code to Connect"** and point your phone at your PC monitor.
   - *Alternatively*, you can manually enter the 4-digit PIN.
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
- **QR Code Scanning:** jsQR
- **QR Code Generation:** qrcode.react
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
