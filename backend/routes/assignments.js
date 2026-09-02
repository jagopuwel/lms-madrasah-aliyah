const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { authenticateToken, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Create assignment (Guru)
router.post('/', authenticateToken, authorize('guru', 'admin'), [
  body('class_id').notEmpty().withMessage('Class ID harus diisi'),
  body('title').notEmpty().withMessage('Judul tugas harus diisi'),
  body('due_date').isISO8601().withMessage('Tanggal deadline tidak valid'),
  body('max_score').isNumeric().withMessage('Max score harus angka')
], handleValidationErrors, async (req, res) => {
  try {
    const { class_id, title, description, instructions, type, due_date, max_score, allow_late_submission } = req.body;

    const assignment = await Assignment.create({
      class_id,
      title,
      description,
      instructions,
      type: type || 'individual',
      due_date,
      max_score: max_score || 100,
      allow_late_submission: allow_late_submission || false,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Tugas berhasil dibuat',
      data: assignment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat tugas'
    });
  }
});

// Get all assignments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { class_id, status, page = 1, limit = 10 } = req.query;
    
    let where = {};
    if (class_id) where.class_id = class_id;

    const offset = (page - 1) * limit;

    const { count, rows } = await Assignment.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['due_date', 'ASC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data tugas berhasil diambil',
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data tugas'
    });
  }
});

// Get assignment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Tugas tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tugas berhasil diambil',
      data: assignment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil tugas'
    });
  }
});

// Submit assignment (Siswa)
router.post('/:id/submit', authenticateToken, authorize('siswa'), async (req, res) => {
  try {
    const { submission_text, file_url } = req.body;
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Tugas tidak ditemukan'
      });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      where: { assignment_id: req.params.id, student_id: req.user.id }
    });

    if (existingSubmission && existingSubmission.status === 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah mengirim tugas ini'
      });
    }

    const is_late = new Date() > assignment.due_date;

    const submission = existingSubmission 
      ? await existingSubmission.update({
          submission_text,
          file_url,
          submission_date: new Date(),
          is_late,
          status: 'submitted'
        })
      : await Submission.create({
          assignment_id: req.params.id,
          student_id: req.user.id,
          submission_text,
          file_url,
          is_late,
          status: 'submitted'
        });

    res.status(201).json({
      success: true,
      message: 'Tugas berhasil dikirim',
      data: submission
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim tugas'
    });
  }
});

// Get submissions for assignment
router.get('/:id/submissions', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Submission.findAndCountAll({
      where: { assignment_id: req.params.id },
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['submission_date', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data submisi tugas berhasil diambil',
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data submisi'
    });
  }
});

// Update assignment
router.put('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Tugas tidak ditemukan'
      });
    }

    // Check permission
    if (assignment.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengubah tugas ini'
      });
    }

    await assignment.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Tugas berhasil diubah',
      data: assignment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah tugas'
    });
  }
});

// Delete assignment
router.delete('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Tugas tidak ditemukan'
      });
    }

    // Check permission
    if (assignment.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menghapus tugas ini'
      });
    }

    await assignment.destroy();

    res.status(200).json({
      success: true,
      message: 'Tugas berhasil dihapus'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus tugas'
    });
  }
});

module.exports = router;
