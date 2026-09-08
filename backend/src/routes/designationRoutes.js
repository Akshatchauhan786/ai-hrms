const express = require("express");

const {
  createDesignation,
  getDesignations,
} = require("../controllers/designationController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createDesignation);

router.get("/", authenticate, getDesignations);

module.exports = router;