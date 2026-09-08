const express = require("express");

const {
  createDepartment,
  getDepartments,
} = require("../controllers/departmentController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createDepartment);

router.get("/", authenticate, getDepartments);

module.exports = router;