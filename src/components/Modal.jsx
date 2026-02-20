import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}
