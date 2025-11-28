/**
 * Catalyst Function: Store Compliance Event
 * Receives compliance events from Deluge and stores in DataStore
 */

const catalyst = require("zcatalyst-sdk-node");

module.exports = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);

    // Get DataStore instance
    const datastore = catalystApp.datastore();
    const eventsTable = datastore.table("compliance_events");

    // Extract event data from request
    const eventData = req.body;

    // Generate unique event ID
    const eventId = Date.now();

    // Prepare row data
    const rowData = {
      event_id: eventId,
      timestamp: eventData.timestamp || new Date().toISOString(),
      channel_id: eventData.channel_id,
      channel_name: eventData.channel_name,
      message_id: eventData.message_id,
      user_id: eventData.user_id,
      user_name: eventData.user_name,
      event_type: eventData.event_type,
      regulation: eventData.regulation,
      risk_level: eventData.risk_level,
      decision_type: eventData.decision_type || null,
      message_text: eventData.message_text,
      evidence_url: eventData.evidence_url,
      confidence_score: eventData.confidence_score,
      stakeholders: JSON.stringify(eventData.stakeholders || []),
      deadline: eventData.deadline || null,
      project_id:
        eventData.project_id ||
        (await inferProjectId(eventData.channel_id, catalystApp)),
      status: "Pending Review",
      zia_entities: JSON.stringify(eventData.zia_entities || {}),
      created_at: new Date().toISOString(),
    };

    // Insert into DataStore
    const insertPromise = eventsTable.insertRow(rowData);
    const insertedRow = await insertPromise;

    // Trigger analytics update
    await updateAnalytics(rowData.project_id, catalystApp);

    // If high/critical risk, trigger prediction model
    if (rowData.risk_level === "High" || rowData.risk_level === "Critical") {
      await triggerRiskPrediction(rowData.project_id, catalystApp);
    }

    res.status(200).send({
      success: true,
      event_id: eventId,
      message: "Compliance event stored successfully",
    });
  } catch (error) {
    console.error("Error storing compliance event:", error);
    res.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Infer project ID from channel mapping
 */
async function inferProjectId(channelId, catalystApp) {
  try {
    // Query Creator or cached mapping
    // For now, return channel ID as project ID
    return channelId;
  } catch (error) {
    return channelId;
  }
}

/**
 * Update daily analytics aggregation
 */
async function updateAnalytics(projectId, catalystApp) {
  try {
    const datastore = catalystApp.datastore();
    const eventsTable = datastore.table("compliance_events");
    const analyticsTable = datastore.table("compliance_analytics");

    const today = new Date().toISOString().split("T")[0];

    // Query today's events for this project
    const query = `SELECT * FROM compliance_events WHERE project_id = '${projectId}' AND DATE(created_at) = '${today}'`;
    const queryPromise = eventsTable.query(query);
    const events = await queryPromise;

    // Calculate metrics
    const totalEvents = events.length;
    const highRiskCount = events.filter(
      (e) =>
        e.compliance_events.risk_level === "High" ||
        e.compliance_events.risk_level === "Critical"
    ).length;
    const pendingApprovals = events.filter(
      (e) =>
        e.compliance_events.event_type === "approval" &&
        e.compliance_events.status === "Pending Review"
    ).length;

    // Count by type
    const eventsByType = {};
    events.forEach((e) => {
      const type = e.compliance_events.event_type;
      eventsByType[type] = (eventsByType[type] || 0) + 1;
    });

    // Count by regulation
    const eventsByRegulation = {};
    events.forEach((e) => {
      const reg = e.compliance_events.regulation;
      eventsByRegulation[reg] = (eventsByRegulation[reg] || 0) + 1;
    });

    // Calculate compliance score (simplified version)
    const complianceScore = calculateComplianceScore(
      totalEvents,
      highRiskCount,
      pendingApprovals
    );

    // Check if analytics record exists for today
    const existingQuery = `SELECT * FROM compliance_analytics WHERE project_id = '${projectId}' AND date = '${today}'`;
    const existing = await analyticsTable.query(existingQuery);

    const analyticsData = {
      project_id: projectId,
      date: today,
      total_events: totalEvents,
      compliance_score: complianceScore,
      high_risk_count: highRiskCount,
      pending_approvals: pendingApprovals,
      events_by_type: JSON.stringify(eventsByType),
      events_by_regulation: JSON.stringify(eventsByRegulation),
      created_at: new Date().toISOString(),
    };

    if (existing.length > 0) {
      // Update existing
      await analyticsTable.updateRow({
        ...analyticsData,
        ROWID: existing[0].compliance_analytics.ROWID,
      });
    } else {
      // Insert new
      analyticsData.analytics_id = Date.now();
      await analyticsTable.insertRow(analyticsData);
    }
  } catch (error) {
    console.error("Error updating analytics:", error);
  }
}

/**
 * Calculate compliance score
 */
function calculateComplianceScore(
  totalEvents,
  highRiskCount,
  pendingApprovals
) {
  let score = 100;

  // Deduct for high-risk items
  score -= highRiskCount * 5;

  // Deduct for pending approvals
  score -= pendingApprovals * 3;

  // Minimum score is 0
  return Math.max(0, Math.min(100, score));
}

/**
 * Trigger risk prediction model
 */
async function triggerRiskPrediction(projectId, catalystApp) {
  try {
    // Call ML prediction function
    const functions = catalystApp.function();
    const predictFunction = functions.functionId("predict-risks");

    await predictFunction.execute({
      project_id: projectId,
      trigger: "high_risk_event",
    });
  } catch (error) {
    console.error("Error triggering risk prediction:", error);
  }
}
