const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function request(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Request failed')
    }
    return res.json()
}

// Players
export const apiPlayers = {
    getAll: () => request('/players'),
    create: (data) => request('/players', { method: 'POST', body: data }),
    update: (id, data) => request(`/players/${id}`, { method: 'PUT', body: data }),
    updateStats: (id, stats) => request(`/players/${id}/stats`, { method: 'PUT', body: stats }),
    delete: (id) => request(`/players/${id}`, { method: 'DELETE' }),
    compileStats: () => request('/players/compile-stats', { method: 'POST' }),
}

// Lineups
export const apiLineups = {
    getAll: () => request('/lineups'),
    create: (data) => request('/lineups', { method: 'POST', body: data }),
    update: (id, data) => request(`/lineups/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/lineups/${id}`, { method: 'DELETE' }),
}

// Games
export const apiGames = {
    getAll: () => request('/games'),
    create: (data) => request('/games', { method: 'POST', body: data }),
    update: (id, data) => request(`/games/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/games/${id}`, { method: 'DELETE' }),
    addEvent: (gameId, data) => request(`/games/${gameId}/events`, { method: 'POST', body: data }),
    deleteEvent: (gameId, eventId) => request(`/games/${gameId}/events/${eventId}`, { method: 'DELETE' }),
}

// Migration
export const apiMigrate = (data) => request('/migrate', { method: 'POST', body: data })

// Health check
export const apiHealth = () => request('/health')
