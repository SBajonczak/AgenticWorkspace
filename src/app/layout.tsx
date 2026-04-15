import type { Metadata } from 'next'
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from 'next-themes';

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Agentic Workplace',
  description: 'AI-powered workplace agent that transforms meetings into actionable outcomes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
