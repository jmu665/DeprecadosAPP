import React, { useState, useRef, useEffect } from 'react'
import { useData, POSITIONS, calcPlayerAvg, formatAvg, calcPlayerStars, StarRating } from '../utils/DataContext'
import Modal from '../components/Modal'
import { BarChart3, Edit2, TrendingUp, Award, Target, Zap, RefreshCw, Database } from 'lucide-react'

function calcOBP(hits, walks, atBats) {
    const denom = atBats + walks
    if (!denom || denom === 0) return '.000'
    return ((hits + walks) / denom).toFixed(3).replace(/^0/, '')
}

// Spanish tooltips for stat abbreviations
const STAT_TOOLTIPS = {
    'all': 'Mostrar todos sin orden específico',
    'avg': 'Promedio de Bateo — Hits entre Turnos al Bat',
    'hits': 'Hits — Total de batazos conectados',
    'hr': 'Home Runs — Cuadrangulares',
    'rbi': 'Carreras Impulsadas — Carreras que anotaron por tu bateo',
    'runs': 'Carreras Anotadas — Veces que llegaste al home',
    'sb': 'Bases Robadas — Bases tomadas sin bateo',
}

const TABLE_TOOLTIPS = {
    'JJ': 'Juegos Jugados',
    'AB': 'Turnos al Bat (At Bats)',
    'H': 'Hits (Batazos conectados)',
    'R': 'Carreras Anotadas (Runs)',
    'RBI': 'Carreras Impulsadas (Runs Batted In)',
    'HR': 'Home Runs (Cuadrangulares)',
    'BB': 'Bases por Bolas (Walks)',
    'K': 'Ponches (Strikeouts)',
    'SB': 'Bases Robadas (Stolen Bases)',
    'E': 'Errores defensivos',
    'AVG': 'Promedio de Bateo (Batting Average)',
    'OBP': 'Porcentaje de Embasarse (On-Base Percentage)',
}

// Interactive tooltip component for stat column headers
function StatTooltipHeader({ label, tooltip, className, isPrimary }) {
    const [showTip, setShowTip] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!showTip) return
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setShowTip(false)
        }
        document.addEventListener('click', handleOutside)
        return () => document.removeEventListener('click', handleOutside)
    }, [showTip])

    return (
        <th
            ref={ref}
            className={className || `text-center p-4 text-xs font-bold ${isPrimary ? 'text-primary' : 'text-text-muted'} uppercase tracking-wider cursor-help`}
            onClick={() => setShowTip(!showTip)}
            style={{ position: 'relative' }}
        >
            {label}
            {showTip && (
                <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 px-3 py-2 rounded-lg bg-surface border border-white/15 shadow-xl text-[11px] font-normal normal-case tracking-normal text-white whitespace-nowrap"
                    style={{ minWidth: '140px', textAlign: 'center' }}>
                    {tooltip}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-l border-t border-white/15 rotate-45" />
                </div>
            )}
        </th>
    )
}

