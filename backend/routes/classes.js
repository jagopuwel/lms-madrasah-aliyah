const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Class = require('../models/Class');
const Enrollment = require('../models/Enrollment');
const { authenticateToken, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Create class (Guru/Admin)
router.post('/', authenticateToken, authorize('guru', 'admin'), [
  body('name').notEmpty().withMessage('Nama kelas harus diisi'),
  body('code').notEmpty().withMessage('Kode kelas harus diisi'),
  body('academic_year').notEmpty().withMessage('Tahun akademik harus diisi'),
  body('semester').isIn(['1', '2']).withMessage('Semester harus 1 atau 2')
], handleValidationErrors, async (req, res) => {
  try {
    const { name, code, description, academic_year, semester, capacity } = req.body;

    const classData = await Class.create({
      name,
      code,
      description,
      academic_year,
      semester,
      capacity: capacity || 30,
      teacher_id: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Kelas berhasil dibuat',
      data: classData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat kelas'
    });
  }
});

// Get all classes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { academic_year, semester, status, page = 1, limit = 10 } = req.query;
    
    let where = {};
    if (academic_year) where.academic_year = academic_year;
    if (semester) where.semester = semester;
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await Class.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data kelas berhasil diambil',
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
      message: 'Terjadi kesalahan saat mengambil data kelas'
    });
  }
});

// Get class by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const classData = await Class.findByPk(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Kelas berhasil diambil',
      data: classData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil kelas'
    });
  }
});

// Update class
router.put('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const classData = await Class.findByPk(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan'
      });
    }

    // Check permission
    if (classData.teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengubah kelas ini'
      });
    }

    await classData.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Kelas berhasil diubah',
      data: classData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah kelas'
    });
  }
});

// Delete class
router.delete('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const classData = await Class.findByPk(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan'
      });
    }

    // Check permission
    if (classData.teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menghapus kelas ini'
      });
    }

    await classData.destroy();

    res.status(200).json({
      success: true,
      message: 'Kelas berhasil dihapus'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus kelas'
    });
  }
});

// Enroll student to class
router.post('/:id/enroll', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const { student_id } = req.body;
    const classData = await Class.findByPk(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan'
      });
    }

    // Check if already enrolled
    const existing = await Enrollment.findOne({
      where: { student_id, class_id: req.params.id }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Siswa sudah terdaftar di kelas ini'
      });
    }

    const enrollment = await Enrollment.create({
      student_id,
      class_id: req.params.id
    });

    res.status(201).json({
      success: true,
      message: 'Siswa berhasil didaftarkan ke kelas',
      data: enrollment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mendaftarkan siswa'
    });
  }
});

// Get class students
router.get('/:id/students', authenticateToken, async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { class_id: req.params.id, status: 'enrolled' }
    });

    res.status(200).json({
      success: true,
      message: 'Data siswa kelas berhasil diambil',
      data: enrollments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data siswa'
    });
  }
});

module.exports = router;
