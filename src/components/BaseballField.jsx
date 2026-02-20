import React from 'react'
import { FIELD_COORDS, POSITIONS, useData } from '../utils/DataContext'

export default function BaseballField({ positions = {}, onPositionClick, interactive = true }) {
    const { getPlayer } = useData()

    return (
        <div className="field-container">
            {/* Field SVG background */}
            <svg viewBox="0 0 400 400" className="w-full h-full" style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))' }}>
                {/* Outfield grass */}
                <path d="M200 380 L10 140 A240 240 0 0 1 390 140 Z" fill="#1B5E20" opacity="0.5" />
                {/* Infield dirt */}
                <path d="M200 340 L120 240 L200 170 L280 240 Z" fill="#5D4037" opacity="0.5" />
                {/* Infield grass */}
                <circle cx="200" cy="255" r="35" fill="#2E7D32" opacity="0.4" />
                {/* Base paths */}
                <line x1="200" y1="340" x2="120" y2="240" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <line x1="120" y1="240" x2="200" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <line x1="200" y1="170" x2="280" y2="240" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <line x1="280" y1="240" x2="200" y2="340" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                {/* Bases */}
                <rect x="194" y="334" width="12" height="12" fill="white" opacity="0.9" transform="rotate(45 200 340)" />
                <rect x="114" y="234" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 120 240)" />
                <rect x="194" y="164" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 200 170)" />
                <rect x="274" y="234" width="12" height="12" fill="white" opacity="0.7" transform="rotate(45 280 240)" />
                {/* Pitcher mound */}
                <circle cx="200" cy="255" r="5" fill="#8D6E63" opacity="0.8" />
                {/* Foul lines */}
                <line x1="200" y1="340" x2="10" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                <line x1="200" y1="340" x2="390" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                {/* Outfield arc */}
                <path d="M10 140 A240 240 0 0 1 390 140" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            </svg>

            {/* Position markers */}
            {Object.entries(FIELD_COORDS).map(([posId, coords]) => {
                const playerId = positions[posId]
                const player = playerId ? getPlayer(playerId) : null
                const posInfo = POSITIONS.find(p => p.id === posId)

                return (
                    <div
                        key={posId}
                        className="field-position"
                        style={{
                            top: coords.top,
                            left: coords.left,
                            transform: 'translate(-50%, -50%)',
                        }}
                        onClick={() => interactive && onPositionClick?.(posId)}
                    >
                        <div className={`field-position-dot ${player ? 'occupied' : ''}`}>
                            {player ? (
                                <span className="text-white">{player.number || posId}</span>
                            ) : (
                                <span className="text-text-muted">{posId}</span>
                            )}
                        </div>
                        <span className="field-position-label">{posInfo?.short}</span>
                        {player && (
                            <span className="field-position-name">{player.name.split(' ')[0]}</span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
