const db = require("../config/database");

const createSalaryStructure = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      basic_salary,
      hra,
      transport_allowance,
      medical_allowance,
      other_allowance,
      provident_fund,
      professional_tax,
      other_deduction,
      effective_from,
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!employee_id || !effective_from) {
      return res.status(400).json({
        success: false,
        message: "Employee and effective date are required",
      });
    }

    // Check employee
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

    const values = {
      basic_salary: Number(basic_salary) || 0,
      hra: Number(hra) || 0,
      transport_allowance: Number(transport_allowance) || 0,
      medical_allowance: Number(medical_allowance) || 0,
      other_allowance: Number(other_allowance) || 0,
      provident_fund: Number(provident_fund) || 0,
      professional_tax: Number(professional_tax) || 0,
      other_deduction: Number(other_deduction) || 0,
    };

    const salaryFields = Object.values(values);

    if (salaryFields.some((value) => value < 0)) {
      return res.status(400).json({
        success: false,
        message: "Salary values cannot be negative",
      });
    }

    // Deactivate previous active structure
    await db.query(
      `
      UPDATE salary_structures
      SET status = 'INACTIVE',
          effective_to = DATE_SUB(?, INTERVAL 1 DAY)
      WHERE organization_id = ?
        AND employee_id = ?
        AND status = 'ACTIVE'
      `,
      [effective_from, organizationId, employee_id]
    );

    const [result] = await db.query(
      `
      INSERT INTO salary_structures (
        organization_id,
        employee_id,
        basic_salary,
        hra,
        transport_allowance,
        medical_allowance,
        other_allowance,
        provident_fund,
        professional_tax,
        other_deduction,
        effective_from,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        organizationId,
        employee_id,
        values.basic_salary,
        values.hra,
        values.transport_allowance,
        values.medical_allowance,
        values.other_allowance,
        values.provident_fund,
        values.professional_tax,
        values.other_deduction,
        effective_from,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Salary structure created successfully",
      salaryStructure: {
        id: result.insertId,
        employee_id,
        ...values,
        effective_from,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    console.error("Create salary structure error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create salary structure",
    });
  }
};

const getSalaryStructures = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { employee_id } = req.query;

    let where = `
      WHERE ss.organization_id = ?
    `;

    const params = [organizationId];

    if (employee_id) {
      where += ` AND ss.employee_id = ?`;
      params.push(employee_id);
    }

    const [salaryStructures] = await db.query(
      `
      SELECT
        ss.id,
        ss.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,

        ss.basic_salary,
        ss.hra,
        ss.transport_allowance,
        ss.medical_allowance,
        ss.other_allowance,

        (
          ss.basic_salary +
          ss.hra +
          ss.transport_allowance +
          ss.medical_allowance +
          ss.other_allowance
        ) AS gross_salary,

        ss.provident_fund,
        ss.professional_tax,
        ss.other_deduction,

        (
          ss.provident_fund +
          ss.professional_tax +
          ss.other_deduction
        ) AS total_deduction,

        (
          ss.basic_salary +
          ss.hra +
          ss.transport_allowance +
          ss.medical_allowance +
          ss.other_allowance -
          ss.provident_fund -
          ss.professional_tax -
          ss.other_deduction
        ) AS net_salary,

        ss.effective_from,
        ss.effective_to,
        ss.status,
        ss.created_at

      FROM salary_structures ss

      INNER JOIN employees e
        ON e.id = ss.employee_id
        AND e.organization_id = ss.organization_id

      ${where}

      ORDER BY ss.created_at DESC
      `,
      params
    );

    res.json({
      success: true,
      data: salaryStructures,
    });
  } catch (error) {
    console.error("Get salary structures error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch salary structures",
    });
  }
};

module.exports = {
  createSalaryStructure,
  getSalaryStructures,
};