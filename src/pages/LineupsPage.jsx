import React, { useState, useRef } from 'react'
import { useData, POSITIONS, calcPlayerStars, calcPlayerAvg, formatAvg } from '../utils/DataContext'
import BaseballField from '../components/BaseballField'
import Modal from '../components/Modal'
import { Plus, Trash2, Printer, Eye, CalendarDays, ChevronDown, ChevronUp, GripVertical, ArrowUp, ArrowDown, Users, Crown, X } from 'lucide-react'

export default function LineupsPage() {
    const { players, lineups, addLineup, updateLineup, deleteLineup, getPlayer } = useData()
    const [expandedId, setExpandedId] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newLineup, setNewLineup] = useState({ name: '', date: new Date().toISOString().split('T')[0], opponent: '' })
    const [createStep, setCreateStep] = useState(1) // 1=info, 2=batting order
    const [battingOrderDraft, setBattingOrderDraft] = useState([])
    const [positionsDraft, setPositionsDraft] = useState({})
    const printRef = useRef()

    const availableForBatting = players.filter(p => !battingOrderDraft.includes(p.id))

    const resetCreateModal = () => {
        setShowCreateModal(false)
        setCreateStep(1)
        setBattingOrderDraft([])
        setPositionsDraft({})
        setNewLineup({ name: '', date: new Date().toISOString().split('T')[0], opponent: '' })
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
            return { ...p, _score: avg * 0.4 + obp * 0.3 + slg * 0.3 }
        }).sort((a, b) => b._score - a._score)
        const draftIds = scored.slice(0, 9).map(p => p.id)
        setBattingOrderDraft(draftIds)
        const posDraft = {}
        draftIds.forEach(id => { posDraft[id] = players.find(p => p.id === id)?.position || 'P' })
        setPositionsDraft(posDraft)
    }

    const handleEveryoneLineup = () => {
        const sorted = [...players].sort((a, b) => {
            const gA = a.stats?.gamesPlayed || 0
            const gB = b.stats?.gamesPlayed || 0
            if (gA !== gB) return gA - gB
            return (a.stats?.atBats || 0) - (b.stats?.atBats || 0)
        })
        const draftIds = sorted.map(p => p.id)
        setBattingOrderDraft(draftIds)
        const posDraft = {}
        draftIds.forEach(id => { posDraft[id] = players.find(p => p.id === id)?.position || 'P' })
        setPositionsDraft(posDraft)
    }

    const handleCreate = () => {
        addLineup({
            ...newLineup,
            name: newLineup.name || `Lineup ${(lineups?.length || 0) + 1}`,
            battingOrder: battingOrderDraft,
            positions: positionsDraft,
        })
        resetCreateModal()
    }

    const handlePrint = (lineup) => {
        const renderHtmlStars = (stars) => {
            if (stars === 0) return `<span class="stars-container"><span class="star-text">Sin datos</span></span>`
            let html = '<span class="stars-container">'
            for (let i = 1; i <= 5; i++) {
                html += `<span class="${i <= stars ? 'star-active' : 'star-inactive'}">★</span>`
            }
            html += '</span>'
            return html
        }

        const printWindow = window.open('', '_blank')
        const positions = lineup.positions || {}
        const positionsList = Object.entries(positions).map(([posId, playerId]) => {
            const player = getPlayer(playerId)
            const posInfo = POSITIONS.find(p => p.id === posId)
            return { position: posInfo?.label || posId, short: posInfo?.short || posId, player }
        })

        const battingOrderList = (lineup.battingOrder || []).map((playerId, idx) => {
            const player = getPlayer(playerId)
            return { order: idx + 1, player }
        })

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lineup - ${lineup.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; padding: 30px; background: white; color: #111; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #DC2626; padding-bottom: 20px; }
          .header h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
          .header .meta { color: #666; margin-top: 8px; font-size: 14px; }
          .section { margin-bottom: 24px; }
          .section h2 { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; color: #DC2626; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
          th { background: #f5f5f5; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #666; }
          .number { font-weight: 800; color: #DC2626; font-size: 16px; }
          .stars-container { display: inline-flex; gap: 1px; align-items: center; }
          .stars-container .star-active { color: #facc15; font-size: 12px; }
          .stars-container .star-inactive { color: #e5e7eb; font-size: 12px; }
          .stars-container .star-text { font-size: 10px; color: #9ca3af; font-style: italic; }
          .player-name-cell { display: flex; flex-direction: column; gap: 2px; }
          .footer { text-align: center; margin-top: 40px; color: #999; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${window.location.origin}/logo.png" alt="Logo" style="height: 60px; width: 60px; object-fit: cover; margin-bottom: 15px; border-radius: 50%;" />
          <h1>Deprecados</h1>
          <div class="meta">
            <strong>${lineup.name}</strong><br/>
            ${lineup.date} ${lineup.opponent ? `| vs ${lineup.opponent}` : ''}
          </div>
        </div>
        <div class="section">
          <h2>Alineación de Campo</h2>
          <table>
            <thead><tr><th>Pos</th><th>#</th><th>Jugador</th></tr></thead>
            <tbody>
              ${positionsList.map(({ short, player }) => `
                <tr>
                  <td><strong>${short}</strong></td>
                  <td class="number">${player?.number || '-'}</td>
                  <td>
                    <div class="player-name-cell">
                        <span>${player?.name || 'Vacante'}</span>
                        ${player ? renderHtmlStars(calcPlayerStars(player)) : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${battingOrderList.length > 0 ? `
        <div class="section">
          <h2>Orden al Bat</h2>
          <table>
            <thead><tr><th>#</th><th>Num</th><th>Jugador</th></tr></thead>
            <tbody>
              ${battingOrderList.map(({ order, player }) => `
                <tr>
                  <td><strong>${order}</strong></td>
                  <td class="number">${player?.number || '-'}</td>
                  <td>
                    <div class="player-name-cell">
                        <span>${player?.name || '-'}</span>
                        ${player ? renderHtmlStars(calcPlayerStars(player)) : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        <div class="footer">Generado por DeprecadosAPP</div>
      </body>
      </html>
    `)
        printWindow.document.close()
        setTimeout(() => printWindow.print(), 300)
    }

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Alineaciones</h1>
                    <p className="text-text-muted text-sm mt-1">{lineups?.length || 0} alineaciones guardadas</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary flex items-center gap-2 w-fit"
                >
                    <Plus size={18} />
                    Nueva Alineación
                </button>
            </div>

            {(lineups?.length || 0) === 0 ? (
                <div className="glass-card p-12 text-center">
                    <CalendarDays size={48} className="mx-auto mb-4 text-text-muted/30" />
                    <p className="text-text-muted font-medium">
                        No hay alineaciones guardadas. Crea una desde el Campo o usa el botón de arriba.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {[...(lineups || [])].reverse().map((lineup, i) => {
                        const isExpanded = expandedId === lineup.id
                        const positions = lineup.positions || {}
                        const assignedCount = Object.keys(positions).length

                        return (
                            <div
                                key={lineup.id}
                                className="glass-card overflow-hidden animate-slide-up"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                {/* Lineup header */}
                                <div
                                    className="p-5 flex items-center gap-4 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : lineup.id)}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <CalendarDays size={20} className="text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate">{lineup.name || 'Sin nombre'}</h3>
                                        <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                                            <span>{lineup.date}</span>
                                            {lineup.opponent && <span>vs {lineup.opponent}</span>}
                                            <span className={`px-2 py-0.5 rounded-full ${assignedCount === 9 ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                                                {assignedCount}/9
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handlePrint(lineup) }}
                                            className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                                            title="Imprimir"
                                        >
                                            <Printer size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(lineup.id) }}
                                            className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                                    </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 border-t border-white/5 pt-5">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Mini field */}
                                            <div className="max-w-sm mx-auto">
                                                <BaseballField positions={positions} interactive={false} />
                                            </div>

                                            {/* Position list */}
                                            <div>
                                                <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">Alineación</h4>
                                                <div className="space-y-2">
                                                    {POSITIONS.filter(p => p.id !== 'DH').map(pos => {
                                                        const playerId = positions[pos.id]
                                                        const player = playerId ? getPlayer(playerId) : null
                                                        return (
                                                            <div key={pos.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/3">
                                                                <span className="w-8 text-xs font-bold text-primary">{pos.short}</span>
                                                                <span className="text-sm text-white flex-1">
                                                                    {player ? `#${player.number || '?'} ${player.name}` : '—'}
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                {/* Batting order */}
                                                {lineup.battingOrder?.length > 0 && (
                                                    <div className="mt-6">
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">Orden al Bat</h4>
                                                        <div className="space-y-2">
                                                            {lineup.battingOrder.map((playerId, idx) => {
                                                                const player = getPlayer(playerId)
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-white/3">
                                                                        <span className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="text-sm text-white">
                                                                            {player ? `#${player.number || '?'} ${player.name}` : '—'}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={resetCreateModal}
                title={createStep === 1 ? 'Nueva Alineación' : 'Orden al Bat'}
            >
                {createStep === 1 ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Nombre</label>
                            <input
                                type="text"
                                value={newLineup.name}
                                onChange={e => setNewLineup(prev => ({ ...prev, name: e.target.value }))}
                                className="input-field"
                                placeholder="Ej: Jornada 5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Fecha</label>
                            <input
                                type="date"
                                value={newLineup.date}
                                onChange={e => setNewLineup(prev => ({ ...prev, date: e.target.value }))}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Rival</label>
                            <input
                                type="text"
                                value={newLineup.opponent}
                                onChange={e => setNewLineup(prev => ({ ...prev, opponent: e.target.value }))}
                                className="input-field"
                                placeholder="Nombre del equipo rival"
                            />
                        </div>
                        <button onClick={() => setCreateStep(2)} className="btn-primary w-full">
                            Siguiente → Orden al Bat
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Auto-fill buttons */}
                        <div className="flex gap-2">
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

                        {/* Selected batting order */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                                    Alineación ({battingOrderDraft.length})
                                </label>
                            </div>
                            {battingOrderDraft.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-3 bg-white/3 rounded-xl">
                                    Selecciona jugadores de abajo
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
                                                        <option key={pos.id} value={pos.id} className="bg-surface text-white">{pos.short}</option>
                                                    ))}
                                                    <option value="BD" className="bg-surface text-white">BD</option>
                                                    <option value="Banca" className="bg-surface text-white">Banca</option>
                                                </select>
                                                <button onClick={() => moveBatter(idx, -1)} disabled={idx === 0} className="p-0.5 ml-1 text-text-muted hover:text-white disabled:opacity-20"><ArrowUp size={14} /></button>
                                                <button onClick={() => moveBatter(idx, 1)} disabled={idx === battingOrderDraft.length - 1} className="p-0.5 text-text-muted hover:text-white disabled:opacity-20"><ArrowDown size={14} /></button>
                                                <button onClick={() => removeFromBattingOrder(idx)} className="p-0.5 text-text-muted hover:text-red-400"><X size={14} /></button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Available players */}
                        {availableForBatting.length > 0 && (
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Jugadores disponibles</label>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {availableForBatting.map(player => (
                                        <button
                                            key={player.id}
                                            onClick={() => addToBattingOrder(player.id)}
                                            className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                                        >
                                            <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold bg-white/10 text-text-muted" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{player.number || '?'}</span>
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
                            <button onClick={() => setCreateStep(1)} className="btn-secondary flex-1">← Atrás</button>
                            <button
                                onClick={handleCreate}
                                disabled={battingOrderDraft.length < 1}
                                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Crear Alineación
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete confirmation */}
            <Modal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title="Eliminar Alineación"
            >
                <p className="text-text-muted mb-6">
                    ¿Estás seguro de que quieres eliminar esta alineación?
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => { deleteLineup(confirmDelete); setConfirmDelete(null) }}
                        className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700"
                    >
                        Eliminar
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
                </div>
            </Modal>
        </div>
    )
}
