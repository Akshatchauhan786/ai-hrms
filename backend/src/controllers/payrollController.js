const PDFDocument = require("pdfkit");
const db = require("../config/database");

const generatePayroll = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      payroll_month,
      payroll_year,
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (!employee_id || !payroll_month || !payroll_year) {
      return res.status(400).json({
        success: false,
        message: "Employee, month and year are required",
      });
    }

    const month = Number(payroll_month);
    const year = Number(payroll_year);

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll month",
      });
    }

    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll year",
      });
    }

    await connection.beginTransaction();

    // Employee
    const [employees] = await connection.query(
      `
      SELECT id, employee_code, first_name, last_name, joining_date
      FROM employees
      WHERE id = ?
        AND organization_id = ?
        AND status = 'ACTIVE'
      LIMIT 1
      `,
      [employee_id, organizationId]
    );

    if (employees.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Active employee not found",
      });
    }

    // Prevent duplicate payroll
    const [existingPayroll] = await connection.query(
      `
      SELECT id, status
      FROM payrolls
      WHERE organization_id = ?
        AND employee_id = ?
        AND payroll_month = ?
        AND payroll_year = ?
      LIMIT 1
      `,
      [
        organizationId,
        employee_id,
        month,
        year,
      ]
    );

    if (existingPayroll.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Payroll already exists for this month",
        payroll_id: existingPayroll[0].id,
        status: existingPayroll[0].status,
      });
    }

    // Active salary structure
    const [salaryRows] = await connection.query(
      `
      SELECT
        id,
        basic_salary,
        hra,
        transport_allowance,
        medical_allowance,
        other_allowance,
        provident_fund,
        professional_tax,
        other_deduction
      FROM salary_structures
      WHERE organization_id = ?
        AND employee_id = ?
        AND status = 'ACTIVE'
        AND effective_from <= LAST_DAY(
          STR_TO_DATE(
            CONCAT(?, '-', ?, '-01'),
            '%Y-%m-%d'
          )
        )
        AND (
          effective_to IS NULL
          OR effective_to >= STR_TO_DATE(
            CONCAT(?, '-', ?, '-01'),
            '%Y-%m-%d'
          )
        )
      ORDER BY effective_from DESC
      LIMIT 1
      `,
      [
        organizationId,
        employee_id,
        year,
        month,
        year,
        month,
      ]
    );

    if (salaryRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Active salary structure not found",
      });
    }

    const salary = salaryRows[0];

    // Days in month
    const daysInMonth = new Date(
      year,
      month,
      0
    ).getDate();

    // Attendance summary
    const [attendanceRows] = await connection.query(
      `
      SELECT
        COUNT(*) AS attendance_days
      FROM attendance
      WHERE organization_id = ?
        AND employee_id = ?
        AND attendance_date >= STR_TO_DATE(
          CONCAT(?, '-', ?, '-01'),
          '%Y-%m-%d'
        )
        AND attendance_date <= LAST_DAY(
          STR_TO_DATE(
            CONCAT(?, '-', ?, '-01'),
            '%Y-%m-%d'
          )
        )
        AND status IN ('PRESENT', 'HALF_DAY')
      `,
      [
        organizationId,
        employee_id,
        year,
        month,
        year,
        month,
      ]
    );

    const attendanceDays = Number(
      attendanceRows[0]?.attendance_days || 0
    );

    // Approved leave days
    const [leaveRows] = await connection.query(
      `
      SELECT
        COALESCE(SUM(total_days), 0) AS leave_days
      FROM leave_requests
      WHERE organization_id = ?
        AND employee_id = ?
        AND status = 'APPROVED'
        AND start_date <= LAST_DAY(
          STR_TO_DATE(
            CONCAT(?, '-', ?, '-01'),
            '%Y-%m-%d'
          )
        )
        AND end_date >= STR_TO_DATE(
          CONCAT(?, '-', ?, '-01'),
          '%Y-%m-%d'
        )
      `,
      [
        organizationId,
        employee_id,
        year,
        month,
        year,
        month,
      ]
    );

    const leaveDays = Number(
      leaveRows[0]?.leave_days || 0
    );

    /*
      Salary calculation
    */

    const basicSalary = Number(salary.basic_salary);
    const hra = Number(salary.hra);
    const transportAllowance = Number(
      salary.transport_allowance
    );
    const medicalAllowance = Number(
      salary.medical_allowance
    );
    const otherAllowance = Number(
      salary.other_allowance
    );

    const providentFund = Number(
      salary.provident_fund
    );
    const professionalTax = Number(
      salary.professional_tax
    );
    const otherDeduction = Number(
      salary.other_deduction
    );

    const grossSalary =
      basicSalary +
      hra +
      transportAllowance +
      medicalAllowance +
      otherAllowance;

    const totalDeduction =
      providentFund +
      professionalTax +
      otherDeduction;

    const netSalary =
      grossSalary - totalDeduction;

    const paidDays = Math.min(
      daysInMonth,
      attendanceDays + leaveDays
    );

    const [result] = await connection.query(
      `
      INSERT INTO payrolls (
        organization_id,
        employee_id,
        payroll_month,
        payroll_year,

        working_days,
        paid_days,
        leave_days,

        basic_salary,
        hra,
        transport_allowance,
        medical_allowance,
        other_allowance,

        gross_salary,

        provident_fund,
        professional_tax,
        other_deduction,

        total_deduction,
        net_salary,

        status,
        processed_at
      )
      VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?,
        'PROCESSED',
        NOW()
      )
      `,
      [
        organizationId,
        employee_id,
        month,
        year,

        daysInMonth,
        paidDays,
        leaveDays,

        basicSalary,
        hra,
        transportAllowance,
        medicalAllowance,
        otherAllowance,

        grossSalary,

        providentFund,
        professionalTax,
        otherDeduction,

        totalDeduction,
        netSalary,
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Payroll generated successfully",

      payroll: {
        id: result.insertId,

        employee_id,
        employee_code: employees[0].employee_code,

        payroll_month: month,
        payroll_year: year,

        working_days: daysInMonth,
        paid_days: paidDays,
        leave_days: leaveDays,

        basic_salary: basicSalary,
        gross_salary: grossSalary,

        total_deduction: totalDeduction,
        net_salary: netSalary,

        status: "PROCESSED",
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Generate payroll error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate payroll",
    });
  } finally {
    connection.release();
  }
};

