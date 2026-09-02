const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Get all users (Admin only)
router.get('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role, status, page = 1, limit = 10 } = req.query;
    
    let where = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(limit),
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data users berhasil diambil',
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
      message: 'Terjadi kesalahan saat mengambil data users'
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User berhasil diambil',
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil user'
    });
  }
});

// Update user profile
router.put('/:id', authenticateToken, [
  body('name').optional().notEmpty().withMessage('Nama tidak boleh kosong'),
  body('phone').optional().isMobilePhone().withMessage('Nomor telepon tidak valid'),
  body('gender').optional().isIn(['laki-laki', 'perempuan']).withMessage('Gender tidak valid'),
  body('date_of_birth').optional().isISO8601().withMessage('Tanggal lahir tidak valid'),
  body('address').optional().notEmpty().withMessage('Alamat tidak boleh kosong')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is updating their own profile or is admin
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengubah profile user lain'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    await user.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Profile user berhasil diubah',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        date_of_birth: user.date_of_birth,
        address: user.address
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah profile user'
    });
  }
});

// Change password
router.post('/:id/change-password', authenticateToken, [
  body('current_password').notEmpty().withMessage('Password saat ini harus diisi'),
  body('new_password').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.new_password) {
      throw new Error('Konfirmasi password tidak cocok');
    }
    return true;
  })
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;

    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengubah password user lain'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    const isValidPassword = await user.validatePassword(current_password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Password saat ini salah'
      });
    }

    await user.update({ password: new_password });

    res.status(200).json({
      success: true,
      message: 'Password berhasil diubah'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah password'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: 'User berhasil dihapus'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus user'
    });
  }
});

module.exports = router;
