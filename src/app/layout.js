import "./globals.css";
import { cookies } from "next/headers";

import Sidebar from "../components/Sidebar";
import GeminiChatWidget from "../components/GeminiChatWidget";

export const metadata = {
  title: "Dealer Intelligence",
  description: "Smart Relationship Management & Operational Automation",
};

import { Suspense } from 'react';

export default async function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#0f172a' }}>
          <Suspense fallback={<div style={{ width: '80px', backgroundColor: '#0f172a' }} />}>
            <Sidebar />
          </Suspense>
          <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--background)' }}>
            {children}
          </main>
        </div>
        <GeminiChatWidget />
      </body>
    </html>
  );
}
