const db = require("../config/database");

const checkIn = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { employee_id } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Verify employee belongs to user's organization
    const [employees] = await db.query(
      `
      SELECT id, first_name, last_name, status
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

    if (employees[0].status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Employee is not active",
      });
    }

    // Server date/time
    const now = new Date();

    const attendanceDate = now.toISOString().slice(0, 10);

    // Check today's attendance
    const [existing] = await db.query(
      `
      SELECT id, check_in, check_out
      FROM attendance
      WHERE employee_id = ?
        AND attendance_date = ?
      LIMIT 1
      `,
      [employee_id, attendanceDate]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee has already checked in today",
        attendance: existing[0],
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO attendance (
        organization_id,
        employee_id,
        attendance_date,
        check_in,
        status
      )
      VALUES (?, ?, ?, NOW(), 'PRESENT')
      `,
      [organizationId, employee_id, attendanceDate]
    );

    res.status(201).json({
      success: true,
      message: "Check-in successful",
      attendance: {
        id: result.insertId,
        employee_id,
        attendance_date: attendanceDate,
        status: "PRESENT",
      },
    });
  } catch (error) {
    console.error("Check-in error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check in",
    });
  }
};

const checkOut = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { employee_id } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Verify employee belongs to this organization
    const [employees] = await db.query(
      `
      SELECT id, first_name, last_name, status
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

    // Get today's attendance
    const [attendance] = await db.query(
      `
      SELECT id, check_in, check_out, attendance_date
      FROM attendance
      WHERE employee_id = ?
        AND organization_id = ?
        AND attendance_date = CURDATE()
      LIMIT 1
      `,
      [employee_id, organizationId]
    );

    if (attendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Employee has not checked in today",
      });
    }

    if (attendance[0].check_out) {
      return res.status(409).json({
        success: false,
        message: "Employee has already checked out today",
      });
    }

    // Calculate working minutes using MySQL server time
    const [result] = await db.query(
      `
      UPDATE attendance
      SET
        check_out = NOW(),
        working_minutes = TIMESTAMPDIFF(
          MINUTE,
          check_in,
          NOW()
        )
      WHERE id = ?
        AND organization_id = ?
        AND check_out IS NULL
      `,
      [attendance[0].id, organizationId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to check out",
      });
    }

    // Fetch updated attendance
    const [updated] = await db.query(
      `
      SELECT
        id,
        employee_id,
        attendance_date,
        check_in,
        check_out,
        working_minutes,
        status
      FROM attendance
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [attendance[0].id, organizationId]
    );

    const workingMinutes = updated[0].working_minutes;

    res.json({
      success: true,
      message: "Check-out successful",
      attendance: updated[0],
      working_hours: `${Math.floor(workingMinutes / 60)}h ${
        workingMinutes % 60
      }m`,
    });
  } catch (error) {
    console.error("Check-out error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check out",
    });
  }
};

const getAttendance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    let {
      employee_id,
      date,
      from_date,
      to_date,
      page = 1,
      limit = 20,
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    // Safe pagination
    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const offset = (page - 1) * limit;

    let where = `
      WHERE a.organization_id = ?
    `;

    const params = [organizationId];

    // Employee filter
    if (employee_id) {
      where += ` AND a.employee_id = ?`;
      params.push(employee_id);
    }

    // Specific date
    if (date) {
      where += ` AND a.attendance_date = ?`;
      params.push(date);
    }

    // Date range
    if (from_date) {
      where += ` AND a.attendance_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      where += ` AND a.attendance_date <= ?`;
      params.push(to_date);
    }

    // Count
    const [countResult] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM attendance a
      ${where}
      `,
      params
    );

    const total = countResult[0].total;

    // Data
    const [attendance] = await db.query(
      `
      SELECT
        a.id,
        a.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,

        a.attendance_date,
        a.check_in,
        a.check_out,
        a.working_minutes,
        a.status,
        a.remarks

      FROM attendance a

      INNER JOIN employees e
        ON e.id = a.employee_id
        AND e.organization_id = a.organization_id

      ${where}

      ORDER BY a.attendance_date DESC, a.check_in DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: attendance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get attendance error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const employeeId = req.params.employeeId;

    let {
      from_date,
      to_date,
      page = 1,
      limit = 20,
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!employeeId || !/^\d+$/.test(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const offset = (page - 1) * limit;

    // Verify employee belongs to organization
    const [employees] = await db.query(
      `
      SELECT id, employee_code, first_name, last_name
      FROM employees
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [employeeId, organizationId]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    let where = `
      WHERE a.organization_id = ?
        AND a.employee_id = ?
    `;

    const params = [organizationId, employeeId];

    if (from_date) {
      where += ` AND a.attendance_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      where += ` AND a.attendance_date <= ?`;
      params.push(to_date);
    }

    // Total records
    const [countResult] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM attendance a
      ${where}
      `,
      params
    );

    const total = countResult[0].total;

    // Attendance data
    const [attendance] = await db.query(
      `
      SELECT
        a.id,
        a.employee_id,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.working_minutes,
        a.status,
        a.remarks
      FROM attendance a
      ${where}
      ORDER BY a.attendance_date DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      employee: employees[0],
      data: attendance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get employee attendance error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch employee attendance",
    });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getAttendance,
  getEmployeeAttendance,
};