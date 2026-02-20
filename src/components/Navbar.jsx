import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Users, LayoutGrid, BarChart3, CalendarDays, Home, Activity } from 'lucide-react'

const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/roster', icon: Users, label: 'Roster' },
    { to: '/field', icon: LayoutGrid, label: 'Campo' },
    { to: '/lineups', icon: CalendarDays, label: 'Alineaciones' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
    { to: '/games', icon: Activity, label: 'Jornadas' },
]

export default function Navbar() {
    const location = useLocation()

    return (
        <>
            {/* Desktop sidebar */}
            <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-6 glass z-40 no-print"
                style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="mb-8">
                    <img src="/logo.png" alt="Deprecados" className="w-12 h-12 object-cover rounded-full" />
                </div>
                <div className="flex-1 flex flex-col items-center gap-2">
                    {navItems.map(item => {
                        const isActive = location.pathname === item.to
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200 group
                  ${isActive ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                            >
                                <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                            </NavLink>
                        )
                    })}
                </div>
            </nav>

            {/* Mobile bottom bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 glass z-40 no-print"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-around py-2 px-2 safe-area-bottom">
                    {navItems.map(item => {
                        const isActive = location.pathname === item.to
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 min-w-[56px]
                  ${isActive ? 'text-primary' : 'text-text-muted'}`}
                            >
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                                <span className="text-[9px] font-medium">{item.label}</span>
                                {isActive && (
                                    <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                                )}
                            </NavLink>
                        )
                    })}
                </div>
            </nav>
        </>
    )
}
