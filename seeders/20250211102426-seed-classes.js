'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Classes', [
      {
        class_code: 'ITE293',
        class_name: 'Systems Administration and Maintenance',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '07:30:00',
        end_time: '09:00:00',
        schedule: 'Thu',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        class_code: 'ITE309',
        class_name: 'Capstone Project and Research 1',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '13:30:00',
        end_time: '16:30:00',
        schedule: 'Sat',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        class_code: 'ITE370',
        class_name: 'Information Assurance and Security 2',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '10:30:00',
        end_time: '12:00:00',
        schedule: 'Fri',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        class_code: 'ITE384',
        class_name: 'Computer Forensics',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '07:30:00',
        end_time: '09:00:00',
        schedule: 'Thu,Sat',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        class_code: 'ITE385',
        class_name: 'Ethical Hackingc',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '12:00:00',
        end_time: '13:30:00',
        schedule: 'Thu,Sat',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        class_code: 'ITE401',
        class_name: 'Platform Technologies',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '15:00:00',
        end_time: '18:00:00',
        schedule: 'Fri',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        class_code: 'SSP008',
        class_name: 'Student Success Program 4',
        course: 'BSIT',
        year: 3,
        section: '06',
        room: 'TBA',
        start_time: '12:00:00',
        end_time: '13:30:00',
        schedule: 'Fri',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Classes', null, {});
  }
};
