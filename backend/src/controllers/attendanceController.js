const db = require("../config/database");

/*
|--------------------------------------------------------------------------
| CHECK IN
|--------------------------------------------------------------------------
*/
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

    // Verify employee belongs to organization
    const [employees] = await db.query(
      `
      SELECT
        id,
        employee_code,
        first_name,
        last_name,
        status
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

    const employee = employees[0];

    if (employee.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Employee is not active",
      });
    }

    // Use MySQL server date
    const [todayResult] = await db.query(
      `SELECT CURDATE() AS attendance_date`
    );

    const attendanceDate = todayResult[0].attendance_date;

    // Check existing attendance
    const [existing] = await db.query(
      `
      SELECT
        id,
        check_in,
        check_out,
        status
      FROM attendance
      WHERE employee_id = ?
        AND organization_id = ?
        AND attendance_date = ?
      LIMIT 1
      `,
      [
        employee_id,
        organizationId,
        attendanceDate,
      ]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee already has attendance for today",
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
      [
        organizationId,
        employee_id,
        attendanceDate,
      ]
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


/*
|--------------------------------------------------------------------------
| CHECK OUT
|--------------------------------------------------------------------------
*/
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

    // Verify employee
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

    const [attendance] = await db.query(
      `
      SELECT
        id,
        check_in,
        check_out,
        attendance_date
      FROM attendance
      WHERE employee_id = ?
        AND organization_id = ?
        AND attendance_date = CURDATE()
      LIMIT 1
      `,
      [
        employee_id,
        organizationId,
      ]
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
      [
        attendance[0].id,
        organizationId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to check out",
      });
    }

    const [updated] = await db.query(
      `
      SELECT
        id,
        employee_id,
        attendance_date,
        check_in,
        check_out,
        working_minutes,
        status,
        remarks
      FROM attendance
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
      `,
      [
        attendance[0].id,
        organizationId,
      ]
    );

    const workingMinutes =
      Number(updated[0].working_minutes) || 0;

    res.json({
      success: true,
      message: "Check-out successful",
      attendance: updated[0],
      working_hours: `${Math.floor(
        workingMinutes / 60
      )}h ${workingMinutes % 60}m`,
    });
  } catch (error) {
    console.error("Check-out error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check out",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET ATTENDANCE
|--------------------------------------------------------------------------
|
| Supports:
| ?search=
| ?date=
| ?status=
| ?employee_id=
| ?from_date=
| ?to_date=
| ?page=
| ?limit=
|
|--------------------------------------------------------------------------
*/
const getAttendance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    let {
      search = "",
      employee_id = "",
      date = "",
      status = "",
      from_date = "",
      to_date = "",
      page = 1,
      limit = 20,
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    page = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    limit = Math.min(
      Math.max(
        parseInt(limit, 10) || 20,
        1
      ),
      100
    );

    const offset = (page - 1) * limit;

    const conditions = [
      "a.organization_id = ?",
    ];

    const params = [organizationId];

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */

    if (search.trim()) {
      const searchValue = `%${search.trim()}%`;

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
        )
      `);

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    /*
    |--------------------------------------------------------------------------
    | EMPLOYEE
    |--------------------------------------------------------------------------
    */

    if (employee_id) {
      conditions.push(
        "a.employee_id = ?"
      );

      params.push(employee_id);
    }

    /*
    |--------------------------------------------------------------------------
    | DATE
    |--------------------------------------------------------------------------
    */

    if (date) {
      conditions.push(
        "a.attendance_date = ?"
      );

      params.push(date);
    }

    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    if (status) {
      conditions.push(
        "a.status = ?"
      );

      params.push(status);
    }

    /*
    |--------------------------------------------------------------------------
    | DATE RANGE
    |--------------------------------------------------------------------------
    */

    if (from_date) {
      conditions.push(
        "a.attendance_date >= ?"
      );

      params.push(from_date);
    }

    if (to_date) {
      conditions.push(
        "a.attendance_date <= ?"
      );

      params.push(to_date);
    }

    const whereClause =
      conditions.join(" AND ");


    /*
    |--------------------------------------------------------------------------
    | TOTAL COUNT
    |--------------------------------------------------------------------------
    */

    const [countResult] =
      await db.query(
        `
        SELECT COUNT(*) AS total
        FROM attendance a
        INNER JOIN employees e
          ON e.id = a.employee_id
          AND e.organization_id =
              a.organization_id
        WHERE ${whereClause}
        `,
        params
      );

    const total =
      Number(countResult[0].total) || 0;


    /*
    |--------------------------------------------------------------------------
    | DYNAMIC SUMMARY
    |--------------------------------------------------------------------------
    */

    const [summaryResult] =
      await db.query(
        `
        SELECT
          COUNT(*) AS total,
          SUM(
            CASE
              WHEN a.status = 'PRESENT'
              THEN 1 ELSE 0
            END
          ) AS present,

          SUM(
            CASE
              WHEN a.status = 'ABSENT'
              THEN 1 ELSE 0
            END
          ) AS absent,

          SUM(
            CASE
              WHEN a.status = 'HALF_DAY'
              THEN 1 ELSE 0
            END
          ) AS half_day,

          SUM(
            CASE
              WHEN a.status = 'LEAVE'
              THEN 1 ELSE 0
            END
          ) AS leave_count

        FROM attendance a

        INNER JOIN employees e
          ON e.id = a.employee_id
          AND e.organization_id =
              a.organization_id

        WHERE ${whereClause}
        `,
        params
      );


    /*
    |--------------------------------------------------------------------------
    | ATTENDANCE DATA
    |--------------------------------------------------------------------------
    */

    const [attendance] =
      await db.query(
        `
        SELECT
          a.id,
          a.organization_id,
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
          AND e.organization_id =
              a.organization_id

        WHERE ${whereClause}

        ORDER BY
          a.attendance_date DESC,
          a.check_in DESC

        LIMIT ? OFFSET ?
        `,
        [
          ...params,
          limit,
          offset,
        ]
      );


    const summary =
      summaryResult[0] || {};

    res.json({
      success: true,

      data: attendance,

      summary: {
        total:
          Number(summary.total) || 0,

        present:
          Number(summary.present) || 0,

        absent:
          Number(summary.absent) || 0,

        half_day:
          Number(summary.half_day) || 0,

        leave:
          Number(summary.leave_count) || 0,
      },

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "Get attendance error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET EMPLOYEE ATTENDANCE
|--------------------------------------------------------------------------
*/
const getEmployeeAttendance = async (
  req,
  res
) => {
  try {
    const organizationId =
      req.user.organizationId;

    const employeeId =
      req.params.employeeId;

    let {
      from_date = "",
      to_date = "",
      page = 1,
      limit = 20,
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization information missing",
      });
    }

    if (
      !employeeId ||
      !/^\d+$/.test(employeeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    page = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    limit = Math.min(
      Math.max(
        parseInt(limit, 10) || 20,
        1
      ),
      100
    );

    const offset =
      (page - 1) * limit;


    /*
    |--------------------------------------------------------------------------
    | VERIFY EMPLOYEE
    |--------------------------------------------------------------------------
    */

    const [employees] =
      await db.query(
        `
        SELECT
          id,
          employee_code,
          first_name,
          last_name
        FROM employees
        WHERE id = ?
          AND organization_id = ?
        LIMIT 1
        `,
        [
          employeeId,
          organizationId,
        ]
      );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }


    const conditions = [
      "a.organization_id = ?",
      "a.employee_id = ?",
    ];

    const params = [
      organizationId,
      employeeId,
    ];

    if (from_date) {
      conditions.push(
        "a.attendance_date >= ?"
      );

      params.push(from_date);
    }

    if (to_date) {
      conditions.push(
        "a.attendance_date <= ?"
      );

      params.push(to_date);
    }

    const whereClause =
      conditions.join(" AND ");


    /*
    |--------------------------------------------------------------------------
    | COUNT
    |--------------------------------------------------------------------------
    */

    const [countResult] =
      await db.query(
        `
        SELECT COUNT(*) AS total
        FROM attendance a
        WHERE ${whereClause}
        `,
        params
      );

    const total =
      Number(countResult[0].total) || 0;


    /*
    |--------------------------------------------------------------------------
    | DATA
    |--------------------------------------------------------------------------
    */

    const [attendance] =
      await db.query(
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

        WHERE ${whereClause}

        ORDER BY
          a.attendance_date DESC

        LIMIT ? OFFSET ?
        `,
        [
          ...params,
          limit,
          offset,
        ]
      );


    res.json({
      success: true,

      employee: employees[0],

      data: attendance,

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "Get employee attendance error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch employee attendance",
    });
  }
};


module.exports = {
  checkIn,
  checkOut,
  getAttendance,
  getEmployeeAttendance,
};