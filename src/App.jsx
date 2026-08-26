import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Admissions from './pages/Admissions';
import Contact from './pages/Contact';
import Departments from './pages/Departments';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PlaceholderPage from './pages/PlaceholderPage';
import ComingSoon from './pages/ComingSoon';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Footer links — placeholders for now */}
        <Route path="/placement" element={<PlaceholderPage title="Training and Placement" />} />
        <Route path="/activities" element={<PlaceholderPage title="Activities" />} />
        <Route path="/gallery/photos" element={<PlaceholderPage title="Photo Gallery" />} />
        <Route path="/gallery/videos" element={<PlaceholderPage title="Video Gallery" />} />
        <Route path="/departments/common" element={<PlaceholderPage title="Common To All Branch" />} />
        <Route path="/departments/cse" element={<PlaceholderPage title="CSE Branch" />} />
        <Route path="/departments/it" element={<PlaceholderPage title="IT Branch" />} />
        <Route path="/departments/mechanical" element={<PlaceholderPage title="Mechanical Branch" />} />
        <Route path="/departments/ece" element={<PlaceholderPage title="ECE Branch" />} />
        <Route path="/departments/ee" element={<PlaceholderPage title="EE Branch" />} />
        <Route path="/departments/civil" element={<PlaceholderPage title="Civil Engineering" />} />
        <Route path="/grievances/caste-discrimination" element={<PlaceholderPage title="Faculty/Student Caste (SC/ST/OBC) Based Discrimination Complaints" />} />
        <Route path="/grievances" element={<PlaceholderPage title="Grievances Redressal Cell" />} />
        <Route path="/anti-ragging" element={<PlaceholderPage title="Anti Ragging" />} />
        <Route path="/nba" element={<PlaceholderPage title="NBA" />} />
        <Route path="/aicte-feedback" element={<PlaceholderPage title="AICTE Feedback" />} />
        <Route path="/messages" element={<PlaceholderPage title="Messages" />} />
        <Route path="/important-links" element={<PlaceholderPage title="Important Links" />} />
        <Route path="/alumni" element={<PlaceholderPage title="Alumni Registration" />} />
        <Route path="/virtual-tour" element={<PlaceholderPage title="Campus Virtual Tour" />} />
        <Route path="/press" element={<PlaceholderPage title="Press Release" />} />
        <Route path="/clubs" element={<PlaceholderPage title="Institute Clubs" />} />

        <Route path="*" element={<ComingSoon />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;