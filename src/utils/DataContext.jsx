import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiPlayers, apiLineups, apiGames, apiMigrate, apiHealth } from './api'

const DataContext = createContext()

const STORAGE_KEY = 'deprecados_data'

export const POSITIONS = [
    { id: 'P', label: 'Pitcher', short: 'P' },
    { id: 'C', label: 'Catcher', short: 'C' },
    { id: '1B', label: 'Primera Base', short: '1B' },
    { id: '2B', label: 'Segunda Base', short: '2B' },
    { id: '3B', label: 'Tercera Base', short: '3B' },
    { id: 'SS', label: 'Short Stop', short: 'SS' },
    { id: 'LF', label: 'Left Field', short: 'LF' },
    { id: 'CF', label: 'Center Field', short: 'CF' },
    { id: 'RF', label: 'Right Field', short: 'RF' },
    { id: 'DH', label: 'Bateador Designado', short: 'DH' },
]

// ===== EVENT TYPES =====
// Offensive plate appearances — auto-assigned to current batter, advances to next
export const OFFENSE_PA_EVENTS = [
    { id: 'single', label: 'Sencillo', emoji: '🟢', isOut: false },
    { id: 'double', label: 'Doble', emoji: '🟡', isOut: false },
    { id: 'triple', label: 'Triple', emoji: '🟠', isOut: false },
    { id: 'homerun', label: 'Home Run', emoji: '💥', isOut: false },
    { id: 'walk', label: 'Base por Bolas', emoji: '🚶', isOut: false },
    { id: 'hbp', label: 'Golpeado (HBP)', emoji: '😤', isOut: false },
    { id: 'strikeout', label: 'Ponche (K)', emoji: '❌', isOut: true },
    { id: 'groundout', label: 'Rodado Out', emoji: '⬇️', isOut: true },
    { id: 'flyout', label: 'Elevado Out', emoji: '⬆️', isOut: true },
    { id: 'popout', label: 'Fly Out', emoji: '🔵', isOut: true },
    { id: 'sacrifice', label: 'Sacrificio', emoji: '🎯', isOut: true },
    { id: 'reached_error', label: 'Error del rival', emoji: '😅', isOut: false },
]

// Offensive non-plate events — choose player manually
export const OFFENSE_EXTRA_EVENTS = [
    { id: 'run', label: 'Carrera Anotada', emoji: '🏃' },
    { id: 'rbi', label: 'Carrera Impulsada', emoji: '💪' },
    { id: 'stolenbase', label: 'Base Robada', emoji: '⚡' },
]

// Defensive events
export const DEFENSE_EVENTS = [
    { id: 'fielding_error', label: 'Error defensivo', emoji: '🫣' },
    { id: 'opponent_run', label: 'Carrera del rival', emoji: '😡' },
]

// All events flat for backwards compatibility
export const EVENT_TYPES = [
    ...OFFENSE_PA_EVENTS.map(e => ({ ...e, category: e.isOut ? 'out' : (['walk', 'hbp'].includes(e.id) ? 'walk' : 'hit'), isAtBat: !['walk', 'hbp', 'sacrifice'].includes(e.id) })),
    ...OFFENSE_EXTRA_EVENTS.map(e => ({ ...e, category: e.id === 'stolenbase' ? 'sb' : e.id, isAtBat: false })),
    ...DEFENSE_EVENTS.map(e => ({ ...e, category: 'defense', isAtBat: false })),
    { id: 'substitution', label: 'Cambio de jugador', emoji: '🔄', category: 'sub', isAtBat: false },
]

export const PLATE_APPEARANCE_IDS = OFFENSE_PA_EVENTS.map(e => e.id)
export const OUT_EVENT_IDS = OFFENSE_PA_EVENTS.filter(e => e.isOut).map(e => e.id)

export const FIELD_COORDS = {
    'P': { top: '58%', left: '50%' },
    'C': { top: '82%', left: '50%' },
    '1B': { top: '55%', left: '68%' },
    '2B': { top: '42%', left: '60%' },
    '3B': { top: '55%', left: '32%' },
    'SS': { top: '42%', left: '40%' },
    'LF': { top: '22%', left: '22%' },
    'CF': { top: '12%', left: '50%' },
    'RF': { top: '22%', left: '78%' },
}

