const bcrypt = require("bcryptjs");
const db = require("../config/database");

/**
 * Create Employee
 *
 * Auto-generated login:
 * Email: username@demohrms.com
 * Password: username@123
 */
const createEmployee = async (req, res) => {
  let connection;

  try {
    const {
      username,
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
    if (!username || !employee_code || !first_name) {
      return res.status(400).json({
        success: false,
        message:
          "Username, employee code and first name are required",
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

    // Clean username
    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".");

    if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message:
          "Username can contain only letters, numbers, dot, underscore and hyphen",
      });
    }

    // Auto-generated login details
    const email = `${cleanUsername}@demohrms.com`;
    const defaultPassword = `${cleanUsername}@123`;

    // Check duplicate employee code in same organization
    const [existingEmployee] = await db.query(
      `
      SELECT id
      FROM employees
      WHERE organization_id = ?
        AND employee_code = ?
      LIMIT 1
      `,
      [organization_id, employee_code]
    );

    if (existingEmployee.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee code already exists",
      });
    }

    // Check duplicate login email
    const [existingUser] = await db.query(
      `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists. Try another username.",
      });
    }

    connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const firstName = first_name.trim();
      const lastName = last_name ? last_name.trim() : null;

      // Hash default password
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      // Create user login account
      const [userResult] = await connection.query(
        `
        INSERT INTO users (
          organization_id,
          email,
          password,
          first_name,
          last_name,
          status
        )
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [
          organization_id,
          email,
          hashedPassword,
          firstName,
          lastName,
        ]
      );

      const userId = userResult.insertId;

      // Get EMPLOYEE role
      const [roles] = await connection.query(
        `
        SELECT id
        FROM roles
        WHERE UPPER(name) = 'EMPLOYEE'
        LIMIT 1
        `
      );

      if (roles.length === 0) {
        throw new Error("EMPLOYEE role not found");
      }

      // Assign EMPLOYEE role
      await connection.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
        `,
        [userId, roles[0].id]
      );

      // Create employee profile
      const [employeeResult] = await connection.query(
        `
        INSERT INTO employees (
          user_id,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          organization_id,
          employee_code,
          firstName,
          lastName,
          phone || null,
          date_of_birth || null,
          department_id || null,
          designation_id || null,
          manager_id || null,
          joining_date || null,
          employment_type || "FULL_TIME",
        ]
      );

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: "Employee and login account created successfully",

        employee: {
          id: employeeResult.insertId,
          user_id: userId,
          username: cleanUsername,
          email,
          employee_code,
          first_name: firstName,
          last_name: lastName,
        },

        // Admin can see these credentials after creation
        loginDetails: {
          username: cleanUsername,
          email,
          password: defaultPassword,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Create employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create employee",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

/**
 * Get Employees
 */
const getEmployees = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );

    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const status = req.query.status || "";
    const departmentId = req.query.department_id || "";
    const designationId = req.query.designation_id || "";

    const conditions = ["e.organization_id = ?"];
    const params = [organizationId];

    // Search filter
    if (search) {
      conditions.push(`
        (
          e.employee_code LIKE ?
          OR e.first_name LIKE ?
          OR e.last_name LIKE ?
          OR CONCAT(
            e.first_name,
            ' ',
            COALESCE(e.last_name, '')
          ) LIKE ?
          OR u.email LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
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

    // Total count
    const [countResult] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE ${whereClause}
      `,
      params
    );

    const total = countResult[0].total;

    // Employee list
    const [employees] = await db.query(
      `
      SELECT
        e.id,
        e.user_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone,
        e.date_of_birth,
        e.joining_date,
        e.employment_type,
        e.status,

        u.email,

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

      LEFT JOIN users u
        ON u.id = e.user_id

      LEFT JOIN departments d
        ON d.id = e.department_id
        AND d.organization_id = e.organization_id

      LEFT JOIN designations ds
        ON ds.id = e.designation_id
        AND ds.organization_id = e.organization_id

      LEFT JOIN employees m
        ON m.id = e.manager_id
        AND m.organization_id = e.organization_id

      WHERE ${whereClause}

      ORDER BY e.id DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return res.json({
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

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};

/**
 * Get Employee By ID
 */
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
        e.user_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone,
        e.date_of_birth,
        e.joining_date,
        e.employment_type,
        e.status,

        u.email,

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

      LEFT JOIN users u
        ON u.id = e.user_id

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

    return res.json({
      success: true,
      data: employees[0],
    });
  } catch (error) {
    console.error("Get employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
    });
  }
};

/**
 * Update Employee
 */
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

    // Check employee belongs to organization
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

    // Employee cannot be their own manager
    if (
      manager_id &&
      Number(manager_id) === Number(employeeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee cannot be their own manager",
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

    return res.json({
      success: true,
      message: "Employee updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update employee",
    });
  }
};

/**
 * Delete/Deactivate Employee
 */
const deleteEmployee = async (req, res) => {
  let connection;

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

    connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Get linked user
      const [employees] = await connection.query(
        `
        SELECT user_id
        FROM employees
        WHERE id = ?
          AND organization_id = ?
        LIMIT 1
        `,
        [employeeId, organizationId]
      );

      if (employees.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      const userId = employees[0].user_id;

      // Deactivate employee profile
      await connection.query(
        `
        UPDATE employees
        SET status = 'INACTIVE'
        WHERE id = ?
          AND organization_id = ?
        `,
        [employeeId, organizationId]
      );

      // Deactivate linked login account
      if (userId) {
        await connection.query(
          `
          UPDATE users
          SET status = 'INACTIVE'
          WHERE id = ?
            AND organization_id = ?
          `,
          [userId, organizationId]
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        message:
          "Employee and login account deactivated successfully",
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Delete employee error:", error);

    return res.status(500).json({
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