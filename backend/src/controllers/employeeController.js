const db = require("../config/database");

const createEmployee = async (req, res) => {
  try {
    const {
      employee_code,
      first_name,
      last_name,
      phone,
      date_of_birth,
      department_id,
      designation_id,
      manager_id,
      joining_date,
      employment_type,
    } = req.body;

    // Basic validation
    if (!employee_code || !first_name) {
      return res.status(400).json({
        success: false,
        message: "Employee code and first name are required",
      });
    }

    // Organization comes from authenticated user
    const organization_id = req.user.organizationId;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    // Check duplicate employee code inside same organization
    const [existing] = await db.query(
      `SELECT id
       FROM employees
       WHERE organization_id = ?
       AND employee_code = ?
       LIMIT 1`,
      [organization_id, employee_code]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee code already exists",
      });
    }

    // Create employee
    const [result] = await db.query(
      `INSERT INTO employees (
        organization_id,
        employee_code,
        first_name,
        last_name,
        phone,
        date_of_birth,
        department_id,
        designation_id,
        manager_id,
        joining_date,
        employment_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organization_id,
        employee_code,
        first_name,
        last_name || null,
        phone || null,
        date_of_birth || null,
        department_id || null,
        designation_id || null,
        manager_id || null,
        joining_date || null,
        employment_type || "FULL_TIME",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      employee: {
        id: result.insertId,
        employee_code,
        first_name,
        last_name: last_name || null,
      },
    });
  } catch (error) {
    console.error("Create employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create employee",
    });
  }
};

const getEmployees = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    // Filters
    const search = (req.query.search || "").trim();
    const status = req.query.status || "";
    const departmentId = req.query.department_id || "";
    const designationId = req.query.designation_id || "";

    const conditions = ["e.organization_id = ?"];
    const params = [organizationId];

    // Search
    if (search) {
      conditions.push(`
        (
          e.employee_code LIKE ?
          OR e.first_name LIKE ?
          OR e.last_name LIKE ?
          OR CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    // Status filter
    if (status) {
      conditions.push("e.status = ?");
      params.push(status);
    }

    // Department filter
    if (departmentId) {
      conditions.push("e.department_id = ?");
      params.push(departmentId);
    }

    // Designation filter
    if (designationId) {
      conditions.push("e.designation_id = ?");
      params.push(designationId);
    }

    const whereClause = conditions.join(" AND ");

    // Get total count
    const [countResult] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM employees e
      WHERE ${whereClause}
      `,
      params
    );

    const total = countResult[0].total;

    // Get employees
    const [employees] = await db.query(
      `
      SELECT
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone,
        e.joining_date,
        e.employment_type,
        e.status,

        d.id AS department_id,
        d.name AS department_name,

        ds.id AS designation_id,
        ds.name AS designation_name

      FROM employees e

      LEFT JOIN departments d
        ON d.id = e.department_id
        AND d.organization_id = e.organization_id

      LEFT JOIN designations ds
        ON ds.id = e.designation_id
        AND ds.organization_id = e.organization_id

      WHERE ${whereClause}

      ORDER BY e.id DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get employees error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const employeeId = req.params.id;

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

    const [employees] = await db.query(
      `
      SELECT
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone,
        e.date_of_birth,
        e.joining_date,
        e.employment_type,
        e.status,

        d.id AS department_id,
        d.name AS department_name,

        ds.id AS designation_id,
        ds.name AS designation_name,

        m.id AS manager_id,
        CONCAT(
          m.first_name,
          ' ',
          COALESCE(m.last_name, '')
        ) AS manager_name

      FROM employees e

      LEFT JOIN departments d
        ON d.id = e.department_id
        AND d.organization_id = e.organization_id

      LEFT JOIN designations ds
        ON ds.id = e.designation_id
        AND ds.organization_id = e.organization_id

      LEFT JOIN employees m
        ON m.id = e.manager_id
        AND m.organization_id = e.organization_id

      WHERE e.id = ?
        AND e.organization_id = ?

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

    res.json({
      success: true,
      data: employees[0],
    });
  } catch (error) {
    console.error("Get employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
    });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const employeeId = req.params.id;

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

    const {
      employee_code,
      first_name,
      last_name,
      phone,
      date_of_birth,
      department_id,
      designation_id,
      manager_id,
      joining_date,
      employment_type,
      status,
    } = req.body;

    if (!employee_code || !first_name) {
      return res.status(400).json({
        success: false,
        message: "Employee code and first name are required",
      });
    }

    // Check employee belongs to this organization
    const [existing] = await db.query(
      `
      SELECT id
      FROM employees
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [employeeId, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check duplicate employee code
    const [duplicate] = await db.query(
      `
      SELECT id
      FROM employees
      WHERE organization_id = ?
        AND employee_code = ?
        AND id != ?
      LIMIT 1
      `,
      [organizationId, employee_code, employeeId]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee code already exists",
      });
    }

    const [result] = await db.query(
      `
      UPDATE employees
      SET
        employee_code = ?,
        first_name = ?,
        last_name = ?,
        phone = ?,
        date_of_birth = ?,
        department_id = ?,
        designation_id = ?,
        manager_id = ?,
        joining_date = ?,
        employment_type = ?,
        status = ?
      WHERE id = ?
        AND organization_id = ?
      `,
      [
        employee_code,
        first_name,
        last_name || null,
        phone || null,
        date_of_birth || null,
        department_id || null,
        designation_id || null,
        manager_id || null,
        joining_date || null,
        employment_type || "FULL_TIME",
        status || "ACTIVE",
        employeeId,
        organizationId,
      ]
    );

    res.json({
      success: true,
      message: "Employee updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update employee",
    });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const employeeId = req.params.id;

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

    const [result] = await db.query(
      `
      UPDATE employees
      SET status = 'INACTIVE'
      WHERE id = ?
        AND organization_id = ?
        AND status != 'INACTIVE'
      `,
      [employeeId, organizationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or already inactive",
      });
    }

    res.json({
      success: true,
      message: "Employee deactivated successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to deactivate employee",
    });
  }
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};