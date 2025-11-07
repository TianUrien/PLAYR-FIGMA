import type { ReactNode } from 'react'
import Footer from './Footer'
import MobileBottomNav from './MobileBottomNav'

interface LayoutProps {
  children: ReactNode
  className?: string
}

export default function Layout({ children, className = '' }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Main content area - grows to push footer down */}
      <main className={`flex-1 ${className}`}>
        {children}
      </main>

      {/* Footer - always at bottom */}
      <Footer />

      {/* Mobile Bottom Navigation - Instagram style */}
      <MobileBottomNav />
    </div>
  )
}
