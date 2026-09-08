const express = require("express");

const {
  applyLeave,
  getLeaveRequests,
  approveLeave,
  rejectLeave,
} = require("../controllers/leaveRequestController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, applyLeave);

router.get("/", authenticate, getLeaveRequests);

router.patch("/:id/approve", authenticate, approveLeave);

router.patch("/:id/reject", authenticate, rejectLeave);

module.exports = router;