const getPayrolls = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      employee_id,
      month,
      year,
      status,
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
      WHERE p.organization_id = ?
    `;

    const params = [organizationId];

    if (employee_id) {
      where += ` AND p.employee_id = ?`;
      params.push(employee_id);
    }

    if (month) {
      where += ` AND p.payroll_month = ?`;
      params.push(month);
    }

    if (year) {
      where += ` AND p.payroll_year = ?`;
      params.push(year);
    }

    if (status) {
      where += ` AND p.status = ?`;
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM payrolls p
      ${where}
      `,
      params
    );

    const total = Number(countRows[0].total);

    const [payrolls] = await db.query(
      `
      SELECT
        p.id,

        p.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,

        p.payroll_month,
        p.payroll_year,

        p.working_days,
        p.paid_days,
        p.leave_days,

        p.basic_salary,
        p.hra,
        p.transport_allowance,
        p.medical_allowance,
        p.other_allowance,

        p.gross_salary,

        p.provident_fund,
        p.professional_tax,
        p.other_deduction,

        p.total_deduction,
        p.net_salary,

        p.status,

        p.processed_at,
        p.approved_at,
        p.paid_at,

        p.created_at,
        p.updated_at

      FROM payrolls p

      INNER JOIN employees e
        ON e.id = p.employee_id
        AND e.organization_id = p.organization_id

      ${where}

      ORDER BY p.payroll_year DESC,
               p.payroll_month DESC,
               p.created_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, currentLimit, offset]
    );

    res.json({
      success: true,
      data: payrolls,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    });
  } catch (error) {
    console.error("Get payrolls error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch payrolls",
    });
  }
};

const getPayrollById = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const payrollId = req.params.id;

    const [rows] = await db.query(
      `
      SELECT
        p.*,

        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone,

        d.name AS department_name,
        dg.name AS designation_name

      FROM payrolls p

      INNER JOIN employees e
        ON e.id = p.employee_id
        AND e.organization_id = p.organization_id

      LEFT JOIN departments d
        ON d.id = e.department_id

      LEFT JOIN designations dg
        ON dg.id = e.designation_id

      WHERE p.id = ?
        AND p.organization_id = ?

      LIMIT 1
      `,
      [payrollId, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get payroll error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch payroll",
    });
  }
};

const approvePayroll = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const payrollId = req.params.id;

    const [result] = await db.query(
      `
      UPDATE payrolls
      SET
        status = 'APPROVED',
        approved_at = NOW()
      WHERE id = ?
        AND organization_id = ?
        AND status = 'PROCESSED'
      `,
      [payrollId, organizationId]
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.query(
        `
        SELECT id, status
        FROM payrolls
        WHERE id = ?
          AND organization_id = ?
        LIMIT 1
        `,
        [payrollId, organizationId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payroll not found",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Payroll cannot be approved from ${rows[0].status} status`,
      });
    }

    res.json({
      success: true,
      message: "Payroll approved successfully",
      payroll: {
        id: Number(payrollId),
        status: "APPROVED",
      },
    });
  } catch (error) {
    console.error("Approve payroll error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to approve payroll",
    });
  }
};


