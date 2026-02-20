const Database = require('better-sqlite3')
const path = require('path')
const crypto = require('crypto')

const DB_PATH = path.join(__dirname, 'deprecados.db')

function generateId() {
    return Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
}

// Events that end a plate appearance (next batter comes up)
const PLATE_APPEARANCE_EVENTS = [
    'single', 'double', 'triple', 'homerun',     // hits
    'walk', 'hbp',                                 // on base
    'strikeout', 'groundout', 'flyout', 'popout', // outs
    'sacrifice', 'reached_error',                  // special
]
// Events that count as official at-bats (for AVG calc)
const AT_BAT_EVENTS = ['single', 'double', 'triple', 'homerun', 'strikeout', 'groundout', 'flyout', 'popout', 'reached_error']
const HIT_EVENTS = ['single', 'double', 'triple', 'homerun']
// Events that are outs
const OUT_EVENTS = ['strikeout', 'groundout', 'flyout', 'popout', 'sacrifice']

function initDB() {
    const db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    db.exec(`
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            number TEXT,
            position TEXT DEFAULT 'P',
            secondaryPosition TEXT DEFAULT '',
            bats TEXT DEFAULT 'R',
            throws TEXT DEFAULT 'R',
            age TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            createdAt TEXT DEFAULT (datetime('now')),
            gamesPlayed INTEGER DEFAULT 0,
            atBats INTEGER DEFAULT 0,
            hits INTEGER DEFAULT 0,
            runs INTEGER DEFAULT 0,
            rbi INTEGER DEFAULT 0,
            homeRuns INTEGER DEFAULT 0,
            strikeouts INTEGER DEFAULT 0,
            walks INTEGER DEFAULT 0,
            stolenBases INTEGER DEFAULT 0,
            errors INTEGER DEFAULT 0,
            doubles INTEGER DEFAULT 0,
            triples INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS lineups (
            id TEXT PRIMARY KEY,
            name TEXT DEFAULT '',
            date TEXT,
            opponent TEXT DEFAULT '',
            createdAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS lineup_positions (
            lineupId TEXT NOT NULL,
            position TEXT NOT NULL,
            playerId TEXT NOT NULL,
            FOREIGN KEY (lineupId) REFERENCES lineups(id) ON DELETE CASCADE,
            FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
            PRIMARY KEY (lineupId, position)
        );

        CREATE TABLE IF NOT EXISTS lineup_batting_order (
            lineupId TEXT NOT NULL,
            orderIndex INTEGER NOT NULL,
            playerId TEXT NOT NULL,
            FOREIGN KEY (lineupId) REFERENCES lineups(id) ON DELETE CASCADE,
            FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
            PRIMARY KEY (lineupId, orderIndex)
        );

        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            date TEXT,
            opponent TEXT DEFAULT '',
            runsFor INTEGER DEFAULT 0,
            runsAgainst INTEGER DEFAULT 0,
            lineupId TEXT,
            notes TEXT DEFAULT '',
            innings INTEGER DEFAULT 7,
            currentBatterIndex INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS game_batting_order (
            gameId TEXT NOT NULL,
            orderIndex INTEGER NOT NULL,
            playerId TEXT NOT NULL,
            FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
            PRIMARY KEY (gameId, orderIndex)
        );

        CREATE TABLE IF NOT EXISTS game_events (
            id TEXT PRIMARY KEY,
            gameId TEXT NOT NULL,
            inning INTEGER DEFAULT 1,
            half TEXT DEFAULT 'offense',
            playerId TEXT,
            eventType TEXT NOT NULL,
            notes TEXT DEFAULT '',
            timestamp TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE SET NULL
        );
    `)

    // Migrations for existing DBs
    const migrations = [
        "ALTER TABLE games ADD COLUMN currentBatterIndex INTEGER DEFAULT 0",
        "ALTER TABLE game_events ADD COLUMN half TEXT DEFAULT 'offense'",
    ]
    migrations.forEach(sql => {
        try { db.exec(sql) } catch (e) { /* column already exists */ }
    })

    // Create game_batting_order if migration needed
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS game_batting_order (
            gameId TEXT NOT NULL,
            orderIndex INTEGER NOT NULL,
            playerId TEXT NOT NULL,
            FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
            PRIMARY KEY (gameId, orderIndex)
        )`)
    } catch (e) { /* already exists */ }

    return db
}

// ================== PLAYERS ==================

function getAllPlayers(db) {
    const rows = db.prepare('SELECT * FROM players ORDER BY createdAt ASC').all()
    return rows.map(formatPlayer)
}

function getPlayer(db, id) {
    const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id)
    return row ? formatPlayer(row) : null
}

function createPlayer(db, data) {
    const id = generateId()
    db.prepare(`
        INSERT INTO players (id, name, number, position, secondaryPosition, bats, throws, age, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.number || '', data.position || 'P',
        data.secondaryPosition || '', data.bats || 'R', data.throws || 'R',
        data.age || '', data.phone || '')
    return getPlayer(db, id)
}

