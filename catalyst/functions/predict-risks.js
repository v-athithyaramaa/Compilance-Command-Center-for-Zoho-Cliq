/**
 * Catalyst Function: Predict Risks
 * Uses ML model to predict compliance bottlenecks and risks
 */

const catalyst = require("zcatalyst-sdk-node");

module.exports = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);

    const { channel_id, project_id, days_ahead = 7 } = req.query || req.body;

    const datastore = catalystApp.datastore();
    const eventsTable = datastore.table("compliance_events");
    const predictionsTable = datastore.table("risk_predictions");
    const analyticsTable = datastore.table("compliance_analytics");

    // Get project ID from channel if not provided
    const targetProjectId = project_id || channel_id;

    // Collect feature data for prediction
    const features = await collectFeatureData(targetProjectId, catalystApp);

    // Run prediction model
    const predictions = await runPredictionModel(
      features,
      parseInt(days_ahead)
    );

    // Store predictions in database
    for (const prediction of predictions) {
      const predictionData = {
        prediction_id: Date.now() + Math.random(),
        project_id: targetProjectId,
        risk_category: prediction.category,
        severity: prediction.severity,
        probability: prediction.probability,
        predicted_impact_date: prediction.impact_date,
        affected_teams: JSON.stringify(prediction.affected_teams),
        contributing_factors: JSON.stringify(prediction.factors),
        recommendations: JSON.stringify(prediction.recommendations),
        confidence: prediction.confidence,
        status: "Active",
        created_at: new Date().toISOString(),
      };

      await predictionsTable.insertRow(predictionData);
    }

    // Format response
    const response = {
      risks: predictions,
      summary: {
        total_risks: predictions.length,
        by_severity: {
          critical: predictions.filter((p) => p.severity === "Critical").length,
          high: predictions.filter((p) => p.severity === "High").length,
          medium: predictions.filter((p) => p.severity === "Medium").length,
          low: predictions.filter((p) => p.severity === "Low").length,
        },
        overall_risk_score: calculateOverallRiskScore(predictions),
      },
      details_url: `https://compliance.zoho.com/risks/${targetProjectId}`,
    };

    res.status(200).send(response);
  } catch (error) {
    console.error("Error predicting risks:", error);
    res.status(500).send({
      error: error.message,
    });
  }
};

/**
 * Collect feature data for ML model
 */
async function collectFeatureData(projectId, catalystApp) {
  const datastore = catalystApp.datastore();
  const eventsTable = datastore.table("compliance_events");
  const analyticsTable = datastore.table("compliance_analytics");

  // Get recent events
  const query = `SELECT * FROM compliance_events WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 100`;
  const events = await eventsTable.query(query);

  // Get analytics history
  const analyticsQuery = `SELECT * FROM compliance_analytics WHERE project_id = '${projectId}' ORDER BY date DESC LIMIT 30`;
  const analytics = await analyticsTable.query(analyticsQuery);

  // Calculate features
  const features = {
    team_response_time: calculateAverageResponseTime(events),
    dependency_chain_length: 3, // Would integrate with Zoho Projects API
    days_until_deadline: calculateDaysUntilDeadline(projectId),
    pending_approvals: events.filter(
      (e) =>
        e.compliance_events.event_type === "approval" &&
        e.compliance_events.status === "Pending Review"
    ).length,
    team_workload: 0.7, // Would integrate with Zoho Projects API
    historical_delay_rate: calculateHistoricalDelayRate(analytics),
    compliance_event_velocity: calculateEventVelocity(events),
    high_risk_count: events.filter(
      (e) =>
        e.compliance_events.risk_level === "High" ||
        e.compliance_events.risk_level === "Critical"
    ).length,
    recent_trend: calculateTrend(analytics),
  };

  return features;
}

/**
 * Run ML prediction model
 */
