import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Loja from './pages/Loja'
import Rastreio from './pages/Rastreio'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/loja/:codigo" element={<Loja />} />
        <Route path="/rastreio/:token" element={<Rastreio />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="text-5xl font-bold mb-2" style={{ color: '#F5A623' }}>DepGest</div>
        <p className="text-gray-400 mt-2">Página não encontrada</p>
        <p className="text-gray-600 text-sm mt-1">Use /loja/CODIGO ou /rastreio/TOKEN</p>
      </div>
    </div>
  )
}
