const db = require('../models');

exports.linkGuardianToStudent = async (req, res) => {
  try {
    const { guardianId, studentId } = req.body;

    // Ensure roles
    const guardian = await db.User.findByPk(guardianId);
    const student = await db.User.findByPk(studentId);

    if (!guardian || guardian.role !== 'guardian') {
      return res.status(400).json({ error: 'Invalid or non-guardian user for guardianId' });
    }
    if (!student || student.role !== 'student') {
      return res.status(400).json({ error: 'Invalid or non-student user for studentId' });
    }

    // Use the belongsToMany association
    await guardian.addStudentsMonitored(student);

    return res.json({ message: 'Guardian linked to student successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to link guardian and student.' });
  }
};