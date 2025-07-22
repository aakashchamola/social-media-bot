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
router.post('/', createTask);

// GET /api/interact - Get all interaction tasks
router.get('/', getTasks);

// GET /api/interact/:id - Get specific task by ID
router.get('/:id', getTaskById);

// PUT /api/interact/:id - Update a task
router.put('/:id', updateTask);

// DELETE /api/interact/:id - Delete a task
router.delete('/:id', deleteTask);

// POST /api/interact/:id/execute - Execute a specific task
router.post('/:id/execute', executeTask);

module.exports = router;
