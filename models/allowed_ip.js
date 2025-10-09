'use strict';

const net = require('net');

module.exports = (sequelize, DataTypes) => {
  const Allowed_IP = sequelize.define('Allowed_IP', {
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
      unique: {
        name: 'allowed_ips_ip_address_unique',
        msg: 'IP address is already whitelisted.'
      },
      validate: {
        isIP(value) {
          if (!value || net.isIP(value) === 0) {
            throw new Error('Invalid IP address format.');
          }
        }
      }
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'allowed_ips',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['ip_address'],
        name: 'allowed_ips_ip_address_unique'
      },
      {
        fields: ['is_active'],
        name: 'allowed_ips_is_active_idx'
      }
    ]
  });

  Allowed_IP.associate = function(models) {
    Allowed_IP.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    Allowed_IP.belongsTo(models.User, {
      foreignKey: 'updated_by',
      as: 'updater'
    });
  };

  return Allowed_IP;
};
