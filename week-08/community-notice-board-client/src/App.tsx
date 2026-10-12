import { Navigate, Route, Routes } from "react-router";
import AdminRoute from "./components/AdminRoute";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminNewNotificationPage from "./pages/AdminNewNotificationPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import RegisterPage from "./pages/RegisterPage";

// The client-side mirror of the API's route table: public pages, pages for
// any logged-in user, and admin pages.
export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/notifications" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/notifications/new"
          element={
            <AdminRoute>
              <AdminNewNotificationPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/notifications" replace />} />
      </Routes>
    </AppLayout>
  );
}
