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
    const singles = hits - doubles - triples - hr
    const pa = ab + walks
    const avg = ab > 0 ? hits / ab : 0
    const obp = pa > 0 ? (hits + walks) / pa : 0
    const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + hr * 4) / ab : 0
    return avg * 0.4 + obp * 0.3 + slg * 0.3
}

export function calcPlayerStars(player) {
    const s = player?.stats || {}
    const ab = s.atBats || 0
    if (ab < 1) return 0 // No stars if no at-bats yet

    const score = calcPlayerScore(player)

    // Thresholds based on recreational/amateur baseball:
    // .400+ composite = 5 stars (elite)
    // .300-.399 = 4 stars (great)
    // .200-.299 = 3 stars (average)
    // .100-.199 = 2 stars (below average)
    // <.100 = 1 star
    if (score >= 0.400) return 5
    if (score >= 0.300) return 4
    if (score >= 0.200) return 3
    if (score >= 0.100) return 2
    return 1
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
            setLineups(l)
            setGames(g)
        } catch (err) {
            console.warn('API not available, using localStorage:', err.message)
            setDbReady(false)
            try {
                const saved = localStorage.getItem(STORAGE_KEY)
                if (saved) {
                    const data = JSON.parse(saved)
                    setPlayers(data.players || [])
                    setLineups(data.lineups || [])
                    setGames(data.games || [])
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

    const addPlayer = async (playerData) => {
        try {
            if (dbReady) {
                const p = await apiPlayers.create(playerData)
                setPlayers(prev => [...prev, p])
                return p
            } else {
                const p = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), ...playerData, stats: { gamesPlayed: 0, atBats: 0, hits: 0, runs: 0, rbi: 0, homeRuns: 0, strikeouts: 0, walks: 0, stolenBases: 0, errors: 0, doubles: 0, triples: 0 } }
                const np = [...players, p]; setPlayers(np); saveLocal(np); return p
            }
        } catch (err) { console.error('Error adding player:', err) }
    }

    const updatePlayer = async (id, updates) => {
        try {
            if (dbReady) {
                const u = await apiPlayers.update(id, updates)
                setPlayers(prev => prev.map(p => p.id === id ? u : p))
            } else {
                const np = players.map(p => p.id === id ? { ...p, ...updates } : p); setPlayers(np); saveLocal(np)
            }
        } catch (err) { console.error('Error updating player:', err) }
    }

    const deletePlayer = async (id) => {
        try {
            if (dbReady) await apiPlayers.delete(id)
            const np = players.filter(p => p.id !== id); setPlayers(np); if (!dbReady) saveLocal(np)
        } catch (err) { console.error('Error deleting player:', err) }
    }

    const updatePlayerStats = async (id, stats) => {
        try {
            if (dbReady) {
                const u = await apiPlayers.updateStats(id, stats)
                setPlayers(prev => prev.map(p => p.id === id ? u : p))
            } else {
                const np = players.map(p => p.id === id ? { ...p, stats: { ...p.stats, ...stats } } : p); setPlayers(np); saveLocal(np)
            }
        } catch (err) { console.error('Error updating stats:', err) }
    }

    const compileAllStats = async () => {
        try {
            if (dbReady) {
                const up = await apiPlayers.compileStats()
                setPlayers(up)
                return up
            }
        } catch (err) { console.error('Error compiling stats:', err) }
    }

    // ================== LINEUP CRUD ==================

    const addLineup = async (data) => {
        try {
            if (dbReady) {
                const l = await apiLineups.create(data)
                setLineups(prev => [l, ...prev]); return l
            } else {
                const l = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), name: '', date: new Date().toISOString().split('T')[0], opponent: '', positions: {}, battingOrder: [], ...data }
                const nl = [...lineups, l]; setLineups(nl); saveLocal(undefined, nl); return l
            }
        } catch (err) { console.error('Error adding lineup:', err) }
    }

    const updateLineup = async (id, updates) => {
        try {
            if (dbReady) {
                const u = await apiLineups.update(id, updates)
                setLineups(prev => prev.map(l => l.id === id ? u : l))
            } else {
                const nl = lineups.map(l => l.id === id ? { ...l, ...updates } : l); setLineups(nl); saveLocal(undefined, nl)
            }
        } catch (err) { console.error('Error updating lineup:', err) }
    }

    const deleteLineup = async (id) => {
        try {
            if (dbReady) await apiLineups.delete(id)
            const nl = lineups.filter(l => l.id !== id); setLineups(nl); if (!dbReady) saveLocal(undefined, nl)
        } catch (err) { console.error('Error deleting lineup:', err) }
    }

    // ================== GAME CRUD ==================

    const addGame = async (data) => {
        try {
            if (dbReady) {
                const g = await apiGames.create(data)
                setGames(prev => [g, ...prev]); return g
            } else {
                const g = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), date: new Date().toISOString().split('T')[0], opponent: '', runsFor: 0, runsAgainst: 0, lineupId: null, notes: '', events: [], innings: 7, battingOrder: [], currentBatterIndex: 0, ...data }
                const ng = [...games, g]; setGames(ng); saveLocal(undefined, undefined, ng); return g
            }
        } catch (err) { console.error('Error adding game:', err) }
    }

    const updateGame = async (id, updates) => {
        try {
            if (dbReady) {
                const u = await apiGames.update(id, updates)
                setGames(prev => prev.map(g => g.id === id ? u : g))
            } else {
                const ng = games.map(g => g.id === id ? { ...g, ...updates } : g); setGames(ng); saveLocal(undefined, undefined, ng)
            }
        } catch (err) { console.error('Error updating game:', err) }
    }

    const deleteGame = async (id) => {
        try {
            if (dbReady) await apiGames.delete(id)
            const ng = games.filter(g => g.id !== id); setGames(ng); if (!dbReady) saveLocal(undefined, undefined, ng)
        } catch (err) { console.error('Error deleting game:', err) }
    }

    const addGameEvent = async (gameId, eventData) => {
        try {
            if (dbReady) {
                const ug = await apiGames.addEvent(gameId, eventData)
                setGames(prev => prev.map(g => g.id === gameId ? ug : g))
                const fp = await apiPlayers.getAll()
                setPlayers(fp)
                return ug
            } else {
                const newEvent = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString(), inning: 1, half: 'offense', playerId: null, eventType: '', notes: '', ...eventData }
                const ng = games.map(g => g.id === gameId ? { ...g, events: [...(g.events || []), newEvent] } : g)
                setGames(ng); saveLocal(undefined, undefined, ng); return newEvent
            }
        } catch (err) { console.error('Error adding event:', err) }
    }

    const deleteGameEvent = async (gameId, eventId) => {
        try {
            if (dbReady) {
                const ug = await apiGames.deleteEvent(gameId, eventId)
                setGames(prev => prev.map(g => g.id === gameId ? ug : g))
                const fp = await apiPlayers.getAll()
                setPlayers(fp)
                return ug
            } else {
                const ng = games.map(g => g.id === gameId ? { ...g, events: (g.events || []).filter(e => e.id !== eventId) } : g)
                setGames(ng); saveLocal(undefined, undefined, ng)
            }
        } catch (err) { console.error('Error deleting event:', err) }
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
