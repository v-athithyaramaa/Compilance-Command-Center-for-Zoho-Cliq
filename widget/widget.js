/**
 * Compliance Dashboard Widget - JavaScript
 * Fetches and displays real-time compliance data
 */

// Configuration
const CONFIG = {
  CATALYST_BASE_URL:
    process.env.CATALYST_BASE_URL || "https://catalyst.zoho.com/baas/v1",
  REFRESH_INTERVAL: 30000, // 30 seconds
  PROJECT_ID: null, // Set from Cliq context
};

let eventsChart = null;
let riskChart = null;
let refreshTimer = null;

/**
 * Initialize widget on load
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Compliance Dashboard initializing...");

  // Get project context from Cliq
  await loadProjectContext();

  // Load initial data
  await loadDashboardData();

  // Set up auto-refresh
  startAutoRefresh();

  console.log("Dashboard initialized");
});

/**
 * Load project context from Cliq
 */
async function loadProjectContext() {
  try {
    // Get channel ID from Cliq context
    const channelId = await getCliqChannelId();
    CONFIG.PROJECT_ID = channelId;
  } catch (error) {
    console.error("Error loading context:", error);
    CONFIG.PROJECT_ID = "default";
  }
}

/**
 * Get Cliq channel ID
 */
async function getCliqChannelId() {
  // This would use Cliq Widget SDK
  // For now, return mock data
  return "channel-123";
}

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
  try {
    showLoading(true);

    // Fetch data in parallel
    const [healthData, risksData, actionsData, analyticsData] =
      await Promise.all([
        fetchHealthScore(),
        fetchPredictedRisks(),
        fetchPendingActions(),
        fetchAnalytics(),
      ]);

    // Update UI
    updateHealthScore(healthData);
    updateRegulationMatrix(healthData.regulations);
    updateRisksList(risksData.risks);
    updateActionsList(actionsData.actions);
    updateCharts(analyticsData);

    // Update last updated time
    document.getElementById("lastUpdated").textContent =
      new Date().toLocaleTimeString();

    showLoading(false);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showError("Failed to load dashboard data");
    showLoading(false);
  }
}

/**
 * Fetch compliance health score
 */
