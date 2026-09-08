const db = require("../config/database");

const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id || !req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const [permissions] = await db.query(
        `
        SELECT DISTINCT p.name
        FROM permissions p
        INNER JOIN role_permissions rp
          ON rp.permission_id = p.id
        INNER JOIN user_roles ur
          ON ur.role_id = rp.role_id
        INNER JOIN users u
          ON u.id = ur.user_id
        WHERE u.id = ?
          AND u.organization_id = ?
          AND p.name = ?
          AND u.status = 'ACTIVE'
        LIMIT 1
        `,
        [req.user.id, req.user.organizationId, permissionName]
      );

      if (permissions.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
        });
      }

      next();
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      });
    }
  };
};

module.exports = requirePermission;