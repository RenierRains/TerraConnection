const db = require('../models');
const { logRFIDAudit } = require('./auditLogger');

exports.processScan = async (req, res) => {
  try {
    const { card_uid, location, device_id } = req.body;
    const rfidCard = await db.RFID_Card.findOne({ where: { card_uid } });
    
    if (!rfidCard || !rfidCard.is_active) {
      await logRFIDAudit(null, 'ACCESS_DENIED', {
        card_uid,
        reason: !rfidCard ? 'Invalid card' : 'Inactive card',
        deviceId: device_id,
        location,
        timestamp: new Date()
      }, req);
      return res.status(400).json({ error: 'Invalid or inactive card' });
    }

    const user = await db.User.findByPk(rfidCard.user_id);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Find the most recent scan for this card to determine if next should be entry or exit
    const lastScan = await db.Entry_Exit_Log.findOne({
      where: { card_uid },
      order: [['timestamp', 'DESC']]
    });

    const newType = lastScan && lastScan.type === 'entry' ? 'exit' : 'entry';

    // Create log entry - skip face verification for exits
    const faceVerificationStatus = newType === 'exit' ? 'skipped' : 'verified';

    const log = await db.Entry_Exit_Log.create({
      user_id: rfidCard.user_id,
      card_uid,
      type: newType,
      location: location || null,
      timestamp: new Date(),
      face_verification_status: faceVerificationStatus
    });

    const auditAction = newType === 'exit' ? 'EXIT' : 'ACCESS_GRANTED';

    await logRFIDAudit(rfidCard.user_id, auditAction, {
      card_uid,
      deviceId: device_id,
      location,
      type: newType,
      status: newType === 'exit' ? 'exit_completed' : 'entry_completed',
      cardDetails: {
        id: rfidCard.id,
        issuedAt: rfidCard.issued_at
      },
      userDetails: {
        id: user.id,
        school_id: user.school_id,
        name: `${user.first_name} ${user.last_name}`
      },
      timestamp: log.timestamp
    }, req);

    // Format profile picture URL if needed
    // Fix for double path issue: only add path prefix if URL doesn't already contain it
    let profilePictureUrl = user.profile_picture;
    if (profilePictureUrl && !profilePictureUrl.startsWith('/') && !profilePictureUrl.startsWith('http') && !profilePictureUrl.startsWith('uploads/')) {
      // If it's just a filename (no path), add the proper path
      profilePictureUrl = `uploads/profile_pics/${profilePictureUrl}`;
    }

    res.json({
      message: newType === 'exit' ? 'Exit recorded successfully.' : 'RFID scan successful.',
      event: newType,
      user: {
        id: user.id,
        school_id: user.school_id,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: profilePictureUrl
      },
      log: {
        id: log.id,
        type: log.type,
        timestamp: log.timestamp,
        face_verification_status: log.face_verification_status
      }
    });
  } catch (err) {
    console.error(err);
    await logRFIDAudit(null, 'CARD_SCAN', {
      error: err.message,
      card_uid: req.body?.card_uid,
      deviceId: req.body?.device_id,
      location: req.body?.location,
      status: 'failed'
    }, req);
    res.status(500).json({ error: 'Failed to process scan' });
  }
};

