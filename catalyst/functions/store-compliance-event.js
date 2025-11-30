/**
 * Catalyst Function: Store Compliance Event
 * Receives compliance events from Deluge and stores in DataStore
 */

const catalyst = require("zcatalyst-sdk-node");

module.exports = async (context, basicIO) => {
  try {
    const catalystApp = catalyst.initialize(context);

    // Get DataStore instance
    const datastore = catalystApp.datastore();
    const eventsTable = datastore.table("compliance_events");

    // Extract event data from POST body (JSON from Deluge)
    let eventData = {};

    // Method 1: Try to get JSON body from request.body (primary method for JSON POST)
    try {
      const requestBody = context.request ? context.request.body : null;
      context.log("Raw request body type: " + typeof requestBody);

      if (requestBody) {
        if (typeof requestBody === "string") {
          // Parse JSON string
          eventData = JSON.parse(requestBody);
          context.log("Method 1 SUCCESS - Parsed JSON from request.body");
        } else if (typeof requestBody === "object") {
          // Already an object
          eventData = requestBody;
          context.log("Method 1 SUCCESS - Got object from request.body");
        }
      }
    } catch (parseError) {
      context.log("Error parsing request body: " + parseError.message);
    }

    // Method 2: Fallback to basicIO.getArgument for form-encoded data
    if (!eventData.channel_id || !eventData.message_id) {
      context.log(
        "Method 1 FAILED or incomplete - Trying Method 2 (basicIO.getArgument)"
      );
      const channel_id = basicIO.getArgument("channel_id");
      const message_id = basicIO.getArgument("message_id");

      if (channel_id && message_id) {
        eventData = {
          timestamp: basicIO.getArgument("timestamp"),
          channel_id: channel_id,
          channel_name: basicIO.getArgument("channel_name"),
          message_id: message_id,
          user_id: basicIO.getArgument("user_id"),
          user_name: basicIO.getArgument("user_name"),
          event_type: basicIO.getArgument("event_type"),
          regulation: basicIO.getArgument("regulation"),
          risk_level: basicIO.getArgument("risk_level"),
          decision_type: basicIO.getArgument("decision_type"),
          message_text: basicIO.getArgument("message_text"),
          evidence_url: basicIO.getArgument("evidence_url"),
          confidence_score: basicIO.getArgument("confidence_score"),
          stakeholders: basicIO.getArgument("stakeholders"),
          deadline: basicIO.getArgument("deadline"),
          project_id: basicIO.getArgument("project_id"),
          zia_entities: basicIO.getArgument("zia_entities"),
        };
        context.log("Method 2 SUCCESS - Got data via getArgument");
      }
    }

    // Debug: Log what we received
    context.log("Final event data keys: " + Object.keys(eventData).join(", "));
    context.log("Final event data: " + JSON.stringify(eventData));

    // Validate required fields
    if (!eventData.channel_id || !eventData.message_id) {
      context.log("Missing required fields: channel_id or message_id");
      basicIO.write(
        JSON.stringify({
          success: false,
          error:
            "Missing required fields: channel_id and message_id are required",
          received_data: eventData,
        })
      );
      context.close();
      return;
    }

    // Generate unique event ID
    const eventId = Date.now();

    // Prepare row data with CORRECT column names and types
    const now = new Date();
    const mysqlTimestamp = now.toISOString().slice(0, 19).replace("T", " ");

    const rowData = {
      event_id: eventId, // bigint - Date.now() returns number
      time_stamp: eventData.timestamp || mysqlTimestamp, // datetime - FIXED: was "timestamp"
      channel_id: String(eventData.channel_id), // varchar
      channel_name: String(eventData.channel_name || ""), // varchar
      message_id: String(eventData.message_id), // varchar
      user_id: String(eventData.user_id || ""), // varchar
      user_name: String(eventData.user_name || ""), // varchar
      event_type: eventData.event_type || null, // varchar (nullable)
      regulation: String(eventData.regulation || "General"), // varchar
      risk_level: String(eventData.risk_level || "Low"), // varchar
      decision_type: eventData.decision_type || null, // varchar (nullable)
      message_text: String(eventData.message_text || ""), // text
      evidence_url: eventData.evidence_url || null, // varchar (nullable)
      confidence_score: parseFloat(eventData.confidence_score) || 0.0, // double
      stakeholders:
        typeof eventData.stakeholders === "string"
          ? eventData.stakeholders
          : JSON.stringify(eventData.stakeholders || []), // text
      deadline: eventData.deadline || null, // datetime (nullable)
      project_id: String(eventData.project_id || eventData.channel_id), // varchar
      status: "Pending Review", // varchar (has default)
      zia_entities:
        typeof eventData.zia_entities === "string"
          ? eventData.zia_entities
          : JSON.stringify(eventData.zia_entities || {}), // text
      created_at: mysqlTimestamp, // datetime
    };

    // Log row data for debugging
    context.log("=== Row Data Type Check ===");
    Object.keys(rowData).forEach((key) => {
      context.log(key + ": " + typeof rowData[key] + " = " + rowData[key]);
    });

    // Insert into DataStore
    context.log("Attempting to insert row data...");
    let insertedRow;
    try {
      insertedRow = await eventsTable.insertRow(rowData);
      context.log("Successfully inserted row with ROWID: " + insertedRow.ROWID);
    } catch (insertError) {
      context.log("Insert error: " + insertError.message);
      context.log("Insert error details: " + JSON.stringify(insertError));
      throw insertError; // Re-throw to be caught by outer catch
    }

    // Trigger analytics update (async, don't wait)
    updateAnalytics(rowData.project_id, catalystApp, context).catch((err) =>
      context.log("Analytics update failed: " + err.message)
    );

    // If high/critical risk, trigger prediction model (async)
    if (rowData.risk_level === "High" || rowData.risk_level === "Critical") {
      triggerRiskPrediction(rowData.project_id, catalystApp, context).catch(
        (err) => context.log("Risk prediction failed: " + err.message)
      );
    }

    // Check for deadline approaching (async)
    if (rowData.deadline) {
      checkDeadlineAlert(rowData, catalystApp, context).catch((err) =>
        context.log("Deadline alert failed: " + err.message)
      );
    }

    // Send success response
    const response = {
      success: true,
      event_id: eventId,
      message: "Compliance event stored successfully",
      rowid: insertedRow ? insertedRow.ROWID : null,
    };
    context.log("Sending success response: " + JSON.stringify(response));
    basicIO.write(JSON.stringify(response));
    context.close();
  } catch (error) {
    context.log("Error storing compliance event: " + error.message);
    context.log("Error stack: " + (error.stack || "No stack trace"));
    context.log("Error details: " + JSON.stringify(error));

    // Get error message - handle both Error objects and strings
    let errorMessage = error.message || error.toString() || "Unknown error";
    if (typeof errorMessage !== "string") {
      errorMessage = JSON.stringify(errorMessage);
    }

    const errorResponse = {
      success: false,
      error: errorMessage,
      error_type: error.constructor ? error.constructor.name : typeof error,
    };
    context.log("Sending error response: " + JSON.stringify(errorResponse));
    basicIO.write(JSON.stringify(errorResponse));
    context.close();
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
async function updateAnalytics(projectId, catalystApp, context) {
  try {
    const datastore = catalystApp.datastore();
    const zcql = catalystApp.zcql();
    const eventsTable = datastore.table("compliance_events");
    const analyticsTable = datastore.table("compliance_analytics");

    // Get today's date range (start and end of day) in MySQL format
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = todayDate.toISOString().slice(0, 10); // YYYY-MM-DD format for date field
    const todayStart = todayDate.toISOString().slice(0, 19).replace("T", " "); // YYYY-MM-DD HH:MM:SS for datetime

    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayEnd = tomorrow.toISOString().slice(0, 19).replace("T", " ");

    // Query today's events for this project using ZCQL (date range instead of DATE function)
    const query =
      "SELECT * FROM compliance_events WHERE project_id = '" +
      projectId +
      "' AND created_at >= '" +
      todayStart +
      "' AND created_at < '" +
      todayEnd +
      "'";
    const queryResult = await zcql.executeZCQLQuery(query);
    const events = queryResult.map((r) => r.compliance_events || r);

    // Calculate metrics
    const totalEvents = events.length;
    const highRiskCount = events.filter(
      (e) => e.risk_level === "High" || e.risk_level === "Critical"
    ).length;
    const pendingApprovals = events.filter(
      (e) => e.event_type === "approval" && e.status === "Pending Review"
    ).length;

    // Count by type
    const eventsByType = {};
    events.forEach((e) => {
      const type = e.event_type;
      eventsByType[type] = (eventsByType[type] || 0) + 1;
    });

    // Count by regulation
    const eventsByRegulation = {};
    events.forEach((e) => {
      const reg = e.regulation;
      eventsByRegulation[reg] = (eventsByRegulation[reg] || 0) + 1;
    });

    // Calculate compliance score (simplified version)
    const complianceScore = calculateComplianceScore(
      totalEvents,
      highRiskCount,
      pendingApprovals
    );

    // Check if analytics record exists for today using ZCQL
    const existingQuery =
      "SELECT * FROM compliance_analytics WHERE project_id = '" +
      projectId +
      "' AND date = '" +
      today +
      "'";
    const existingResult = await zcql.executeZCQLQuery(existingQuery);
    const existing = existingResult.map((r) => r.compliance_analytics || r);

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
        ROWID: existing[0].ROWID,
      });
    } else {
      // Insert new
      analyticsData.analytics_id = Date.now();
      await analyticsTable.insertRow(analyticsData);
    }
  } catch (error) {
    if (context) {
      context.log("Error updating analytics: " + error.message);
    } else {
      console.error("Error updating analytics:", error);
    }
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
async function triggerRiskPrediction(projectId, catalystApp, context) {
  try {
    // Call ML prediction function
    const functions = catalystApp.function();
    const predictFunction = functions.functionId("predict-risks");

    await predictFunction.execute({
      project_id: projectId,
      trigger: "high_risk_event",
    });
  } catch (error) {
    if (context) {
      context.log("Error triggering risk prediction: " + error.message);
    } else {
      console.error("Error triggering risk prediction:", error);
    }
  }
}

/**
 * Check deadline and send predictive alert if 48 hours before
 */
async function checkDeadlineAlert(eventData, catalystApp, context) {
  try {
    if (!eventData.deadline) return;

    const deadline = new Date(eventData.deadline);
    const now = new Date();
    const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

    // Alert if deadline is within 48-50 hours (48 hours before)
    if (hoursUntilDeadline >= 48 && hoursUntilDeadline <= 50) {
      // Send predictive alert
      const alertMessage = {
        text: "Predictive Alert: Deadline Approaching",
        card: {
          title: "Deadline Alert - 48 Hours Remaining",
          theme: "modern-inline",
          sections: [
            {
              title: "Deadline Information",
              data: [
                { key: "Event Type", value: eventData.event_type },
                { key: "Regulation", value: eventData.regulation },
                { key: "Deadline", value: deadline.toLocaleDateString() },
                {
                  key: "Hours Remaining",
                  value: Math.round(hoursUntilDeadline) + " hours",
                },
                { key: "Channel", value: eventData.channel_name },
                { key: "Status", value: eventData.status },
              ],
            },
            {
              title: "Action Required",
              data: [
                {
                  key: "Message",
                  value:
                    "This compliance item has a deadline in " +
                    Math.round(hoursUntilDeadline) +
                    " hours. Please ensure all approvals and reviews are completed on time.",
                },
              ],
            },
          ],
          buttons: [
            {
              label: "View Event Details",
              type: "open.url",
              url: eventData.evidence_url || "#",
            },
          ],
        },
      };

      // Send to compliance team channel (would need channel ID from config)
      // For now, log the alert (in production, send via Cliq API)
      if (context) {
        context.log(
          "Predictive deadline alert: " + JSON.stringify(alertMessage)
        );
      } else {
        console.log("Predictive deadline alert:", alertMessage);
      }

      // TODO: Send alert via Cliq webhook or API
      // This would call back to Cliq to post the alert message
    }
  } catch (error) {
    if (context) {
      context.log("Error checking deadline alert: " + error.message);
    } else {
      console.error("Error checking deadline alert:", error);
    }
  }
}
