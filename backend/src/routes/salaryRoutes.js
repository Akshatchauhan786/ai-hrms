const express = require("express");

const {
  createSalaryStructure,
  getSalaryStructures,
} = require("../controllers/salaryController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createSalaryStructure);

router.get("/", authenticate, getSalaryStructures);

module.exports = router;