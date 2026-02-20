import React from 'react'
import { Link } from 'react-router-dom'
import { Users, LayoutGrid, BarChart3, CalendarDays, ChevronRight, Trophy, Zap, Star, TrendingUp, Medal } from 'lucide-react'
import { useData, POSITIONS, calcPlayerAvg, formatAvg } from '../utils/DataContext'

export default function HomePage() {
    const { players, lineups, games } = useData()

    const totalGames = games.length
    const wins = games.filter(g => g.runsFor > g.runsAgainst).length
    const losses = games.filter(g => g.runsFor < g.runsAgainst).length

    // Top 9 players by AVG (like a starting 9)
    const top9 = [...players]
        .map(p => ({ ...p, avg: calcPlayerAvg(p) }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 9)

    const quickLinks = [
        { to: '/roster', icon: Users, label: 'Roster', desc: 'Gestionar jugadores', color: 'from-red-600 to-red-800' },
        { to: '/field', icon: LayoutGrid, label: 'Campo', desc: 'Asignar posiciones', color: 'from-green-600 to-green-800' },
        { to: '/lineups', icon: CalendarDays, label: 'Alineaciones', desc: 'Crear lineups', color: 'from-blue-600 to-blue-800' },
        { to: '/stats', icon: BarChart3, label: 'Estadísticas', desc: 'Ver rendimiento', color: 'from-purple-600 to-purple-800' },
    ]

    const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600']

    return (
        <div className="animate-fade-in">
            {/* Hero section */}
            <div className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-12"
                style={{
                    background: 'linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(10,10,10,0.9) 60%)',
                    border: '1px solid rgba(220,38,38,0.15)',
                }}>
                <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
                    <img src="/logo.png" alt="" className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <img src="/logo.png" alt="Deprecados" className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-full" />
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                DEPRECADOS
                            </h1>
                            <p className="text-text-muted text-sm md:text-base font-medium">Gestión de Equipo</p>
                        </div>
                    </div>
                    <p className="text-text-muted max-w-md mt-4 text-sm leading-relaxed">
                        Administra tu roster, crea alineaciones para cada juego, asigna posiciones en el campo y lleva las estadísticas de tu equipo.
                    </p>
                </div>
            </div>

            {/* Stats overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="stat-card">
                    <div className="flex items-center justify-center mb-2">
                        <Users size={20} className="text-primary" />
                    </div>
                    <div className="stat-value">{players.length}</div>
                    <div className="stat-label">Jugadores</div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-center mb-2">
                        <CalendarDays size={20} className="text-primary" />
                    </div>
                    <div className="stat-value">{lineups.length}</div>
                    <div className="stat-label">Alineaciones</div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-center mb-2">
                        <Trophy size={20} className="text-primary" />
                    </div>
                    <div className="stat-value">{wins}</div>
                    <div className="stat-label">Victorias</div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-center mb-2">
                        <Zap size={20} className="text-primary" />
                    </div>
                    <div className="stat-value">{totalGames > 0 ? ((wins / totalGames) * 100).toFixed(0) : 0}%</div>
                    <div className="stat-label">Win Rate</div>
                </div>
            </div>

            {/* Top 9 Players */}
            {players.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Medal size={18} className="text-yellow-400" />
                        Top 9 — Mejores Bateadores
                    </h2>
                    <div className="glass-card overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {top9.map((player, i) => {
                                const posInfo = POSITIONS.find(p => p.id === player.position)
                                const secPosInfo = player.secondaryPosition ? POSITIONS.find(p => p.id === player.secondaryPosition) : null
                                return (
                                    <div
                                        key={player.id}
                                        className="flex items-center gap-4 p-4 hover:bg-white/3 transition-colors animate-slide-up"
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    >
                                        {/* Rank */}
                                        <div className="w-8 flex-shrink-0 text-center">
                                            {i < 3 ? (
                                                <Medal size={20} className={medalColors[i]} />
                                            ) : (
                                                <span className="text-sm font-bold text-text-muted">{i + 1}</span>
                                            )}
                                        </div>
                                        {/* Number */}
                                        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {player.number || '?'}
                                            </span>
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-white truncate">{player.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                                <span className="text-primary font-medium">{posInfo?.short}</span>
                                                {secPosInfo && <span className="text-blue-400">/ {secPosInfo.short}</span>}
                                                {player.stats?.atBats > 0 && (
                                                    <span>{player.stats.hits}H · {player.stats.homeRuns || 0}HR · {player.stats.rbi || 0}RBI</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* AVG */}
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-xl font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {formatAvg(player.avg)}
                                            </div>
                                            <div className="text-[10px] text-text-muted uppercase">Promedio</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {players.length > 9 && (
                            <Link to="/stats" className="block p-3 text-center text-xs text-primary hover:bg-primary/5 transition-colors border-t border-white/5">
                                Ver todas las estadísticas →
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Quick links */}
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Star size={18} className="text-primary" />
                Acceso Rápido
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {quickLinks.map((link, i) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className="glass-card p-5 flex items-center gap-4 group"
                        style={{ animationDelay: `${i * 100}ms` }}
                    >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                            <link.icon size={22} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white">{link.label}</div>
                            <div className="text-sm text-text-muted">{link.desc}</div>
                        </div>
                        <ChevronRight size={18} className="text-text-muted group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                    </Link>
                ))}
            </div>

            {/* Recent lineups */}
            {lineups.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold mb-4">Alineaciones recientes</h2>
                    <div className="space-y-3">
                        {lineups.slice(-3).reverse().map(lineup => (
                            <Link
                                key={lineup.id}
                                to={`/lineups`}
                                className="glass-card p-4 flex items-center gap-4 block"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <CalendarDays size={18} className="text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white truncate">{lineup.name || 'Sin nombre'}</div>
                                    <div className="text-xs text-text-muted">
                                        {lineup.date} {lineup.opponent && `vs ${lineup.opponent}`}
                                    </div>
                                </div>
                                <div className="text-xs text-text-muted">
                                    {Object.keys(lineup.positions).length}/9
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
