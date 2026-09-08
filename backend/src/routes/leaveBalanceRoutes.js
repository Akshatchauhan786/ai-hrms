const express = require("express");

const {
  createLeaveBalance,
  getLeaveBalances,
} = require("../controllers/leaveBalanceController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createLeaveBalance);

router.get("/", authenticate, getLeaveBalances);

module.exports = router;