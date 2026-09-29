const express = require('express');

const {
    getLeadsController,
    getLeadByIdController,
    createLeadController,
} = require('../controllers/leadController');

const router = express.Router();

// Get all leads
router.get('/', getLeadsController);

// Get lead by ID
router.get('/:id', getLeadByIdController);

// Create lead
router.post('/', createLeadController);

module.exports = router;
