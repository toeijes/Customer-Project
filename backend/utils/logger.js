const db = require('../db');

function getLogValues(req, user, action, target, target_id, details) {
  const rawIpAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
  const ipAddress = rawIpAddress ? String(rawIpAddress).split(',')[0].trim().slice(0, 45) : null;
  const userId = user?.id || null;
  const username = String(user?.fullName || user?.pwa_username || user?.local_username || user?.username || 'System').slice(0, 100);
  const enrichedDetails = details ? {
    ...details,
    role: details.role || user?.role || null,
    area: details.area || user?.area || null
  } : null;

  return [
    userId,
    username,
    action,
    target,
    target_id,
    enrichedDetails ? JSON.stringify(enrichedDetails) : null,
    ipAddress
  ];
}

const INSERT_LOG_SQL = `
  INSERT INTO system_logs (user_id, username, action, target, target_id, details, ip_address)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Logs a system action into the database.
 * 
 * @param {Object} req - The Express request object (used to extract IP)
 * @param {Object} user - The user performing the action (should have id and username/fullName)
 * @param {String} action - The action type (e.g., LOGIN, LOGOUT, UPDATE_ROLE, UPDATE_STATUS)
 * @param {String} target - The target entity (e.g., USERS, PROJECTS, SYSTEM)
 * @param {String} target_id - The ID of the targeted entity (optional)
 * @param {Object} details - Additional details about the action (optional)
 */
async function logSystemAction(req, user, action, target, target_id = null, details = null) {
  try {
    await db.query(INSERT_LOG_SQL, getLogValues(req, user, action, target, target_id, details));
  } catch (error) {
    console.error('Failed to log system action:', error);
  }
}

async function logSystemActionWithConnection(connection, req, user, action, target, target_id = null, details = null) {
  await connection.query(
    INSERT_LOG_SQL,
    getLogValues(req, user, action, target, target_id, details)
  );
}

module.exports = {
  logSystemAction,
  logSystemActionWithConnection
};
