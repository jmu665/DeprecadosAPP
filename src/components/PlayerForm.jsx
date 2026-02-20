import React from 'react'
import { POSITIONS } from '../utils/DataContext'

export default function PlayerForm({ player, onSave, onCancel }) {
    const [form, setForm] = React.useState({
        name: '',
        number: '',
        position: 'P',
        secondaryPosition: '',
        bats: 'R',
        throws: 'R',
        age: '',
        phone: '',
        ...player,
    })

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.name.trim()) return
        onSave(form)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Nombre completo</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => handleChange('name', e.target.value)}
                        className="input-field"
                        placeholder="Nombre del jugador"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Número</label>
                    <input
                        type="text"
                        value={form.number}
                        onChange={e => handleChange('number', e.target.value)}
                        className="input-field"
                        placeholder="#"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Posición principal</label>
                    <select
                        value={form.position}
                        onChange={e => handleChange('position', e.target.value)}
                        className="select-field"
                    >
                        {POSITIONS.map(pos => (
                            <option key={pos.id} value={pos.id}>{pos.short} - {pos.label}</option>
                        ))}
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Posición secundaria (también juega)</label>
                    <select
                        value={form.secondaryPosition}
                        onChange={e => handleChange('secondaryPosition', e.target.value)}
                        className="select-field"
                    >
                        <option value="">— Ninguna —</option>
                        {POSITIONS.filter(pos => pos.id !== form.position).map(pos => (
                            <option key={pos.id} value={pos.id}>{pos.short} - {pos.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Batea</label>
                    <select
                        value={form.bats}
                        onChange={e => handleChange('bats', e.target.value)}
                        className="select-field"
                    >
                        <option value="R">Derecha</option>
                        <option value="L">Izquierda</option>
                        <option value="S">Switch</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Tira</label>
                    <select
                        value={form.throws}
                        onChange={e => handleChange('throws', e.target.value)}
                        className="select-field"
                    >
                        <option value="R">Derecha</option>
                        <option value="L">Izquierda</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Edad</label>
                    <input
                        type="number"
                        value={form.age}
                        onChange={e => handleChange('age', e.target.value)}
                        className="input-field"
                        placeholder="Edad"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Teléfono</label>
                    <input
                        type="tel"
                        value={form.phone}
                        onChange={e => handleChange('phone', e.target.value)}
                        className="input-field"
                        placeholder="(opcional)"
                    />
                </div>
            </div>
            <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                    {player ? 'Guardar cambios' : 'Agregar jugador'}
                </button>
                <button type="button" onClick={onCancel} className="btn-secondary">
                    Cancelar
                </button>
            </div>
        </form>
    )
}