async function runPredictionModel(features, daysAhead) {
  const predictions = [];

  // Model 1: Approval Delay Prediction
  const approvalRisk = predictApprovalDelay(features);
  if (approvalRisk.probability > 0.3) {
    predictions.push({
      category: "approval_delay",
      title: "Approval Process Delay Risk",
      severity: getSeverity(approvalRisk.probability),
      probability: approvalRisk.probability,
      impact_date: getImpactDate(daysAhead, approvalRisk.delay_days),
      affected_teams: approvalRisk.teams,
      factors: approvalRisk.factors,
      recommendations: approvalRisk.recommendations,
      confidence: approvalRisk.confidence,
    });
  }

  // Model 2: Dependency Bottleneck Prediction
  const dependencyRisk = predictDependencyBottleneck(features);
  if (dependencyRisk.probability > 0.3) {
    predictions.push({
      category: "dependency_bottleneck",
      title: "Cross-Team Dependency Delay",
      severity: getSeverity(dependencyRisk.probability),
      probability: dependencyRisk.probability,
      impact_date: getImpactDate(daysAhead, dependencyRisk.delay_days),
      affected_teams: dependencyRisk.teams,
      factors: dependencyRisk.factors,
      recommendations: dependencyRisk.recommendations,
      confidence: dependencyRisk.confidence,
    });
  }

  // Model 3: Documentation Gap Prediction
  const docRisk = predictDocumentationGap(features);
  if (docRisk.probability > 0.3) {
    predictions.push({
      category: "documentation_gap",
      title: "Incomplete Compliance Documentation",
      severity: getSeverity(docRisk.probability),
      probability: docRisk.probability,
      impact_date: getImpactDate(daysAhead, docRisk.delay_days),
      affected_teams: docRisk.teams,
      factors: docRisk.factors,
      recommendations: docRisk.recommendations,
      confidence: docRisk.confidence,
    });
  }

  // Model 4: Resource Constraint Prediction
  const resourceRisk = predictResourceConstraint(features);
  if (resourceRisk.probability > 0.3) {
    predictions.push({
      category: "resource_constraint",
      title: "Team Bandwidth Limitation",
      severity: getSeverity(resourceRisk.probability),
      probability: resourceRisk.probability,
      impact_date: getImpactDate(daysAhead, resourceRisk.delay_days),
      affected_teams: resourceRisk.teams,
      factors: resourceRisk.factors,
      recommendations: resourceRisk.recommendations,
      confidence: resourceRisk.confidence,
    });
  }

  return predictions.sort((a, b) => b.probability - a.probability);
}

/**
 * Predict approval delay
 */
function predictApprovalDelay(features) {
  const { team_response_time, pending_approvals, days_until_deadline } =
    features;

  // Simplified ML model (would be replaced with trained model)
  let probability = 0;
  const factors = [];
  const teams = ["Compliance Team", "Legal"];
  const recommendations = [];

  // High response time increases risk
  if (team_response_time > 72) {
    probability += 0.35;
    factors.push({
      factor: "Slow average response time",
      impact_score: 0.35,
      current_value: team_response_time,
      threshold_value: 48,
    });
    recommendations.push({
      action: "Escalate to manager for priority review",
      priority: "high",
      estimated_effort: "30 minutes",
      expected_risk_reduction: 0.25,
    });
  }

  // Many pending approvals increase risk
  if (pending_approvals > 5) {
    probability += 0.3;
    factors.push({
      factor: "High number of pending approvals",
      impact_score: 0.3,
      current_value: pending_approvals,
      threshold_value: 3,
    });
    recommendations.push({
      action: "Schedule dedicated approval session",
      priority: "high",
      estimated_effort: "2 hours",
      expected_risk_reduction: 0.3,
    });
  }

  // Tight deadline increases risk
  if (days_until_deadline < 7) {
    probability += 0.25;
    factors.push({
      factor: "Tight deadline",
      impact_score: 0.25,
      current_value: days_until_deadline,
      threshold_value: 14,
    });
    recommendations.push({
      action: "Request expedited review process",
      priority: "critical",
      estimated_effort: "1 hour",
      expected_risk_reduction: 0.2,
    });
  }

  return {
    probability: Math.min(1.0, probability),
    delay_days: Math.round(team_response_time / 24),
    teams,
    factors,
    recommendations,
    confidence: 0.85,
  };
}

/**
 * Predict dependency bottleneck
 */
