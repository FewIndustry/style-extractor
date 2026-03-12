import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from '@/routes/Home'
import { History } from '@/routes/History'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
