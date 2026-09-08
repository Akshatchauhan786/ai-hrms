const db = require("../config/database");

const createDesignation = async (req, res) => {
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
        message: "Designation name is required",
      });
    }

    const designationName = name.trim();

    const [existing] = await db.query(
      `
      SELECT id
      FROM designations
      WHERE organization_id = ?
        AND name = ?
      LIMIT 1
      `,
      [organizationId, designationName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Designation already exists",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO designations (
        organization_id,
        name,
        description
      )
      VALUES (?, ?, ?)
      `,
      [
        organizationId,
        designationName,
        description?.trim() || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Designation created successfully",
      designation: {
        id: result.insertId,
        name: designationName,
        description: description?.trim() || null,
      },
    });
  } catch (error) {
    console.error("Create designation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create designation",
    });
  }
};

const getDesignations = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    const [designations] = await db.query(
      `
      SELECT
        id,
        name,
        description,
        status,
        created_at
      FROM designations
      WHERE organization_id = ?
      ORDER BY name ASC
      `,
      [organizationId]
    );

    res.json({
      success: true,
      data: designations,
    });
  } catch (error) {
    console.error("Get designations error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch designations",
    });
  }
};

module.exports = {
  createDesignation,
  getDesignations,
};