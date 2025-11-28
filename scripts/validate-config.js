#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(colors[color] + message + colors.reset);
}

function validateConfig() {
  console.log("\n" + "═".repeat(60));
  log("  Configuration Validation", "cyan");
  console.log("═".repeat(60) + "\n");

  let valid = true;
  const errors = [];
  const warnings = [];

  // Check .env file
  const envPath = path.join(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    errors.push('.env file not found. Run "npm run setup" first.');
    valid = false;
  } else {
    log("✓ .env file found", "green");

    const envContent = fs.readFileSync(envPath, "utf8");
    const requiredVars = [
      "ZOHO_DATA_CENTER",
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET",
      "ZOHO_ORGANIZATION_ID",
      "CLIQ_BOT_ID",
      "CATALYST_PROJECT_ID",
    ];

    requiredVars.forEach((varName) => {
      const regex = new RegExp(`^${varName}=(.+)$`, "m");
      const match = envContent.match(regex);
      if (!match || !match[1] || match[1].trim() === "") {
        errors.push(`${varName} is not set in .env`);
        valid = false;
      } else {
        log(`  ✓ ${varName} is configured`, "green");
      }
    });
  }

  // Check config.json
  const configPath = path.join(__dirname, "../config.json");
  if (!fs.existsSync(configPath)) {
    warnings.push("config.json not found (optional)");
  } else {
    log("✓ config.json found", "green");
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      log(`  ✓ Data center: ${config.dataCenter}`, "green");
      log(`  ✓ Organization ID: ${config.organizationId}`, "green");
      log(`  ✓ Bot ID: ${config.bot.id}`, "green");
    } catch (err) {
      errors.push("config.json is invalid JSON: " + err.message);
      valid = false;
    }
  }

  // Check bot files
  const botFiles = ["plugin.json", "bot-handler.js", "config.js"];
  botFiles.forEach((file) => {
    const filePath = path.join(__dirname, "../cliq-bot", file);
    if (fs.existsSync(filePath)) {
      log(`✓ Bot file: ${file}`, "green");
    } else {
      errors.push(`Missing bot file: ${file}`);
      valid = false;
    }
  });

  // Check Catalyst files
  const catalystConfig = path.join(
    __dirname,
    "../catalyst/catalyst-config.json"
  );
  if (fs.existsSync(catalystConfig)) {
    log("✓ Catalyst configuration found", "green");
  } else {
    warnings.push("Catalyst configuration not found");
  }

  // Check Zia skills
  const ziaSkills = ["compliance-extractor.json", "risk-predictor.json"];
  ziaSkills.forEach((skill) => {
    const skillPath = path.join(__dirname, "../zia-skills", skill);
    if (fs.existsSync(skillPath)) {
      log(`✓ Zia skill: ${skill}`, "green");
    } else {
      warnings.push(`Zia skill not found: ${skill}`);
    }
  });

  // Print summary
  console.log("\n" + "─".repeat(60));

  if (errors.length > 0) {
    log("\n❌ ERRORS:", "red");
    errors.forEach((err) => log("  • " + err, "red"));
  }

  if (warnings.length > 0) {
    log("\n⚠️  WARNINGS:", "yellow");
    warnings.forEach((warn) => log("  • " + warn, "yellow"));
  }

  if (valid && errors.length === 0) {
    log("\n✅ Configuration is valid!\n", "green");
    log("Next steps:", "cyan");
    log("  1. Deploy Catalyst: npm run deploy:catalyst");
    log("  2. Upload bot to Cliq manually");
    log("  3. Configure Zia Skills");
    log("  4. Test with: /compliance-help\n");
  } else {
    log("\n❌ Configuration has errors. Fix them and try again.\n", "red");
    log('Run "npm run setup" to reconfigure.\n', "yellow");
  }

  console.log("═".repeat(60) + "\n");

  return valid;
}

const isValid = validateConfig();
process.exit(isValid ? 0 : 1);
