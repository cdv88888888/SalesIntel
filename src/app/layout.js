import "./globals.css";
import { cookies } from "next/headers";

import Sidebar from "../components/Sidebar";
import GeminiChatWidget from "../components/GeminiChatWidget";
import { ChatProvider } from "../context/ChatContext";
import { ClientDrawerProvider } from "../context/ClientDrawerContext";
import ViewDealerModal from "./intelligence/ViewDealerModal";

export const metadata = {
  title: "CDV-sales-intelligence",
  description: "Smart Relationship Management & Operational Automation",
};

import { Suspense } from 'react';

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "dark";

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--background-dark)' }}>
          <ChatProvider>
            <ClientDrawerProvider>
              <Suspense fallback={<div style={{ width: '80px', backgroundColor: 'var(--background-dark)' }} />}>
                <Sidebar />
              </Suspense>
              <main className="main-content">
                {children}
              </main>
              <GeminiChatWidget />
              <ViewDealerModal />
            </ClientDrawerProvider>
          </ChatProvider>
        </div>
      </body>
    </html>
  );
}

