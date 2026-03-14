import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AKT Palkanlaskenta',
  description: 'Kuljetusalan TES-pohjainen laskuri',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fi" className="dark">
      <body className={`${inter.className} bg-slate-900 text-slate-50 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
