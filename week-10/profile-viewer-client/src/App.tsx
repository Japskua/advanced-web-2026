import { Navigate, Route, Routes } from "react-router";
import RequireSession from "./components/RequireSession";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      {/* A layout route without a path: it wraps its children. Every route
          inside requires a session; more protected pages go here too. */}
      <Route element={<RequireSession />}>
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