function updatePlayer(db, id, data) {
    const fields = ['name', 'number', 'position', 'secondaryPosition', 'bats', 'throws', 'age', 'phone']
    const updates = []
    const values = []
    fields.forEach(f => {
        if (data[f] !== undefined) {
            updates.push(`${f} = ?`)
            values.push(data[f])
        }
    })
    if (updates.length > 0) {
        values.push(id)
        db.prepare(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }
    return getPlayer(db, id)
}

function updatePlayerStats(db, id, stats) {
    const fields = ['gamesPlayed', 'atBats', 'hits', 'runs', 'rbi', 'homeRuns',
        'strikeouts', 'walks', 'stolenBases', 'errors', 'doubles', 'triples']
    const updates = []
    const values = []
    fields.forEach(f => {
        if (stats[f] !== undefined) {
            updates.push(`${f} = ?`)
            values.push(parseInt(stats[f]) || 0)
        }
    })
    if (updates.length > 0) {
        values.push(id)
        db.prepare(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }
    return getPlayer(db, id)
}

function deletePlayer(db, id) {
    db.prepare('DELETE FROM players WHERE id = ?').run(id)
}

function formatPlayer(row) {
    return {
        id: row.id,
        name: row.name,
        number: row.number,
        position: row.position,
        secondaryPosition: row.secondaryPosition,
        bats: row.bats,
        throws: row.throws,
        age: row.age,
        phone: row.phone,
        createdAt: row.createdAt,
        stats: {
            gamesPlayed: row.gamesPlayed || 0,
            atBats: row.atBats || 0,
            hits: row.hits || 0,
            runs: row.runs || 0,
            rbi: row.rbi || 0,
            homeRuns: row.homeRuns || 0,
            strikeouts: row.strikeouts || 0,
            walks: row.walks || 0,
            stolenBases: row.stolenBases || 0,
            errors: row.errors || 0,
            doubles: row.doubles || 0,
            triples: row.triples || 0,
        }
    }
}

// ================== COMPILE STATS FROM EVENTS ==================

function compileAllStats(db) {
    db.prepare(`
        UPDATE players SET gamesPlayed=0, atBats=0, hits=0, runs=0, rbi=0,
        homeRuns=0, strikeouts=0, walks=0, stolenBases=0, errors=0, doubles=0, triples=0
    `).run()

    const events = db.prepare(`
        SELECT ge.playerId, ge.gameId, ge.eventType
        FROM game_events ge
        WHERE ge.playerId IS NOT NULL AND ge.eventType NOT IN ('substitution','opponent_run')
    `).all()

    const playerStats = {}
    const playerGames = {}

    events.forEach(e => {
        if (!playerStats[e.playerId]) {
            playerStats[e.playerId] = {
                atBats: 0, hits: 0, runs: 0, rbi: 0,
                homeRuns: 0, strikeouts: 0, walks: 0,
                stolenBases: 0, errors: 0, doubles: 0, triples: 0,
            }
            playerGames[e.playerId] = new Set()
        }

        const ps = playerStats[e.playerId]
        playerGames[e.playerId].add(e.gameId)

        if (AT_BAT_EVENTS.includes(e.eventType)) ps.atBats++
        if (HIT_EVENTS.includes(e.eventType)) ps.hits++

        switch (e.eventType) {
            case 'double': ps.doubles++; break
            case 'triple': ps.triples++; break
            case 'homerun': ps.homeRuns++; break
            case 'walk': case 'hbp': ps.walks++; break
            case 'strikeout': ps.strikeouts++; break
            case 'stolenbase': ps.stolenBases++; break
            case 'run': ps.runs++; break
            case 'rbi': ps.rbi++; break
            case 'error': case 'fielding_error': ps.errors++; break
        }
    })

    const updateStmt = db.prepare(`
        UPDATE players SET gamesPlayed=?, atBats=?, hits=?, runs=?, rbi=?,
        homeRuns=?, strikeouts=?, walks=?, stolenBases=?, errors=?, doubles=?, triples=?
        WHERE id=?
    `)

    const updateAll = db.transaction(() => {
        Object.entries(playerStats).forEach(([playerId, s]) => {
            const gp = playerGames[playerId]?.size || 0
            updateStmt.run(gp, s.atBats, s.hits, s.runs, s.rbi,
                s.homeRuns, s.strikeouts, s.walks, s.stolenBases, s.errors, s.doubles, s.triples,
                playerId)
        })
    })

    updateAll()
    return getAllPlayers(db)
}

function recompilePlayerStats(db, playerId) {
    const events = db.prepare(`
        SELECT eventType, gameId FROM game_events
        WHERE playerId = ? AND eventType NOT IN ('substitution','opponent_run')
    `).all(playerId)

    const s = {
        atBats: 0, hits: 0, runs: 0, rbi: 0,
        homeRuns: 0, strikeouts: 0, walks: 0,
        stolenBases: 0, errors: 0, doubles: 0, triples: 0,
    }
    const gameIds = new Set()

    events.forEach(e => {
        gameIds.add(e.gameId)
        if (AT_BAT_EVENTS.includes(e.eventType)) s.atBats++
        if (HIT_EVENTS.includes(e.eventType)) s.hits++
        switch (e.eventType) {
            case 'double': s.doubles++; break
            case 'triple': s.triples++; break
            case 'homerun': s.homeRuns++; break
            case 'walk': case 'hbp': s.walks++; break
            case 'strikeout': s.strikeouts++; break
            case 'stolenbase': s.stolenBases++; break
            case 'run': s.runs++; break
            case 'rbi': s.rbi++; break
            case 'error': case 'fielding_error': s.errors++; break
        }
    })

    db.prepare(`
        UPDATE players SET gamesPlayed=?, atBats=?, hits=?, runs=?, rbi=?,
        homeRuns=?, strikeouts=?, walks=?, stolenBases=?, errors=?, doubles=?, triples=?
        WHERE id=?
    `).run(gameIds.size, s.atBats, s.hits, s.runs, s.rbi,
        s.homeRuns, s.strikeouts, s.walks, s.stolenBases, s.errors, s.doubles, s.triples,
        playerId)
}

// ================== LINEUPS ==================

function getAllLineups(db) {
    const rows = db.prepare('SELECT * FROM lineups ORDER BY createdAt DESC').all()
    return rows.map(row => formatLineup(db, row))
}

function createLineup(db, data) {
    const id = generateId()
    db.prepare(`INSERT INTO lineups (id, name, date, opponent) VALUES (?, ?, ?, ?)`)
        .run(id, data.name || '', data.date || new Date().toISOString().split('T')[0], data.opponent || '')

    if (data.positions && typeof data.positions === 'object') {
        const insertPos = db.prepare('INSERT INTO lineup_positions (lineupId, position, playerId) VALUES (?, ?, ?)')
        Object.entries(data.positions).forEach(([pos, playerId]) => {
            insertPos.run(id, pos, playerId)
        })
    }

    if (data.battingOrder && Array.isArray(data.battingOrder)) {
        const insertOrder = db.prepare('INSERT INTO lineup_batting_order (lineupId, orderIndex, playerId) VALUES (?, ?, ?)')
        data.battingOrder.forEach((playerId, i) => {
            insertOrder.run(id, i, playerId)
        })
    }

    return formatLineup(db, db.prepare('SELECT * FROM lineups WHERE id = ?').get(id))
}

function updateLineup(db, id, data) {
    const fields = ['name', 'date', 'opponent']
    const updates = []
    const values = []
    fields.forEach(f => {
        if (data[f] !== undefined) {
            updates.push(`${f} = ?`)
            values.push(data[f])
        }
    })
    if (updates.length > 0) {
        values.push(id)
        db.prepare(`UPDATE lineups SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }
    return formatLineup(db, db.prepare('SELECT * FROM lineups WHERE id = ?').get(id))
}

function deleteLineup(db, id) {
    db.prepare('DELETE FROM lineups WHERE id = ?').run(id)
}

function formatLineup(db, row) {
    const positions = {}
    db.prepare('SELECT position, playerId FROM lineup_positions WHERE lineupId = ?')
        .all(row.id).forEach(p => { positions[p.position] = p.playerId })

    const battingOrder = db.prepare('SELECT playerId FROM lineup_batting_order WHERE lineupId = ? ORDER BY orderIndex')
        .all(row.id).map(b => b.playerId)

    return {
        id: row.id, name: row.name, date: row.date, opponent: row.opponent,
        createdAt: row.createdAt, positions, battingOrder,
    }
}

// ================== GAMES ==================

function getAllGames(db) {
    const rows = db.prepare('SELECT * FROM games ORDER BY date DESC, createdAt DESC').all()
    return rows.map(row => formatGame(db, row))
}

function createGame(db, data) {
    const id = generateId()
    db.prepare(`INSERT INTO games (id, date, opponent, runsFor, runsAgainst, lineupId, notes, innings, currentBatterIndex)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, data.date || new Date().toISOString().split('T')[0],
            data.opponent || '', data.runsFor || 0, data.runsAgainst || 0,
            data.lineupId || null, data.notes || '', data.innings || 7, 0)

    // Save batting order
    if (data.battingOrder && Array.isArray(data.battingOrder)) {
        const insertBO = db.prepare('INSERT INTO game_batting_order (gameId, orderIndex, playerId) VALUES (?, ?, ?)')
        data.battingOrder.forEach((playerId, i) => {
            insertBO.run(id, i, playerId)
        })
    }

    return formatGame(db, db.prepare('SELECT * FROM games WHERE id = ?').get(id))
}

function updateGame(db, id, data) {
    const fields = ['date', 'opponent', 'runsFor', 'runsAgainst', 'lineupId', 'notes', 'innings', 'currentBatterIndex']
    const updates = []
    const values = []
    fields.forEach(f => {
        if (data[f] !== undefined) {
            updates.push(`${f} = ?`)
            values.push(data[f])
        }
    })
    if (updates.length > 0) {
        values.push(id)
        db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }

    // Update batting order if provided
    if (data.battingOrder && Array.isArray(data.battingOrder)) {
        db.prepare('DELETE FROM game_batting_order WHERE gameId = ?').run(id)
        const insertBO = db.prepare('INSERT INTO game_batting_order (gameId, orderIndex, playerId) VALUES (?, ?, ?)')
        data.battingOrder.forEach((playerId, i) => {
            insertBO.run(id, i, playerId)
        })
    }

    return formatGame(db, db.prepare('SELECT * FROM games WHERE id = ?').get(id))
}

function deleteGame(db, id) {
    db.prepare('DELETE FROM game_batting_order WHERE gameId = ?').run(id)
    db.prepare('DELETE FROM games WHERE id = ?').run(id)
}

function addGameEvent(db, gameId, data) {
    const id = generateId()
    const half = data.half || 'offense'
    let playerId = data.playerId || null
    const eventType = data.eventType || ''

    // If it's an offensive plate appearance, auto-assign current batter and advance
    if (half === 'offense' && PLATE_APPEARANCE_EVENTS.includes(eventType)) {
        const game = db.prepare('SELECT currentBatterIndex FROM games WHERE id = ?').get(gameId)
        const battingOrder = db.prepare('SELECT playerId FROM game_batting_order WHERE gameId = ? ORDER BY orderIndex')
            .all(gameId).map(r => r.playerId)

        if (battingOrder.length > 0) {
            const idx = (game?.currentBatterIndex || 0) % battingOrder.length
            playerId = battingOrder[idx]
            // Advance to next batter
            const nextIdx = (idx + 1) % battingOrder.length
            db.prepare('UPDATE games SET currentBatterIndex = ? WHERE id = ?').run(nextIdx, gameId)
        }
    }

    db.prepare(`INSERT INTO game_events (id, gameId, inning, half, playerId, eventType, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, gameId, data.inning || 1, half, playerId, eventType, data.notes || '')

    // Auto-recompile stats for this player
    if (playerId) {
        recompilePlayerStats(db, playerId)
    }

    return formatGame(db, db.prepare('SELECT * FROM games WHERE id = ?').get(gameId))
}

function deleteGameEvent(db, gameId, eventId) {
    const event = db.prepare('SELECT playerId FROM game_events WHERE id = ?').get(eventId)
    db.prepare('DELETE FROM game_events WHERE id = ?').run(eventId)

    if (event?.playerId) {
        recompilePlayerStats(db, event.playerId)
    }

    return formatGame(db, db.prepare('SELECT * FROM games WHERE id = ?').get(gameId))
}

function formatGame(db, row) {
    if (!row) return null
    const events = db.prepare('SELECT * FROM game_events WHERE gameId = ? ORDER BY inning, timestamp')
        .all(row.id)

    const battingOrder = db.prepare('SELECT playerId FROM game_batting_order WHERE gameId = ? ORDER BY orderIndex')
        .all(row.id).map(r => r.playerId)

    return {
        id: row.id,
        date: row.date,
        opponent: row.opponent,
        runsFor: row.runsFor,
        runsAgainst: row.runsAgainst,
        lineupId: row.lineupId,
        notes: row.notes,
        innings: row.innings,
        currentBatterIndex: row.currentBatterIndex || 0,
        battingOrder,
        createdAt: row.createdAt,
        events: events.map(e => ({
            id: e.id,
            inning: e.inning,
            half: e.half || 'offense',
            playerId: e.playerId,
            eventType: e.eventType,
            notes: e.notes,
            timestamp: e.timestamp,
        }))
    }
}

// ================== MIGRATE FROM LOCALSTORAGE ==================

function migrateFromLocalStorage(db, data) {
    const transaction = db.transaction(() => {
        if (data.players?.length) {
            const insertPlayer = db.prepare(`
                INSERT OR IGNORE INTO players (id, name, number, position, secondaryPosition, bats, throws, age, phone, createdAt,
                    gamesPlayed, atBats, hits, runs, rbi, homeRuns, strikeouts, walks, stolenBases, errors, doubles, triples)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            data.players.forEach(p => {
                const s = p.stats || {}
                insertPlayer.run(p.id, p.name, p.number || '', p.position || 'P',
                    p.secondaryPosition || '', p.bats || 'R', p.throws || 'R',
                    p.age || '', p.phone || '', p.createdAt || new Date().toISOString(),
                    s.gamesPlayed || 0, s.atBats || 0, s.hits || 0, s.runs || 0,
                    s.rbi || 0, s.homeRuns || 0, s.strikeouts || 0, s.walks || 0,
                    s.stolenBases || 0, s.errors || 0, s.doubles || 0, s.triples || 0)
            })
        }

        if (data.lineups?.length) {
            const insertLineup = db.prepare('INSERT OR IGNORE INTO lineups (id, name, date, opponent, createdAt) VALUES (?, ?, ?, ?, ?)')
            const insertPos = db.prepare('INSERT OR IGNORE INTO lineup_positions (lineupId, position, playerId) VALUES (?, ?, ?)')
            const insertOrder = db.prepare('INSERT OR IGNORE INTO lineup_batting_order (lineupId, orderIndex, playerId) VALUES (?, ?, ?)')
            data.lineups.forEach(l => {
                insertLineup.run(l.id, l.name || '', l.date || '', l.opponent || '', l.createdAt || new Date().toISOString())
                if (l.positions) Object.entries(l.positions).forEach(([pos, pid]) => insertPos.run(l.id, pos, pid))
                if (l.battingOrder) l.battingOrder.forEach((pid, i) => insertOrder.run(l.id, i, pid))
            })
        }

        if (data.games?.length) {
            const insertGame = db.prepare(`INSERT OR IGNORE INTO games (id, date, opponent, runsFor, runsAgainst, lineupId, notes, innings, currentBatterIndex, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            const insertEvent = db.prepare(`INSERT OR IGNORE INTO game_events (id, gameId, inning, half, playerId, eventType, notes, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            data.games.forEach(g => {
                insertGame.run(g.id, g.date || '', g.opponent || '', g.runsFor || 0,
                    g.runsAgainst || 0, g.lineupId || null, g.notes || '',
                    g.innings || 7, 0, g.createdAt || new Date().toISOString())
                if (g.events) {
                    g.events.forEach(e => {
                        insertEvent.run(e.id, g.id, e.inning || 1, e.half || 'offense',
                            e.playerId || null, e.eventType || '', e.notes || '',
                            e.timestamp || new Date().toISOString())
                    })
                }
            })
        }
    })

    transaction()
    return { migrated: true }
}

module.exports = {
    initDB, generateId,
    PLATE_APPEARANCE_EVENTS, AT_BAT_EVENTS, HIT_EVENTS, OUT_EVENTS,
    getAllPlayers, getPlayer, createPlayer, updatePlayer, updatePlayerStats, deletePlayer,
    compileAllStats,
    getAllLineups, createLineup, updateLineup, deleteLineup,
    getAllGames, createGame, updateGame, deleteGame,
    addGameEvent, deleteGameEvent,
    migrateFromLocalStorage,
}
