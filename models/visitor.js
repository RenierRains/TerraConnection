'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Visitor extends Model {
    static associate(models) {
      // Define associations here if needed in the future
    }
  }
  
  Visitor.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    purpose: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [5, 500]
      }
    },
    faceImagePath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'face_image_path'
    },
    entryTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'entry_time'
    },
    exitTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'exit_time'
    },
    status: {
      type: DataTypes.ENUM('active', 'exited', 'expired'),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'exited', 'expired']]
      }
    }
  }, {
    sequelize,
    modelName: 'Visitor',
    tableName: 'visitors',
    timestamps: true,
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['status']
      },
      {
        fields: ['entry_time']
      },
      {
        fields: ['exit_time']
      },
      {
        fields: ['createdAt']
      }
    ]
  });
  
  return Visitor;
};
