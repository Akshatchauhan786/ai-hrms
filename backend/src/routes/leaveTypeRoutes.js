const express = require("express");

const {
  createLeaveType,
  getLeaveTypes,
} = require("../controllers/leaveTypeController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createLeaveType);
router.get("/", authenticate, getLeaveTypes);

module.exports = router;