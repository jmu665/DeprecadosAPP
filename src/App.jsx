import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DataProvider, useData } from './utils/DataContext'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import RosterPage from './pages/RosterPage'
import FieldPage from './pages/FieldPage'
import LineupsPage from './pages/LineupsPage'
import StatsPage from './pages/StatsPage'
import GamesPage from './pages/GamesPage'
import { Database, Wifi, WifiOff } from 'lucide-react'

function DbStatusBanner() {
    const { loading, dbReady } = useData()

    if (loading) {
        return (
            <div className="fixed top-0 left-0 right-0 z-50 bg-primary/20 backdrop-blur-sm text-center py-2 text-xs text-white font-medium">
                <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    Conectando a base de datos...
                </div>
            </div>
        )
    }

    return (
        <div className={`fixed top-0 left-0 right-0 z-50 text-center py-1 text-[10px] font-medium transition-all duration-500
      ${dbReady ? 'bg-green-600/15 text-green-400' : 'bg-yellow-600/15 text-yellow-400'}`}>
            <div className="flex items-center justify-center gap-1.5">
                {dbReady ? (
                    <>
                        <Database size={10} />
                        SQLite conectado
                    </>
                ) : (
                    <>
                        <WifiOff size={10} />
                        Modo local (localStorage) — Inicia el servidor para usar SQLite
                    </>
                )}
            </div>
        </div>
    )
}

function AppContent() {
    const { loading } = useData()

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <img src="/logo.png" alt="Deprecados" className="w-20 h-20 mx-auto mb-4 rounded-full animate-pulse" />
                    <p className="text-text-muted text-sm">Cargando...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <DbStatusBanner />
            <Navbar />
            <main className="md:pl-20 pb-24 md:pb-8 pt-6">
                <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/roster" element={<RosterPage />} />
                        <Route path="/field" element={<FieldPage />} />
                        <Route path="/lineups" element={<LineupsPage />} />
                        <Route path="/stats" element={<StatsPage />} />
                        <Route path="/games" element={<GamesPage />} />
                    </Routes>
                </div>
            </main>
        </div>
    )
}

export default function App() {
    return (
        <DataProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </DataProvider>
    )
}
