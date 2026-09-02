const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validator');

// Define Discussion model inline
const Discussion = sequelize.define('Discussion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  class_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  content: {
    type: DataTypes.LONGTEXT,
    allowNull: false
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  is_pinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
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
  tableName: 'discussions',
  timestamps: false
});

// Define DiscussionReply model inline
const DiscussionReply = sequelize.define('DiscussionReply', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  discussion_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'discussions',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.LONGTEXT,
    allowNull: false
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
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
  tableName: 'discussion_replies',
  timestamps: false
});

// Create discussion
router.post('/', authenticateToken, [
  body('class_id').notEmpty().withMessage('Class ID harus diisi'),
  body('title').notEmpty().withMessage('Judul diskusi harus diisi'),
  body('content').notEmpty().withMessage('Konten diskusi harus diisi')
], handleValidationErrors, async (req, res) => {
  try {
    const { class_id, title, content } = req.body;

    const discussion = await Discussion.create({
      class_id,
      title,
      content,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Diskusi berhasil dibuat',
      data: discussion
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat diskusi'
    });
  }
});

// Get all discussions for class
router.get('/class/:class_id', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Discussion.findAndCountAll({
      where: { class_id: req.params.class_id },
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['is_pinned', 'DESC'], ['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Data diskusi berhasil diambil',
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
      message: 'Terjadi kesalahan saat mengambil data diskusi'
    });
  }
});

// Get discussion detail with replies
router.get('/:id/replies', authenticateToken, async (req, res) => {
  try {
    const discussion = await Discussion.findByPk(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Diskusi tidak ditemukan'
      });
    }

    const replies = await DiscussionReply.findAll({
      where: { discussion_id: req.params.id },
      order: [['created_at', 'ASC']]
    });

    res.status(200).json({
      success: true,
      message: 'Diskusi dan balasan berhasil diambil',
      data: {
        discussion,
        replies
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil diskusi'
    });
  }
});

// Add reply to discussion
router.post('/:id/replies', authenticateToken, [
  body('content').notEmpty().withMessage('Konten balasan harus diisi')
], handleValidationErrors, async (req, res) => {
  try {
    const { content } = req.body;
    
    const discussion = await Discussion.findByPk(req.params.id);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Diskusi tidak ditemukan'
      });
    }

    if (discussion.is_locked) {
      return res.status(403).json({
        success: false,
        message: 'Diskusi ini sudah ditutup'
      });
    }

    const reply = await DiscussionReply.create({
      discussion_id: req.params.id,
      content,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Balasan berhasil ditambahkan',
      data: reply
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menambahkan balasan'
    });
  }
});

module.exports = router;
