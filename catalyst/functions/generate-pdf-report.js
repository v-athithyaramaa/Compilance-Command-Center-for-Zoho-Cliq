/**
 * Catalyst Function: Generate PDF Report
 * Generates audit-ready PDF report from compliance summary data
 */

const catalyst = require("zcatalyst-sdk-node");
const PDFDocument = require("pdfkit");

module.exports = async (context, basicIO) => {
  try {
    const catalystApp = catalyst.initialize(context);

    const project = basicIO.getArgument("project");
    let summary_data = basicIO.getArgument("summary_data");
    const insights = basicIO.getArgument("insights");
    
    // Parse summary_data if it's a string
    if (typeof summary_data === "string") {
      try {
        summary_data = JSON.parse(summary_data);
      } catch (e) {
        // If parsing fails, treat as null
        summary_data = null;
      }
    }

    if (!summary_data) {
      basicIO.write(JSON.stringify({
        error: "Summary data is required",
      }));
      context.close();
      return;
    }

    // Generate PDF
    const pdfBuffer = await generatePDFDocument(summary_data, insights, project);

    // Store PDF in Catalyst File Storage
    const filestore = catalystApp.filestore();
    
    // Use root folder (folderId 0) - can create named folder later if needed
    const folder = filestore.folderId(0);

    const fileName = "compliance-report-" + (project || "all") + "-" + Date.now() + ".pdf";
    
    // Upload file to Catalyst File Storage
    // File Storage expects base64 encoded content
    const fileObj = await folder.uploadFile({
      code: pdfBuffer.toString("base64"),
      name: fileName,
    });

    // Get file download URL
    // File object structure: { id, name, file_url, ... }
    const fileId = fileObj.id || fileObj.file_id;
    const fileUrl = fileObj.file_url;
    
    // Use file_url if available, otherwise construct download URL
    let downloadUrl;
    if (fileUrl) {
      downloadUrl = fileUrl;
    } else {
      const projectId = catalystApp.getProjectId();
      downloadUrl = "https://catalyst.zoho.com/baas/v1/project/" + projectId + "/file/" + fileId + "/download";
    }

    basicIO.write(JSON.stringify({
      success: true,
      report_url: downloadUrl,
      file_id: fileId,
      file_name: fileName,
      message: "PDF report generated successfully",
    }));
    context.close();
  } catch (error) {
    context.log("Error generating PDF report: " + error.message);
    basicIO.write(JSON.stringify({
      success: false,
      error: error.message,
    }));
    context.close();
  }
};

/**
 * Generate PDF document from summary data
 */
async function generatePDFDocument(summaryData, insights, projectName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Compliance Audit Report", { align: "center" })
        .moveDown();

      doc
        .fontSize(12)
        .font("Helvetica")
        .text(Project: ${projectName || "All Projects"}, { align: "center" })
        .text(Period: ${summaryData.period || "Last 30 days"}, {
          align: "center",
        })
        .text(Generated: ${new Date().toLocaleDateString()}, {
          align: "center",
        })
        .moveDown(2);

      // Executive Summary
      doc.fontSize(16).font("Helvetica-Bold").text("Executive Summary");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");

      doc.text(Total Events: ${summaryData.total_events || 0});
      doc.text(
        Compliance Score: ${summaryData.compliance_score || 0}/100
      );
      doc.text(Pending Actions: ${summaryData.pending_actions?.length || 0});
      doc.moveDown();

      // AI Insights
      if (insights) {
        doc.fontSize(14).font("Helvetica-Bold").text("AI-Generated Insights");
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica");
        doc.text(insights, { align: "justify" });
        doc.moveDown();
      }

      // Events Breakdown
      doc.fontSize(16).font("Helvetica-Bold").text("Events Breakdown");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");

      // By Type
      if (summaryData.events_by_type) {
        doc.fontSize(12).font("Helvetica-Bold").text("By Event Type:");
        doc.fontSize(10).font("Helvetica");
        Object.entries(summaryData.events_by_type).forEach(([type, count]) => {
          doc.text(`  • ${type}: ${count}`);
        });
        doc.moveDown();
      }

      // By Regulation
      if (summaryData.events_by_regulation) {
        doc.fontSize(12).font("Helvetica-Bold").text("By Regulation:");
        doc.fontSize(10).font("Helvetica");
        Object.entries(summaryData.events_by_regulation).forEach(
          ([reg, count]) => {
            doc.text(`  • ${reg}: ${count}`);
          }
        );
        doc.moveDown();
      }

      // By Risk Level
      if (summaryData.events_by_risk) {
        doc.fontSize(12).font("Helvetica-Bold").text("By Risk Level:");
        doc.fontSize(10).font("Helvetica");
        Object.entries(summaryData.events_by_risk).forEach(([risk, count]) => {
          doc.text(`  • ${risk}: ${count}`);
        });
        doc.moveDown();
      }

      // Pending Actions
      if (
        summaryData.pending_actions &&
        summaryData.pending_actions.length > 0
      ) {
        doc.fontSize(16).font("Helvetica-Bold").text("Pending Actions");
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica");
        summaryData.pending_actions.forEach((action, index) => {
          doc.text(${index + 1}. ${action.type} - ${action.description});
          if (action.risk) {
            doc.text(`   Risk Level: ${action.risk}`, { indent: 20 });
          }
          if (action.deadline) {
            doc.text(`   Deadline: ${action.deadline}`, { indent: 20 });
          }
          doc.moveDown(0.3);
        });
      }

      // Timeline
      if (summaryData.timeline && summaryData.timeline.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("Event Timeline");
        doc.moveDown(0.5);
        doc.fontSize(9).font("Helvetica");

        summaryData.timeline.slice(0, 50).forEach((event) => {
          // Limit to 50 events to avoid PDF being too long
          const date = new Date(event.date).toLocaleDateString();
          doc.text(
            ${date} - ${event.type} (${event.regulation}) - ${event.user}
          );
          doc.moveDown(0.2);
        });
      }

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          This report was automatically generated by Compliance Command Center on ${new Date().toLocaleString()},
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}