export default function StatsPage() {
    const { players, updatePlayerStats, compileAllStats, dbReady, games } = useData()
    const [editingPlayer, setEditingPlayer] = useState(null)
    const [statsForm, setStatsForm] = useState({})
    const [sortBy, setSortBy] = useState('all')
    const [compiling, setCompiling] = useState(false)

    const playersWithCalc = players.map(p => ({
        ...p,
        avg: calcPlayerAvg(p),
        obp: (p.stats.atBats + p.stats.walks) > 0 ? (p.stats.hits + p.stats.walks) / (p.stats.atBats + p.stats.walks) : 0,
    }))

    const sortedPlayers = [...playersWithCalc].sort((a, b) => {
        switch (sortBy) {
            case 'avg': return b.avg - a.avg
            case 'hr': return (b.stats.homeRuns || 0) - (a.stats.homeRuns || 0)
            case 'rbi': return (b.stats.rbi || 0) - (a.stats.rbi || 0)
            case 'hits': return (b.stats.hits || 0) - (a.stats.hits || 0)
            case 'runs': return (b.stats.runs || 0) - (a.stats.runs || 0)
            case 'sb': return (b.stats.stolenBases || 0) - (a.stats.stolenBases || 0)
            case 'all':
            default: return 0
        }
    })

    // Team totals
    const teamTotals = playersWithCalc.reduce((acc, p) => ({
        gamesPlayed: Math.max(acc.gamesPlayed, p.stats.gamesPlayed || 0),
        atBats: acc.atBats + (p.stats.atBats || 0),
        hits: acc.hits + (p.stats.hits || 0),
        runs: acc.runs + (p.stats.runs || 0),
        rbi: acc.rbi + (p.stats.rbi || 0),
        homeRuns: acc.homeRuns + (p.stats.homeRuns || 0),
        walks: acc.walks + (p.stats.walks || 0),
        strikeouts: acc.strikeouts + (p.stats.strikeouts || 0),
        stolenBases: acc.stolenBases + (p.stats.stolenBases || 0),
        errors: acc.errors + (p.stats.errors || 0),
    }), { gamesPlayed: 0, atBats: 0, hits: 0, runs: 0, rbi: 0, homeRuns: 0, walks: 0, strikeouts: 0, stolenBases: 0, errors: 0 })

    const handleEditStats = (player) => {
        setEditingPlayer(player)
        setStatsForm({ ...player.stats })
    }

    const handleSaveStats = () => {
        const cleanStats = {}
        Object.entries(statsForm).forEach(([key, val]) => {
            cleanStats[key] = typeof val === 'string' ? parseInt(val) || 0 : val
        })
        updatePlayerStats(editingPlayer.id, cleanStats)
        setEditingPlayer(null)
        setStatsForm({})
    }

    const statFields = [
        { key: 'gamesPlayed', label: 'Juegos Jugados (JJ)' },
        { key: 'atBats', label: 'Turnos al Bat (AB)' },
        { key: 'hits', label: 'Hits — Batazos conectados (H)' },
        { key: 'runs', label: 'Carreras Anotadas (R)' },
        { key: 'rbi', label: 'Carreras Impulsadas (RBI)' },
        { key: 'homeRuns', label: 'Home Runs — Cuadrangulares (HR)' },
        { key: 'walks', label: 'Bases por Bolas (BB)' },
        { key: 'strikeouts', label: 'Ponches (K)' },
        { key: 'stolenBases', label: 'Bases Robadas (SB)' },
        { key: 'errors', label: 'Errores defensivos (E)' },
    ]

    // Team leaders
    const topAvg = sortedPlayers.length > 0 ? sortedPlayers.reduce((best, p) => p.avg > best.avg ? p : best, sortedPlayers[0]) : null
    const topHR = playersWithCalc.length > 0 ? playersWithCalc.reduce((best, p) => (p.stats.homeRuns || 0) > (best.stats.homeRuns || 0) ? p : best, playersWithCalc[0]) : null
    const topRBI = playersWithCalc.length > 0 ? playersWithCalc.reduce((best, p) => (p.stats.rbi || 0) > (best.stats.rbi || 0) ? p : best, playersWithCalc[0]) : null

    const thClass = "text-center p-4 text-xs font-bold text-text-muted uppercase tracking-wider cursor-help"

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Estadísticas</h1>
                    <p className="text-text-muted text-sm mt-1">Rendimiento individual del equipo</p>
                </div>
                {dbReady && games.length > 0 && (
                    <button
                        onClick={async () => {
                            setCompiling(true)
                            await compileAllStats()
                            setCompiling(false)
                        }}
                        disabled={compiling}
                        className="btn-secondary flex items-center gap-2 text-sm"
                        title="Recalcula todas las stats de jugadores a partir de los eventos registrados en las Jornadas"
                    >
                        <RefreshCw size={16} className={compiling ? 'animate-spin' : ''} />
                        {compiling ? 'Compilando...' : 'Compilar desde Jornadas'}
                    </button>
                )}
            </div>

            {/* Source info */}
            {dbReady && (
                <div className="mb-4 p-3 rounded-xl bg-blue-500/8 border border-blue-500/15 text-xs text-blue-300 flex items-center gap-2">
                    <Database size={14} />
                    Las estadísticas se calculan automáticamente al agregar eventos en Jornadas. También puedes editar manualmente.
                </div>
            )}

            {/* Team leaders */}
            {players.length > 0 && players.some(p => p.stats.atBats > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {topAvg && topAvg.avg > 0 && (
                        <div className="glass-card p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center">
                                <Award size={22} className="text-yellow-400" />
                            </div>
                            <div>
                                <div className="text-xs text-text-muted uppercase tracking-wider">Líder en Promedio</div>
                                <div className="font-bold text-white">{topAvg.name}</div>
                                <div className="text-lg font-black text-yellow-400" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {formatAvg(topAvg.avg)}
                                </div>
                            </div>
                        </div>
                    )}
                    {topHR && (topHR.stats.homeRuns || 0) > 0 && (
                        <div className="glass-card p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                                <Zap size={22} className="text-primary" />
                            </div>
                            <div>
                                <div className="text-xs text-text-muted uppercase tracking-wider">Líder cuadrangulares</div>
                                <div className="font-bold text-white">{topHR.name}</div>
                                <div className="text-lg font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {topHR.stats.homeRuns} HR
                                </div>
                            </div>
                        </div>
                    )}
                    {topRBI && (topRBI.stats.rbi || 0) > 0 && (
                        <div className="glass-card p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
                                <Target size={22} className="text-green-400" />
                            </div>
                            <div>
                                <div className="text-xs text-text-muted uppercase tracking-wider">Líder carreras impulsadas</div>
                                <div className="font-bold text-white">{topRBI.name}</div>
                                <div className="text-lg font-black text-green-400" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {topRBI.stats.rbi} RBI
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sort controls with tooltips */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-text-muted uppercase tracking-wider mr-2">Ordenar:</span>
                {[
                    { value: 'all', label: 'Todas' },
                    { value: 'avg', label: 'AVG' },
                    { value: 'hits', label: 'H' },
                    { value: 'hr', label: 'HR' },
                    { value: 'rbi', label: 'RBI' },
                    { value: 'runs', label: 'R' },
                    { value: 'sb', label: 'SB' },
                ].map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setSortBy(opt.value)}
                        title={STAT_TOOLTIPS[opt.value]}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
              ${sortBy === opt.value ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-text-muted hover:text-white border border-white/5'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Stats table */}
            {players.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <BarChart3 size={48} className="mx-auto mb-4 text-text-muted/30" />
                    <p className="text-text-muted font-medium">
                        Agrega jugadores desde el Roster para ver sus estadísticas.
                    </p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left p-4 text-xs font-bold text-text-muted uppercase tracking-wider sticky left-0 bg-surface/90 backdrop-blur-sm z-10">Jugador</th>
                                    <StatTooltipHeader label="JJ" tooltip={TABLE_TOOLTIPS['JJ']} />
                                    <StatTooltipHeader label="AB" tooltip={TABLE_TOOLTIPS['AB']} />
                                    <StatTooltipHeader label="H" tooltip={TABLE_TOOLTIPS['H']} />
                                    <StatTooltipHeader label="R" tooltip={TABLE_TOOLTIPS['R']} />
                                    <StatTooltipHeader label="RBI" tooltip={TABLE_TOOLTIPS['RBI']} />
                                    <StatTooltipHeader label="HR" tooltip={TABLE_TOOLTIPS['HR']} />
                                    <StatTooltipHeader label="BB" tooltip={TABLE_TOOLTIPS['BB']} />
                                    <StatTooltipHeader label="K" tooltip={TABLE_TOOLTIPS['K']} />
                                    <StatTooltipHeader label="SB" tooltip={TABLE_TOOLTIPS['SB']} />
                                    <StatTooltipHeader label="E" tooltip={TABLE_TOOLTIPS['E']} />
                                    <StatTooltipHeader label="AVG" tooltip={TABLE_TOOLTIPS['AVG']} isPrimary />
                                    <StatTooltipHeader label="OBP" tooltip={TABLE_TOOLTIPS['OBP']} isPrimary />
                                    <th className="text-center p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Rating</th>
                                    <th className="text-center p-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPlayers.map((player, i) => (
                                    <tr
                                        key={player.id}
                                        className="border-b border-white/5 hover:bg-white/3 transition-colors"
                                    >
                                        <td className="p-4 sticky left-0 bg-surface/70 backdrop-blur-sm z-10">
                                            <div className="flex items-center gap-3">
                                                <span className="text-primary font-bold text-sm" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    #{player.number || '?'}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-white truncate max-w-[120px]">{player.name}</div>
                                                    <div className="text-[10px] text-text-muted">
                                                        {player.position}
                                                        {player.secondaryPosition && ` / ${player.secondaryPosition}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.gamesPlayed}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.atBats}</td>
                                        <td className="text-center p-4 text-white font-medium">{player.stats.hits}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.runs}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.rbi}</td>
                                        <td className="text-center p-4 text-white font-medium">{player.stats.homeRuns}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.walks}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.strikeouts}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.stolenBases}</td>
                                        <td className="text-center p-4 text-text-muted">{player.stats.errors}</td>
                                        <td className="text-center p-4 font-bold text-primary">{formatAvg(player.avg)}</td>
                                        <td className="text-center p-4 font-medium text-primary/80">{calcOBP(player.stats.hits, player.stats.walks, player.stats.atBats)}</td>
                                        <td className="text-center p-4"><StarRating stars={calcPlayerStars(player)} size={13} /></td>
                                        <td className="text-center p-4">
                                            <button
                                                onClick={() => handleEditStats(player)}
                                                className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                                                title="Editar estadísticas"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Team totals row */}
                                <tr className="border-t-2 border-primary/30 bg-primary/5">
                                    <td className="p-4 sticky left-0 bg-primary/10 backdrop-blur-sm z-10">
                                        <div className="flex items-center gap-3">
                                            <span className="text-primary font-bold text-sm" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                ⚾
                                            </span>
                                            <div className="min-w-0">
                                                <div className="font-bold text-primary">EQUIPO</div>
                                                <div className="text-[10px] text-primary/60">Totales</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.gamesPlayed}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.atBats}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.hits}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.runs}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.rbi}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.homeRuns}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.walks}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.strikeouts}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.stolenBases}</td>
                                    <td className="text-center p-4 font-semibold text-white">{teamTotals.errors}</td>
                                    <td className="text-center p-4 font-bold text-primary">{formatAvg(teamTotals.atBats > 0 ? teamTotals.hits / teamTotals.atBats : 0)}</td>
                                    <td className="text-center p-4 font-bold text-primary/80">{calcOBP(teamTotals.hits, teamTotals.walks, teamTotals.atBats)}</td>
                                    <td className="text-center p-4"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit stats modal */}
            <Modal
                isOpen={!!editingPlayer}
                onClose={() => setEditingPlayer(null)}
                title={editingPlayer ? `Stats de ${editingPlayer.name}` : ''}
            >
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {statFields.map(field => (
                        <div key={field.key} className="flex items-center gap-4">
                            <label className="text-xs font-medium text-text-muted w-48 flex-shrink-0">{field.label}</label>
                            <input
                                type="number"
                                min="0"
                                value={statsForm[field.key] || 0}
                                onChange={e => setStatsForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                className="input-field !py-2 w-24 text-center"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 pt-5 mt-4 border-t border-white/10">
                    <button onClick={handleSaveStats} className="btn-primary flex-1">Guardar</button>
                    <button onClick={() => setEditingPlayer(null)} className="btn-secondary">Cancelar</button>
                </div>
            </Modal>
        </div>
    )
}
