import React, { useState } from 'react'
import { useData, POSITIONS, PLATE_APPEARANCE_IDS, OUT_EVENT_IDS, EVENT_TYPES, calcPlayerAvg, formatAvg, getPlayerAssignedPosition } from '../utils/DataContext'
import Modal from '../components/Modal'
import { Plus, Trash2, ChevronDown, ChevronUp, Calendar, Shield, Swords, X, Users, ArrowUp, ArrowDown, Lightbulb, Crown } from 'lucide-react'

const QUICK_PA_EVENTS = [
    { id: 'single', label: 'Hit', emoji: '🟢', tone: 'success' },
    { id: 'homerun', label: 'HR', emoji: '💥', tone: 'warning' },
    { id: 'groundout', label: 'Out', emoji: '⚪', tone: 'neutral' },
    { id: 'strikeout', label: 'Ponche', emoji: '❌', tone: 'danger' },
]

const EVENT_INFO_OVERRIDES = {
    single: { label: 'Hit', emoji: '🟢' },
    homerun: { label: 'Home Run', emoji: '💥' },
    groundout: { label: 'Out', emoji: '⚪' },
    strikeout: { label: 'Ponche', emoji: '❌' },
    run: { label: 'Hizo carrera', emoji: '🏃' },
}

export default function GamesPage() {
    const { players, games, lineups, addGame, updateGame, deleteGame, addGameEvent, deleteGameEvent, getPlayer } = useData()
    const [expandedGame, setExpandedGame] = useState(null)
    const [showNewGame, setShowNewGame] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    // Current inning and half for expanded game
    const [activeInning, setActiveInning] = useState(1)
    const [activeHalf, setActiveHalf] = useState('defense') // defense first (Top), then offense (Bottom)

    // Substitution modal
    const [showSubModal, setShowSubModal] = useState(null) // gameId | null
    const [subPlayerOut, setSubPlayerOut] = useState('')
    const [subPlayerIn, setSubPlayerIn] = useState('')

    // ===== NEW GAME FORM =====
    const [newGameForm, setNewGameForm] = useState({
        date: new Date().toISOString().split('T')[0],
        opponent: '',
        innings: 7,
        notes: '',
        lineupId: null,
    })
    const [battingOrderDraft, setBattingOrderDraft] = useState([])
    const [positionsDraft, setPositionsDraft] = useState({})
    const [gameStep, setGameStep] = useState(1) // 1=info, 2=batting order

    const availableForBatting = players.filter(p => !battingOrderDraft.includes(p.id))
    const getPositionShort = (positionId) => POSITIONS.find(position => position.id === positionId)?.short || positionId || ''
    const getPositionLabel = (positionId) => POSITIONS.find(position => position.id === positionId)?.label || positionId || 'Sin posición'

    const handleCreateGame = async () => {
        if (battingOrderDraft.length < 1) return

        await addGame({
            ...newGameForm,
            battingOrder: battingOrderDraft,
            playerPositions: positionsDraft,
            currentBatterIndex: 0,
            runsFor: 0,
            runsAgainst: 0,
        })
        setNewGameForm({ date: new Date().toISOString().split('T')[0], opponent: '', innings: 7, notes: '', lineupId: null })
        setBattingOrderDraft([])
        setPositionsDraft({})
        setGameStep(1)
        setShowNewGame(false)
    }

    const addToBattingOrder = (playerId) => {
        setBattingOrderDraft(prev => [...prev, playerId])
        setPositionsDraft(prev => ({ ...prev, [playerId]: players.find(p => p.id === playerId)?.position || 'P' }))
    }

    const removeFromBattingOrder = (index) => {
        setBattingOrderDraft(prev => {
            const arr = [...prev]
            const idRemoved = arr.splice(index, 1)[0]
            setPositionsDraft(pos => {
                const newPos = { ...pos }
                delete newPos[idRemoved]
                return newPos
            })
            return arr
        })
    }

    const moveBatter = (index, direction) => {
        setBattingOrderDraft(prev => {
            const arr = [...prev]
            const newIndex = index + direction
            if (newIndex < 0 || newIndex >= arr.length) return arr
                ;[arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]
            return arr
        })
    }

    const handleStellarLineup = () => {
        // Composite score: AVG * 0.4 + OBP * 0.3 + SLG * 0.3
        const scored = players.map(p => {
            const s = p.stats || {}
            const ab = s.atBats || 0
            const hits = s.hits || 0
            const walks = s.walks || 0
            const doubles = s.doubles || 0
            const triples = s.triples || 0
            const hr = s.homeRuns || 0
            const singles = hits - doubles - triples - hr
            const pa = ab + walks
            const avg = ab > 0 ? hits / ab : 0
            const obp = pa > 0 ? (hits + walks) / pa : 0
            const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + hr * 4) / ab : 0
            const score = avg * 0.4 + obp * 0.3 + slg * 0.3
            return { ...p, _score: score }
        })
        const sorted = scored.sort((a, b) => b._score - a._score)
        const draftIds = sorted.slice(0, 9).map(p => p.id)
        setBattingOrderDraft(draftIds)

        const posDraft = {}
        draftIds.forEach(id => {
            posDraft[id] = players.find(p => p.id === id)?.position || 'P'
        })
        setPositionsDraft(posDraft)
    }

    const handleEveryoneLineup = () => {
        // Prioritize players with fewest games and at-bats (give everyone a chance)
        const sorted = [...players].sort((a, b) => {
            const gamesA = a.stats?.gamesPlayed || 0
            const gamesB = b.stats?.gamesPlayed || 0
            if (gamesA !== gamesB) return gamesA - gamesB
            return (a.stats?.atBats || 0) - (b.stats?.atBats || 0)
        })
        const draftIds = sorted.map(p => p.id)
        setBattingOrderDraft(draftIds)

        const posDraft = {}
        draftIds.forEach(id => {
            posDraft[id] = players.find(p => p.id === id)?.position || 'P'
        })
        setPositionsDraft(posDraft)
    }

    // ===== GAME EVENT HANDLERS =====

    const handlePAEvent = async (gameId, eventType) => {
        const game = games.find(g => g.id === gameId)
        if (!game || !game.battingOrder?.length) return

        const currentIdx = game.currentBatterIndex || 0
        const playerId = game.battingOrder[currentIdx % game.battingOrder.length]

        // Record the event with the current batter's ID
        await addGameEvent(gameId, {
            inning: activeInning,
            half: 'offense',
            eventType,
            playerId,
        })

        // Advance to next batter
        const nextIdx = currentIdx + 1
        await updateGame(gameId, {
            currentBatterIndex: nextIdx,
            ...(eventType === 'homerun' ? { runsFor: (game.runsFor || 0) + 1 } : {}),
        })
    }

    const handleDefenseEvent = async (gameId, eventType) => {
        await addGameEvent(gameId, {
            inning: activeInning,
            half: 'defense',
            eventType,
        })

        if (eventType === 'opponent_run') {
            const game = games.find(g => g.id === gameId)
            if (game) {
                await updateGame(gameId, { runsAgainst: (game.runsAgainst || 0) + 1 })
            }
        }
    }

    // Quick error — one tap to record error for a specific player
    const handleQuickError = async (gameId, playerId) => {
        await addGameEvent(gameId, {
            inning: activeInning,
            half: 'defense',
            eventType: 'fielding_error',
            playerId,
        })
    }

    const handlePlayerEvent = async (gameId, eventType, playerId) => {
        await addGameEvent(gameId, {
            inning: activeInning,
            half: 'offense',
            eventType,
            playerId,
        })

        // If it's a run scored, auto-increment runsFor
        if (eventType === 'run') {
            const game = games.find(g => g.id === gameId)
            if (game) {
                await updateGame(gameId, { runsFor: (game.runsFor || 0) + 1 })
            }
        }
    }

    const handleDeleteEvent = async (gameId, event) => {
        await deleteGameEvent(gameId, event.id)
        // If it was a scored run, decrement
        if (event.eventType === 'run' && event.half === 'offense') {
            const game = games.find(g => g.id === gameId)
            if (game && game.runsFor > 0) {
                await updateGame(gameId, { runsFor: game.runsFor - 1 })
            }
        }
        if (event.eventType === 'homerun' && event.half === 'offense') {
            const game = games.find(g => g.id === gameId)
            if (game && game.runsFor > 0) {
                await updateGame(gameId, { runsFor: game.runsFor - 1 })
            }
        }
        if (event.eventType === 'opponent_run') {
            const game = games.find(g => g.id === gameId)
            if (game && game.runsAgainst > 0) {
                await updateGame(gameId, { runsAgainst: game.runsAgainst - 1 })
            }
        }
    }

    // ===== SUBSTITUTION HANDLER =====
    const handleSubstitution = async () => {
        if (!showSubModal || !subPlayerOut || !subPlayerIn) return
        const game = games.find(g => g.id === showSubModal)
        if (!game) return

        // Replace player in batting order
        const newOrder = (game.battingOrder || []).map(id => id === subPlayerOut ? subPlayerIn : id)
        const currentPositionId = getPlayerAssignedPosition(game, subPlayerOut, players)
        const newPositions = { ...game.positions || {} }
        if (currentPositionId && newPositions[currentPositionId] === subPlayerOut) {
            newPositions[currentPositionId] = subPlayerIn
        }
        const newPlayerPositions = { ...(game.playerPositions || {}) }
        const outgoingAssignment = newPlayerPositions[subPlayerOut] || currentPositionId
        delete newPlayerPositions[subPlayerOut]
        if (outgoingAssignment) {
            newPlayerPositions[subPlayerIn] = outgoingAssignment
        }

        await addGameEvent(showSubModal, {
            inning: activeInning,
            half: activeHalf,
            eventType: 'substitution',
            playerId: subPlayerIn,
            replacedPlayerId: subPlayerOut,
        })
        await updateGame(showSubModal, {
            battingOrder: newOrder,
            positions: newPositions,
            playerPositions: newPlayerPositions,
        })

        setShowSubModal(null)
        setSubPlayerOut('')
        setSubPlayerIn('')
    }

    const toggleExpand = (gameId) => {
        if (expandedGame === gameId) {
            setExpandedGame(null)
        } else {
            setExpandedGame(gameId)
            setActiveInning(1)
            setActiveHalf('defense')
        }
    }

    // Get events for a specific inning + half
    const getHalfEvents = (game, inning, half) => {
        return (game.events || []).filter(e => e.inning === inning && (e.half || 'offense') === half)
    }

    // Count outs in a half-inning
    const countOuts = (game, inning, half) => {
        return getHalfEvents(game, inning, half).filter(e => OUT_EVENT_IDS.includes(e.eventType)).length
    }

    // Helper to get event info
    const getEventInfo = (eventType) => EVENT_INFO_OVERRIDES[eventType] || EVENT_TYPES.find(e => e.id === eventType) || { label: eventType, emoji: '❓' }

    const sortedGames = [...games].sort((a, b) => new Date(b.date) - new Date(a.date))

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Jornadas</h1>
                    <p className="text-text-muted text-sm mt-1">Registro de juegos por innings</p>
                </div>
                <button onClick={() => {
                    setShowNewGame(true)
                    setGameStep(1)
                    setBattingOrderDraft([])
                    setPositionsDraft({})
                    setNewGameForm({ date: new Date().toISOString().split('T')[0], opponent: '', innings: 7, notes: '', lineupId: null })
                }} className="btn-primary flex items-center gap-2 w-fit">
                    <Plus size={18} /> Nueva Jornada
                </button>
            </div>

            {/* Games list */}
            {games.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <Calendar size={48} className="mx-auto mb-4 text-text-muted/30" />
                    <p className="text-text-muted font-medium">No hay jornadas. ¡Crea tu primera!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedGames.map(game => {
                        const isExpanded = expandedGame === game.id
                        const isWin = game.runsFor > game.runsAgainst
                        const isLoss = game.runsFor < game.runsAgainst
                        const totalInnings = game.innings || 7

                        return (
                            <div key={game.id} className="glass-card overflow-hidden animate-slide-up">
                                {/* Header */}
                                <div className="p-5 cursor-pointer hover:bg-white/3 transition-colors" onClick={() => toggleExpand(game.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm
                                            ${isWin ? 'bg-green-500/15 text-green-400' : isLoss ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-text-muted'}`}>
                                            {isWin ? 'W' : isLoss ? 'L' : '—'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-white">{game.opponent ? `vs ${game.opponent}` : 'Jornada'}</span>
                                                <span className="text-2xl font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {game.runsFor}-{game.runsAgainst}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                                                <span>{game.date}</span>
                                                <span>{(game.events || []).length} eventos</span>
                                                <span>{game.battingOrder?.length || 0} bateadores</span>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
                                    </div>
                                </div>

                                {/* Expanded game detail */}
                                {isExpanded && (
                                    <div className="border-t border-white/5">
                                        {/* Scoreboard */}
                                        <div className="p-4 bg-white/3">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                                    <span className="text-2xl font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {game.runsFor}
                                                    </span>
                                                    <span>Deprecados</span>
                                                </div>
                                                <span className="text-xs text-text-muted">VS</span>
                                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                                    <span>{game.opponent || 'Rival'}</span>
                                                    <span className="text-2xl font-black text-text-muted" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {game.runsAgainst}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Inning tabs */}
                                        <div className="flex gap-1 px-4 py-3 overflow-x-auto border-b border-white/5">
                                            {Array.from({ length: totalInnings }, (_, i) => i + 1).map(inn => {
                                                const hasEvents = (game.events || []).some(e => e.inning === inn)
                                                return (
                                                    <button
                                                        key={inn}
                                                        onClick={() => setActiveInning(inn)}
                                                        className={`min-w-[40px] h-10 rounded-lg text-sm font-bold transition-all flex-shrink-0
                                                            ${activeInning === inn
                                                                ? 'bg-primary text-white'
                                                                : hasEvents
                                                                    ? 'bg-white/10 text-white hover:bg-white/15'
                                                                    : 'bg-white/5 text-text-muted hover:bg-white/10'}`}
                                                    >
                                                        {inn}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Half selector */}
                                        <div className="flex gap-2 px-4 py-3 border-b border-white/5">
                                            <button
                                                onClick={() => setActiveHalf('defense')}
                                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all
                                                    ${activeHalf === 'defense'
                                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                        : 'bg-white/5 text-text-muted hover:bg-white/10 border border-transparent'}`}
                                            >
                                                <Shield size={16} /> Defensa
                                                {(() => {
                                                    const outs = countOuts(game, activeInning, 'defense')
                                                    return outs > 0 ? <span className="text-xs opacity-70">({outs} out{outs > 1 ? 's' : ''})</span> : null
                                                })()}
                                            </button>
                                            <button
                                                onClick={() => setActiveHalf('offense')}
                                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all
                                                    ${activeHalf === 'offense'
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : 'bg-white/5 text-text-muted hover:bg-white/10 border border-transparent'}`}
                                            >
                                                <Swords size={16} /> Ataque
                                                {(() => {
                                                    const outs = countOuts(game, activeInning, 'offense')
                                                    return outs > 0 ? <span className="text-xs opacity-70">({outs} out{outs > 1 ? 's' : ''})</span> : null
                                                })()}
                                            </button>
                                        </div>

                                        {/* OFFENSE VIEW */}
                                        {activeHalf === 'offense' && (
                                            <div className="p-4">
                                                {game.battingOrder?.length > 0 ? (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        {/* Batting order */}
                                                        <div>
                                                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                                                                <Swords size={14} className="text-red-400" /> Orden al Bat
                                                            </h3>
                                                            <div className="space-y-1.5">
                                                                {game.battingOrder.map((pId, idx) => {
                                                                    const player = getPlayer(pId)
                                                                    if (!player) return null
                                                                    const isCurrent = idx === (game.currentBatterIndex % game.battingOrder.length)
                                                                    const assignedPosition = getPlayerAssignedPosition(game, pId, players)
                                                                    const posInfo = POSITIONS.find(p => p.id === assignedPosition) || POSITIONS.find(p => p.id === player.position)

                                                                    // Check what happened to this batter in this inning
                                                                    const batEvents = getHalfEvents(game, activeInning, 'offense')
                                                                        .filter(e => e.playerId === pId && PLATE_APPEARANCE_IDS.includes(e.eventType))

                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className={`flex items-center gap-3 p-2.5 rounded-xl transition-all
                                                                                ${isCurrent ? 'bg-primary/15 border border-primary/30 ring-1 ring-primary/20' : 'bg-white/3'}`}
                                                                        >
                                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black
                                                                                ${isCurrent ? 'bg-primary text-white' : 'bg-white/10 text-text-muted'}`}
                                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                                {idx + 1}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className={`text-sm font-medium truncate ${isCurrent ? 'text-white' : 'text-white/70'}`}>
                                                                                    #{player.number} {player.name}
                                                                                </div>
                                                                                <div className="text-[10px] text-text-muted">{getPositionShort(assignedPosition || player.position)} · {formatAvg(calcPlayerAvg(player))}</div>
                                                                            </div>
                                                                            {isCurrent && (
                                                                                <span className="text-xs font-bold text-primary animate-pulse">AL BAT</span>
                                                                            )}
                                                                            {batEvents.length > 0 && (
                                                                                <div className="flex gap-1">
                                                                                    {batEvents.map((e, i) => {
                                                                                        const info = getEventInfo(e.eventType)
                                                                                        return (
                                                                                            <span key={i} className="text-sm" title={info.label}>
                                                                                                {info.emoji}
                                                                                            </span>
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Event buttons */}
                                                        <div>
                                                            {/* Current batter info */}
                                                            {(() => {
                                                                const cIdx = game.currentBatterIndex % (game.battingOrder?.length || 1)
                                                                const currentBatter = getPlayer(game.battingOrder?.[cIdx])
                                                                const outsInInning = countOuts(game, activeInning, 'offense')
                                                                const assignedPositionId = currentBatter ? getPlayerAssignedPosition(game, currentBatter.id, players) : ''

                                                                return (
                                                                    <div className="mb-4">
                                                                        {currentBatter && (
                                                                            <div className="glass-card p-4 border-primary/20 mb-3">
                                                                                <div className="text-[10px] text-text-muted uppercase tracking-wider">Al bat</div>
                                                                                <div className="text-lg font-bold text-white">
                                                                                    #{currentBatter.number} {currentBatter.name}
                                                                                </div>
                                                                                <div className="text-xs text-text-muted">
                                                                                    {getPositionLabel(assignedPositionId || currentBatter.position)} · AVG: {formatAvg(calcPlayerAvg(currentBatter))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Outs indicator */}
                                                                        <div className="flex items-center gap-2 mb-4">
                                                                            <span className="text-xs text-text-muted font-medium">Outs:</span>
                                                                            {[0, 1, 2].map(i => (
                                                                                <div key={i} className={`w-4 h-4 rounded-full ${i < outsInInning ? 'bg-red-500' : 'bg-white/10'}`} />
                                                                            ))}
                                                                            {outsInInning >= 3 && (
                                                                                <span className="text-xs text-red-400 font-bold ml-2">¡3 Outs!</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })()}

                                                            {/* PA event buttons */}
                                                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Resultado rápido del turno</h4>
                                                            <div className="grid grid-cols-2 gap-1.5 mb-4 sm:grid-cols-4">
                                                                {QUICK_PA_EVENTS.map(evt => (
                                                                    <button
                                                                        key={evt.id}
                                                                        onClick={() => handlePAEvent(game.id, evt.id)}
                                                                        className={`p-2 rounded-lg text-xs font-medium transition-all text-center
                                                                            ${evt.tone === 'danger'
                                                                                ? 'bg-red-500/10 text-red-300 border border-red-500/15 hover:bg-red-500/20'
                                                                                : evt.tone === 'warning'
                                                                                    ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/15 hover:bg-yellow-500/20'
                                                                                : evt.tone === 'neutral'
                                                                                    ? 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
                                                                                    : 'bg-green-500/10 text-green-300 border border-green-500/15 hover:bg-green-500/20'
                                                                            }`}
                                                                    >
                                                                        <span className="text-base">{evt.emoji}</span>
                                                                        <div className="mt-0.5">{evt.label}</div>
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            {/* Substitution button */}
                                                            <button
                                                                onClick={() => { setShowSubModal(game.id); setSubPlayerOut(''); setSubPlayerIn('') }}
                                                                className="w-full mb-3 py-2 px-3 rounded-xl text-sm font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                🔄 Cambio de Jugador
                                                            </button>

                                                            {/* Per-player stat buttons */}
                                                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 mt-2">Registrar carrera por jugador</h4>
                                                            <div className="space-y-1.5 mb-2">
                                                                {game.battingOrder?.map((pId, idx) => {
                                                                    const player = getPlayer(pId)
                                                                    if (!player) return null
                                                                    const assignedPosition = getPlayerAssignedPosition(game, pId, players)
                                                                    const posInfo = POSITIONS.find(p => p.id === assignedPosition) || POSITIONS.find(p => p.id === player.position)

                                                                    // Count stats for this player in this game
                                                                    const gameRuns = (game.events || []).filter(e => e.playerId === pId && e.eventType === 'run').length

                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className="flex flex-col gap-2 p-3 rounded-xl bg-white/3 border border-white/5"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black bg-primary/15 text-primary"
                                                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                                    {player.number || '?'}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0 flex justify-between items-center">
                                                                                    <div>
                                                                                        <div className="text-xs font-bold text-white truncate">
                                                                                            {player.name}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-text-muted">
                                                                                            {getPositionShort(assignedPosition || player.position)} · {formatAvg(calcPlayerAvg(player))}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-[10px] font-black text-right min-w-[50px]">
                                                                                        {gameRuns > 0 && <span className="text-green-400 block">{gameRuns} R</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 hide-scrollbar">
                                                                                <button
                                                                                    onClick={() => handlePlayerEvent(game.id, 'run', pId)}
                                                                                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-green-500/15 text-green-300 border border-green-500/20 hover:bg-green-500/30 transition-all flex items-center gap-1"
                                                                                    title="Registrar carrera anotada"
                                                                                >
                                                                                    🏃 Hizo carrera
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 text-text-muted text-sm">
                                                        <Users size={24} className="mx-auto mb-2 opacity-40" />
                                                        Este juego no tiene orden al bat configurado.
                                                    </div>
                                                )}

                                                {/* Inning events timeline */}
                                                {getHalfEvents(game, activeInning, 'offense').length > 0 && (
                                                    <div className="mt-4 border-t border-white/5 pt-4">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                                                            Jugadas del inning {activeInning} — Ataque
                                                        </h4>
                                                        <div className="space-y-1.5">
                                                            {getHalfEvents(game, activeInning, 'offense').map(event => {
                                                                const player = event.playerId ? getPlayer(event.playerId) : null
                                                                const replacedPlayer = event.replacedPlayerId ? getPlayer(event.replacedPlayerId) : null
                                                                const info = getEventInfo(event.eventType)
                                                                return (
                                                                    <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/3">
                                                                        <span className="text-sm">{info.emoji}</span>
                                                                        <span className="text-xs font-medium text-white flex-1">
                                                                            {event.eventType === 'substitution' && replacedPlayer
                                                                                ? <><span className="text-red-300">#{replacedPlayer.number} {replacedPlayer.name}</span><span className="text-text-muted mx-1">→</span><span className="text-green-300">#{player?.number} {player?.name}</span></>
                                                                                : <>{player ? `#${player.number} ${player.name}` : '—'} → {info.label}</>
                                                                            }
                                                                        </span>
                                                                        <button onClick={() => handleDeleteEvent(game.id, event)} className="p-1 text-text-muted hover:text-red-400 transition-colors">
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* DEFENSE VIEW */}
                                        {activeHalf === 'defense' && (
                                            <div className="p-4">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                                                    <Shield size={14} className="text-blue-400" /> Tu equipo en el campo
                                                </h3>

                                                {/* Players on defense with quick error buttons */}
                                                {game.battingOrder?.length > 0 ? (
                                                    <div className="space-y-1.5 mb-5">
                                                        {game.battingOrder.map((pId, idx) => {
                                                            const player = getPlayer(pId)
                                                            if (!player) return null
                                                            const assignedPosition = getPlayerAssignedPosition(game, pId, players)
                                                            const posInfo = POSITIONS.find(p => p.id === assignedPosition) || POSITIONS.find(p => p.id === player.position)

                                                            // Count errors for this player in this ENTIRE game
                                                            const gameErrors = (game.events || []).filter(
                                                                e => e.playerId === pId && e.eventType === 'fielding_error'
                                                            ).length

                                                            // Count errors in this specific inning
                                                            const inningErrors = getHalfEvents(game, activeInning, 'defense').filter(
                                                                e => e.playerId === pId && e.eventType === 'fielding_error'
                                                            ).length

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all
                                                                        ${inningErrors > 0 ? 'bg-red-500/10 border border-red-500/15' : 'bg-white/3'}`}
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black bg-blue-500/15 text-blue-300"
                                                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                        {getPositionShort(assignedPosition || posInfo?.short)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-medium text-white truncate">
                                                                            #{player.number} {player.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-text-muted">
                                                                            {getPositionLabel(assignedPosition || posInfo?.id)}
                                                                            {gameErrors > 0 && (
                                                                                <span className="text-red-400 font-bold ml-2">
                                                                                    {gameErrors} E en este juego
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Quick error button */}
                                                                    <button
                                                                        onClick={() => handleQuickError(game.id, pId)}
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/30 transition-all flex items-center gap-1"
                                                                        title="Registrar error defensivo"
                                                                    >
                                                                        🫣 Error
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 text-text-muted text-sm mb-5">
                                                        <Users size={24} className="mx-auto mb-2 opacity-40" />
                                                        No hay jugadores en el roster para esta jornada.
                                                    </div>
                                                )}

                                                {/* Substitution button – Defense */}
                                                <button
                                                    onClick={() => { setShowSubModal(game.id); setSubPlayerOut(''); setSubPlayerIn('') }}
                                                    className="w-full mb-4 py-2 px-3 rounded-xl text-sm font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all flex items-center justify-center gap-2"
                                                >
                                                    🔄 Cambio de Jugador
                                                </button>

                                                {/* General defense events */}
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                                                    Eventos generales
                                                </h4>
                                                <div className="grid grid-cols-1 gap-2 max-w-sm mb-5">
                                                    <button
                                                        onClick={() => handleDefenseEvent(game.id, 'opponent_run')}
                                                        className="p-3 rounded-xl text-sm font-medium bg-orange-500/10 text-orange-300 border border-orange-500/15 hover:bg-orange-500/20 transition-all text-center flex items-center justify-center gap-2"
                                                    >
                                                        <span className="text-xl">😡</span> Carrera del rival (+1 carrera en contra)
                                                    </button>
                                                </div>

                                                {/* Stats note */}
                                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-4">
                                                    <p className="text-[11px] text-blue-300/80">
                                                        <Shield size={12} className="inline mr-1 -mt-0.5" />
                                                        Los errores defensivos se registran automáticamente en las <strong>estadísticas individuales</strong> del jugador (columna <strong>E</strong> en Stats).
                                                    </p>
                                                </div>

                                                {/* Suggestions section */}
                                                {(() => {
                                                    // Find players not in the starting 9/batting order (i.e., bench)
                                                    const currentFielders = game.battingOrder || []
                                                    const bench = players.filter(p => !currentFielders.includes(p.id))

                                                    if (bench.length === 0) return null

                                                    // Sort bench by lowest total errors
                                                    const sortedBench = [...bench].sort((a, b) => (a.stats?.errors || 0) - (b.stats?.errors || 0))
                                                    const topSuggestions = sortedBench.slice(0, 3)

                                                    return (
                                                        <div className="mb-5 bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-3 flex items-center gap-2">
                                                                <Lightbulb size={12} /> Sugerencias desde la banca (Menos Errores)
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {topSuggestions.map(p => {
                                                                    const posInfo = POSITIONS.find(pos => pos.id === p.position)
                                                                    const secPosInfo = POSITIONS.find(pos => pos.id === p.secondaryPosition)
                                                                    return (
                                                                        <div key={p.id} className="flex justify-between items-center text-xs">
                                                                            <span className="font-semibold text-white">#{p.number} {p.name}</span>
                                                                            <div className="text-right">
                                                                                <span className="text-text-muted mr-3">
                                                                                    {posInfo?.short || '?'} {secPosInfo ? `/ ${secPosInfo.short}` : ''}
                                                                                </span>
                                                                                <span className="text-green-300 bg-green-500/10 px-2 py-0.5 rounded">
                                                                                    {p.stats?.errors || 0} E
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                                {getHalfEvents(game, activeInning, 'defense').length > 0 && (
                                                    <div className="border-t border-white/5 pt-4">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                                                            Inning {activeInning} — Defensa
                                                        </h4>
                                                        <div className="space-y-1.5">
                                                            {getHalfEvents(game, activeInning, 'defense').map(event => {
                                                                const player = event.playerId ? getPlayer(event.playerId) : null
                                                                const info = getEventInfo(event.eventType)
                                                                return (
                                                                    <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5">
                                                                        <span className="text-sm">{info.emoji}</span>
                                                                        <span className="text-xs font-medium text-white flex-1">
                                                                            {player ? `#${player.number} ${player.name} — ` : ''}{info.label}
                                                                        </span>
                                                                        <button onClick={() => handleDeleteEvent(game.id, event)} className="p-1 text-text-muted hover:text-red-400 transition-colors">
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer actions */}
                                        <div className="p-3 border-t border-white/5 flex flex-col gap-3">
                                            {activeInning >= totalInnings && (
                                                <button
                                                    onClick={() => { setExpandedGame(null) }}
                                                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary to-orange-600 border-none"
                                                >
                                                    <span className="text-xl">🏆</span> ¡Finalizar Jornada ({totalInnings} Inn)!
                                                </button>
                                            )}
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(game.id) }}
                                                    className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs flex items-center gap-1"
                                                >
                                                    <Trash2 size={14} /> Eliminar jornada
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                                }
                            </div>
                        )
                    })}
                </div>
            )
            }

            {/* ===== NEW GAME MODAL ===== */}
            <Modal
                isOpen={showNewGame}
                onClose={() => {
                    setShowNewGame(false)
                    setGameStep(1)
                    setBattingOrderDraft([])
                    setPositionsDraft({})
                    setNewGameForm({ date: new Date().toISOString().split('T')[0], opponent: '', innings: 7, notes: '', lineupId: null })
                }}
                title={gameStep === 1 ? 'Nueva Jornada' : 'Orden al Bat'}
            >
                {gameStep === 1 ? (
                    <div className="space-y-4">
                        {/* Load from existing lineup */}
                        {lineups?.length > 0 && (
                            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                                <label className="block text-xs font-medium text-blue-300 mb-2 uppercase tracking-wider">
                                    📋 Cargar Alineación Guardada
                                </label>
                                <select
                                    className="input-field text-sm"
                                    defaultValue=""
                                    onChange={e => {
                                        const lineup = lineups.find(l => l.id === e.target.value)
                                        if (!lineup) {
                                            setNewGameForm(prev => ({ ...prev, lineupId: null }))
                                            return
                                        }
                                        // Pre-fill game info from lineup
                                        setNewGameForm(prev => ({
                                            ...prev,
                                            opponent: lineup.opponent || prev.opponent,
                                            date: lineup.date || prev.date,
                                            lineupId: lineup.id,
                                        }))
                                        // Pre-fill batting order and positions
                                        if (lineup.battingOrder?.length > 0) {
                                            setBattingOrderDraft(lineup.battingOrder)
                                            setPositionsDraft(lineup.playerPositions || {})
                                        }
                                    }}
                                >
                                    <option value="">— Seleccionar alineación guardada —</option>
                                    {[...(lineups || [])].reverse().map(l => (
                                        <option key={l.id} value={l.id}>
                                            {l.name} {l.date ? `(${l.date})` : ''} {l.battingOrder?.length > 0 ? `· ${l.battingOrder.length} jug.` : ''}
                                        </option>
                                    ))}
                                </select>
                                {battingOrderDraft.length > 0 && (
                                    <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                                        ✓ {battingOrderDraft.length} jugadores cargados — puedes ajustarlos en el siguiente paso
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Fecha</label>
                            <input type="date" value={newGameForm.date} onChange={e => setNewGameForm(p => ({ ...p, date: e.target.value }))} className="input-field" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Rival</label>
                            <input type="text" value={newGameForm.opponent} onChange={e => setNewGameForm(p => ({ ...p, opponent: e.target.value }))} className="input-field" placeholder="Nombre del equipo rival" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Innings</label>
                            <input type="number" min="1" max="12" value={newGameForm.innings} onChange={e => setNewGameForm(p => ({ ...p, innings: parseInt(e.target.value) || 7 }))} className="input-field" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Notas</label>
                            <textarea value={newGameForm.notes} onChange={e => setNewGameForm(p => ({ ...p, notes: e.target.value }))} className="input-field" rows={2} placeholder="Notas opcionales..." />
                        </div>
                        <button onClick={() => setGameStep(2)} className="btn-primary w-full" disabled={players.length === 0}>
                            {battingOrderDraft.length > 0 ? `Siguiente → Revisar Orden al Bat (${battingOrderDraft.length} jug.)` : 'Siguiente → Orden al Bat'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Batting order */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                                    Alineación ({battingOrderDraft.length})
                                </label>
                            </div>

                            {/* Auto-fill buttons */}
                            <div className="flex gap-2 mb-3">
                                <button
                                    onClick={handleStellarLineup}
                                    className="flex-1 p-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <Crown size={14} /> Estrellas
                                </button>
                                <button
                                    onClick={handleEveryoneLineup}
                                    className="flex-1 p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <Users size={14} /> Todos Juegan
                                </button>
                            </div>

                            {battingOrderDraft.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-3 bg-white/3 rounded-xl">
                                    Selecciona jugadores de abajo para armar el orden al bat
                                </p>
                            ) : (
                                <div className="space-y-1 max-h-52 overflow-y-auto">
                                    {battingOrderDraft.map((pId, idx) => {
                                        const player = players.find(p => p.id === pId)
                                        if (!player) return null
                                        return (
                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/15">
                                                <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-black bg-primary text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {idx + 1}
                                                </span>
                                                <span className="flex-1 text-sm font-medium text-white truncate">
                                                    #{player.number} {player.name}
                                                </span>
                                                <select
                                                    value={positionsDraft[pId] || player.position || ''}
                                                    onChange={e => setPositionsDraft(prev => ({ ...prev, [pId]: e.target.value }))}
                                                    className="bg-white/5 text-[10px] text-primary border border-primary/20 rounded font-bold outline-none cursor-pointer py-1 px-1 appearance-none text-center hover:bg-white/10"
                                                >
                                                    {POSITIONS.map(pos => (
                                                        <option key={pos.id} value={pos.id} className="bg-surface text-white">
                                                            {pos.short}
                                                        </option>
                                                    ))}
                                                    <option value="BD" className="bg-surface text-white">BD</option>
                                                    <option value="Banca" className="bg-surface text-white">Banca</option>
                                                </select>
                                                <button onClick={() => moveBatter(idx, -1)} disabled={idx === 0} className="p-0.5 ml-1 text-text-muted hover:text-white disabled:opacity-20">
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button onClick={() => moveBatter(idx, 1)} disabled={idx === battingOrderDraft.length - 1} className="p-0.5 text-text-muted hover:text-white disabled:opacity-20">
                                                    <ArrowDown size={14} />
                                                </button>
                                                <button onClick={() => removeFromBattingOrder(idx)} className="p-0.5 text-text-muted hover:text-red-400">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Available players */}
                        {availableForBatting.length > 0 && (
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                                    Jugadores disponibles
                                </label>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {availableForBatting.map(player => (
                                        <button
                                            key={player.id}
                                            onClick={() => addToBattingOrder(player.id)}
                                            className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                                        >
                                            <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold bg-white/10 text-text-muted" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {player.number || '?'}
                                            </span>
                                            <span className="flex-1 text-sm text-white truncate">{player.name}</span>
                                            <span className="text-[10px] text-primary">{player.position}</span>
                                            <span className="text-[10px] text-text-muted">{formatAvg(calcPlayerAvg(player))}</span>
                                            <Plus size={14} className="text-text-muted" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setGameStep(1)} className="btn-secondary flex-1">← Atrás</button>
                            <button onClick={handleCreateGame} disabled={battingOrderDraft.length < 1} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                                Crear Jornada
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Substitution modal */}
            <Modal
                isOpen={!!showSubModal}
                onClose={() => { setShowSubModal(null); setSubPlayerOut(''); setSubPlayerIn('') }}
                title="🔄 Cambio de Jugador"
            >
                {showSubModal && (() => {
                    const game = games.find(g => g.id === showSubModal)
                    const currentRoster = (game?.battingOrder || []).map(id => getPlayer(id)).filter(Boolean)
                    const benchPlayers = players.filter(p => !(game?.battingOrder || []).includes(p.id))
                    return (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">🚪 Jugador que SALE</label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {currentRoster.map(player => (
                                        <button
                                            key={player.id}
                                            onClick={() => setSubPlayerOut(player.id)}
                                            className={`w-full flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${subPlayerOut === player.id
                                                ? 'bg-red-500/20 border border-red-500/30'
                                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                                }`}
                                        >
                                            <span className="text-xs font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{player.number || '?'}</span>
                                            <span className="flex-1 text-sm text-white">{player.name}</span>
                                            <span className="text-[10px] text-text-muted">{player.position}</span>
                                            {subPlayerOut === player.id && <span className="text-red-400 text-xs font-bold">SALE</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">🟢 Jugador que ENTRA (Banca)</label>
                                {benchPlayers.length === 0 ? (
                                    <p className="text-xs text-text-muted text-center py-4 bg-white/3 rounded-xl">No hay jugadores en banca disponibles.</p>
                                ) : (
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {benchPlayers.map(player => (
                                            <button
                                                key={player.id}
                                                onClick={() => setSubPlayerIn(player.id)}
                                                className={`w-full flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${subPlayerIn === player.id
                                                    ? 'bg-green-500/20 border border-green-500/30'
                                                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                                    }`}
                                            >
                                                <span className="text-xs font-bold text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{player.number || '?'}</span>
                                                <span className="flex-1 text-sm text-white">{player.name}</span>
                                                <span className="text-[10px] text-text-muted">{player.position}</span>
                                                {subPlayerIn === player.id && <span className="text-green-400 text-xs font-bold">ENTRA</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {subPlayerOut && subPlayerIn && (() => {
                                const out = getPlayer(subPlayerOut)
                                const inn = getPlayer(subPlayerIn)
                                return (
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-sm">
                                        <span className="text-red-300 font-bold">#{out?.number} {out?.name}</span>
                                        <span className="text-text-muted mx-2">→</span>
                                        <span className="text-green-300 font-bold">#{inn?.number} {inn?.name}</span>
                                    </div>
                                )
                            })()}

                            <button
                                onClick={handleSubstitution}
                                disabled={!subPlayerOut || !subPlayerIn}
                                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Confirmar Cambio
                            </button>
                        </div>
                    )
                })()}
            </Modal>

            {/* Delete confirmation */}
            <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Eliminar Jornada">
                <p className="text-text-muted mb-6">¿Estás seguro? Se eliminarán todos los eventos y stats asociados.</p>
                <div className="flex gap-3">
                    <button onClick={() => { deleteGame(deleteConfirm); setDeleteConfirm(null); setExpandedGame(null) }} className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700">Eliminar</button>
                    <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancelar</button>
                </div>
            </Modal>
        </div >
    )
}
