const db = require("../config/database");

const applyLeave = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      reason,
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (
      !employee_id ||
      !leave_type_id ||
      !start_date ||
      !end_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Employee, leave type, start date and end date are required",
      });
    }

    // Validate dates
    const start = new Date(`${start_date}T00:00:00`);
    const end = new Date(`${end_date}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    // Calculate inclusive leave days
    const totalDays =
      Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    await connection.beginTransaction();

    // Verify employee
    const [employees] = await connection.query(
      `
      SELECT id, employee_code, first_name, last_name, status
      FROM employees
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [employee_id, organizationId]
    );

    if (employees.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employees[0].status !== "ACTIVE") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Employee is not active",
      });
    }

    // Verify leave type
    const [leaveTypes] = await connection.query(
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
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    if (leaveTypes[0].status !== "ACTIVE") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Leave type is inactive",
      });
    }

    // Check leave balance
    const leaveYear = start.getFullYear();

    const [balances] = await connection.query(
      `
      SELECT
        id,
        allocated_days,
        used_days,
        (allocated_days - used_days) AS remaining_days
      FROM employee_leave_balances
      WHERE organization_id = ?
        AND employee_id = ?
        AND leave_type_id = ?
        AND year = ?
      LIMIT 1
      `,
      [
        organizationId,
        employee_id,
        leave_type_id,
        leaveYear,
      ]
    );

    if (balances.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Leave balance not configured for this employee",
      });
    }

    const remainingDays = Number(balances[0].remaining_days);

    if (remainingDays < totalDays) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Insufficient leave balance",
        remaining_days: remainingDays,
        requested_days: totalDays,
      });
    }

    // Check overlapping pending/approved leave
    const [overlapping] = await connection.query(
      `
      SELECT id
      FROM leave_requests
      WHERE organization_id = ?
        AND employee_id = ?
        AND status IN ('PENDING', 'APPROVED')
        AND start_date <= ?
        AND end_date >= ?
      LIMIT 1
      `,
      [
        organizationId,
        employee_id,
        end_date,
        start_date,
      ]
    );

    if (overlapping.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Leave request overlaps with an existing leave",
      });
    }

    // Create leave request
    const [result] = await connection.query(
      `
      INSERT INTO leave_requests (
        organization_id,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        reason,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `,
      [
        organizationId,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        totalDays,
        reason?.trim() || null,
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      leaveRequest: {
        id: result.insertId,
        employee_id,
        leave_type_id,
        leave_type: leaveTypes[0].name,
        start_date,
        end_date,
        total_days: totalDays,
        reason: reason?.trim() || null,
        status: "PENDING",
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Apply leave error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to submit leave request",
    });
  } finally {
    connection.release();
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      status,
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

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const currentLimit = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const offset = (currentPage - 1) * currentLimit;

    let where = `
      WHERE lr.organization_id = ?
    `;

    const params = [organizationId];

    if (employee_id) {
      where += ` AND lr.employee_id = ?`;
      params.push(employee_id);
    }

    if (status) {
      where += ` AND lr.status = ?`;
      params.push(status);
    }

    if (from_date) {
      where += ` AND lr.start_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      where += ` AND lr.end_date <= ?`;
      params.push(to_date);
    }

    const [countResult] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM leave_requests lr
      ${where}
      `,
      params
    );

    const total = countResult[0].total;

    const [requests] = await db.query(
      `
      SELECT
        lr.id,
        lr.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,

        lr.leave_type_id,
        lt.name AS leave_type_name,

        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status,

        lr.approved_by,
        lr.approved_at,
        lr.rejection_reason,

        lr.created_at,
        lr.updated_at

      FROM leave_requests lr

      INNER JOIN employees e
        ON e.id = lr.employee_id
        AND e.organization_id = lr.organization_id

      INNER JOIN leave_types lt
        ON lt.id = lr.leave_type_id
        AND lt.organization_id = lr.organization_id

      ${where}

      ORDER BY lr.created_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, currentLimit, offset]
    );

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    });
  } catch (error) {
    console.error("Get leave requests error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch leave requests",
    });
  }
};

const approveLeave = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const organizationId = req.user.organizationId;
    const approverId = req.user.id;
    const requestId = req.params.id;

    if (!organizationId || !approverId) {
      return res.status(400).json({
        success: false,
        message: "Authentication information missing",
      });
    }

    await connection.beginTransaction();

    // Lock leave request
    const [requests] = await connection.query(
      `
      SELECT
        id,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        status
      FROM leave_requests
      WHERE id = ?
        AND organization_id = ?
      FOR UPDATE
      `,
      [requestId, organizationId]
    );

    if (requests.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    const request = requests[0];

    if (request.status !== "PENDING") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: `Leave request is already ${request.status}`,
      });
    }

    const leaveYear = new Date(request.start_date).getFullYear();

    // Lock balance row
    const [balances] = await connection.query(
      `
      SELECT
        id,
        allocated_days,
        used_days,
        (allocated_days - used_days) AS remaining_days
      FROM employee_leave_balances
      WHERE organization_id = ?
        AND employee_id = ?
        AND leave_type_id = ?
        AND year = ?
      FOR UPDATE
      `,
      [
        organizationId,
        request.employee_id,
        request.leave_type_id,
        leaveYear,
      ]
    );

    if (balances.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Leave balance not configured",
      });
    }

    const balance = balances[0];
    const remainingDays = Number(balance.remaining_days);
    const requestedDays = Number(request.total_days);

    if (remainingDays < requestedDays) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Insufficient leave balance",
        remaining_days: remainingDays,
        requested_days: requestedDays,
      });
    }

    // Approve request
    await connection.query(
      `
      UPDATE leave_requests
      SET
        status = 'APPROVED',
        approved_by = ?,
        approved_at = NOW()
      WHERE id = ?
        AND organization_id = ?
        AND status = 'PENDING'
      `,
      [approverId, requestId, organizationId]
    );

    // Deduct balance
    await connection.query(
      `
      UPDATE employee_leave_balances
      SET used_days = used_days + ?
      WHERE id = ?
        AND organization_id = ?
      `,
      [
        requestedDays,
        balance.id,
        organizationId,
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Leave request approved successfully",
      leaveRequest: {
        id: request.id,
        status: "APPROVED",
        approved_by: approverId,
        total_days: requestedDays,
      },
      leaveBalance: {
        used_days: Number(balance.used_days) + requestedDays,
        remaining_days: remainingDays - requestedDays,
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Approve leave error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to approve leave request",
    });
  } finally {
    connection.release();
  }
};

const rejectLeave = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const approverId = req.user.id;
    const requestId = req.params.id;

    const { rejection_reason } = req.body;

    if (!organizationId || !approverId) {
      return res.status(400).json({
        success: false,
        message: "Authentication information missing",
      });
    }

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const [result] = await db.query(
      `
      UPDATE leave_requests
      SET
        status = 'REJECTED',
        approved_by = ?,
        approved_at = NOW(),
        rejection_reason = ?
      WHERE id = ?
        AND organization_id = ?
        AND status = 'PENDING'
      `,
      [
        approverId,
        rejection_reason.trim(),
        requestId,
        organizationId,
      ]
    );

    if (result.affectedRows === 0) {
      const [existing] = await db.query(
        `
        SELECT id, status
        FROM leave_requests
        WHERE id = ?
          AND organization_id = ?
        LIMIT 1
        `,
        [requestId, organizationId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Leave request not found",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Leave request is already ${existing[0].status}`,
      });
    }

    res.json({
      success: true,
      message: "Leave request rejected successfully",
      leaveRequest: {
        id: Number(requestId),
        status: "REJECTED",
        approved_by: approverId,
        rejection_reason: rejection_reason.trim(),
      },
    });
  } catch (error) {
    console.error("Reject leave error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reject leave request",
    });
  }
};

module.exports = {
  applyLeave,
  getLeaveRequests,
  approveLeave,
  rejectLeave,
};