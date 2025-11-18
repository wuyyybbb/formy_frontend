import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import FeatureSelection from './pages/FeatureSelection'
import Editor from './pages/Editor'

function App() {
  return (
    <div className="min-h-screen bg-dark">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeatureSelection />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </div>
  )
}

export default App

