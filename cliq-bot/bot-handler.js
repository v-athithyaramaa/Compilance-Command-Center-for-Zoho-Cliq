/**
 * Compliance Command Center - Main Bot Handler
 * Processes messages, extracts compliance events, and manages bot interactions
 */

const axios = require("axios");
const config = require("./config");

// Bot configuration
const BOT_NAME = "ComplianceBot";
const CATALYST_BASE_URL =
  process.env.CATALYST_BASE_URL || config.catalystBaseUrl;
const ZIA_API_URL = process.env.ZIA_API_URL || config.ziaApiUrl;

/**
 * Main message handler - receives all messages from monitored channels
 */
async function handleMessage(request) {
  const { message, channel, user, bot } = request.body;

  // Ignore bot's own messages
  if (user.id === bot.id) {
    return { success: true };
  }

  try {
    // Check if channel has compliance monitoring enabled
    const isMonitored = await isChannelMonitored(channel.id);

    if (isMonitored) {
      // Extract compliance events from message using Zia
      await processComplianceEvent(message, channel, user);
    }

    // Handle bot commands
    if (message.text.startsWith("/compliance-")) {
      return await handleCommand(message, channel, user);
    }

    // Handle bot mentions
    if (message.mentions && message.mentions.includes(bot.id)) {
      return await handleMention(message, channel, user);
    }

    return { success: true };
  } catch (error) {
    console.error("Error handling message:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process compliance event extraction using Zia NLP
 */
async function processComplianceEvent(message, channel, user) {
  try {
    // Call Zia Skills API for compliance entity extraction
    const ziaResponse = await axios.post(
      `${ZIA_API_URL}/skills/extract`,
      {
        text: message.text,
        model_id: config.ziaModelId,
        entities: [
          "compliance_event",
          "regulation_type",
          "risk_level",
          "decision_type",
        ],
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${await getZohoAuthToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    const extractedData = ziaResponse.data;

    // If compliance-relevant content detected
    if (extractedData.entities.compliance_event) {
      const complianceEvent = {
        timestamp: new Date().toISOString(),
        channel_id: channel.id,
        channel_name: channel.name,
        message_id: message.id,
        user_id: user.id,
        user_name: user.name,
        event_type: extractedData.entities.compliance_event.value,
        regulation: extractedData.entities.regulation_type?.value || "General",
        risk_level: extractedData.entities.risk_level?.value || "Low",
        decision_type: extractedData.entities.decision_type?.value,
        message_text: message.text,
        evidence_url: message.permalink,
        files: message.attachments || [],
        confidence_score: extractedData.confidence,
      };

      // Send to Catalyst for storage and processing
      await axios.post(
        `${CATALYST_BASE_URL}/functions/store-compliance-event`,
        complianceEvent,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check if immediate action required (high risk)
      if (extractedData.entities.risk_level?.value === "High") {
        await sendRiskAlert(complianceEvent, channel);
      }
    }

    return extractedData;
  } catch (error) {
    console.error("Error processing compliance event:", error);
    throw error;
  }
}

/**
 * Handle bot commands
 */
async function handleCommand(message, channel, user) {
  const parts = message.text.split(" ");
  const command = parts[0];
  const args = parts.slice(1);

  switch (command) {
    case "/compliance-summary":
      return await generateComplianceSummary(args, channel);

    case "/compliance-health":
      return await getComplianceHealth(args, channel);

    case "/compliance-risks":
      return await getPredictedRisks(args, channel);

    case "/compliance-export":
      return await exportComplianceReport(args, channel, user);

    case "/compliance-monitor":
      return await toggleMonitoring(args, channel, user);

    case "/compliance-help":
      return await showHelp(channel);

    default:
      return {
        text: `Unknown command: ${command}. Type /compliance-help for available commands.`,
      };
  }
}

/**
 * Generate compliance summary report
 */
async function generateComplianceSummary(args, channel) {
  const projectName = args[0] || channel.name;
  const regulation = args[1] || "all";

  try {
    // Call Catalyst function to generate summary
    const response = await axios.get(
      `${CATALYST_BASE_URL}/functions/generate-summary`,
      {
        params: {
          project: projectName,
          regulation: regulation,
          channel_id: channel.id,
        },
      }
    );

    const summary = response.data;

    // Format response as rich card
    return {
      text: `📊 Compliance Summary: ${projectName}`,
      card: {
        title: `Compliance Summary - ${projectName}`,
        theme: "modern-inline",
        thumbnail: "https://example.com/compliance-icon.png",
        sections: [
          {
            id: 1,
            title: "Overview",
            data: [
              { key: "Regulation", value: regulation.toUpperCase() },
              { key: "Total Events", value: summary.total_events },
              {
                key: "Compliance Score",
                value: `${summary.compliance_score}%`,
              },
              { key: "Period", value: summary.period },
            ],
          },
          {
            id: 2,
            title: "Event Breakdown",
            data: [
              { key: "Approvals", value: summary.approvals },
              { key: "Risk Discussions", value: summary.risks },
              { key: "Decisions", value: summary.decisions },
              { key: "Milestones", value: summary.milestones },
            ],
          },
          {
            id: 3,
            title: "Pending Actions",
            data: summary.pending_actions.map((action) => ({
              key: "⚠️",
              value: action,
            })),
          },
        ],
        buttons: [
          {
            label: "View Full Report",
            type: "open.url",
            url: summary.report_url,
          },
          {
            label: "Export PDF",
            type: "invoke.function",
            function_name: "export_report",
            data: { project: projectName, format: "pdf" },
          },
        ],
      },
    };
  } catch (error) {
    return {
      text: `❌ Error generating summary: ${error.message}`,
    };
  }
}

/**
 * Get compliance health score
 */
async function getComplianceHealth(args, channel) {
  const scope = args[0] || channel.id;

  try {
    const response = await axios.get(
      `${CATALYST_BASE_URL}/functions/health-score`,
      {
        params: { scope },
      }
    );

    const health = response.data;
    const scoreEmoji =
      health.score >= 90 ? "🟢" : health.score >= 70 ? "🟡" : "🔴";

    return {
      text: `${scoreEmoji} Compliance Health: ${health.score}/100`,
      card: {
        title: "Compliance Health Dashboard",
        theme: "modern-inline",
        sections: [
          {
            id: 1,
            title: "Overall Health",
            data: [
              {
                key: "Health Score",
                value: `${scoreEmoji} ${health.score}/100`,
              },
              { key: "Trend", value: health.trend },
              { key: "Last Updated", value: health.last_updated },
            ],
          },
          {
            id: 2,
            title: "Regulation Status",
            data: health.regulations.map((reg) => ({
              key: reg.name,
              value: `${reg.score}% (${reg.status})`,
            })),
          },
          {
            id: 3,
            title: "Risk Indicators",
            data: [
              { key: "High Priority Issues", value: health.high_priority },
              { key: "Overdue Items", value: health.overdue },
              { key: "Missing Documentation", value: health.missing_docs },
            ],
          },
        ],
      },
    };
  } catch (error) {
    return {
      text: `❌ Error fetching health data: ${error.message}`,
    };
  }
}

/**
 * Get predicted compliance risks
 */
async function getPredictedRisks(args, channel) {
  const daysAhead = parseInt(args[0]) || 7;

  try {
    const response = await axios.get(
      `${CATALYST_BASE_URL}/functions/predict-risks`,
      {
        params: {
          channel_id: channel.id,
          days_ahead: daysAhead,
        },
      }
    );

    const risks = response.data.risks;

    if (risks.length === 0) {
      return {
        text:
          "✅ No compliance risks predicted in the next " +
          daysAhead +
          " days!",
      };
    }

    return {
      text: `⚠️ ${risks.length} Compliance Risk(s) Predicted`,
      card: {
        title: `Predicted Risks (Next ${daysAhead} Days)`,
        theme: "modern-inline",
        sections: risks.map((risk, index) => ({
          id: index + 1,
          title: `${getRiskEmoji(risk.severity)} ${risk.title}`,
          data: [
            { key: "Severity", value: risk.severity },
            { key: "Impact Date", value: risk.predicted_date },
            { key: "Affected Teams", value: risk.teams.join(", ") },
            { key: "Recommendation", value: risk.recommendation },
          ],
        })),
        buttons: [
          {
            label: "View Details",
            type: "open.url",
            url: response.data.details_url,
          },
        ],
      },
    };
  } catch (error) {
    return {
      text: `❌ Error predicting risks: ${error.message}`,
    };
  }
}

/**
 * Export compliance report
 */
async function exportComplianceReport(args, channel, user) {
  const project = args[0];
  const format = (args[1] || "PDF").toUpperCase();

  if (!project) {
    return {
      text: "❌ Please specify a project name: /compliance-export <project> <format>",
    };
  }

  try {
    // Trigger report generation
    const response = await axios.post(
      `${CATALYST_BASE_URL}/functions/export-report`,
      {
        project,
        format,
        channel_id: channel.id,
        requested_by: user.id,
      }
    );

    return {
      text: `📄 Generating ${format} report for "${project}"... You'll receive a DM when ready.`,
    };
  } catch (error) {
    return {
      text: `❌ Export failed: ${error.message}`,
    };
  }
}

/**
 * Toggle compliance monitoring for channel
 */
async function toggleMonitoring(args, channel, user) {
  const action = args[0]?.toLowerCase();
  const regulation = args[1] || "all";

  if (!["on", "off"].includes(action)) {
    return {
      text: "❌ Usage: /compliance-monitor [on|off] [regulation]",
    };
  }

  try {
    await axios.post(`${CATALYST_BASE_URL}/functions/toggle-monitoring`, {
      channel_id: channel.id,
      action,
      regulation,
      user_id: user.id,
    });

    return {
      text:
        action === "on"
          ? `✅ Compliance monitoring enabled for ${regulation.toUpperCase()} in this channel`
          : `🔕 Compliance monitoring disabled for this channel`,
    };
  } catch (error) {
    return {
      text: `❌ Error: ${error.message}`,
    };
  }
}

/**
 * Show help information
 */
async function showHelp(channel) {
  return {
    text: "📚 Compliance Command Center - Help",
    card: {
      title: "Available Commands",
      theme: "modern-inline",
      sections: [
        {
          id: 1,
          title: "Reporting",
          data: [
            { key: "/compliance-summary", value: "Generate audit report" },
            {
              key: "/compliance-health",
              value: "View compliance health score",
            },
            { key: "/compliance-export", value: "Export compliance report" },
          ],
        },
        {
          id: 2,
          title: "Monitoring",
          data: [
            { key: "/compliance-risks", value: "View predicted risks" },
            { key: "/compliance-monitor", value: "Enable/disable monitoring" },
          ],
        },
        {
          id: 3,
          title: "How It Works",
          data: [
            { key: "🤖", value: "I passively monitor your conversations" },
            { key: "🧠", value: "AI extracts compliance-relevant events" },
            { key: "📊", value: "Auto-generate audit-ready reports" },
            { key: "⚠️", value: "Predict and prevent compliance risks" },
          ],
        },
      ],
    },
  };
}

/**
 * Send risk alert to stakeholders
 */
async function sendRiskAlert(event, channel) {
  const alertMessage = {
    text: `🚨 High-Risk Compliance Event Detected`,
    card: {
      title: "⚠️ Immediate Attention Required",
      theme: "modern-inline",
      sections: [
        {
          id: 1,
          data: [
            { key: "Event Type", value: event.event_type },
            { key: "Regulation", value: event.regulation },
            { key: "Channel", value: event.channel_name },
            { key: "Reported By", value: event.user_name },
            { key: "Risk Level", value: "🔴 HIGH" },
          ],
        },
      ],
      buttons: [
        {
          label: "View Message",
          type: "open.url",
          url: event.evidence_url,
        },
      ],
    },
  };

  // Send to compliance team channel (configured in settings)
  await axios.post(`${CATALYST_BASE_URL}/functions/send-alert`, {
    alert: alertMessage,
    channel_id: config.complianceTeamChannelId,
  });
}

/**
 * Check if channel has compliance monitoring enabled
 */
async function isChannelMonitored(channelId) {
  try {
    const response = await axios.get(
      `${CATALYST_BASE_URL}/functions/check-monitoring`,
      {
        params: { channel_id: channelId },
      }
    );
    return response.data.monitored;
  } catch (error) {
    console.error("Error checking monitoring status:", error);
    return false;
  }
}

/**
 * Get Zoho OAuth token
 */
async function getZohoAuthToken() {
  // Implementation depends on your OAuth setup
  // This is a placeholder
  return process.env.ZOHO_AUTH_TOKEN || config.zohoAuthToken;
}

/**
 * Get emoji for risk severity
 */
function getRiskEmoji(severity) {
  const emojiMap = {
    Critical: "🔴",
    High: "🟠",
    Medium: "🟡",
    Low: "🟢",
  };
  return emojiMap[severity] || "⚪";
}

/**
 * Handle bot mentions
 */
async function handleMention(message, channel, user) {
  // Simple AI-powered help
  const query = message.text.replace(/@ComplianceBot/g, "").trim();

  if (!query) {
    return await showHelp(channel);
  }

  // Use Zia to understand user intent
  try {
    const ziaResponse = await axios.post(
      `${ZIA_API_URL}/skills/intent`,
      {
        text: query,
        model_id: config.ziaIntentModelId,
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${await getZohoAuthToken()}`,
        },
      }
    );

    const intent = ziaResponse.data.intent;

    // Route to appropriate handler based on intent
    switch (intent) {
      case "get_summary":
        return await generateComplianceSummary([], channel);
      case "check_health":
        return await getComplianceHealth([], channel);
      case "view_risks":
        return await getPredictedRisks([], channel);
      default:
        return {
          text: `I can help you with compliance tracking! Try:\n• /compliance-summary - Get audit reports\n• /compliance-health - Check compliance status\n• /compliance-risks - View predicted risks`,
        };
    }
  } catch (error) {
    return await showHelp(channel);
  }
}

module.exports = {
  handleMessage,
  handleCommand,
  processComplianceEvent,
};
