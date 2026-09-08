const db = require("../config/database");

const createLeaveBalance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      leave_type_id,
      year,
      allocated_days,
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!employee_id || !leave_type_id || !year) {
      return res.status(400).json({
        success: false,
        message: "Employee, leave type and year are required",
      });
    }

    const allocatedDays = Number(allocated_days);

    if (
      !Number.isFinite(allocatedDays) ||
      allocatedDays < 0 ||
      allocatedDays > 365
    ) {
      return res.status(400).json({
        success: false,
        message: "allocated_days must be between 0 and 365",
      });
    }

    // Verify employee
    const [employees] = await db.query(
      `
      SELECT id, employee_code, first_name, last_name
      FROM employees
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [employee_id, organizationId]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Verify leave type
    const [leaveTypes] = await db.query(
      `
      SELECT id, name, status
      FROM leave_types
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [leave_type_id, organizationId]
    );

    if (leaveTypes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    if (leaveTypes[0].status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Leave type is inactive",
      });
    }

    // Check duplicate balance
    const [existing] = await db.query(
      `
      SELECT id
      FROM employee_leave_balances
      WHERE employee_id = ?
        AND leave_type_id = ?
        AND year = ?
      LIMIT 1
      `,
      [employee_id, leave_type_id, year]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Leave balance already exists for this year",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO employee_leave_balances (
        organization_id,
        employee_id,
        leave_type_id,
        year,
        allocated_days,
        used_days
      )
      VALUES (?, ?, ?, ?, ?, 0)
      `,
      [
        organizationId,
        employee_id,
        leave_type_id,
        year,
        allocatedDays,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Leave balance created successfully",
      balance: {
        id: result.insertId,
        employee_id,
        leave_type_id,
        year,
        allocated_days: allocatedDays,
        used_days: 0,
        remaining_days: allocatedDays,
      },
    });
  } catch (error) {
    console.error("Create leave balance error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create leave balance",
    });
  }
};

const getLeaveBalances = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      year,
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    let where = `
      WHERE b.organization_id = ?
    `;

    const params = [organizationId];

    if (employee_id) {
      where += ` AND b.employee_id = ?`;
      params.push(employee_id);
    }

    if (year) {
      where += ` AND b.year = ?`;
      params.push(year);
    }

    const [balances] = await db.query(
      `
      SELECT
        b.id,
        b.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,

        b.leave_type_id,
        lt.name AS leave_type_name,

        b.year,
        b.allocated_days,
        b.used_days,

        (b.allocated_days - b.used_days) AS remaining_days

      FROM employee_leave_balances b

      INNER JOIN employees e
        ON e.id = b.employee_id
        AND e.organization_id = b.organization_id

      INNER JOIN leave_types lt
        ON lt.id = b.leave_type_id
        AND lt.organization_id = b.organization_id

      ${where}

      ORDER BY e.first_name ASC, lt.name ASC
      `,
      params
    );

    res.json({
      success: true,
      data: balances,
    });
  } catch (error) {
    console.error("Get leave balances error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch leave balances",
    });
  }
};

module.exports = {
  createLeaveBalance,
  getLeaveBalances,
};