function predictDependencyBottleneck(features) {
  const { dependency_chain_length, team_workload, historical_delay_rate } =
    features;

  let probability = 0;
  const factors = [];
  const teams = ["Engineering", "Product", "Legal"];
  const recommendations = [];

  if (dependency_chain_length > 4) {
    probability += 0.4;
    factors.push({
      factor: "Complex dependency chain",
      impact_score: 0.4,
      current_value: dependency_chain_length,
      threshold_value: 3,
    });
    recommendations.push({
      action: "Parallelize independent tasks",
      priority: "medium",
      estimated_effort: "4 hours",
      expected_risk_reduction: 0.25,
    });
  }

  if (team_workload > 0.85) {
    probability += 0.35;
    factors.push({
      factor: "Team approaching capacity",
      impact_score: 0.35,
      current_value: team_workload,
      threshold_value: 0.75,
    });
    recommendations.push({
      action: "Allocate additional resources or extend timeline",
      priority: "high",
      estimated_effort: "Varies",
      expected_risk_reduction: 0.35,
    });
  }

  if (historical_delay_rate > 0.4) {
    probability += 0.2;
    factors.push({
      factor: "High historical delay rate",
      impact_score: 0.2,
      current_value: historical_delay_rate,
      threshold_value: 0.25,
    });
  }

  return {
    probability: Math.min(1.0, probability),
    delay_days: dependency_chain_length * 2,
    teams,
    factors,
    recommendations,
    confidence: 0.78,
  };
}

/**
 * Predict documentation gap
 */
function predictDocumentationGap(features) {
  const { compliance_event_velocity, days_until_deadline, high_risk_count } =
    features;

  let probability = 0;
  const factors = [];
  const teams = ["Compliance Team"];
  const recommendations = [];

  if (compliance_event_velocity < 0.5) {
    probability += 0.45;
    factors.push({
      factor: "Low compliance event velocity",
      impact_score: 0.45,
      current_value: compliance_event_velocity,
      threshold_value: 1.0,
    });
    recommendations.push({
      action: "Schedule documentation sprint",
      priority: "high",
      estimated_effort: "1 day",
      expected_risk_reduction: 0.4,
    });
  }

  if (days_until_deadline < 14 && compliance_event_velocity < 1.0) {
    probability += 0.3;
    recommendations.push({
      action: "Auto-generate draft documentation from existing events",
      priority: "critical",
      estimated_effort: "2 hours",
      expected_risk_reduction: 0.3,
    });
  }

  return {
    probability: Math.min(1.0, probability),
    delay_days: 7,
    teams,
    factors,
    recommendations,
    confidence: 0.72,
  };
}

/**
 * Predict resource constraint
 */
function predictResourceConstraint(features) {
  const { team_workload, pending_approvals, dependency_chain_length } =
    features;

  let probability = 0;
  const factors = [];
  const teams = ["All Teams"];
  const recommendations = [];

  if (team_workload > 0.9) {
    probability += 0.5;
    factors.push({
      factor: "Team severely overloaded",
      impact_score: 0.5,
      current_value: team_workload,
      threshold_value: 0.75,
    });
    recommendations.push({
      action: "Bring in external contractors or extend deadline",
      priority: "critical",
      estimated_effort: "Varies",
      expected_risk_reduction: 0.45,
    });
  }

  return {
    probability: Math.min(1.0, probability),
    delay_days: 5,
    teams,
    factors,
    recommendations,
    confidence: 0.8,
  };
}

// Helper functions
function calculateAverageResponseTime(events) {
  // Simplified - would calculate from actual timestamps
  return 48;
}

function calculateDaysUntilDeadline(projectId) {
  // Would query Zoho Projects
  return 14;
}

function calculateHistoricalDelayRate(analytics) {
  if (!analytics || analytics.length === 0) return 0.3;
  // Simplified calculation
  return 0.35;
}

function calculateEventVelocity(events) {
  if (!events || events.length === 0) return 0;
  // Events per day
  return events.length / 7;
}

function calculateTrend(analytics) {
  return "stable";
}

function getSeverity(probability) {
  if (probability >= 0.85) return "Critical";
  if (probability >= 0.7) return "High";
  if (probability >= 0.5) return "Medium";
  return "Low";
}

function getImpactDate(daysAhead, delayDays) {
  const date = new Date();
  date.setDate(date.getDate() + Math.min(daysAhead, delayDays));
  return date.toISOString();
}

function calculateOverallRiskScore(predictions) {
  if (predictions.length === 0) return 0;
  const avgProbability =
    predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length;
  return Math.round(avgProbability * 10 * 10) / 10;
}
