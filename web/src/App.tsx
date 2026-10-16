import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./admin/AdminPage";
import { LoginPage } from "./auth/LoginPage";
import { PublicViewerPage } from "./public-viewer/PublicViewerPage";

function isSignedIn() {
  return Boolean(localStorage.getItem("epc_token"));
}

export function App() {
  return (
    <Routes>
      {/* Fully open, no login required */}
      <Route path="/" element={<PublicViewerPage />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={isSignedIn() ? <AdminPage /> : <Navigate to="/admin/login" replace />}
      />
    </Routes>
  );
}