const POSITION_ID_SET = new Set(POSITIONS.map(position => position.id))
const POSITION_ID_ORDER = POSITIONS.map(position => position.id)
const BENCH_ASSIGNMENTS = new Set(['Banca'])

const normalizeAssignmentValue = (value) => {
    if (typeof value !== 'string') return ''

    const normalized = value.trim()
    if (!normalized) return ''
    if (normalized === 'BD') return 'DH'

    return normalized
}

const normalizeStringMap = (value) => {
    if (!value || typeof value !== 'object') return {}

    return Object.entries(value).reduce((acc, [key, rawValue]) => {
        const normalizedValue = normalizeAssignmentValue(rawValue)
        if (!key || !normalizedValue) return acc
        acc[key] = normalizedValue
        return acc
    }, {})
}

export function normalizePlayerPositions(positions = {}, playerPositions = {}) {
    const explicitAssignments = normalizeStringMap(playerPositions)
    if (Object.keys(explicitAssignments).length > 0) return explicitAssignments

    const normalizedPositions = normalizeStringMap(positions)
    const looksLikeFieldMap = Object.keys(normalizedPositions).some(key => POSITION_ID_SET.has(key))
    if (!looksLikeFieldMap) return normalizedPositions

    return Object.entries(normalizedPositions).reduce((acc, [positionId, playerId]) => {
        if (POSITION_ID_SET.has(positionId) && playerId) {
            acc[playerId] = positionId
        }
        return acc
    }, {})
}

export function buildFieldPositionsFromAssignments(battingOrder = [], players = [], playerPositions = {}) {
    const normalizedAssignments = normalizeStringMap(playerPositions)
    const playerMap = new Map((players || []).map(player => [player.id, player]))
    const fieldPositions = {}
    const usedPositions = new Set()
    const placedPlayers = new Set()
    const orderedPlayers = (battingOrder || []).filter(Boolean)

    const placePlayer = (playerId, rawPositionId) => {
        const positionId = normalizeAssignmentValue(rawPositionId)
        if (!playerId || !POSITION_ID_SET.has(positionId) || usedPositions.has(positionId)) return false

        fieldPositions[positionId] = playerId
        usedPositions.add(positionId)
        placedPlayers.add(playerId)
        return true
    }

    orderedPlayers.forEach(playerId => {
        const assignment = normalizedAssignments[playerId]
        if (BENCH_ASSIGNMENTS.has(assignment)) return
        placePlayer(playerId, assignment)
    })

    orderedPlayers.forEach(playerId => {
        if (placedPlayers.has(playerId)) return

        const assignment = normalizedAssignments[playerId]
        if (BENCH_ASSIGNMENTS.has(assignment)) return

        const player = playerMap.get(playerId)
        if (placePlayer(playerId, player?.position)) return
        placePlayer(playerId, player?.secondaryPosition)
    })

    orderedPlayers.forEach(playerId => {
        if (placedPlayers.has(playerId)) return

        const assignment = normalizedAssignments[playerId]
        if (BENCH_ASSIGNMENTS.has(assignment)) return

        const openPosition = POSITION_ID_ORDER.find(positionId => !usedPositions.has(positionId))
        if (openPosition) {
            placePlayer(playerId, openPosition)
        }
    })

    return fieldPositions
}

export function normalizeFieldPositions(positions = {}, playerPositions = {}, battingOrder = [], players = []) {
    const normalizedPositions = normalizeStringMap(positions)
    const directFieldMap = Object.entries(normalizedPositions).reduce((acc, [positionId, playerId]) => {
        if (POSITION_ID_SET.has(positionId) && playerId) {
            acc[positionId] = playerId
        }
        return acc
    }, {})

    if (Object.keys(directFieldMap).length > 0) return directFieldMap

    const assignments = normalizePlayerPositions(positions, playerPositions)
    const orderedPlayers = (battingOrder || []).length > 0 ? battingOrder : Object.keys(assignments)
    return buildFieldPositionsFromAssignments(orderedPlayers, players, assignments)
}

