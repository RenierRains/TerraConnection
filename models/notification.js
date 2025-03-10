'use strict';
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
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
    Notification.belongsToMany(models.User, {
      through: 'NotificationReadStatus',
      foreignKey: 'notification_id',
      otherKey: 'user_id',
      as: 'readBy'
    });
  };

  return Notification;
}; 