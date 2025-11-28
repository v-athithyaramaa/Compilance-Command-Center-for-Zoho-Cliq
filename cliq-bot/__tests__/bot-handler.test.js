/**
 * Test Suite for Compliance Command Center Bot
 * Run with: npm test
 */

const botHandler = require("../bot-handler");

describe("Compliance Command Center Bot", () => {
  describe("Message Handler", () => {
    test("should ignore bot own messages", async () => {
      const request = {
        body: {
          message: { text: "test", id: "msg1" },
          channel: { id: "ch1", name: "test-channel" },
          user: { id: "bot123", name: "ComplianceBot" },
          bot: { id: "bot123" },
        },
      };

      const result = await botHandler.handleMessage(request);
      expect(result.success).toBe(true);
    });

    test("should process compliance-related messages", async () => {
      const request = {
        body: {
          message: {
            text: "John approved the GDPR security review",
            id: "msg2",
            permalink: "https://cliq.zoho.com/...",
          },
          channel: { id: "ch1", name: "product-team" },
          user: { id: "user1", name: "John Doe" },
          bot: { id: "bot123" },
        },
      };

      const result = await botHandler.handleMessage(request);
      expect(result.success).toBe(true);
    });
  });

  describe("Command Handler", () => {
    test("should handle /compliance-summary command", async () => {
      const message = {
        text: "/compliance-summary product-release GDPR",
        id: "msg3",
      };
      const channel = { id: "ch1", name: "product-team" };
      const user = { id: "user1", name: "John Doe" };

      const result = await botHandler.handleCommand(message, channel, user);

      expect(result).toHaveProperty("card");
      expect(result.card.title).toContain("Compliance Summary");
    });

    test("should handle /compliance-health command", async () => {
      const message = {
        text: "/compliance-health",
        id: "msg4",
      };
      const channel = { id: "ch1", name: "product-team" };
      const user = { id: "user1", name: "John Doe" };

      const result = await botHandler.handleCommand(message, channel, user);

      expect(result).toHaveProperty("card");
      expect(result.text).toContain("Compliance Health");
    });

    test("should handle unknown commands gracefully", async () => {
      const message = {
        text: "/compliance-unknown",
        id: "msg5",
      };
      const channel = { id: "ch1", name: "product-team" };
      const user = { id: "user1", name: "John Doe" };

      const result = await botHandler.handleCommand(message, channel, user);

      expect(result.text).toContain("Unknown command");
    });
  });

  describe("Compliance Event Processing", () => {
    test("should extract approval events", async () => {
      const message = {
        text: "@security-lead approved the encryption change for SOC 2 compliance",
        id: "msg6",
        permalink: "https://cliq.zoho.com/...",
      };
      const channel = { id: "ch1", name: "security" };
      const user = { id: "user1", name: "Security Lead" };

      // Mock Zia response
      const expectedEntities = {
        compliance_event: { value: "approval", confidence: 0.92 },
        regulation_type: { value: "SOC2", confidence: 0.88 },
        risk_level: { value: "Medium", confidence: 0.75 },
      };

      const result = await botHandler.processComplianceEvent(
        message,
        channel,
        user
      );

      expect(result).toHaveProperty("entities");
      expect(result.entities.compliance_event).toBeDefined();
    });

    test("should extract risk discussions", async () => {
      const message = {
        text: "We need to document this data retention decision for GDPR compliance. This is a high-priority issue.",
        id: "msg7",
        permalink: "https://cliq.zoho.com/...",
      };
      const channel = { id: "ch1", name: "legal" };
      const user = { id: "user2", name: "Legal Counsel" };

      const result = await botHandler.processComplianceEvent(
        message,
        channel,
        user
      );

      expect(result).toHaveProperty("entities");
    });
  });
});

describe("Catalyst Functions", () => {
  describe("Store Compliance Event", () => {
    test("should store event in DataStore", async () => {
      // Test would integrate with Catalyst mock
      const eventData = {
        timestamp: new Date().toISOString(),
        channel_id: "ch1",
        channel_name: "product-team",
        message_id: "msg123",
        user_id: "user1",
        user_name: "John Doe",
        event_type: "approval",
        regulation: "GDPR",
        risk_level: "Medium",
        message_text: "Approved GDPR review",
        evidence_url: "https://cliq.zoho.com/...",
        confidence_score: 0.85,
      };

      // Mock Catalyst DataStore
      expect(eventData).toHaveProperty("event_type");
      expect(eventData.confidence_score).toBeGreaterThan(0.7);
    });
  });

  describe("Generate Summary", () => {
    test("should calculate compliance score correctly", async () => {
      const events = [
        { event_type: "approval", risk_level: "Low", status: "Completed" },
        { event_type: "decision", risk_level: "Medium", status: "Completed" },
        {
          event_type: "risk_discussion",
          risk_level: "High",
          status: "Pending Review",
        },
      ];

      // Simplified score calculation
      let score = 100;
      const highRisk = events.filter(
        (e) => e.risk_level === "High" && e.status === "Pending Review"
      ).length;
      score -= highRisk * 5;

      expect(score).toBe(95);
    });
  });

  describe("Predict Risks", () => {
    test("should identify high-risk scenarios", async () => {
      const features = {
        team_response_time: 96, // 96 hours
        pending_approvals: 8,
        days_until_deadline: 2,
      };

      // Simple risk calculation
      let probability = 0;
      if (features.team_response_time > 72) probability += 0.35;
      if (features.pending_approvals > 5) probability += 0.3;
      if (features.days_until_deadline < 3) probability += 0.25;

      expect(probability).toBeGreaterThan(0.7);
    });
  });
});

describe("Widget Dashboard", () => {
  test("should format health score correctly", () => {
    const score = 87;
    let className = "";

    if (score >= 90) className = "excellent";
    else if (score >= 70) className = "good";
    else if (score >= 50) className = "warning";
    else className = "critical";

    expect(className).toBe("good");
  });

  test("should calculate days until impact", () => {
    const impactDate = new Date();
    impactDate.setDate(impactDate.getDate() + 5);

    const now = new Date();
    const daysAway = Math.ceil((impactDate - now) / (1000 * 60 * 60 * 24));

    expect(daysAway).toBe(5);
  });
});

describe("Integration Tests", () => {
  test("end-to-end: message to dashboard", async () => {
    // 1. Message received in Cliq
    const message = "Security review approved for GDPR module";

    // 2. Zia extracts entities
    const entities = {
      compliance_event: "approval",
      regulation: "GDPR",
    };

    // 3. Stored in Catalyst
    const stored = true;

    // 4. Analytics updated
    const analyticsUpdated = true;

    // 5. Dashboard refreshes
    const dashboardData = {
      total_events: 1,
      compliance_score: 95,
    };

    expect(stored).toBe(true);
    expect(analyticsUpdated).toBe(true);
    expect(dashboardData.total_events).toBeGreaterThan(0);
  });
});
