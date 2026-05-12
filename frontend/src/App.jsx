import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyFiles from './pages/MyFiles';
import AdminPanel from './pages/AdminPanel';
import SharedFiles from './pages/SharedFiles';
import Vault from './pages/Vault';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="my-files" element={<MyFiles />} />
        <Route path="shared-files" element={
          <PrivateRoute allowedRoles={['Manager', 'User', 'Guest']}>
            <SharedFiles />
          </PrivateRoute>
        } />
        <Route path="vault" element={
          <PrivateRoute allowedRoles={['Administrator', 'Manager', 'User']}>
            <Vault />
          </PrivateRoute>
        } />
        <Route path="admin" element={
          <PrivateRoute allowedRoles={['Administrator']}>
            <AdminPanel />
          </PrivateRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

export default App;