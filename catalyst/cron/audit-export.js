/**
 * Catalyst Cron: Audit Log Export
 * Generates immutable audit logs with blockchain-style verification
 */

const catalyst = require("zcatalyst-sdk-node");
const crypto = require("crypto");

module.exports = async (cronDetails, context) => {
  try {
    console.log("Starting daily audit log export...");

    const catalystApp = catalyst.initialize(context);
    const datastore = catalystApp.datastore();

    // Get all compliance events from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const eventsTable = datastore.table("compliance_events");
    const auditLogsTable = datastore.table("audit_logs");

    // Query yesterday's events
    const query = `SELECT * FROM compliance_events WHERE DATE(created_at) = '${yesterdayStr}'`;
    const eventsPromise = eventsTable.query(query);
    const events = await eventsPromise;

    if (events.length === 0) {
      console.log("No events to export for", yesterdayStr);
      return {
        success: true,
        message: "No events to export",
        date: yesterdayStr,
      };
    }

    // Group events by project and regulation
    const groupedEvents = groupEventsByProjectAndRegulation(events);

    // Get previous audit log hash (blockchain chain)
    const previousHash = await getLastAuditHash(auditLogsTable);

    // Generate audit logs for each group
    for (const [key, eventGroup] of Object.entries(groupedEvents)) {
      const [projectId, regulation] = key.split("::");

      await generateAuditLog({
        projectId,
        regulation,
        events: eventGroup,
        date: yesterdayStr,
        previousHash,
        auditLogsTable,
        catalystApp,
      });
    }

    console.log("Audit log export completed successfully");

    return {
      success: true,
      logs_generated: Object.keys(groupedEvents).length,
      date: yesterdayStr,
    };
  } catch (error) {
    console.error("Error in audit export:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Group events by project and regulation
 */
function groupEventsByProjectAndRegulation(events) {
  const groups = {};

  events.forEach((eventWrapper) => {
    const event = eventWrapper.compliance_events;
    const key = `${event.project_id}::${event.regulation}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(event);
  });

  return groups;
}

/**
 * Get last audit log hash for blockchain chain
 */
async function getLastAuditHash(auditLogsTable) {
  try {
    const query =
      "SELECT report_hash FROM audit_logs ORDER BY export_timestamp DESC LIMIT 1";
    const results = await auditLogsTable.query(query);

    if (results.length > 0) {
      return results[0].audit_logs.report_hash;
    }

    return "0000000000000000000000000000000000000000000000000000000000000000"; // Genesis hash
  } catch (error) {
    return "0000000000000000000000000000000000000000000000000000000000000000";
  }
}

/**
 * Generate audit log with tamper-proof hash
 */
async function generateAuditLog(params) {
  const {
    projectId,
    regulation,
    events,
    date,
    previousHash,
    auditLogsTable,
    catalystApp,
  } = params;

  // Sort events by timestamp for consistency
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Extract event IDs
  const eventIds = events.map((e) => e.event_id);

  // Build audit report data
  const auditData = {
    project_id: projectId,
    regulation: regulation,
    period_start: date,
    period_end: date,
    total_events: events.length,
    events: events.map((e) => ({
      event_id: e.event_id,
      timestamp: e.timestamp,
      event_type: e.event_type,
      user: e.user_name,
      risk_level: e.risk_level,
      evidence_url: e.evidence_url,
    })),
    summary: generateAuditSummary(events),
  };

  // Generate SHA-256 hash of audit data
  const auditJson = JSON.stringify(auditData);
  const currentHash = crypto
    .createHash("sha256")
    .update(auditJson + previousHash)
    .digest("hex");

  // Export to external storage (S3/GCS)
  const storageUrl = await exportToExternalStorage(
    auditData,
    currentHash,
    catalystApp
  );

  // Create audit log record
  const auditLogRecord = {
    log_id: Date.now(),
    event_ids: JSON.stringify(eventIds),
    export_timestamp: new Date().toISOString(),
    exported_by: "system-cron",
    project_id: projectId,
    regulation: regulation,
    period_start: date,
    period_end: date,
    report_hash: currentHash,
    previous_hash: previousHash,
    storage_url: storageUrl,
    metadata: JSON.stringify({
      total_events: events.length,
      event_types: getEventTypeCounts(events),
      risk_levels: getRiskLevelCounts(events),
    }),
  };

  // Insert into DataStore
  await auditLogsTable.insertRow(auditLogRecord);

  console.log(
    `Audit log generated: ${projectId} - ${regulation} - ${currentHash.substring(0, 8)}`
  );

  return auditLogRecord;
}

/**
 * Generate audit summary
 */
function generateAuditSummary(events) {
  const summary = {
    total_events: events.length,
    by_type: {},
    by_risk: {},
    high_priority_count: 0,
    unique_users: new Set(),
  };

  events.forEach((event) => {
    // Count by type
    summary.by_type[event.event_type] =
      (summary.by_type[event.event_type] || 0) + 1;

    // Count by risk
    summary.by_risk[event.risk_level] =
      (summary.by_risk[event.risk_level] || 0) + 1;

    // High priority
    if (event.risk_level === "High" || event.risk_level === "Critical") {
      summary.high_priority_count++;
    }

    // Unique users
    summary.unique_users.add(event.user_id);
  });

  summary.unique_users = summary.unique_users.size;

  return summary;
}

/**
 * Export audit data to external storage
 */
async function exportToExternalStorage(auditData, hash, catalystApp) {
  try {
    // This would integrate with AWS S3, Google Cloud Storage, or Zoho WorkDrive
    // For now, return a mock URL
    const storageUrl = `https://compliance-audit-logs.s3.amazonaws.com/${auditData.project_id}/${auditData.period_start}/${hash}.json`;

    // In production:
    // const filestore = catalystApp.filestore();
    // const folder = filestore.folder('audit-logs');
    // const uploadedFile = await folder.uploadFile({
    //     code: auditData,
    //     name: `${hash}.json`
    // });
    // return uploadedFile.file_url;

    return storageUrl;
  } catch (error) {
    console.error("Error exporting to storage:", error);
    return `local://${hash}.json`;
  }
}

/**
 * Helper functions
 */
function getEventTypeCounts(events) {
  const counts = {};
  events.forEach((e) => {
    counts[e.event_type] = (counts[e.event_type] || 0) + 1;
  });
  return counts;
}

function getRiskLevelCounts(events) {
  const counts = {};
  events.forEach((e) => {
    counts[e.risk_level] = (counts[e.risk_level] || 0) + 1;
  });
  return counts;
}
