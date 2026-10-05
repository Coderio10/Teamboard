import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthProvider";
import ProtectedRoute from "./ProtectedRoute";
import Login from "./Login";
import BoardList from "./BoardList";
import BoardEditor from "./BoardEditor";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><BoardList /></ProtectedRoute>} />
          <Route path="/board/:id" element={<ProtectedRoute><BoardEditor /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);