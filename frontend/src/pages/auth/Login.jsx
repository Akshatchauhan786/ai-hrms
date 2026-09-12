import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loginAs, setLoginAs] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // ----------------------------------
      // LOGIN API
      // ----------------------------------
      const response = await api.post("/auth/login", form);

      const data = response.data;

      const token =
        data.token ||
        data.accessToken ||
        data.data?.token ||
        data.data?.accessToken;

      if (!token) {
        throw new Error("Token not received from server");
      }

      // ----------------------------------
      // GET USER FROM BACKEND RESPONSE
      // ----------------------------------
      const user =
        data.user ||
        data.data?.user ||
        data.data?.data?.user ||
        null;

      if (!user) {
        throw new Error("User details not received from server");
      }

      // ----------------------------------
      // GET USER ROLES
      // Backend response:
      // user.roles = ["SUPER_ADMIN"] / ["EMPLOYEE"]
      // ----------------------------------
      const backendRoles = Array.isArray(user.roles)
        ? user.roles
        : [];

      const normalizedRoles = backendRoles.map((role) =>
        String(role)
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, "_")
      );

      if (normalizedRoles.length === 0) {
        throw new Error(
          "No role assigned to this account. Please contact administrator."
        );
      }

      // ----------------------------------
      // ROLE TYPES
      // ----------------------------------
      const adminRoles = [
        "SUPER_ADMIN",
        "ADMIN",
        "HR",
        "ORGANIZATION_ADMIN",
      ];

      const employeeRoles = [
        "EMPLOYEE",
        "STAFF",
      ];

      const isAdmin = normalizedRoles.some((role) =>
        adminRoles.includes(role)
      );

      const isEmployee = normalizedRoles.some((role) =>
        employeeRoles.includes(role)
      );

      // ----------------------------------
      // VALIDATE SELECTED LOGIN TYPE
      // ----------------------------------
      if (loginAs === "admin" && !isAdmin) {
        throw new Error(
          "This account is not authorized for Admin / HR login."
        );
      }

      if (loginAs === "employee" && !isEmployee) {
        throw new Error(
          "This account is not authorized for Employee login."
        );
      }

      // ----------------------------------
      // CLEAR OLD AUTH DATA
      // ----------------------------------
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("roles");
      localStorage.removeItem("loginAs");

      // ----------------------------------
      // SAVE NEW AUTH DATA
      // ----------------------------------
      localStorage.setItem("token", token);
      localStorage.setItem("loginAs", loginAs);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem(
        "roles",
        JSON.stringify(normalizedRoles)
      );

      // ----------------------------------
      // REDIRECT BASED ON SELECTED LOGIN
      // ----------------------------------
      if (loginAs === "employee") {
        navigate("/employee/dashboard", {
          replace: true,
        });
      } else {
        navigate("/dashboard", {
          replace: true,
        });
      }
    } catch (error) {
      console.error("Login error:", error);

      setError(
        error.response?.data?.message ||
          error.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">AI</div>

          <h1>AI HRMS</h1>

          <p>Manage your workforce smarter</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* LOGIN AS */}
          <div className="form-group">
            <label>Login As</label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              {/* ADMIN / HR BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setLoginAs("admin");
                  setError("");
                }}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border:
                    loginAs === "admin"
                      ? "2px solid #2563eb"
                      : "1px solid #d1d5db",
                  background:
                    loginAs === "admin"
                      ? "#eff6ff"
                      : "#fff",
                  color: "#111827",
                  cursor: "pointer",
                  fontWeight:
                    loginAs === "admin"
                      ? "600"
                      : "400",
                }}
              >
                👨‍💼 Admin / HR
              </button>

              {/* EMPLOYEE BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setLoginAs("employee");
                  setError("");
                }}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border:
                    loginAs === "employee"
                      ? "2px solid #2563eb"
                      : "1px solid #d1d5db",
                  background:
                    loginAs === "employee"
                      ? "#eff6ff"
                      : "#fff",
                  color: "#111827",
                  cursor: "pointer",
                  fontWeight:
                    loginAs === "employee"
                      ? "600"
                      : "400",
                }}
              >
                👤 Employee
              </button>
            </div>
          </div>

          {/* EMAIL */}
          <div className="form-group">
            <label>Email</label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* PASSWORD */}
          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;