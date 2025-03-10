module.exports = (sequelize, DataTypes) => {
  const NotificationReadStatus = sequelize.define('NotificationReadStatus', {
    notification_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Notifications',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['notification_id', 'user_id']
      }
    ]
  });

  return NotificationReadStatus;
}; 