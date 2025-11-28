/**
 * Catalyst Function: Generate Compliance Summary
 * Generates comprehensive compliance summary reports
 */

const catalyst = require("zcatalyst-sdk-node");

module.exports = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);

    const { project, regulation = "all", channel_id } = req.query;

    if (!project) {
      return res.status(400).send({
        error: "Project name is required",
      });
    }

    const datastore = catalystApp.datastore();
    const eventsTable = datastore.table("compliance_events");

    // Build query
    let query = `SELECT * FROM compliance_events WHERE project_id LIKE '%${project}%'`;

    if (regulation !== "all") {
      query += ` AND regulation = '${regulation}'`;
    }

    // Get last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query += ` AND created_at >= '${thirtyDaysAgo.toISOString()}'`;

    query += " ORDER BY created_at DESC";

    const queryPromise = eventsTable.query(query);
    const results = await queryPromise;

    // Process results
    const events = results.map((r) => r.compliance_events);

    // Aggregate data
    const summary = {
      project_name: project,
      regulation: regulation.toUpperCase(),
      period: `Last 30 days`,
      total_events: events.length,
      compliance_score: 0,
      approvals: 0,
      risks: 0,
      decisions: 0,
      milestones: 0,
      pending_actions: [],
      events_by_type: {},
      events_by_regulation: {},
      events_by_risk: {},
      timeline: [],
      report_url: "",
    };

    // Process each event
    events.forEach((event) => {
      // Count by type
      const type = event.event_type;
      summary.events_by_type[type] = (summary.events_by_type[type] || 0) + 1;

      // Count specific types
      if (type === "approval") summary.approvals++;
      if (type === "risk_discussion") summary.risks++;
      if (type === "decision") summary.decisions++;
      if (type === "milestone") summary.milestones++;

      // Count by regulation
      const reg = event.regulation;
      summary.events_by_regulation[reg] =
        (summary.events_by_regulation[reg] || 0) + 1;

      // Count by risk
      const risk = event.risk_level;
      summary.events_by_risk[risk] = (summary.events_by_risk[risk] || 0) + 1;

      // Collect pending actions
      if (event.status === "Pending Review") {
        summary.pending_actions.push({
          type: type,
          description: event.message_text.substring(0, 100) + "...",
          risk: risk,
          deadline: event.deadline,
          url: event.evidence_url,
        });
      }

      // Build timeline
      summary.timeline.push({
        date: event.timestamp,
        type: type,
        regulation: reg,
        risk: risk,
        user: event.user_name,
      });
    });

    // Calculate compliance score
    summary.compliance_score = calculateDetailedComplianceScore(events);

    // Generate report URL (would integrate with Zoho Writer or file storage)
    summary.report_url = `https://compliance.zoho.com/reports/${project}-${Date.now()}.pdf`;

    res.status(200).send(summary);
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).send({
      error: error.message,
    });
  }
};

/**
 * Calculate detailed compliance score
 */
function calculateDetailedComplianceScore(events) {
  if (events.length === 0) return 50;

  let score = 100;

  // Factor 1: High-risk pending items
  const highRiskPending = events.filter(
    (e) =>
      (e.risk_level === "High" || e.risk_level === "Critical") &&
      e.status === "Pending Review"
  ).length;
  score -= highRiskPending * 5;

  // Factor 2: Overdue deadlines
  const now = new Date();
  const overdue = events.filter(
    (e) =>
      e.deadline && new Date(e.deadline) < now && e.status === "Pending Review"
  ).length;
  score -= overdue * 10;

  // Factor 3: Event coverage (diverse event types)
  const eventTypes = new Set(events.map((e) => e.event_type));
  const coverageBonus = Math.min(eventTypes.size * 2, 10);
  score += coverageBonus;

  // Factor 4: Recent activity (events in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentEvents = events.filter(
    (e) => new Date(e.created_at) >= sevenDaysAgo
  ).length;
  const activityBonus = Math.min((recentEvents / events.length) * 10, 10);
  score += activityBonus;

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