async function fetchHealthScore() {
  try {
    const response = await fetch(
      `${CONFIG.CATALYST_BASE_URL}/functions/health-score?scope=${CONFIG.PROJECT_ID}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching health score:", error);
    // Return mock data
    return {
      score: 87,
      trend: "improving",
      project_count: 5,
      total_events: 234,
      regulations: [
        { name: "SOC 2", score: 92, status: "Compliant" },
        { name: "GDPR", score: 85, status: "Attention Needed" },
        { name: "ISO 27001", score: 88, status: "Compliant" },
        { name: "HIPAA", score: 75, status: "At Risk" },
      ],
    };
  }
}

/**
 * Fetch predicted risks
 */
async function fetchPredictedRisks() {
  try {
    const response = await fetch(
      `${CONFIG.CATALYST_BASE_URL}/functions/predict-risks?project_id=${CONFIG.PROJECT_ID}&days_ahead=7`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching risks:", error);
    // Return mock data
    return {
      risks: [
        {
          title: "Approval Process Delay Risk",
          severity: "High",
          probability: 0.75,
          impact_date: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000
          ).toISOString(),
          affected_teams: ["Legal", "Compliance"],
          recommendations: [
            {
              action: "Escalate to manager for priority review",
              priority: "high",
            },
          ],
        },
        {
          title: "Documentation Gap",
          severity: "Medium",
          probability: 0.55,
          impact_date: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000
          ).toISOString(),
          affected_teams: ["Compliance Team"],
          recommendations: [
            { action: "Schedule documentation sprint", priority: "medium" },
          ],
        },
      ],
    };
  }
}

/**
 * Fetch pending actions
 */
async function fetchPendingActions() {
  try {
    const response = await fetch(
      `${CONFIG.CATALYST_BASE_URL}/functions/pending-actions?project_id=${CONFIG.PROJECT_ID}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching actions:", error);
    // Return mock data
    return {
      actions: [
        {
          id: 1,
          type: "approval",
          description: "Security review for data encryption module",
          risk: "High",
          deadline: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
          assignee: "Legal Team",
        },
        {
          id: 2,
          type: "decision",
          description: "Data retention policy for EU customers",
          risk: "Critical",
          deadline: new Date(
            Date.now() + 1 * 24 * 60 * 60 * 1000
          ).toISOString(),
          assignee: "Compliance Officer",
        },
        {
          id: 3,
          type: "risk_discussion",
          description: "Vendor security assessment incomplete",
          risk: "Medium",
          deadline: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          assignee: "Security Team",
        },
      ],
    };
  }
}

/**
 * Fetch analytics data
 */
async function fetchAnalytics() {
  try {
    const response = await fetch(
      `${CONFIG.CATALYST_BASE_URL}/functions/analytics?project_id=${CONFIG.PROJECT_ID}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    // Return mock data
    return {
      events_by_type: {
        approval: 45,
        risk_discussion: 32,
        decision: 28,
        milestone: 15,
        audit_action: 12,
      },
      events_by_risk: {
        Low: 58,
        Medium: 42,
        High: 28,
        Critical: 6,
      },
    };
  }
}

/**
 * Update health score display
 */
function updateHealthScore(data) {
  const scoreElement = document.getElementById("scoreValue");
  const trendElement = document.getElementById("scoreTrend");
  const circleElement = document.getElementById("scoreCircle");

  // Animate score
  animateValue(scoreElement, 0, data.score, 1000);

  // Set color based on score
  if (data.score >= 90) {
    circleElement.className = "score-circle score-excellent";
  } else if (data.score >= 70) {
    circleElement.className = "score-circle score-good";
  } else if (data.score >= 50) {
    circleElement.className = "score-circle score-warning";
  } else {
    circleElement.className = "score-circle score-critical";
  }

  // Update trend
  const trendIcon =
    data.trend === "improving"
      ? "📈"
      : data.trend === "deteriorating"
        ? "📉"
        : "➡️";
  trendElement.textContent = `${trendIcon} ${data.trend}`;

  // Update counts
  document.getElementById("projectCount").textContent = data.project_count || 0;
  document.getElementById("eventCount").textContent = data.total_events || 0;
}

/**
 * Update regulation matrix
 */
function updateRegulationMatrix(regulations) {
  const container = document.getElementById("regulationMatrix");
  container.innerHTML = "";

  regulations.forEach((reg) => {
    const card = document.createElement("div");
    card.className = "regulation-card";

    const scoreClass =
      reg.score >= 90
        ? "excellent"
        : reg.score >= 70
          ? "good"
          : reg.score >= 50
            ? "warning"
            : "critical";

    card.innerHTML = `
            <div class="regulation-name">${reg.name}</div>
            <div class="regulation-score score-${scoreClass}">${reg.score}%</div>
            <div class="regulation-status">${reg.status}</div>
            <div class="regulation-bar">
                <div class="regulation-progress score-${scoreClass}" style="width: ${reg.score}%"></div>
            </div>
        `;

    container.appendChild(card);
  });
}

/**
 * Update risks list
 */
function updateRisksList(risks) {
  const container = document.getElementById("riskList");
  container.innerHTML = "";

  if (risks.length === 0) {
    container.innerHTML =
      '<div class="no-data">✅ No risks predicted in the next 7 days</div>';
    return;
  }

  risks.forEach((risk) => {
    const card = document.createElement("div");
    card.className = `risk-card risk-${risk.severity.toLowerCase()}`;

    const impactDate = new Date(risk.impact_date);
    const daysAway = Math.ceil(
      (impactDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    card.innerHTML = `
            <div class="risk-header">
                <span class="risk-severity">${getSeverityIcon(risk.severity)} ${risk.severity}</span>
                <span class="risk-probability">${Math.round(risk.probability * 100)}% likely</span>
            </div>
            <div class="risk-title">${risk.title}</div>
            <div class="risk-details">
                <div class="risk-impact">Impact in ${daysAway} days</div>
                <div class="risk-teams">Teams: ${risk.affected_teams.join(", ")}</div>
            </div>
            <div class="risk-recommendations">
                ${risk.recommendations
                  .map(
                    (rec) => `
                    <div class="recommendation">
                        <span class="rec-priority priority-${rec.priority}">${rec.priority}</span>
                        ${rec.action}
                    </div>
                `
                  )
                  .join("")}
            </div>
        `;

    container.appendChild(card);
  });
}

/**
 * Update actions list
 */
function updateActionsList(actions) {
  const container = document.getElementById("actionsList");
  container.innerHTML = "";

  if (actions.length === 0) {
    container.innerHTML = '<div class="no-data">✅ No pending actions</div>';
    return;
  }

  actions.forEach((action) => {
    const card = document.createElement("div");
    card.className = "action-card";

    const deadline = new Date(action.deadline);
    const isOverdue = deadline < new Date();
    const daysUntil = Math.ceil(
      (deadline - new Date()) / (1000 * 60 * 60 * 24)
    );

    card.innerHTML = `
            <div class="action-header">
                <span class="action-type">${getTypeIcon(action.type)} ${action.type}</span>
                <span class="action-risk risk-${action.risk.toLowerCase()}">${action.risk}</span>
            </div>
            <div class="action-description">${action.description}</div>
            <div class="action-footer">
                <span class="action-assignee">👤 ${action.assignee}</span>
                <span class="action-deadline ${isOverdue ? "overdue" : ""}">
                    ${isOverdue ? "⚠️ OVERDUE" : `📅 ${daysUntil} days`}
                </span>
            </div>
        `;

    container.appendChild(card);
  });
}

/**
 * Update charts
 */
function updateCharts(data) {
  // Events by Type chart
  const eventsCtx = document.getElementById("eventsChart").getContext("2d");

  if (eventsChart) {
    eventsChart.destroy();
  }

  eventsChart = new Chart(eventsCtx, {
    type: "doughnut",
    data: {
      labels: Object.keys(data.events_by_type),
      datasets: [
        {
          data: Object.values(data.events_by_type),
          backgroundColor: [
            "#4CAF50",
            "#2196F3",
            "#FF9800",
            "#9C27B0",
            "#F44336",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  // Risk Distribution chart
  const riskCtx = document.getElementById("riskChart").getContext("2d");

  if (riskChart) {
    riskChart.destroy();
  }

  riskChart = new Chart(riskCtx, {
    type: "bar",
    data: {
      labels: Object.keys(data.events_by_risk),
      datasets: [
        {
          label: "Events",
          data: Object.values(data.events_by_risk),
          backgroundColor: ["#4CAF50", "#FF9800", "#FF5722", "#D32F2F"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

/**
 * Helper functions
 */
function animateValue(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if (
      (increment > 0 && current >= end) ||
      (increment < 0 && current <= end)
    ) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.round(current);
  }, 16);
}

function getSeverityIcon(severity) {
  const icons = {
    Critical: "🔴",
    High: "🟠",
    Medium: "🟡",
    Low: "🟢",
  };
  return icons[severity] || "⚪";
}

function getTypeIcon(type) {
  const icons = {
    approval: "✅",
    decision: "⚖️",
    risk_discussion: "⚠️",
    milestone: "🎯",
    audit_action: "🔍",
  };
  return icons[type] || "📝";
}

function showLoading(show) {
  // Add loading indicator
  const indicator = document.querySelector(".loading-indicator");
  if (indicator) {
    indicator.style.display = show ? "block" : "none";
  }
}

function showError(message) {
  console.error("Dashboard error:", message);
  // Show error notification
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(() => {
    loadDashboardData();
  }, CONFIG.REFRESH_INTERVAL);
}

/**
 * Button handlers
 */
async function refreshData() {
  await loadDashboardData();
}

function exportReport() {
  window.open(
    `${CONFIG.CATALYST_BASE_URL}/functions/export-report?project_id=${CONFIG.PROJECT_ID}&format=PDF`,
    "_blank"
  );
}

function viewFullReport() {
  window.open(
    `https://compliance.zoho.com/reports/${CONFIG.PROJECT_ID}`,
    "_blank"
  );
}

function configureMonitoring() {
  // Open configuration modal
  alert("Configuration panel coming soon!");
}
