const db = require("../config/database");

const createDepartment = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { name, description } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Department name is required",
      });
    }

    const departmentName = name.trim();

    const [existing] = await db.query(
      `
      SELECT id
      FROM departments
      WHERE organization_id = ?
        AND name = ?
      LIMIT 1
      `,
      [organizationId, departmentName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Department already exists",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO departments (
        organization_id,
        name,
        description
      )
      VALUES (?, ?, ?)
      `,
      [
        organizationId,
        departmentName,
        description?.trim() || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      department: {
        id: result.insertId,
        name: departmentName,
        description: description?.trim() || null,
      },
    });
  } catch (error) {
    console.error("Create department error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create department",
    });
  }
};

const getDepartments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    const [departments] = await db.query(
      `
      SELECT
        id,
        name,
        description,
        status,
        created_at
      FROM departments
      WHERE organization_id = ?
      ORDER BY name ASC
      `,
      [organizationId]
    );

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("Get departments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
    });
  }
};

module.exports = {
  createDepartment,
  getDepartments,
};