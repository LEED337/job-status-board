import { Navigate, Route, Routes } from "react-router-dom";
import { ManagePage } from "./pages/ManagePage.tsx";
import { SharePage } from "./pages/SharePage.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SharePage />} />
      <Route path="/share" element={<SharePage />} />
      <Route path="/manage" element={<ManagePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
