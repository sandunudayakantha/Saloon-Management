
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import Calendar from '@/pages/Calendar';
import TeamManagement from '@/pages/TeamManagement';
import ClientManagement from '@/pages/ClientManagement';
import ServiceManagement from '@/pages/ServiceManagement';
import Market from '@/pages/Market';
import ShopManagement from '@/pages/ShopManagement';
import AdminDashboard from '@/pages/AdminDashboard';
import EmploymentStatusManagement from '@/pages/EmploymentStatusManagement';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { ShopProvider } from '@/contexts/ShopContext';
import { AlertDialogProvider, useAlertDialog } from '@/contexts/AlertDialogContext';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';


const ProtectedRoute = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="w-screen h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }
  return session ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { session, loading, userRole } = useAuth();

  if (loading) {
    return <div className="w-screen h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  // Check if user has admin or owner role
  if (userRole !== 'admin' && userRole !== 'owner') {
    return <Navigate to="/" />;
  }

  return children;
};


const GlobalAlertDialog = () => {
  const { dialog, hideDialog } = useAlertDialog();
  if (!dialog.isOpen) return null;

  return (
    <AlertDialog open={dialog.isOpen} onOpenChange={hideDialog}>
      <AlertDialogContent className="bg-white border-2 border-gray-200 text-gray-900 shadow-2xl rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-semibold text-gray-900">{dialog.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600 mt-2">
            {dialog.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel onClick={dialog.onCancel || hideDialog} className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={dialog.onConfirm} className="bg-red-600 hover:bg-red-700 text-white border-none shadow-sm hover:shadow-md transition-shadow">{dialog.confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

function App() {
  return (
    <AuthProvider>
      <ShopProvider>
        <AlertDialogProvider>
          <Helmet>
            <title>Salon Booking System</title>
            <meta name="description" content="Professional salon booking and management system" />
          </Helmet>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><ClientManagement /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><ServiceManagement /></ProtectedRoute>} />
              <Route path="/market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
              <Route path="/settings/shops" element={<ProtectedRoute><ShopManagement /></ProtectedRoute>} />
              <Route path="/settings/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/settings/employment-status" element={<ProtectedRoute><EmploymentStatusManagement /></ProtectedRoute>} />
            </Routes>
          </Router>
          <Toaster />
          <GlobalAlertDialog />
        </AlertDialogProvider>
      </ShopProvider>
    </AuthProvider>
  );
}

export default App;
