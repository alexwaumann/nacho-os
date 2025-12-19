import { Link, useMatches } from '@tanstack/react-router'
import { Triangle } from 'lucide-react'

const NachoLogo = ({ size = 24 }: { size?: number }) => (
  <div className="relative flex items-center justify-center">
    {/* Literal Nacho (Triangle) */}
    <Triangle
      size={size}
      className="text-amber-500 fill-amber-400 rotate-180 drop-shadow-sm"
      strokeWidth={2.5}
    />
    {/* OS "Chip" dot */}
    <div className="absolute -bottom-0.5 w-1.5 h-1.5 bg-sky-500 rounded-full border border-white dark:border-slate-900" />
  </div>
)

export default function TopBar() {
  const matches = useMatches()
  const lastMatch = matches[matches.length - 1]

  const getPageTitle = () => {
    const pathname = lastMatch?.pathname
    if (pathname === '/') return ''
    if (pathname.startsWith('/jobs')) return 'Jobs'
    if (pathname.startsWith('/map')) return 'Map'
    if (pathname.startsWith('/account')) return 'Account'
    return ''
  }

  const pageTitle = getPageTitle()

  return (
    <header className="sticky top-0 z-40 w-full flex justify-center py-6 pointer-events-none">
      <div className="bg-card/80 backdrop-blur-md border border-border shadow-sm px-5 py-2 rounded-full flex items-center gap-3 pointer-events-auto">
        <Link to="/" className="flex items-center gap-3">
          <NachoLogo size={24} />
          <span className="font-black text-lg tracking-tight text-foreground">
            Nacho OS{' '}
            {pageTitle && (
              <span className="text-muted-foreground font-medium ml-1">
                • {pageTitle}
              </span>
            )}
          </span>
        </Link>
      </div>
    </header>
  )
}
