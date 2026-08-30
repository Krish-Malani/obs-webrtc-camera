import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    template: '%s | WebRTC OBS Camera',
    default: 'WebRTC OBS Camera - Turn Your Phone Into A Webcam',
  },
  description: "Turn any smartphone into a high-quality, ultra-low latency wireless webcam for OBS Studio or any PC using pure WebRTC.",
  keywords: ["OBS camera", "wireless webcam", "webrtc camera", "phone webcam", "obs studio", "live streaming", "free webcam app"],
  verification: {
    google: "81e87f0ff221746a",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
