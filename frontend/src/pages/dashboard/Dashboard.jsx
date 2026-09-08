function Dashboard() {
  const stats = [
    {
      title: "Total Employees",
      value: "1",
      icon: "👥",
    },
    {
      title: "Present Today",
      value: "0",
      icon: "✅",
    },
    {
      title: "On Leave",
      value: "0",
      icon: "📅",
    },
    {
      title: "Payroll",
      value: "₹43,700",
      icon: "💰",
    },
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.title}>
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

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3>Recent Employees</h3>
              <p>Recently added employees</p>
            </div>

            <button>View All</button>
          </div>

          <div className="empty-state">
            <span>👤</span>
            <p>No recent employee activity</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3>Payroll Overview</h3>
              <p>Current payroll status</p>
            </div>
          </div>

          <div className="payroll-summary">
            <div>
              <span>Gross Salary</span>
              <strong>₹48,000</strong>
            </div>

            <div>
              <span>Deductions</span>
              <strong>₹4,300</strong>
            </div>

            <div>
              <span>Net Salary</span>
              <strong>₹43,700</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;