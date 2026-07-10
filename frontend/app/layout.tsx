import "./globals.css"
import React from "react"

export const metadata = {
  title: "FlientSec | Workstation Security Posture Platform",
  description: "Continuous developer workstation verification without MDM",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAF8] text-slate-800 antialiased">
        {children}
      </body>
    </html>
  )
}
