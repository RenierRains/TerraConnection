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

    // Check if user has a profile picture for face verification
    if (!user.profile_picture || user.profile_picture === '/images/default-avatar.png') {
      await logRFIDAudit(rfidCard.user_id, 'ACCESS_DENIED', {
        card_uid,
        reason: 'No profile picture for face verification',
        deviceId: device_id,
        location,
        timestamp: new Date()
      }, req);
      return res.status(400).json({ error: 'No profile picture found. Face verification required.' });
    }

    // Find the most recent scan for this card to determine if next should be entry or exit
    const lastScan = await db.Entry_Exit_Log.findOne({
      where: { card_uid },
      order: [['timestamp', 'DESC']]
    });

    const newType = lastScan && lastScan.type === 'entry' ? 'exit' : 'entry';

    // Create log entry - skip face verification for exits
    const log = await db.Entry_Exit_Log.create({
      user_id: rfidCard.user_id,
      card_uid,
      type: newType,
      location: location || null,
      timestamp: new Date(),
      face_verification_status: newType === 'exit' ? 'skipped' : 'pending'
    });

    await logRFIDAudit(rfidCard.user_id, 'RFID_SCAN', {
      card_uid,
      deviceId: device_id,
      location,
      type: newType,
      status: newType === 'exit' ? 'exit_completed' : 'pending_face_verification',
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
      message: newType === 'exit' ? 'Exit recorded successfully.' : 'RFID scan successful. Face verification required.',
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

exports.updateFaceVerification = async (req, res) => {
  try {
    const { log_id, verification_status } = req.body;
    
    if (!log_id || !verification_status) {
      return res.status(400).json({ error: 'Missing log_id or verification_status' });
    }

    const validStatuses = ['pending', 'verified', 'failed', 'skipped'];
    if (!validStatuses.includes(verification_status)) {
      return res.status(400).json({ error: 'Invalid verification_status' });
    }

    const log = await db.Entry_Exit_Log.findByPk(log_id);
    if (!log) {
      return res.status(404).json({ error: 'Entry/Exit log not found' });
    }

    // Update the face verification status
    await log.update({ face_verification_status: verification_status });

    // Determine the final access status
    let auditAction = 'FACE_VERIFICATION';
    let accessGranted = false;

    if (verification_status === 'verified') {
      auditAction = 'ACCESS_GRANTED';
      accessGranted = true;
    } else if (verification_status === 'failed') {
      auditAction = 'ACCESS_DENIED';
    } else if (verification_status === 'skipped') {
      auditAction = 'ACCESS_DENIED'; // Treat skipped as denied for security
    }

    // Log the face verification result
    await logRFIDAudit(log.user_id, auditAction, {
      log_id,
      card_uid: log.card_uid,
      verification_status,
      access_granted: accessGranted,
      entry_type: log.type,
      timestamp: new Date(),
      location: log.location
    }, req);

    let message = 'Face verification status updated';
    if (verification_status === 'verified') {
      message = `Access granted! ${log.type} recorded successfully.`;
    } else if (verification_status === 'failed') {
      message = 'Access denied. Face verification failed.';
    } else if (verification_status === 'skipped') {
      message = 'Access denied. Face verification was skipped.';
    }

    res.json({
      message,
      log_id,
      verification_status,
      access_granted: accessGranted,
      entry_type: log.type,
      updated_at: new Date()
    });
  } catch (err) {
    console.error('Face verification error:', err);
    await logRFIDAudit(null, 'FACE_VERIFICATION', {
      error: err.message,
      log_id: req.body?.log_id,
      verification_status: req.body?.verification_status,
      status: 'failed'
    }, req);
    res.status(500).json({ error: 'Failed to update face verification status' });
  }
};