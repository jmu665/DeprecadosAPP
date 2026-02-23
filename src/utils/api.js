import { db } from './firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'

const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9)

async function getAll(col) {
    const snap = await getDocs(collection(db, col))
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function getOne(col, id) {
    const d = await getDoc(doc(db, col, id))
    return d.exists() ? { id: d.id, ...d.data() } : null
}

async function createDoc(col, data) {
    const id = data.id || genId()
    const full = { ...data, id, createdAt: new Date().toISOString() }
    await setDoc(doc(db, col, id), full)
    return full
}

async function updateDocData(col, id, data) {
    await updateDoc(doc(db, col, id), data)
    return getOne(col, id) // Return fully updated object to match previous API behavior
}

export const apiPlayers = {
    getAll: () => getAll('players'),
    create: async (data) => {
        const stats = { gamesPlayed: 0, atBats: 0, hits: 0, runs: 0, rbi: 0, homeRuns: 0, strikeouts: 0, walks: 0, stolenBases: 0, errors: 0, doubles: 0, triples: 0, ...data.stats }
        return createDoc('players', { ...data, stats })
    },
    update: (id, data) => updateDocData('players', id, data),
    updateStats: (id, stats) => updateDocData('players', id, { stats }),
    delete: (id) => deleteDoc(doc(db, 'players', id)),
    compileStats: async () => {
        // Compile stats from all games
        const games = await getAll('games')
        const players = await getAll('players')

        const newStats = {}
        for (const p of players) {
            newStats[p.id] = { gamesPlayed: 0, atBats: 0, hits: 0, runs: 0, rbi: 0, homeRuns: 0, strikeouts: 0, walks: 0, stolenBases: 0, errors: 0, doubles: 0, triples: 0 }
        }

        for (const g of games) {
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

                if (type === 'run') s.runs++
                if (type === 'rbi') s.rbi++
                if (type === 'stolenbase') s.stolenBases++
                if (type === 'fielding_error') s.errors++
            }
            played.forEach(pId => newStats[pId].gamesPlayed++)
        }

        const batch = writeBatch(db)
        const updatedPlayers = []
        for (const p of players) {
            if (newStats[p.id]) {
                const s = { ...p.stats, ...newStats[p.id] }
                batch.update(doc(db, 'players', p.id), { stats: s })
                updatedPlayers.push({ ...p, stats: s })
            } else {
                updatedPlayers.push(p)
            }
        }
        await batch.commit()
        return updatedPlayers
    }
}

export const apiLineups = {
    getAll: () => getAll('lineups'),
    create: (data) => createDoc('lineups', data),
    update: (id, data) => updateDocData('lineups', id, data),
    delete: (id) => deleteDoc(doc(db, 'lineups', id)),
}

export const apiGames = {
    getAll: () => getAll('games'),
    create: (data) => createDoc('games', {
        runsFor: 0, runsAgainst: 0, lineupId: null, notes: '', events: [], innings: 7, battingOrder: [], currentBatterIndex: 0, ...data
    }),
    update: (id, data) => updateDocData('games', id, data),
    delete: (id) => deleteDoc(doc(db, 'games', id)),
    addEvent: async (gameId, data) => {
        const game = await getOne('games', gameId)
        if (!game) throw new Error('Game not found')
        const newEvent = { id: genId(), timestamp: new Date().toISOString(), inning: 1, half: 'offense', playerId: null, eventType: '', notes: '', ...data }
        const updatedEvents = [...(game.events || []), newEvent]
        const ug = await updateDocData('games', gameId, { events: updatedEvents })
        await apiPlayers.compileStats()
        return ug
    },
    deleteEvent: async (gameId, eventId) => {
        const game = await getOne('games', gameId)
        if (!game) throw new Error('Game not found')
        const updatedEvents = (game.events || []).filter(e => e.id !== eventId)
        const ug = await updateDocData('games', gameId, { events: updatedEvents })
        await apiPlayers.compileStats()
        return ug
    }
}

export const apiMigrate = async (localData) => {
    const batch = writeBatch(db)
    if (localData.players) localData.players.forEach(p => batch.set(doc(db, 'players', p.id), p))
    if (localData.lineups) localData.lineups.forEach(l => batch.set(doc(db, 'lineups', l.id), l))
    if (localData.games) localData.games.forEach(g => batch.set(doc(db, 'games', g.id), g))
    await batch.commit()
    return true
}

export const apiHealth = async () => {
    // Actually test Firestore connectivity
    const snap = await getDocs(collection(db, 'players'))
    return true
}
