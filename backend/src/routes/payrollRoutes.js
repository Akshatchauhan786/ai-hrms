const express = require("express");

const {
  generatePayroll,
  getPayrolls,
  getPayrollById,
  approvePayroll,
  markPayrollPaid,
  generatePayslip,
} = require("../controllers/payrollController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/generate", authenticate, generatePayroll);
router.get("/", authenticate, getPayrolls);
router.get("/:id/payslip",authenticate,generatePayslip);
router.get("/:id", authenticate, getPayrollById);
router.patch("/:id/approve", authenticate, approvePayroll);
router.patch("/:id/pay", authenticate, markPayrollPaid);


module.exports = router;