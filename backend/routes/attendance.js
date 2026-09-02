const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Define Attendance model inline
const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  student_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  class_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('hadir', 'izin', 'sakit', 'alpha'),
    allowNull: false,
    defaultValue: 'hadir'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    onUpdate: DataTypes.NOW
  }
}, {
  tableName: 'attendance',
  timestamps: false
});

// Record attendance
router.post('/', authenticateToken, authorize('guru', 'admin'), [
  body('student_id').notEmpty().withMessage('Student ID harus diisi'),
  body('class_id').notEmpty().withMessage('Class ID harus diisi'),
  body('date').isISO8601().withMessage('Tanggal tidak valid'),
  body('status').isIn(['hadir', 'izin', 'sakit', 'alpha']).withMessage('Status tidak valid')
], handleValidationErrors, async (req, res) => {
  try {
    const { student_id, class_id, date, status, notes } = req.body;

    // Check if attendance already recorded
    const existing = await Attendance.findOne({
      where: { student_id, class_id, date: new Date(date).toDateString() }
    });

    if (existing) {
      // Update existing attendance
      await existing.update({ status, notes });
      return res.status(200).json({
        success: true,
        message: 'Absensi berhasil diperbarui',
        data: existing
      });
    }

    const attendance = await Attendance.create({
      student_id,
      class_id,
      date,
      status,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Absensi berhasil dicatat',
      data: attendance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mencatat absensi'
    });
  }
});

// Get attendance by student
router.get('/student/:student_id', authenticateToken, async (req, res) => {
  try {
    const { class_id, page = 1, limit = 10 } = req.query;
    
    let where = { student_id: req.params.student_id };
    if (class_id) where.class_id = class_id;

    const offset = (page - 1) * limit;

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['date', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data absensi siswa berhasil diambil',
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
      message: 'Terjadi kesalahan saat mengambil data absensi'
    });
  }
});

// Get attendance report for class
router.get('/class/:class_id/report', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const attendances = await Attendance.findAll({
      where: { class_id: req.params.class_id }
    });

    const report = {
      total: attendances.length,
      hadir: attendances.filter(a => a.status === 'hadir').length,
      izin: attendances.filter(a => a.status === 'izin').length,
      sakit: attendances.filter(a => a.status === 'sakit').length,
      alpha: attendances.filter(a => a.status === 'alpha').length
    };

    res.status(200).json({
      success: true,
      message: 'Laporan absensi berhasil dibuat',
      data: report
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat laporan absensi'
    });
  }
});

module.exports = router;
