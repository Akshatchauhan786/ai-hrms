import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/auth/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import MainLayout from "./layouts/MainLayout";
import Employees from "./pages/employees/Employees";
import Attendance from "./pages/attendance/Attendance";
import Leaves from "./pages/leaves/Leaves";
import Payroll from "./pages/payroll/Payroll";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* Protected Application */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          {/* Employees */}
          <Route
            path="/employees"
            element={<Employees />}
          />

          {/* Attendance */}
          <Route
            path="/attendance"
            element={<Attendance />}
          />

          {/* Leaves */}
          <Route
            path="/leaves"
            element={<Leaves />}
          />
          <Route
            path="/payroll"
            element={<Payroll />}
          />
        </Route>

        {/* Default */}
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* Invalid Route */}
        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;