import React, { useState, useMemo } from 'react'
import { useData, POSITIONS, FIELD_COORDS, calcPlayerAvg, formatAvg } from '../utils/DataContext'
import BaseballField from '../components/BaseballField'
import Modal from '../components/Modal'
import { Save, RotateCcw, Star, Users, Lightbulb, Crown, ArrowRightLeft, Calendar, Eye, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function FieldPage() {
    const { players, lineups, games, addLineup, getPlayer } = useData()
    const [positions, setPositions] = useState({})
    const [selectedPos, setSelectedPos] = useState(null)
    const [lineupName, setLineupName] = useState('')
    const [lineupDate, setLineupDate] = useState(new Date().toISOString().split('T')[0])
    const [opponent, setOpponent] = useState('')
    const [showPlayerSelect, setShowPlayerSelect] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showTips, setShowTips] = useState(false)

    // View mode: 'create' or 'games'
    const [viewMode, setViewMode] = useState('games')
    const [selectedGame, setSelectedGame] = useState(null)

    // Players not yet assigned
    const availablePlayers = players.filter(p => !Object.values(positions).includes(p.id))

    // Bench = players not in the 9 field positions (excluding DH)
    const fieldPlayerIds = Object.entries(positions)
        .filter(([pos]) => pos !== 'DH')
        .map(([, id]) => id)
    const benchPlayers = players.filter(p => !fieldPlayerIds.includes(p.id))

    // Calculate stellar lineup: best player for each position
    const stellarLineup = useMemo(() => {
        const lineup = {}
        const used = new Set()
        const fieldPositions = POSITIONS.filter(p => p.id !== 'DH')

        // Sort players by AVG
        const rankedPlayers = [...players].sort((a, b) => calcPlayerAvg(b) - calcPlayerAvg(a))

        // First pass: assign best player to their primary position
        fieldPositions.forEach(pos => {
            const best = rankedPlayers.find(p =>
                p.position === pos.id && !used.has(p.id)
            )
            if (best) {
                lineup[pos.id] = best.id
                used.add(best.id)
            }
        })

        // Second pass: fill empty positions with secondary position matches
        fieldPositions.forEach(pos => {
            if (lineup[pos.id]) return
            const best = rankedPlayers.find(p =>
                p.secondaryPosition === pos.id && !used.has(p.id)
            )
            if (best) {
                lineup[pos.id] = best.id
                used.add(best.id)
            }
        })

        // Third pass: fill remaining with best available
        fieldPositions.forEach(pos => {
            if (lineup[pos.id]) return
            const best = rankedPlayers.find(p => !used.has(p.id))
            if (best) {
                lineup[pos.id] = best.id
                used.add(best.id)
            }
        })

        return lineup
    }, [players])

    // Calculate "everyone plays" lineup: rotate so all players get field time
    const everyonePlaysLineup = useMemo(() => {
        if (players.length <= 9) return stellarLineup

        const lineup = {}
        const used = new Set()
        const fieldPositions = POSITIONS.filter(p => p.id !== 'DH')

        // Sort players by games played (ascending) to prioritize less-played
        const byLeastPlayed = [...players].sort((a, b) =>
            (a.stats?.gamesPlayed || 0) - (b.stats?.gamesPlayed || 0)
        )

        // First: assign least-played to their primary position
        fieldPositions.forEach(pos => {
            const best = byLeastPlayed.find(p =>
                (p.position === pos.id || p.secondaryPosition === pos.id) && !used.has(p.id)
            )
            if (best) {
                lineup[pos.id] = best.id
                used.add(best.id)
            }
        })

        // Fill remaining spots
        fieldPositions.forEach(pos => {
            if (lineup[pos.id]) return
            const next = byLeastPlayed.find(p => !used.has(p.id))
            if (next) {
                lineup[pos.id] = next.id
                used.add(next.id)
            }
        })

        return lineup
    }, [players, stellarLineup])

    // Generate rotation tips
    const rotationTips = useMemo(() => {
        if (players.length <= 9) return null

        const totalPlayers = players.length
        const fieldSpots = 9
        const innings = 7
        const tips = []

        // How many innings per player to be roughly equal
        const totalSlots = fieldSpots * innings // 63 player-innings
        const inningsPerPlayer = Math.floor(totalSlots / totalPlayers)
        const extraSlots = totalSlots % totalPlayers

        tips.push(`Con ${totalPlayers} jugadores y ${innings} innings, cada jugador debería jugar aprox. ${inningsPerPlayer} innings.`)

        if (totalPlayers <= 12) {
            const benchCount = totalPlayers - fieldSpots
            tips.push(`Tienes ${benchCount} jugador(es) en banca. Haz ${benchCount} cambios cada 2-3 innings para rotar a todos.`)
            tips.push(`Sugerencia: En el inning 3, mete a los de banca por los que llevan más tiempo. En el inning 5, rota de nuevo.`)
        } else if (totalPlayers <= 15) {
            const benchCount = totalPlayers - fieldSpots
            tips.push(`Tienes ${benchCount} en banca. Haz cambios cada 2 innings: saca 3-4 jugadores y mete a los de banca.`)
            tips.push(`Rota las posiciones: los que entran de banca van al OF o posiciones donde su error afecte menos.`)
        } else {
            tips.push(`Con tantos jugadores, divide en 2 equipos y rota por mitades de juego.`)
        }

        tips.push(`💡 Tip: Mantén a tu pitcher y catcher titulares más tiempo, y rota más en el outfield (LF, CF, RF).`)
        tips.push(`🔄 Cambios sugeridos por inning:`)

        // Generate specific inning suggestions
        const allPlayers = [...players].sort((a, b) => calcPlayerAvg(b) - calcPlayerAvg(a))
        const starters = allPlayers.slice(0, 9)
        const bench = allPlayers.slice(9)

        if (bench.length > 0) {
            const changesPerInning = Math.ceil(bench.length / Math.floor(innings / 2))
            for (let i = 0; i < bench.length; i += changesPerInning) {
                const inningNum = Math.min(2 + Math.floor(i / changesPerInning) * 2, innings)
                const group = bench.slice(i, i + changesPerInning)
                const names = group.map(p => p.name.split(' ')[0]).join(', ')
                tips.push(`  • Inning ${inningNum}: Meter a ${names}`)
            }
        }

        return tips
    }, [players])

    // Build positions map from a game's batting order using player primary positions
    const buildGamePositions = (game) => {
        const pos = {}
        if (!game?.battingOrder) return pos
        const used = new Set()
        const fieldPositions = POSITIONS.filter(p => p.id !== 'DH')

        // First pass: assign to primary position
        game.battingOrder.forEach(pId => {
            const player = getPlayer(pId)
            if (!player) return
            if (player.position && !used.has(player.position) && fieldPositions.some(fp => fp.id === player.position)) {
                pos[player.position] = pId
                used.add(player.position)
            }
        })

        // Second pass: assign to secondary position
        game.battingOrder.forEach(pId => {
            if (Object.values(pos).includes(pId)) return
            const player = getPlayer(pId)
            if (!player) return
            if (player.secondaryPosition && !used.has(player.secondaryPosition) && fieldPositions.some(fp => fp.id === player.secondaryPosition)) {
                pos[player.secondaryPosition] = pId
                used.add(player.secondaryPosition)
            }
        })

        // Third pass: assign remaining to any open position
        game.battingOrder.forEach(pId => {
            if (Object.values(pos).includes(pId)) return
            const openPos = fieldPositions.find(fp => !used.has(fp.id))
            if (openPos) {
                pos[openPos.id] = pId
                used.add(openPos.id)
            }
        })

        return pos
    }

    const handlePositionClick = (posId) => {
        setSelectedPos(posId)
        setShowPlayerSelect(true)
    }

    const handleAssignPlayer = (playerId) => {
        setPositions(prev => ({ ...prev, [selectedPos]: playerId }))
        setShowPlayerSelect(false)
        setSelectedPos(null)
    }

    const handleRemoveFromPosition = (posId) => {
        setPositions(prev => {
            const next = { ...prev }
            delete next[posId]
            return next
        })
    }

    const handleReset = () => {
        setPositions({})
        setLineupName('')
        setOpponent('')
        setSaved(false)
    }

    const handleSaveLineup = () => {
        const battingOrder = Object.values(positions)
        addLineup({
            name: lineupName || `Lineup ${lineups.length + 1}`,
            date: lineupDate,
            opponent,
            positions,
            battingOrder,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    const applyStellarLineup = () => {
        setPositions(stellarLineup)
    }

    const applyEveryonePlays = () => {
        setPositions(everyonePlaysLineup)
    }

    // ===== GAME LINEUP FIELD COMPONENT (read-only view) =====
    const GameFieldView = ({ game }) => {
        const gamePositions = buildGamePositions(game)

        return (
            <div className="field-container">
                {/* Field SVG background */}
                <svg viewBox="0 0 400 400" className="w-full h-full" style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))' }}>
                    {/* Outfield grass */}
                    <path d="M200 380 L10 140 A240 240 0 0 1 390 140 Z" fill="#1B5E20" opacity="0.5" />
                    {/* Infield dirt */}
                    <path d="M200 340 L120 240 L200 170 L280 240 Z" fill="#5D4037" opacity="0.5" />
                    {/* Infield grass */}
                    <circle cx="200" cy="255" r="35" fill="#2E7D32" opacity="0.4" />
                    {/* Base paths */}
                    <line x1="200" y1="340" x2="120" y2="240" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <line x1="120" y1="240" x2="200" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <line x1="200" y1="170" x2="280" y2="240" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <line x1="280" y1="240" x2="200" y2="340" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    {/* Bases */}
                    <rect x="194" y="334" width="12" height="12" fill="white" opacity="0.9" transform="rotate(45 200 340)" />
                    <rect x="114" y="234" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 120 240)" />
                    <rect x="194" y="164" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 200 170)" />
                    <rect x="274" y="234" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 280 240)" />
                    {/* Pitcher mound */}
                    <circle cx="200" cy="255" r="5" fill="#8D6E63" opacity="0.8" />
                    {/* Foul lines */}
                    <line x1="200" y1="340" x2="10" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                    <line x1="200" y1="340" x2="390" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                    {/* Outfield arc */}
                    <path d="M10 140 A240 240 0 0 1 390 140" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                </svg>

                {/* Position markers */}
                {Object.entries(FIELD_COORDS).map(([posId, coords]) => {
                    const playerId = gamePositions[posId]
                    const player = playerId ? getPlayer(playerId) : null
                    const posInfo = POSITIONS.find(p => p.id === posId)

                    return (
                        <div
                            key={posId}
                            className="field-position"
                            style={{
                                top: coords.top,
                                left: coords.left,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            <div className={`field-position-dot ${player ? 'occupied' : ''}`}>
                                {player ? (
                                    <span className="text-white">{player.number || posId}</span>
                                ) : (
                                    <span className="text-text-muted">{posId}</span>
                                )}
                            </div>
                            <span className="field-position-label">{posInfo?.short}</span>
                            {player && (
                                <span className="field-position-name">{player.name.split(' ')[0]}</span>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    // Suggestion lineup state (for "Ver Jornadas" view)
    const [suggestedLineup, setSuggestedLineup] = useState(null) // { positions: {}, type: 'stellar' | 'everyone' }

    const handleShowSuggestion = (type) => {
        const lineup = type === 'stellar' ? stellarLineup : everyonePlaysLineup
        if (suggestedLineup?.type === type) {
            setSuggestedLineup(null) // Toggle off
        } else {
            setSuggestedLineup({ positions: lineup, type })
        }
        setSelectedGame(null)
    }

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Campo</h1>
                    <p className="text-text-muted text-sm mt-1">Visualiza y crea plantillas</p>
                </div>
                {viewMode === 'create' && (
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
                            <RotateCcw size={16} />
                            Limpiar
                        </button>
                        <button
                            onClick={handleSaveLineup}
                            disabled={Object.keys(positions).length === 0}
                            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Save size={16} />
                            {saved ? '¡Guardado!' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* View mode tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => { setViewMode('games'); setSelectedGame(null); setSuggestedLineup(null) }}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                        ${viewMode === 'games'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-white/5 text-text-muted border border-white/5 hover:bg-white/10'
                        }`}
                >
                    <Eye size={16} /> Ver Jornadas
                </button>
                <button
                    onClick={() => setViewMode('create')}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                        ${viewMode === 'create'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-white/5 text-text-muted border border-white/5 hover:bg-white/10'
                        }`}
                >
                    <PlusCircle size={16} /> Crear Plantilla
                </button>
            </div>

            {/* ===== GAMES VIEW ===== */}
            {viewMode === 'games' && (
                <div>
                    <div className="space-y-4">
                        {/* Suggestion buttons */}
                        {players.length >= 2 && (
                            <div className="flex flex-col sm:flex-row gap-3 mb-2">
                                <button
                                    onClick={() => handleShowSuggestion('stellar')}
                                    className={`flex-1 glass-card p-4 flex items-center gap-3 cursor-pointer transition-all group
                                            ${suggestedLineup?.type === 'stellar'
                                            ? 'border-yellow-500/40 bg-yellow-500/10 ring-1 ring-yellow-500/20'
                                            : 'hover:border-yellow-500/30'
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Crown size={20} className="text-yellow-400" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-white text-sm">Plantilla Estelar</div>
                                        <div className="text-xs text-text-muted">Los mejores en cada posición por promedio</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleShowSuggestion('everyone')}
                                    className={`flex-1 glass-card p-4 flex items-center gap-3 cursor-pointer transition-all group
                                            ${suggestedLineup?.type === 'everyone'
                                            ? 'border-green-500/40 bg-green-500/10 ring-1 ring-green-500/20'
                                            : 'hover:border-green-500/30'
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Users size={20} className="text-green-400" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-white text-sm">Todos Juegan</div>
                                        <div className="text-xs text-text-muted">Prioriza jugadores con menos tiempo</div>
                                    </div>
                                </button>
                                {players.length > 9 && (
                                    <button
                                        onClick={() => setShowTips(true)}
                                        className="sm:w-auto glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-blue-500/30 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <Lightbulb size={20} className="text-blue-400" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-white text-sm">Tips Rotación</div>
                                            <div className="text-xs text-text-muted">Cómo rotar para que jueguen todos</div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Suggested lineup preview */}
                        {suggestedLineup && (
                            <div className="animate-fade-in">
                                <div className="glass-card p-4 md:p-6 mb-4">
                                    <div className="text-center mb-4">
                                        <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                                            {suggestedLineup.type === 'stellar' ? (
                                                <><Crown size={20} className="text-yellow-400" /> Plantilla Estelar</>
                                            ) : (
                                                <><Users size={20} className="text-green-400" /> Todos Juegan</>
                                            )}
                                        </h2>
                                        <p className="text-text-muted text-xs mt-1">
                                            {suggestedLineup.type === 'stellar'
                                                ? 'Sugerencia basada en promedios de bateo'
                                                : 'Sugerencia para rotar a todos los jugadores'}
                                        </p>
                                    </div>

                                    {/* Reuse the field visualization */}
                                    <div className="field-container">
                                        <svg viewBox="0 0 400 400" className="w-full h-full" style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))' }}>
                                            <path d="M200 350 L60 200 A200 200 0 0 1 340 200 Z" fill="#2E7D32" opacity="0.3" />
                                            <path d="M200 350 L120 240 L200 170 L280 240 Z" fill="#4CAF50" opacity="0.15" />
                                            <line x1="120" y1="240" x2="200" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                                            <line x1="200" y1="170" x2="280" y2="240" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                                            <line x1="120" y1="240" x2="200" y2="340" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                                            <line x1="280" y1="240" x2="200" y2="340" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                                            <rect x="194" y="334" width="12" height="12" fill="white" opacity="0.9" transform="rotate(45 200 340)" />
                                            <rect x="114" y="234" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 120 240)" />
                                            <rect x="194" y="164" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 200 170)" />
                                            <rect x="274" y="234" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 280 240)" />
                                            <circle cx="200" cy="255" r="5" fill="#8D6E63" opacity="0.8" />
                                            <line x1="200" y1="340" x2="10" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                                            <line x1="200" y1="340" x2="390" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                                            <path d="M10 140 A240 240 0 0 1 390 140" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                                        </svg>

                                        {Object.entries(FIELD_COORDS).map(([posId, coords]) => {
                                            const playerId = suggestedLineup.positions[posId]
                                            const player = playerId ? getPlayer(playerId) : null
                                            const posInfo = POSITIONS.find(p => p.id === posId)

                                            return (
                                                <div
                                                    key={posId}
                                                    className="field-position"
                                                    style={{
                                                        top: coords.top,
                                                        left: coords.left,
                                                        transform: 'translate(-50%, -50%)',
                                                    }}
                                                >
                                                    <div className={`field-position-dot ${player ? 'occupied' : ''}`}>
                                                        {player ? (
                                                            <span className="text-white">{player.number || posId}</span>
                                                        ) : (
                                                            <span className="text-text-muted">{posId}</span>
                                                        )}
                                                    </div>
                                                    <span className="field-position-label">{posInfo?.short}</span>
                                                    {player && (
                                                        <span className="field-position-name">{player.name.split(' ')[0]}</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Suggested batting order */}
                                <div className="glass-card p-4 mb-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                                        <Users size={14} /> Orden de bateo sugerido
                                    </h3>
                                    <div className="space-y-1.5">
                                        {Object.entries(suggestedLineup.positions).map(([posId, playerId], idx) => {
                                            const player = getPlayer(playerId)
                                            if (!player) return null
                                            const posInfo = POSITIONS.find(p => p.id === posId)
                                            return (
                                                <div key={posId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-primary/15 text-primary"
                                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-blue-500/15 text-blue-300"
                                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {posInfo?.short || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-white truncate">
                                                            #{player.number} {player.name}
                                                        </div>
                                                        <div className="text-[10px] text-text-muted">
                                                            {posInfo?.label || 'Sin posición'}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {formatAvg(calcPlayerAvg(player))}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Bench players */}
                                {(() => {
                                    const assignedIds = Object.values(suggestedLineup.positions)
                                    const bench = players.filter(p => !assignedIds.includes(p.id))
                                    if (bench.length === 0) return null
                                    return (
                                        <div className="glass-card p-4 mb-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                                                🪑 Banca ({bench.length})
                                            </h3>
                                            <div className="space-y-1">
                                                {bench.map(player => (
                                                    <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/3">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold bg-white/10 text-text-muted"
                                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                            {player.number || '?'}
                                                        </div>
                                                        <span className="flex-1 text-sm text-text-muted truncate">{player.name}</span>
                                                        <span className="text-[10px] text-primary">{player.position}</span>
                                                        <span className="text-xs text-text-muted" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                            {formatAvg(calcPlayerAvg(player))}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Games list header */}
                        {games.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <Calendar size={48} className="mx-auto mb-4 text-text-muted/30" />
                                <p className="text-text-muted font-medium mb-2">
                                    No hay jornadas registradas.
                                </p>
                                <p className="text-text-muted text-sm">
                                    Crea una jornada desde la sección de Jornadas para ver la plantilla aquí.
                                </p>
                            </div>
                        ) : (
                            <>

                                {/* Game selector */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {games.map(game => {
                                        const isSelected = selectedGame?.id === game.id
                                        const result = (game.runsFor || 0) > (game.runsAgainst || 0) ? 'W' : (game.runsFor || 0) < (game.runsAgainst || 0) ? 'L' : '—'
                                        const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-text-muted'

                                        return (
                                            <button
                                                key={game.id}
                                                onClick={() => setSelectedGame(isSelected ? null : game)}
                                                className={`glass-card p-4 text-left transition-all duration-200 cursor-pointer
                                                ${isSelected
                                                        ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
                                                        : 'hover:border-white/15 hover:bg-white/5'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-text-muted">{game.date}</span>
                                                    <span className={`text-lg font-black ${resultColor}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {result}
                                                    </span>
                                                </div>
                                                <div className="font-semibold text-white text-sm">
                                                    {game.opponent ? `vs ${game.opponent}` : 'Jornada'}
                                                </div>
                                                <div className="text-primary font-bold text-lg mt-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {game.runsFor || 0}-{game.runsAgainst || 0}
                                                </div>
                                                <div className="text-[10px] text-text-muted mt-1">
                                                    {game.battingOrder?.length || 0} jugadores
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Selected game field display */}
                                {selectedGame && (
                                    <div className="animate-fade-in">
                                        <div className="glass-card p-4 md:p-6 mb-4">
                                            <div className="text-center mb-4">
                                                <h2 className="text-lg font-bold text-white">
                                                    {selectedGame.opponent ? `vs ${selectedGame.opponent}` : 'Jornada'}
                                                </h2>
                                                <p className="text-text-muted text-xs">{selectedGame.date}</p>
                                                <div className="text-2xl font-black text-primary mt-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {selectedGame.runsFor || 0} - {selectedGame.runsAgainst || 0}
                                                </div>
                                            </div>
                                            <GameFieldView game={selectedGame} />
                                        </div>

                                        {/* Batting order list */}
                                        <div className="glass-card p-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                                                <Users size={14} /> Orden al Bat
                                            </h3>
                                            <div className="space-y-1.5">
                                                {selectedGame.battingOrder?.map((pId, idx) => {
                                                    const player = getPlayer(pId)
                                                    if (!player) return null
                                                    const posInfo = POSITIONS.find(p => p.id === player.position)

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3"
                                                        >
                                                            <div
                                                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-primary/15 text-primary"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                                            >
                                                                {idx + 1}
                                                            </div>
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-blue-500/15 text-blue-300"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {posInfo?.short || '?'}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium text-white truncate">
                                                                    #{player.number} {player.name}
                                                                </div>
                                                                <div className="text-[10px] text-text-muted">
                                                                    {posInfo?.label || 'Sin posición'}
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {formatAvg(calcPlayerAvg(player))}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ===== CREATE MODE ===== */}
            {viewMode === 'create' && (
                <>
                    {/* Template buttons */}
                    {players.length >= 2 && (
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <button
                                onClick={applyStellarLineup}
                                className="flex-1 glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-yellow-500/30 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Crown size={20} className="text-yellow-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold text-white text-sm">Plantilla Estelar</div>
                                    <div className="text-xs text-text-muted">Los mejores en cada posición por promedio</div>
                                </div>
                            </button>
                            <button
                                onClick={applyEveryonePlays}
                                className="flex-1 glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-green-500/30 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Users size={20} className="text-green-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold text-white text-sm">Todos Juegan</div>
                                    <div className="text-xs text-text-muted">Prioriza jugadores con menos tiempo en campo</div>
                                </div>
                            </button>
                            {players.length > 9 && (
                                <button
                                    onClick={() => setShowTips(true)}
                                    className="sm:w-auto glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-blue-500/30 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Lightbulb size={20} className="text-blue-400" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-white text-sm">Tips Rotación</div>
                                        <div className="text-xs text-text-muted">Cómo rotar para que jueguen todos</div>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Lineup info */}
                    <div className="glass-card p-5 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Nombre de alineación</label>
                                <input
                                    type="text"
                                    value={lineupName}
                                    onChange={e => setLineupName(e.target.value)}
                                    className="input-field"
                                    placeholder="Ej: Jornada 5"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Fecha</label>
                                <input
                                    type="date"
                                    value={lineupDate}
                                    onChange={e => setLineupDate(e.target.value)}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Rival</label>
                                <input
                                    type="text"
                                    value={opponent}
                                    onChange={e => setOpponent(e.target.value)}
                                    className="input-field"
                                    placeholder="Nombre del equipo rival"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Field */}
                        <div className="lg:col-span-2">
                            <div className="glass-card p-4 md:p-6">
                                <BaseballField
                                    positions={positions}
                                    onPositionClick={handlePositionClick}
                                />
                            </div>
                        </div>

                        {/* Sidebar: Positions + Bench */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">Posiciones asignadas</h2>
                            {POSITIONS.filter(p => p.id !== 'DH').map(pos => {
                                const playerId = positions[pos.id]
                                const player = playerId ? players.find(p => p.id === playerId) : null
                                return (
                                    <div
                                        key={pos.id}
                                        className={`glass-card p-3 flex items-center gap-3 cursor-pointer transition-all duration-200
                      ${player ? 'border-primary/20' : 'opacity-60'}`}
                                        onClick={() => player ? handleRemoveFromPosition(pos.id) : handlePositionClick(pos.id)}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold
                      ${player ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-muted'}`}>
                                            {pos.short}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-text-muted">{pos.label}</div>
                                            <div className="text-sm font-medium text-white truncate">
                                                {player ? `#${player.number || '?'} ${player.name}` : 'Vacante'}
                                            </div>
                                        </div>
                                        {player && (
                                            <span className="text-xs font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {formatAvg(calcPlayerAvg(player))}
                                            </span>
                                        )}
                                        {player && (
                                            <span className="text-[10px] text-text-muted hover:text-red-400 transition-colors">✕</span>
                                        )}
                                    </div>
                                )
                            })}

                            {/* DH */}
                            {(() => {
                                const dhPlayer = positions['DH'] ? players.find(p => p.id === positions['DH']) : null
                                return (
                                    <div
                                        className={`glass-card p-3 flex items-center gap-3 cursor-pointer border-dashed
                      ${dhPlayer ? 'border-primary/20' : 'opacity-60'}`}
                                        onClick={() => dhPlayer ? handleRemoveFromPosition('DH') : handlePositionClick('DH')}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold
                      ${dhPlayer ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-muted'}`}>
                                            DH
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-text-muted">Bateador Designado</div>
                                            <div className="text-sm font-medium text-white truncate">
                                                {dhPlayer ? `#${dhPlayer.number || '?'} ${dhPlayer.name}` : 'Vacante'}
                                            </div>
                                        </div>
                                        {dhPlayer && (
                                            <span className="text-[10px] text-text-muted hover:text-red-400 transition-colors">✕</span>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Bench */}
                            {benchPlayers.length > 0 && Object.keys(positions).length > 0 && (
                                <div className="mt-6">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                                        <ArrowRightLeft size={14} />
                                        Banca ({benchPlayers.length})
                                    </h2>
                                    <div className="space-y-2">
                                        {benchPlayers
                                            .sort((a, b) => calcPlayerAvg(b) - calcPlayerAvg(a))
                                            .map(player => {
                                                const posInfo = POSITIONS.find(p => p.id === player.position)
                                                return (
                                                    <div
                                                        key={player.id}
                                                        className="glass-card p-3 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-xs font-bold text-text-muted" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {player.number || '?'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium text-white truncate">{player.name}</div>
                                                            <div className="text-[10px] text-text-muted">
                                                                {posInfo?.short}
                                                                {player.secondaryPosition && ` / ${player.secondaryPosition}`}
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-text-muted" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                            {formatAvg(calcPlayerAvg(player))}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Player selection modal */}
            <Modal
                isOpen={showPlayerSelect}
                onClose={() => { setShowPlayerSelect(false); setSelectedPos(null) }}
                title={`Seleccionar jugador para ${selectedPos}`}
            >
                {availablePlayers.length === 0 ? (
                    <p className="text-text-muted text-center py-6">
                        No hay jugadores disponibles. Agrega jugadores desde el Roster.
                    </p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {[...availablePlayers]
                            .sort((a, b) => calcPlayerAvg(b) - calcPlayerAvg(a))
                            .map(player => {
                                const posInfo = POSITIONS.find(p => p.id === player.position)
                                const isMatchingPos = player.position === selectedPos || player.secondaryPosition === selectedPos
                                return (
                                    <button
                                        key={player.id}
                                        onClick={() => handleAssignPlayer(player.id)}
                                        className={`w-full p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 text-left
                      ${isMatchingPos
                                                ? 'bg-primary/10 border-primary/20 hover:bg-primary/15'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {player.number || '?'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white text-sm truncate">{player.name}</div>
                                            <div className="text-xs text-text-muted">
                                                {posInfo?.label || player.position}
                                                {player.secondaryPosition && ` / ${player.secondaryPosition}`}
                                                {isMatchingPos && <span className="text-primary ml-1">★ posición natural</span>}
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {formatAvg(calcPlayerAvg(player))}
                                        </span>
                                    </button>
                                )
                            })}
                    </div>
                )}
            </Modal>

            {/* Rotation Tips modal */}
            <Modal
                isOpen={showTips}
                onClose={() => setShowTips(false)}
                title="💡 Tips de Rotación"
            >
                {rotationTips && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {rotationTips.map((tip, i) => (
                            <div
                                key={i}
                                className={`p-3 rounded-xl text-sm ${tip.startsWith('  •')
                                    ? 'bg-primary/10 text-white border border-primary/15 ml-2'
                                    : tip.startsWith('💡') || tip.startsWith('🔄')
                                        ? 'bg-blue-500/10 text-blue-300 border border-blue-500/15 font-medium'
                                        : 'bg-white/5 text-text-muted'
                                    }`}
                            >
                                {tip}
                            </div>
                        ))}
                        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/15 text-sm">
                            <div className="font-semibold text-yellow-400 mb-2">📋 Regla general:</div>
                            <p className="text-yellow-200/80">
                                Sin límite de cambios, la clave es planificar antes del juego quién entra en qué inning.
                                Manten a los mejores bateadores cuando la situación es apretada, y rota en el campo
                                cuando lleves ventaja. El outfield (LF, RF) es donde más fácil se meten jugadores de banca.
                            </p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
