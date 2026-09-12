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

// --------------------------------------------------
// Get logged-in user
// --------------------------------------------------
function getUser() {
  try {
    const user = localStorage.getItem("user");

    if (!user) {
      return null;
    }

    return JSON.parse(user);
  } catch (error) {
    console.error("Failed to parse user:", error);
    return null;
  }
}

// --------------------------------------------------
// Get user roles
// --------------------------------------------------
function getUserRoles() {
  const user = getUser();

  if (!user) {
    return [];
  }

  const roles = user.roles || [];

  if (!Array.isArray(roles)) {
    return [String(roles).toUpperCase()];
  }

  return roles.map((role) => String(role).toUpperCase());
}

// --------------------------------------------------
// Check authentication
// --------------------------------------------------
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// --------------------------------------------------
// Admin / HR Route
// --------------------------------------------------
function AdminRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const roles = getUserRoles();

  const isAdmin = roles.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "HR"].includes(role)
  );

  if (!isAdmin) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
}

// --------------------------------------------------
// Employee Route
// --------------------------------------------------
function EmployeeRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const roles = getUserRoles();

  const isEmployee = roles.includes("EMPLOYEE");

  if (!isEmployee) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// --------------------------------------------------
// Employee Dashboard
// --------------------------------------------------
function EmployeeDashboard() {
  const user = getUser();

  return (
    <div style={{ padding: "30px" }}>
      <h1>Employee Dashboard</h1>

      <p>
        Welcome{" "}
        <strong>
          {user?.firstName || "Employee"}
        </strong>
      </p>

      <p>
        You are logged in as an employee.
      </p>
    </div>
  );
}

// --------------------------------------------------
// App
// --------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================
            LOGIN
        ========================== */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* =========================
            ADMIN / HR APPLICATION
        ========================== */}
        <Route
          element={
            <AdminRoute>
              <MainLayout />
            </AdminRoute>
          }
        >
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/employees"
            element={<Employees />}
          />

          <Route
            path="/attendance"
            element={<Attendance />}
          />

          <Route
            path="/leaves"
            element={<Leaves />}
          />

          <Route
            path="/payroll"
            element={<Payroll />}
          />
        </Route>

        {/* =========================
            EMPLOYEE APPLICATION
        ========================== */}
        <Route
          path="/employee/dashboard"
          element={
            <EmployeeRoute>
              <EmployeeDashboard />
            </EmployeeRoute>
          }
        />

        {/* =========================
            DEFAULT ROUTE
        ========================== */}
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* =========================
            404 / UNKNOWN ROUTE
        ========================== */}
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