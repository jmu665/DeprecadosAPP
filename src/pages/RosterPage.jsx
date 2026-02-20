import React, { useState } from 'react'
import { useData, POSITIONS, calcPlayerAvg, formatAvg } from '../utils/DataContext'
import Modal from '../components/Modal'
import PlayerForm from '../components/PlayerForm'
import { Plus, Search, Edit2, Trash2, User, Phone, TrendingUp } from 'lucide-react'

export default function RosterPage() {
    const { players, addPlayer, updatePlayer, deletePlayer } = useData()
    const [showModal, setShowModal] = useState(false)
    const [editingPlayer, setEditingPlayer] = useState(null)
    const [search, setSearch] = useState('')
    const [filterPos, setFilterPos] = useState('ALL')
    const [confirmDelete, setConfirmDelete] = useState(null)

    // Sort by AVG descending
    const sortedPlayers = [...players]
        .filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.number && p.number.toString().includes(search))
            const matchesPos = filterPos === 'ALL' || p.position === filterPos || p.secondaryPosition === filterPos
            return matchesSearch && matchesPos
        })
        .sort((a, b) => calcPlayerAvg(b) - calcPlayerAvg(a))

    const handleSave = (formData) => {
        if (editingPlayer) {
            updatePlayer(editingPlayer.id, formData)
        } else {
            addPlayer(formData)
        }
        setShowModal(false)
        setEditingPlayer(null)
    }

    const handleEdit = (player) => {
        setEditingPlayer(player)
        setShowModal(true)
    }

    const handleDelete = (id) => {
        deletePlayer(id)
        setConfirmDelete(null)
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Roster</h1>
                    <p className="text-text-muted text-sm mt-1">{players.length} jugadores registrados · Ordenados por promedio de bateo</p>
                </div>
                <button
                    onClick={() => { setEditingPlayer(null); setShowModal(true) }}
                    className="btn-primary flex items-center gap-2 w-fit"
                >
                    <Plus size={18} />
                    Agregar Jugador
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input-field pl-9"
                        placeholder="Buscar por nombre o número..."
                    />
                </div>
                <select
                    value={filterPos}
                    onChange={e => setFilterPos(e.target.value)}
                    className="select-field w-full sm:w-44"
                >
                    <option value="ALL">Todas las posiciones</option>
                    {POSITIONS.map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.short} - {pos.label}</option>
                    ))}
                </select>
            </div>

            {/* Player cards */}
            {sortedPlayers.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <User size={48} className="mx-auto mb-4 text-text-muted/30" />
                    <p className="text-text-muted font-medium">
                        {players.length === 0
                            ? 'No hay jugadores registrados. ¡Agrega tu primer jugador!'
                            : 'No se encontraron jugadores con esos filtros.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sortedPlayers.map((player, i) => {
                        const posInfo = POSITIONS.find(p => p.id === player.position)
                        const secPosInfo = player.secondaryPosition ? POSITIONS.find(p => p.id === player.secondaryPosition) : null
                        const avg = calcPlayerAvg(player)
                        const avgDisplay = formatAvg(avg)

                        return (
                            <div
                                key={player.id}
                                className="glass-card p-5 animate-slide-up"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Number badge */}
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                                        <span className="text-xl font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {player.number || '?'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate">{player.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                                                {posInfo?.short || player.position}
                                            </span>
                                            {secPosInfo && (
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                                    {secPosInfo.short}
                                                </span>
                                            )}
                                            <span className="text-xs text-text-muted">
                                                B:{player.bats} T:{player.throws}
                                            </span>
                                        </div>
                                        {/* AVG display */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <TrendingUp size={13} className="text-primary" />
                                            <span className="text-lg font-black text-primary" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                                                {avgDisplay}
                                            </span>
                                            <span className="text-[10px] text-text-muted uppercase">AVG</span>
                                            {player.stats?.atBats > 0 && (
                                                <span className="text-[10px] text-text-muted ml-1">
                                                    ({player.stats.hits}/{player.stats.atBats})
                                                </span>
                                            )}
                                        </div>
                                        {player.phone && (
                                            <div className="flex items-center gap-1 mt-1.5 text-xs text-text-muted">
                                                <Phone size={11} />
                                                {player.phone}
                                            </div>
                                        )}
                                    </div>
                                    {/* Actions */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEdit(player)}
                                            className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(player.id)}
                                            className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit modal */}
            <Modal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingPlayer(null) }}
                title={editingPlayer ? 'Editar Jugador' : 'Nuevo Jugador'}
            >
                <PlayerForm
                    player={editingPlayer}
                    onSave={handleSave}
                    onCancel={() => { setShowModal(false); setEditingPlayer(null) }}
                />
            </Modal>

            {/* Delete confirmation */}
            <Modal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title="Confirmar eliminación"
            >
                <p className="text-text-muted mb-6">
                    ¿Estás seguro de que quieres eliminar a este jugador? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleDelete(confirmDelete)}
                        className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700"
                    >
                        Eliminar
                    </button>
                    <button
                        onClick={() => setConfirmDelete(null)}
                        className="btn-secondary"
                    >
                        Cancelar
                    </button>
                </div>
            </Modal>
        </div>
    )
}
