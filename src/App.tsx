import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from '@/routes/Home'
import { History } from '@/routes/History'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
