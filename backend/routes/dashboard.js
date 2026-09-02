const express = require('express');
const router = express.Router();
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Class = require('../models/Class');
const Enrollment = require('../models/Enrollment');
const Assignment = require('../models/Assignment');
const { authenticateToken, authorize } = require('../middleware/auth');

// Define models
const Grade = sequelize.define('Grade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  }
}, {
  tableName: 'grades',
  timestamps: false
});

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  }
}, {
  tableName: 'submissions',
  timestamps: false
});

// Dashboard untuk Guru
router.get('/guru', authenticateToken, authorize('guru'), async (req, res) => {
  try {
    // Get teacher's classes
    const classes = await Class.findAll({
      where: { teacher_id: req.user.id }
    });

    // Get total students
    const enrollments = await Enrollment.findAll({
      where: { status: 'enrolled' },
      include: [{
        model: Class,
        where: { teacher_id: req.user.id }
      }]
    });

    // Get pending assignments
    const pendingAssignments = await Assignment.findAll({
      where: { created_by: req.user.id, is_published: true }
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard guru berhasil diambil',
      data: {
        totalClasses: classes.length,
        totalStudents: enrollments.length,
        pendingAssignments: pendingAssignments.length,
        classes: classes.map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
          studentCount: enrollments.filter(e => e.class_id === c.id).length
        }))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil dashboard'
    });
  }
});

// Dashboard untuk Siswa
router.get('/siswa', authenticateToken, authorize('siswa'), async (req, res) => {
  try {
    // Get enrolled classes
    const enrollments = await Enrollment.findAll({
      where: { student_id: req.user.id, status: 'enrolled' }
    });

    const classIds = enrollments.map(e => e.class_id);

    // Get assignments for enrolled classes
    const assignments = await Assignment.findAll({
      where: { class_id: classIds, is_published: true }
    });

    // Get grades
    const grades = await Grade.findAll({
      where: { student_id: req.user.id }
    });

    // Get submissions
    const submissions = await Submission.findAll({
      where: { student_id: req.user.id }
    });

    const averageGrade = grades.length > 0 
      ? (grades.reduce((sum, g) => sum + parseFloat(g.score), 0) / grades.length).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      message: 'Dashboard siswa berhasil diambil',
      data: {
        totalClasses: enrollments.length,
        totalAssignments: assignments.length,
        pendingAssignments: assignments.filter(a => new Date(a.due_date) > new Date()).length,
        submittedAssignments: submissions.length,
        averageGrade,
        upcomingDeadlines: assignments
          .filter(a => new Date(a.due_date) > new Date())
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, 5)
          .map(a => ({
            id: a.id,
            title: a.title,
            dueDate: a.due_date
          }))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil dashboard'
    });
  }
});

// Dashboard untuk Admin
router.get('/admin', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalClasses = await Class.count();
    const totalEnrollments = await Enrollment.count({
      where: { status: 'enrolled' }
    });
    const totalAssignments = await Assignment.count({ where: { is_published: true } });

    // Users by role
    const usersByRole = await User.findAll({
      attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard admin berhasil diambil',
      data: {
        totalUsers,
        totalClasses,
        totalEnrollments,
        totalAssignments,
        usersByRole: usersByRole.reduce((acc, u) => {
          acc[u.role] = parseInt(u.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil dashboard'
    });
  }
});

module.exports = router;
