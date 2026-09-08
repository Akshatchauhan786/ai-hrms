const express = require("express");

const {
  checkIn,
  checkOut,
  getAttendance,
  getEmployeeAttendance,
} = require("../controllers/attendanceController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/check-in", authenticate, checkIn);
router.post("/check-out", authenticate, checkOut);
router.get("/", authenticate, getAttendance);
router.get("/:employeeId", authenticate, getEmployeeAttendance);

module.exports = router;