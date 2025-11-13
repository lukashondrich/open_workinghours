import type { Metadata } from "next"
import Link from "next/link"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { cn } from "@/lib/utils"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/verify", label: "Verify" },
  { href: "/data-ingestion", label: "Data Ingestion" },
  { href: "/public-dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cn(_geist.variable, "bg-white text-slate-900 antialiased")}>
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
            <Link href="/" className="font-semibold tracking-tight text-slate-900">
              Open Working Hours
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-slate-900">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
