import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrolls, setPayrolls] = useState([]);

  const [error, setError] = useState("");

  const API_URL = "/api";

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const getArray = (data, keys = []) => {
    if (Array.isArray(data)) return data;

    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    return [];
  };

  const getEmployeeName = (employee) => {
    if (!employee) return "Unknown Employee";

    if (employee.name) return employee.name;

    return `${employee.first_name || ""} ${
      employee.last_name || ""
    }`.trim() || employee.employee_code || "Unknown Employee";
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // --------------------------------------------------
  // Fetch Dashboard Data
  // --------------------------------------------------

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [employeesRes, attendanceRes, leaveRes, payrollRes] =
        await Promise.all([
          fetch(`${API_URL}/employees`, {
            headers: getHeaders(),
          }),

          fetch(`${API_URL}/attendance`, {
            headers: getHeaders(),
          }),

          fetch(`${API_URL}/leave-requests`, {
            headers: getHeaders(),
          }),

          fetch(`${API_URL}/payroll`, {
            headers: getHeaders(),
          }),
        ]);

      const responses = [
        employeesRes,
        attendanceRes,
        leaveRes,
        payrollRes,
      ];

      const jsonResponses = await Promise.all(
        responses.map(async (response) => {
          const text = await response.text();

          if (!text) return {};

          try {
            return JSON.parse(text);
          } catch {
            return {};
          }
        })
      );

      const [
        employeesData,
        attendanceData,
        leaveData,
        payrollData,
      ] = jsonResponses;

      setEmployees(
        getArray(employeesData, [
          "employees",
          "data",
          "results",
        ])
      );

      setAttendance(
        getArray(attendanceData, [
          "attendance",
          "data",
          "results",
        ])
      );

      setLeaveRequests(
        getArray(leaveData, [
          "leaveRequests",
          "leave_requests",
          "requests",
          "data",
          "results",
        ])
      );

      setPayrolls(
        getArray(payrollData, [
          "payrolls",
          "payroll",
          "data",
          "results",
        ])
      );
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --------------------------------------------------
  // Today's Attendance
  // --------------------------------------------------

  const presentToday = attendance.filter(
    (item) =>
      String(item.status || "").toUpperCase() === "PRESENT"
  ).length;

  const halfDayToday = attendance.filter(
    (item) =>
      String(item.status || "").toUpperCase() === "HALF_DAY"
  ).length;

  const absentToday = Math.max(
    employees.length - presentToday - halfDayToday,
    0
  );

  // --------------------------------------------------
  // Leave
  // --------------------------------------------------

  const onLeave = leaveRequests.filter(
    (item) =>
      String(item.status || "").toUpperCase() === "APPROVED"
  ).length;

  const pendingLeaves = leaveRequests.filter(
    (item) =>
      String(item.status || "").toUpperCase() === "PENDING"
  ).length;

  // --------------------------------------------------
  // Payroll
  // --------------------------------------------------

  const currentDate = new Date();

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const currentMonthPayroll = payrolls.filter((item) => {
    const month = Number(
      item.payroll_month ?? item.month
    );

    const year = Number(
      item.payroll_year ?? item.year
    );

    return month === currentMonth && year === currentYear;
  });

  const monthlyPayroll = currentMonthPayroll.reduce(
    (total, item) =>
      total + Number(
        item.net_salary ??
        item.netSalary ??
        0
      ),
    0
  );

  const grossSalary = currentMonthPayroll.reduce(
    (total, item) =>
      total + Number(
        item.gross_salary ??
        item.grossSalary ??
        0
      ),
    0
  );

  const totalDeductions = currentMonthPayroll.reduce(
    (total, item) =>
      total + Number(
        item.total_deduction ??
        item.totalDeduction ??
        0
      ),
    0
  );

  // --------------------------------------------------
  // Recent Employees
  // --------------------------------------------------

  const recentEmployees = [...employees]
    .sort((a, b) => {
      const dateA = new Date(
        a.created_at || a.createdAt || 0
      );

      const dateB = new Date(
        b.created_at || b.createdAt || 0
      );

      return dateB - dateA;
    })
    .slice(0, 5);

  // --------------------------------------------------
  // Stats
  // --------------------------------------------------

  const stats = [
    {
      title: "Total Employees",
      value: employees.length,
      icon: "👥",
    },
    {
      title: "Present Today",
      value: presentToday,
      icon: "✅",
    },
    {
      title: "On Leave",
      value: onLeave,
      icon: "📅",
    },
    {
      title: "Payroll",
      value: formatCurrency(monthlyPayroll),
      icon: "💰",
    },
  ];

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Loading your HRMS dashboard...</p>
          </div>
        </div>

        <div className="dashboard-loading">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back! Here's what's happening today.
          </p>
        </div>

        <button
          className="dashboard-refresh-btn"
          onClick={fetchDashboardData}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div
            className="stat-card"
            key={stat.title}
          >
            <div className="stat-icon">
              {stat.icon}
            </div>

            <div>
              <p>{stat.title}</p>
              <h3>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Extra Attendance Stats */}
      <div className="dashboard-grid">

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3>Today's Attendance</h3>
              <p>Current attendance overview</p>
            </div>

            <button
              onClick={() => navigate("/attendance")}
            >
              View All
            </button>
          </div>

          <div className="attendance-summary">

            <div className="attendance-item">
              <span>Present</span>
              <strong>{presentToday}</strong>
            </div>

            <div className="attendance-item">
              <span>Half Day</span>
              <strong>{halfDayToday}</strong>
            </div>

            <div className="attendance-item">
              <span>Absent</span>
              <strong>{absentToday}</strong>
            </div>

          </div>
        </div>

        {/* Leave Overview */}
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3>Leave Overview</h3>
              <p>Current leave requests</p>
            </div>

            <button
              onClick={() => navigate("/leave")}
            >
              View All
            </button>
          </div>

          <div className="leave-summary">

            <div>
              <span>Pending Requests</span>
              <strong>{pendingLeaves}</strong>
            </div>

            <div>
              <span>Approved</span>
              <strong>{onLeave}</strong>
            </div>

          </div>
        </div>

      </div>

      {/* Recent Employees + Payroll */}
      <div className="dashboard-grid">

        {/* Recent Employees */}
        <div className="dashboard-card">

          <div className="card-header">
            <div>
              <h3>Recent Employees</h3>
              <p>Recently added employees</p>
            </div>

            <button
              onClick={() => navigate("/employees")}
            >
              View All
            </button>
          </div>

          {recentEmployees.length === 0 ? (
            <div className="empty-state">
              <span>👤</span>
              <p>No recent employee activity</p>
            </div>
          ) : (
            <div className="recent-employees">

              {recentEmployees.map((employee) => (
                <div
                  className="recent-employee"
                  key={employee.id}
                >

                  <div className="employee-avatar">
                    {(
                      employee.first_name ||
                      employee.name ||
                      "E"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="employee-info">

                    <strong>
                      {getEmployeeName(employee)}
                    </strong>

                    <span>
                      {employee.employee_code ||
                        employee.employeeCode ||
                        "Employee"}
                    </span>

                  </div>

                  <div className="employee-date">
                    {formatDate(
                      employee.created_at ||
                      employee.createdAt ||
                      employee.joining_date
                    )}
                  </div>

                </div>
              ))}

            </div>
          )}

        </div>

        {/* Payroll */}
        <div className="dashboard-card">

          <div className="card-header">
            <div>
              <h3>Payroll Overview</h3>
              <p>
                {currentMonth}/{currentYear} payroll
              </p>
            </div>

            <button
              onClick={() => navigate("/payroll")}
            >
              View All
            </button>
          </div>

          <div className="payroll-summary">

            <div>
              <span>Gross Salary</span>
              <strong>
                {formatCurrency(grossSalary)}
              </strong>
            </div>

            <div>
              <span>Deductions</span>
              <strong>
                {formatCurrency(totalDeductions)}
              </strong>
            </div>

            <div>
              <span>Net Salary</span>
              <strong>
                {formatCurrency(monthlyPayroll)}
              </strong>
            </div>

          </div>

          <div className="payroll-count">
            {currentMonthPayroll.length} payroll record
            {currentMonthPayroll.length !== 1
              ? "s"
              : ""} generated this month
          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;