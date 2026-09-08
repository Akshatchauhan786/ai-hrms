const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const register = async (req, res) => {
  try {
    const {
      organizationName,
      email,
      password,
      firstName,
      lastName,
    } = req.body;

    if (!organizationName || !email || !password || !firstName) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [organization] = await connection.query(
        "INSERT INTO organizations (name) VALUES (?)",
        [organizationName]
      );

      const organizationId = organization.insertId;

      const hashedPassword = await bcrypt.hash(password, 12);

      const [user] = await connection.query(
        `INSERT INTO users
        (organization_id, email, password, first_name, last_name)
        VALUES (?, ?, ?, ?, ?)`,
        [
          organizationId,
          email,
          hashedPassword,
          firstName,
          lastName || null,
        ]
      );

      const [roles] = await connection.query(
        "SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1"
      );

      if (roles.length === 0) {
        throw new Error("SUPER_ADMIN role not found");
      }

      await connection.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
        [user.insertId, roles[0].id]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Organization and admin user created successfully",
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const [users] = await db.query(
      `SELECT 
        u.id,
        u.organization_id,
        u.email,
        u.password,
        u.first_name,
        u.last_name,
        u.status
      FROM users u
      WHERE u.email = ?
      LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const [roles] = await db.query(
      `SELECT r.name
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [user.id]
    );

    const roleNames = roles.map((role) => role.name);

    const token = jwt.sign(
      {
        sub: user.id,
        organizationId: user.organization_id,
        roles: roleNames,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        organizationId: user.organization_id,
        roles: roleNames,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

module.exports = {
  register,
  login,
};