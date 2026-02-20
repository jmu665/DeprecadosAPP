const express = require('express')
const cors = require('cors')
const db = require('./db.cjs')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Initialize database
const database = db.initDB()
console.log('✅ SQLite database initialized at server/deprecados.db')

// ================== PLAYERS ==================

app.get('/api/players', (req, res) => {
    try {
        res.json(db.getAllPlayers(database))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/players', (req, res) => {
    try {
        const player = db.createPlayer(database, req.body)
        res.json(player)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/players/:id', (req, res) => {
    try {
        const player = db.updatePlayer(database, req.params.id, req.body)
        res.json(player)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/players/:id/stats', (req, res) => {
    try {
        const player = db.updatePlayerStats(database, req.params.id, req.body)
        res.json(player)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/players/:id', (req, res) => {
    try {
        db.deletePlayer(database, req.params.id)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Recompile ALL player stats from game events
app.post('/api/players/compile-stats', (req, res) => {
    try {
        const players = db.compileAllStats(database)
        res.json(players)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ================== LINEUPS ==================

app.get('/api/lineups', (req, res) => {
    try {
        res.json(db.getAllLineups(database))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/lineups', (req, res) => {
    try {
        const lineup = db.createLineup(database, req.body)
        res.json(lineup)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/lineups/:id', (req, res) => {
    try {
        const lineup = db.updateLineup(database, req.params.id, req.body)
        res.json(lineup)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/lineups/:id', (req, res) => {
    try {
        db.deleteLineup(database, req.params.id)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ================== GAMES ==================

app.get('/api/games', (req, res) => {
    try {
        res.json(db.getAllGames(database))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/games', (req, res) => {
    try {
        const game = db.createGame(database, req.body)
        res.json(game)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/games/:id', (req, res) => {
    try {
        const game = db.updateGame(database, req.params.id, req.body)
        res.json(game)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/games/:id', (req, res) => {
    try {
        db.deleteGame(database, req.params.id)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Game events
app.post('/api/games/:id/events', (req, res) => {
    try {
        const game = db.addGameEvent(database, req.params.id, req.body)
        res.json(game)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/games/:gameId/events/:eventId', (req, res) => {
    try {
        const game = db.deleteGameEvent(database, req.params.gameId, req.params.eventId)
        res.json(game)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ================== MIGRATE ==================

app.post('/api/migrate', (req, res) => {
    try {
        const result = db.migrateFromLocalStorage(database, req.body)
        res.json(result)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ================== HEALTH ==================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'sqlite' })
})

app.listen(PORT, () => {
    console.log(`🚀 DeprecadosAPP API server running on http://localhost:${PORT}`)
    console.log(`📦 Database: server/deprecados.db`)
})
