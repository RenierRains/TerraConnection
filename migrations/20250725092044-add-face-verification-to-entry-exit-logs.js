'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Entry_Exit_Logs', 'face_verification_status', {
      type: Sequelize.ENUM('pending', 'verified', 'failed', 'skipped'),
      allowNull: true,
      defaultValue: 'pending',
      comment: 'Status of face verification after RFID scan'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Entry_Exit_Logs', 'face_verification_status');
  }
};
