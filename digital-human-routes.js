// React Router Configuration for Digital Human Video
// Add this route to your App.tsx or routing configuration

import { Route, Routes } from 'react-router-dom';
import DigitalHumanVideoComplete2 from './pages/DigitalHumanVideoComplete2';

// In your App.tsx file, add this route:
/*
<Routes>
  {/* Other routes */}
  <Route path="/digital-human-video" element={<DigitalHumanVideoComplete2 />} />
  {/* Other routes */}
</Routes>
*/

// Example complete routing setup:
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Digital Human Video Route */}
          <Route path="/digital-human-video" element={<DigitalHumanVideoComplete2 />} />
          
          {/* Other routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

// Navigation link example:
/*
<Link to="/digital-human-video" className="nav-link">
  数字人视频创作
</Link>
*/

export default App;