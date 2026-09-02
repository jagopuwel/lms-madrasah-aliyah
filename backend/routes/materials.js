const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Material = require('../models/Material');
const { authenticateToken, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Create material (Guru)
router.post('/', authenticateToken, authorize('guru', 'admin'), [
  body('class_id').notEmpty().withMessage('Class ID harus diisi'),
  body('title').notEmpty().withMessage('Judul materi harus diisi'),
  body('type').isIn(['text', 'video', 'document', 'link']).withMessage('Tipe materi tidak valid')
], handleValidationErrors, async (req, res) => {
  try {
    const { class_id, title, description, content, type, file_url, order } = req.body;

    const material = await Material.create({
      class_id,
      title,
      description,
      content,
      type,
      file_url,
      order: order || 0,
      created_by: req.user.id,
      published_at: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Materi berhasil dibuat',
      data: material
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat materi'
    });
  }
});

// Get all materials
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { class_id, type, page = 1, limit = 10 } = req.query;
    
    let where = { is_published: true };
    if (class_id) where.class_id = class_id;
    if (type) where.type = type;

    const offset = (page - 1) * limit;

    const { count, rows } = await Material.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['order', 'ASC'], ['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data materi berhasil diambil',
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
      message: 'Terjadi kesalahan saat mengambil data materi'
    });
  }
});

// Get material by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Materi tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Materi berhasil diambil',
      data: material
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil materi'
    });
  }
});

// Update material
router.put('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Materi tidak ditemukan'
      });
    }

    // Check permission
    if (material.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengubah materi ini'
      });
    }

    await material.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Materi berhasil diubah',
      data: material
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah materi'
    });
  }
});

// Delete material
router.delete('/:id', authenticateToken, authorize('guru', 'admin'), async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Materi tidak ditemukan'
      });
    }

    // Check permission
    if (material.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menghapus materi ini'
      });
    }

    await material.destroy();

    res.status(200).json({
      success: true,
      message: 'Materi berhasil dihapus'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus materi'
    });
  }
});

module.exports = router;
