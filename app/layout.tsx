import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'https://daemoncast.vercel.app';
  
  return {
    title: 'DaemonFetch - Farcaster Psychology Bot',
    description: 'A Farcaster bot that performs psychological analysis using Carl Jung-style introspective responses',
    generator: 'DaemonFetch',
    other: {
      'base:app_id': '693c68f5e6be54f5ed71d80f',
      'fc:miniapp': JSON.stringify({
        version: 'next',
        imageUrl: `${URL}/azura-pfp.png`,
        button: {
          title: 'View Commands',
          action: {
            type: 'launch_miniapp',
            name: 'Azura Commands',
            url: URL,
            splashImageUrl: `${URL}/azura-pfp.png`,
            splashBackgroundColor: '#0a0a0f',
          },
        },
      }),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