const markPayrollPaid = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const payrollId = req.params.id;

    const [result] = await db.query(
      `
      UPDATE payrolls
      SET
        status = 'PAID',
        paid_at = NOW()
      WHERE id = ?
        AND organization_id = ?
        AND status = 'APPROVED'
      `,
      [payrollId, organizationId]
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.query(
        `
        SELECT id, status
        FROM payrolls
        WHERE id = ?
          AND organization_id = ?
        LIMIT 1
        `,
        [payrollId, organizationId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payroll not found",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Payroll cannot be marked paid from ${rows[0].status} status`,
      });
    }

    res.json({
      success: true,
      message: "Payroll marked as paid successfully",
      payroll: {
        id: Number(payrollId),
        status: "PAID",
      },
    });
  } catch (error) {
    console.error("Mark payroll paid error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark payroll as paid",
    });
  }
};

const generatePayslip = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const payrollId = req.params.id;

    const [rows] = await db.query(
      `
      SELECT
        p.*,

        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone,

        d.name AS department_name,
        dg.name AS designation_name,

        o.name AS organization_name

      FROM payrolls p

      INNER JOIN employees e
        ON e.id = p.employee_id
        AND e.organization_id = p.organization_id

      LEFT JOIN departments d
        ON d.id = e.department_id

      LEFT JOIN designations dg
        ON dg.id = e.designation_id

      INNER JOIN organizations o
        ON o.id = p.organization_id

      WHERE p.id = ?
        AND p.organization_id = ?

      LIMIT 1
      `,
      [payrollId, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    const payroll = rows[0];

    if (!["APPROVED", "PAID"].includes(payroll.status)) {
      return res.status(400).json({
        success: false,
        message: "Payslip can only be generated for approved or paid payroll",
      });
    }

    const monthName = new Date(
      payroll.payroll_year,
      payroll.payroll_month - 1
    ).toLocaleString("en-US", {
      month: "long",
    });

    const employeeName = [
      payroll.first_name,
      payroll.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payslip-${payroll.employee_code}-${monthName}-${payroll.payroll_year}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(payroll.organization_name || "AI HRMS", {
        align: "center",
      });

    doc
      .moveDown(0.5)
      .fontSize(16)
      .text("SALARY PAYSLIP", {
        align: "center",
      });

    doc
      .moveDown(0.5)
      .fontSize(11)
      .font("Helvetica")
      .text(`${monthName} ${payroll.payroll_year}`, {
        align: "center",
      });

    doc.moveDown(1);

    // Employee Information
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Employee Information");

    doc.moveDown(0.5);

    doc.font("Helvetica");

    doc.text(`Employee Code: ${payroll.employee_code}`);
    doc.text(`Employee Name: ${employeeName}`);
    doc.text(
      `Department: ${payroll.department_name || "N/A"}`
    );
    doc.text(
      `Designation: ${payroll.designation_name || "N/A"}`
    );

    doc.moveDown(1);

    // Attendance
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Attendance");

    doc.moveDown(0.5);

    doc.font("Helvetica");

    doc.text(`Working Days: ${payroll.working_days}`);
    doc.text(`Paid Days: ${payroll.paid_days}`);
    doc.text(`Leave Days: ${payroll.leave_days}`);

    doc.moveDown(1);

    // Earnings
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Earnings");

    doc.moveDown(0.5);

    doc.font("Helvetica");

    doc.text(`Basic Salary: Rs. ${payroll.basic_salary}`);
    doc.text(`HRA: Rs. ${payroll.hra}`);
    doc.text(
      `Transport Allowance: Rs. ${payroll.transport_allowance}`
    );
    doc.text(
      `Medical Allowance: Rs. ${payroll.medical_allowance}`
    );
    doc.text(
      `Other Allowance: Rs. ${payroll.other_allowance}`
    );

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .text(`Gross Salary: Rs. ${payroll.gross_salary}`);

    doc.moveDown(1);

    // Deductions
    doc
      .fontSize(12)
      .text("Deductions");

    doc.moveDown(0.5);

    doc.font("Helvetica");

    doc.text(
      `Provident Fund: Rs. ${payroll.provident_fund}`
    );
    doc.text(
      `Professional Tax: Rs. ${payroll.professional_tax}`
    );
    doc.text(
      `Other Deduction: Rs. ${payroll.other_deduction}`
    );

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .text(
        `Total Deduction: Rs. ${payroll.total_deduction}`
      );

    doc.moveDown(1);

    // Net Salary
    doc
      .fontSize(15)
      .font("Helvetica-Bold")
      .text(`NET SALARY: Rs. ${payroll.net_salary}`);

    doc.moveDown(1);

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(`Status: ${payroll.status}`);

    if (payroll.paid_at) {
      doc.text(
        `Paid Date: ${new Date(payroll.paid_at).toLocaleDateString(
          "en-IN"
        )}`
      );
    }

    doc.moveDown(2);

    doc
      .fontSize(9)
      .fillColor("gray")
      .text(
        "This is a system-generated payslip from AI HRMS.",
        {
          align: "center",
        }
      );

    doc.end();
  } catch (error) {
    console.error("Generate payslip error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to generate payslip",
      });
    }
  }
};

module.exports = {
  generatePayroll,
  getPayrolls,
  getPayrollById,
  approvePayroll,
  markPayrollPaid,
  generatePayslip,
};