export function normalizeRosterRecord(record = {}, players = []) {
    const battingOrder = record?.battingOrder || []
    const playerPositions = normalizePlayerPositions(record?.positions, record?.playerPositions)
    const positions = normalizeFieldPositions(record?.positions, playerPositions, battingOrder, players)

    return {
        ...record,
        positions,
        playerPositions: {
            ...Object.fromEntries(Object.entries(positions).map(([positionId, playerId]) => [playerId, positionId])),
            ...playerPositions,
        },
    }
}

export function countAssignedPositions(record = {}, players = []) {
    return Object.keys(
        normalizeFieldPositions(record?.positions, record?.playerPositions, record?.battingOrder || [], players)
    ).length
}

export function getPlayerAssignedPosition(record = {}, playerId, players = []) {
    if (!playerId) return ''

    const playerPositions = normalizePlayerPositions(record?.positions, record?.playerPositions)
    if (playerPositions[playerId]) return playerPositions[playerId]

    const positions = normalizeFieldPositions(record?.positions, playerPositions, record?.battingOrder || [], players)
    return Object.entries(positions).find(([, assignedPlayerId]) => assignedPlayerId === playerId)?.[0] || ''
}

export function calcPlayerAvg(player) {
    if (!player?.stats?.atBats || player.stats.atBats === 0) return 0
    return player.stats.hits / player.stats.atBats
}

export function formatAvg(val) {
    if (!val || val === 0) return '.000'
    return val.toFixed(3).replace(/^0/, '')
}

// Calculate composite score for star rating (1-5 stars)
export function calcPlayerScore(player) {
    const s = player?.stats || {}
    const ab = s.atBats || 0
    const hits = s.hits || 0
    const walks = s.walks || 0
    const doubles = s.doubles || 0
    const triples = s.triples || 0
    const hr = s.homeRuns || 0
    const singles = Math.max(0, hits - doubles - triples - hr)
    const pa = ab + walks
    const avg = ab > 0 ? hits / ab : 0
    const obp = pa > 0 ? (hits + walks) / pa : 0
    const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + hr * 4) / ab : 0
    const rawScore = avg * 0.5 + obp * 0.2 + slg * 0.3

    // Regress to a baseline so a tiny sample does not inflate the rating.
    const baselineScore = 0.24
    const sampleFactor = Math.min(ab / 25, 1)

    return baselineScore + (rawScore - baselineScore) * sampleFactor
}

export function calcPlayerStars(player) {
    const s = player?.stats || {}
    const ab = s.atBats || 0
    if (ab < 3) return 0 // Too little data to rate reliably

    const score = calcPlayerScore(player)
    let stars = 1

    if (score >= 0.38) stars = 5
    else if (score >= 0.32) stars = 4
    else if (score >= 0.26) stars = 3
    else if (score >= 0.20) stars = 2

    // Cap the ceiling until the player has a meaningful sample.
    const maxStarsBySample =
        ab >= 25 ? 5 :
            ab >= 15 ? 4 :
                ab >= 8 ? 3 :
                    2

    return Math.min(stars, maxStarsBySample)
}

export function StarRating({ stars, size = 14 }) {
    if (stars === 0) return <span className="text-[10px] text-text-muted italic">Sin datos</span>
    return (
        <span className="inline-flex gap-0.5" title={`${stars}/5 estrellas`}>
            {[1, 2, 3, 4, 5].map(i => (
                <span
                    key={i}
                    style={{ fontSize: size }}
                    className={i <= stars ? 'text-yellow-400' : 'text-white/10'}
                >
                    ★
                </span>
            ))}
        </span>
    )
}

