'use strict';
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'Notifications',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  Notification.associate = function(models) {
    Notification.belongsTo(models.Class, {
      foreignKey: 'class_id',
      as: 'class'
    });
    Notification.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender'
    });
  };

  return Notification;
}; 