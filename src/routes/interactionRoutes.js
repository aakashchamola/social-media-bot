const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getTaskById,
  executeTask
} = require('../controllers/interactions');

// POST /api/interact - Create a new interaction task
router.post('/interact', createTask);

// GET /api/interact - Get all interaction tasks
router.get('/interact', getTasks);

// GET /api/interact/:id - Get specific task by ID
router.get('/interact/:id', getTaskById);

// PUT /api/interact/:id - Update a task
router.put('/interact/:id', updateTask);

// DELETE /api/interact/:id - Delete a task
router.delete('/interact/:id', deleteTask);

// POST /api/interact/:id/execute - Execute a specific task
router.post('/interact/:id/execute', executeTask);

module.exports = router;
