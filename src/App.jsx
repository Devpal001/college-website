import { lazy } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import PlaceholderPage from './pages/PlaceholderPage';
import ComingSoon from './pages/ComingSoon';
import Gallery from './components/Gallery';
import ProtectedRoute from './components/ProtectedRoute';
import AIAssistant from './components/AIAssistant';

// Route-level lazy loading (React 19 `lazy()` + React Router v7): keeps the
// initial public-page chunk small and loads dashboards/admin/news on demand.
const About = lazy(() => import('./pages/About'));
const Admissions = lazy(() => import('./pages/Admissions'));
const Contact = lazy(() => import('./pages/Contact'));
const Departments = lazy(() => import('./pages/Departments'));
const Login = lazy(() => import('./pages/Login'));
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const Notifications = lazy(() => import('./pages/Notifications'));
const PortalProfile = lazy(() => import('./pages/PortalProfile'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminNews = lazy(() => import('./pages/AdminNews'));
const AdminAgent = lazy(() => import('./pages/AdminAgent'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));

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
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<ActivateAccount />} />
        {/* Public self-signup retired (Decision 3): old links now lead to activation. */}
        <Route path="/signup" element={<Navigate to="/activate" replace />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/news" element={<NewsPage />} />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PortalProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/news"
          element={
            <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
              <AdminNews />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/agent"
          element={
            <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
              <AdminAgent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher-dashboard"
          element={
            <ProtectedRoute requiredRoles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

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
      <AIAssistant />
      <Footer />
    </>
  );
}

export default App;