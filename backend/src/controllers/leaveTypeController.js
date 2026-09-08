const db = require("../config/database");

const createLeaveType = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { name, description, days_per_year } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Leave type name is required",
      });
    }

    const days = Number(days_per_year);

    if (!Number.isFinite(days) || days < 0 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "days_per_year must be between 0 and 365",
      });
    }

    const leaveTypeName = name.trim();

    const [existing] = await db.query(
      `
      SELECT id
      FROM leave_types
      WHERE organization_id = ?
        AND name = ?
      LIMIT 1
      `,
      [organizationId, leaveTypeName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Leave type already exists",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO leave_types (
        organization_id,
        name,
        description,
        days_per_year
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        organizationId,
        leaveTypeName,
        description?.trim() || null,
        days,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Leave type created successfully",
      leaveType: {
        id: result.insertId,
        name: leaveTypeName,
        description: description?.trim() || null,
        days_per_year: days,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    console.error("Create leave type error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create leave type",
    });
  }
};

const getLeaveTypes = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    const [leaveTypes] = await db.query(
      `
      SELECT
        id,
        name,
        description,
        days_per_year,
        status,
        created_at
      FROM leave_types
      WHERE organization_id = ?
      ORDER BY name ASC
      `,
      [organizationId]
    );

    res.json({
      success: true,
      data: leaveTypes,
    });
  } catch (error) {
    console.error("Get leave types error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch leave types",
    });
  }
};

module.exports = {
  createLeaveType,
  getLeaveTypes,
};