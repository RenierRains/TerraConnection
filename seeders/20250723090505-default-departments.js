'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Insert departments only if they don't already exist
    await queryInterface.bulkInsert('Departments', [
      {
        name: 'College of Management and Accountancy',
        code: 'CMA',
        description: 'College offering business, management, and accounting programs',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Master of Business Administration',
        code: 'MBA',
        description: 'Graduate program in business administration',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Senior High School',
        code: 'SHS',
        description: 'Senior high school department',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { ignoreDuplicates: true });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Departments', null, {});
  }
};
