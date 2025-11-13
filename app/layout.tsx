import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: 'Open Working Hours',
  description: 'Hospital shift planning and working hours review platform',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
