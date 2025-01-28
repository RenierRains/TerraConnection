'use strict';
module.exports = (sequelize, DataTypes) => {
  const Audit_Log = sequelize.define('Audit_Log', {
    action_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    details: DataTypes.TEXT,
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'Audit_Logs',
    underscored: true,
    timestamps: false
  });

  Audit_Log.associate = function(models) {
    // many logs -> 1 User (nullable)
    Audit_Log.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
  };

  return Audit_Log;
};