export function DataProvider({ children }) {
    const [players, setPlayers] = useState([])
    const [lineups, setLineups] = useState([])
    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(true)
    const [dbReady, setDbReady] = useState(false)

    useEffect(() => { loadData() }, [])

    const normalizeRosterUpdates = useCallback((currentRecord, updates) => {
        const touchesRosterShape = ['battingOrder', 'positions', 'playerPositions'].some(key =>
            Object.prototype.hasOwnProperty.call(updates || {}, key)
        )

        if (!touchesRosterShape) return updates

        const normalized = normalizeRosterRecord({ ...(currentRecord || {}), ...(updates || {}) }, players)
        return {
            ...updates,
            battingOrder: normalized.battingOrder || [],
            positions: normalized.positions,
            playerPositions: normalized.playerPositions,
        }
    }, [players])

    const loadData = async () => {
        try {
            await apiHealth()
            setDbReady(true)

            const savedLocal = localStorage.getItem(STORAGE_KEY)
            if (savedLocal) {
                try {
                    const localData = JSON.parse(savedLocal)
                    if (localData.players?.length || localData.lineups?.length || localData.games?.length) {
                        await apiMigrate(localData)
                        localStorage.removeItem(STORAGE_KEY)
                    }
                } catch (migErr) { console.warn('Migration error:', migErr) }
            }

            const [p, l, g] = await Promise.all([
                apiPlayers.getAll(), apiLineups.getAll(), apiGames.getAll(),
            ])
            setPlayers(p)
            setLineups((l || []).map(lineup => normalizeRosterRecord(lineup, p)))
            setGames((g || []).map(game => normalizeRosterRecord(game, p)))
        } catch (err) {
            console.warn('API not available, using localStorage:', err.message)
            setDbReady(false)
            try {
                const saved = localStorage.getItem(STORAGE_KEY)
                if (saved) {
                    const data = JSON.parse(saved)
                    const localPlayers = data.players || []
                    setPlayers(localPlayers)
                    setLineups((data.lineups || []).map(lineup => normalizeRosterRecord(lineup, localPlayers)))
                    setGames((data.games || []).map(game => normalizeRosterRecord(game, localPlayers)))
                }
            } catch (e) { console.error('Error loading localStorage:', e) }
        } finally {
            setLoading(false)
        }
    }

    const saveLocal = useCallback((p, l, g) => {
        if (!dbReady) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: p || players, lineups: l || lineups, games: g || games }))
        }
    }, [dbReady, players, lineups, games])

    // ================== PLAYER CRUD ==================

    const _createLocalPlayer = (playerData) => {
        return { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), ...playerData, stats: { gamesPlayed: 0, atBats: 0, hits: 0, runs: 0, rbi: 0, homeRuns: 0, strikeouts: 0, walks: 0, stolenBases: 0, errors: 0, doubles: 0, triples: 0, ...(playerData.stats || {}) } }
    }

    const addPlayer = async (playerData) => {
        try {
            if (dbReady) {
                const p = await apiPlayers.create(playerData)
                setPlayers(prev => [...prev, p])
                return p
            }
        } catch (err) {
            console.warn('Firebase write failed, saving locally:', err.message)
        }
        // Fallback to localStorage
        const p = _createLocalPlayer(playerData)
        const np = [...players, p]; setPlayers(np); saveLocal(np); return p
    }

    const updatePlayer = async (id, updates) => {
        try {
            if (dbReady) {
                const u = await apiPlayers.update(id, updates)
                setPlayers(prev => prev.map(p => p.id === id ? u : p))
                return
            }
        } catch (err) {
            console.warn('Firebase update failed, saving locally:', err.message)
        }
        const np = players.map(p => p.id === id ? { ...p, ...updates } : p); setPlayers(np); saveLocal(np)
    }

    const deletePlayer = async (id) => {
        try {
            if (dbReady) await apiPlayers.delete(id)
        } catch (err) { console.warn('Firebase delete failed:', err.message) }
        const np = players.filter(p => p.id !== id); setPlayers(np); saveLocal(np)
    }

    const updatePlayerStats = async (id, stats) => {
        try {
            if (dbReady) {
                const u = await apiPlayers.updateStats(id, stats)
                setPlayers(prev => prev.map(p => p.id === id ? u : p))
                return
            }
        } catch (err) {
            console.warn('Firebase stats update failed, saving locally:', err.message)
        }
        const np = players.map(p => p.id === id ? { ...p, stats: { ...p.stats, ...stats } } : p); setPlayers(np); saveLocal(np)
    }

    const _compileStatsOffline = (currentGames, currentPlayers) => {
        const newStats = {}
        for (const p of currentPlayers) {
            newStats[p.id] = { gamesPlayed: 0, atBats: 0, hits: 0, runs: 0, rbi: 0, homeRuns: 0, strikeouts: 0, walks: 0, stolenBases: 0, errors: 0, doubles: 0, triples: 0 }
        }

        for (const g of currentGames) {
            const played = new Set()
            for (const e of (g.events || [])) {
                if (!e.playerId || !newStats[e.playerId]) continue
                played.add(e.playerId)
                const s = newStats[e.playerId]
                const type = e.eventType

                if (['single', 'double', 'triple', 'homerun'].includes(type)) s.hits++
                if (type === 'double') s.doubles++
                if (type === 'triple') s.triples++
                if (type === 'homerun') s.homeRuns++
                if (['walk', 'hbp'].includes(type)) s.walks++
                if (type === 'strikeout') s.strikeouts++
                if (['single', 'double', 'triple', 'homerun', 'strikeout', 'groundout', 'flyout', 'popout', 'reached_error'].includes(type)) s.atBats++

                if (type === 'run' || type === 'homerun') s.runs++
                if (type === 'rbi') s.rbi++
                if (type === 'stolenbase') s.stolenBases++
                if (type === 'fielding_error') s.errors++
            }
            played.forEach(pId => newStats[pId].gamesPlayed++)
        }

        return currentPlayers.map(p => {
            if (newStats[p.id]) {
                return { ...p, stats: { ...p.stats, ...newStats[p.id] } }
            }
            return p
        })
    }

    const compileAllStats = async () => {
        try {
            if (dbReady) {
                const up = await apiPlayers.compileStats()
                setPlayers(up)
                return up
            }
        } catch (err) { console.warn('Firebase compileStats failed, compiling locally:', err.message) }

        // Offline compiling fallback
        const updatedPlayers = _compileStatsOffline(games, players)
        setPlayers(updatedPlayers)
        saveLocal(updatedPlayers)
        return updatedPlayers
    }

    // ================== LINEUP CRUD ==================

    const addLineup = async (data) => {
        const payload = normalizeRosterRecord({
            name: '',
            date: new Date().toISOString().split('T')[0],
            opponent: '',
            positions: {},
            playerPositions: {},
            battingOrder: [],
            ...data,
        }, players)

        try {
            if (dbReady) {
                const l = normalizeRosterRecord(await apiLineups.create(payload), players)
                setLineups(prev => [l, ...prev]); return l
            }
        } catch (err) {
            console.warn('Firebase lineup create failed, saving locally:', err.message)
        }
        const l = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), ...payload }
        const nl = [...lineups, l]; setLineups(nl); saveLocal(undefined, nl); return l
    }

    const updateLineup = async (id, updates) => {
        const currentLineup = lineups.find(lineup => lineup.id === id)
        const normalizedUpdates = normalizeRosterUpdates(currentLineup, updates)

        try {
            if (dbReady) {
                const u = normalizeRosterRecord(await apiLineups.update(id, normalizedUpdates), players)
                setLineups(prev => prev.map(l => l.id === id ? u : l))
                return
            }
        } catch (err) { console.warn('Firebase lineup update failed, saving locally:', err.message) }
        const nl = lineups.map(l => l.id === id ? normalizeRosterRecord({ ...l, ...normalizedUpdates }, players) : l); setLineups(nl); saveLocal(undefined, nl)
    }

    const deleteLineup = async (id) => {
        try {
            if (dbReady) await apiLineups.delete(id)
        } catch (err) { console.warn('Firebase lineup delete failed:', err.message) }
        const nl = lineups.filter(l => l.id !== id); setLineups(nl); saveLocal(undefined, nl)
    }

    // ================== GAME CRUD ==================

    const addGame = async (data) => {
        const payload = normalizeRosterRecord({
            runsFor: 0,
            runsAgainst: 0,
            lineupId: null,
            notes: '',
            events: [],
            innings: 7,
            battingOrder: [],
            currentBatterIndex: 0,
            positions: {},
            playerPositions: {},
            ...data,
        }, players)

        try {
            if (dbReady) {
                const g = normalizeRosterRecord(await apiGames.create(payload), players)
                setGames(prev => [g, ...prev]); return g
            }
        } catch (err) { console.warn('Firebase game create failed, saving locally:', err.message) }
        const g = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), ...payload }
        const ng = [...games, g]; setGames(ng); saveLocal(undefined, undefined, ng); return g
    }

    const updateGame = async (id, updates) => {
        const currentGame = games.find(game => game.id === id)
        const normalizedUpdates = normalizeRosterUpdates(currentGame, updates)

        try {
            if (dbReady) {
                const u = normalizeRosterRecord(await apiGames.update(id, normalizedUpdates), players)
                setGames(prev => prev.map(g => g.id === id ? u : g))
                return
            }
        } catch (err) { console.warn('Firebase game update failed, saving locally:', err.message) }
        const ng = games.map(g => g.id === id ? normalizeRosterRecord({ ...g, ...normalizedUpdates }, players) : g); setGames(ng); saveLocal(undefined, undefined, ng)
    }

    const deleteGame = async (id) => {
        try {
            if (dbReady) await apiGames.delete(id)
        } catch (err) { console.warn('Firebase game delete failed:', err.message) }
        const ng = games.filter(g => g.id !== id); setGames(ng); saveLocal(undefined, undefined, ng)
    }

    const addGameEvent = async (gameId, eventData) => {
        try {
            if (dbReady) {
                const ug = await apiGames.addEvent(gameId, eventData)
                setGames(prev => prev.map(g => g.id === gameId ? normalizeRosterRecord(ug, players) : g))
                const fp = await apiPlayers.getAll()
                setPlayers(fp)
                return ug
            }
        } catch (err) { console.warn('Firebase addEvent failed, saving locally:', err.message) }
        const newEvent = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString(), inning: 1, half: 'offense', playerId: null, eventType: '', notes: '', ...eventData }
        const ng = games.map(g => g.id === gameId ? { ...g, events: [...(g.events || []), newEvent] } : g)
        setGames(ng)

        // Recompile stats locally
        const updatedPlayers = _compileStatsOffline(ng, players)
        setPlayers(updatedPlayers)

        saveLocal(updatedPlayers, undefined, ng)
        return newEvent
    }

    const deleteGameEvent = async (gameId, eventId) => {
        try {
            if (dbReady) {
                const ug = await apiGames.deleteEvent(gameId, eventId)
                setGames(prev => prev.map(g => g.id === gameId ? normalizeRosterRecord(ug, players) : g))
                const fp = await apiPlayers.getAll()
                setPlayers(fp)
                return ug
            }
        } catch (err) { console.warn('Firebase deleteEvent failed, saving locally:', err.message) }
        const ng = games.map(g => g.id === gameId ? { ...g, events: (g.events || []).filter(e => e.id !== eventId) } : g)
        setGames(ng)

        // Recompile stats locally
        const updatedPlayers = _compileStatsOffline(ng, players)
        setPlayers(updatedPlayers)

        saveLocal(updatedPlayers, undefined, ng)
    }

    const getPlayer = (id) => players.find(p => p.id === id)

    const value = {
        players, lineups, games, loading, dbReady,
        addPlayer, updatePlayer, deletePlayer, updatePlayerStats, getPlayer, compileAllStats,
        addLineup, updateLineup, deleteLineup,
        addGame, updateGame, deleteGame, addGameEvent, deleteGameEvent,
        refreshData: loadData,
    }

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
    const ctx = useContext(DataContext)
    if (!ctx) throw new Error('useData must be used within DataProvider')
    return ctx
}
