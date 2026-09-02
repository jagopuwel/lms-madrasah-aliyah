const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Grade = require('../models/Grade');
const { authenticateToken, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Add grade (Guru)
router.post('/', authenticateToken, authorize('guru', 'admin'), [
  body('submission_id').notEmpty().withMessage('Submission ID harus diisi'),
  body('assignment_id').notEmpty().withMessage('Assignment ID harus diisi'),
  body('student_id').notEmpty().withMessage('Student ID harus diisi'),
  body('score').isNumeric().withMessage('Score harus angka')
], handleValidationErrors, async (req, res) => {
  try {
    const { submission_id, assignment_id, student_id, score, feedback } = req.body;

    const grade = await Grade.create({
      submission_id,
      assignment_id,
      student_id,
      score,
      feedback,
      graded_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Nilai berhasil ditambahkan',
      data: grade
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menambahkan nilai'
    });
  }
});

// Get grades for student
router.get('/student/:student_id', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Grade.findAndCountAll({
      where: { student_id: req.params.student_id },
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['graded_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data nilai siswa berhasil diambil',
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
      message: 'Terjadi kesalahan saat mengambil data nilai'
    });
  }
});

// Get grade by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id);

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Nilai tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Nilai berhasil diambil',
      data: grade
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil nilai'
    });
  }
});

// Update grade
router.put('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id);

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Nilai tidak ditemukan'
      });
    }

    await grade.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Nilai berhasil diubah',
      data: grade
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah nilai'
    });
  }
});

// Get class average
router.get('/class/:class_id/average', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const grades = await Grade.findAll({
      where: { class_id: req.params.class_id }
    });

    if (grades.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Tidak ada nilai untuk kelas ini',
        average: 0
      });
    }

    const total = grades.reduce((sum, g) => sum + parseFloat(g.score), 0);
    const average = total / grades.length;

    res.status(200).json({
      success: true,
      message: 'Rata-rata nilai kelas berhasil dihitung',
      average: average.toFixed(2)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghitung rata-rata'
    });
  }
});

module.exports = router;
