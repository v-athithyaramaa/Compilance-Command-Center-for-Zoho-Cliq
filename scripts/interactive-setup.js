#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const https = require("https");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(message, color = "reset") {
  console.log(colors[color] + message + colors.reset);
}

async function main() {
  console.clear();
  log(
    "\n╔════════════════════════════════════════════════════════════════╗",
    "cyan"
  );
  log(
    "║     Compliance Command Center - Interactive Setup Wizard      ║",
    "cyan"
  );
  log(
    "╚════════════════════════════════════════════════════════════════╝\n",
    "cyan"
  );

  log(
    "This wizard will help you configure all Zoho services step-by-step.\n",
    "bright"
  );
  log("Prerequisites:", "yellow");
  log("  ✓ Zoho Developer Account", "green");
  log("  ✓ Zoho Cliq workspace with Admin access", "green");
  log("  ✓ Zoho Catalyst account (free tier is fine)", "green");
  log("  ✓ Zoho Creator account (optional for now)\n", "green");

  const ready =
    (await question(
      colors.bright + "Ready to begin? (yes/no) [yes]: " + colors.reset
    )) || "yes";

  if (ready.toLowerCase() !== "yes" && ready.toLowerCase() !== "y") {
    log('\nSetup cancelled. Run "npm run setup" when ready.\n', "yellow");
    rl.close();
    return;
  }

  const config = {};

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Zoho Data Center
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(64));
  log("\n📍 STEP 1: Identify Your Zoho Data Center\n", "cyan");

  log("Look at your Zoho URL to determine your data center:", "bright");
  log("  • accounts.zoho.com      → us");
  log("  • accounts.zoho.eu       → eu");
  log("  • accounts.zoho.in       → in");
  log("  • accounts.zoho.com.au   → au");
  log("  • accounts.zoho.jp       → jp\n");

  config.dataCenter =
    (await question("Enter your data center (us/eu/in/au/jp) [us]: ")) || "us";

  const dcUrls = {
    us: {
      accounts: "https://accounts.zoho.com",
      api: "https://www.zohoapis.com",
      cliq: "https://cliq.zoho.com",
      catalyst: "https://console.catalyst.zoho.com",
    },
    eu: {
      accounts: "https://accounts.zoho.eu",
      api: "https://www.zohoapis.eu",
      cliq: "https://cliq.zoho.eu",
      catalyst: "https://console.catalyst.zoho.eu",
    },
    in: {
      accounts: "https://accounts.zoho.in",
      api: "https://www.zohoapis.in",
      cliq: "https://cliq.zoho.in",
      catalyst: "https://console.catalyst.zoho.in",
    },
    au: {
      accounts: "https://accounts.zoho.com.au",
      api: "https://www.zohoapis.com.au",
      cliq: "https://cliq.zoho.com.au",
      catalyst: "https://console.catalyst.zoho.com.au",
    },
    jp: {
      accounts: "https://accounts.zoho.jp",
      api: "https://www.zohoapis.jp",
      cliq: "https://cliq.zoho.jp",
      catalyst: "https://console.catalyst.zoho.jp",
    },
  };

  config.urls = dcUrls[config.dataCenter];
  log("\n✓ Using data center: " + config.dataCenter.toUpperCase(), "green");

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Zoho Developer Console (OAuth)
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(64));
  log("\n🔐 STEP 2: Create OAuth Client\n", "cyan");

  log("We need to create an OAuth client for API access:\n", "bright");
  log("1. Open: " + config.urls.accounts + "/developerconsole", "yellow");
  log('2. Click "Add Client ID"', "yellow");
  log('3. Choose "Server-based Applications"', "yellow");
  log("4. Fill in:", "yellow");
  log("   • Client Name: Compliance Command Center");
  log("   • Homepage URL: " + config.urls.cliq);
  log("   • Authorized Redirect URIs: " + config.urls.cliq + "/oauth/callback");
  log('5. Click "Create"', "yellow");
  log("6. Copy the Client ID and Client Secret\n", "yellow");

  await question(
    colors.bright +
      "Press Enter after you've created the OAuth client..." +
      colors.reset
  );

  config.clientId = await question("\nEnter Client ID: ");
  config.clientSecret = await question("Enter Client Secret: ");

  log("\n✓ OAuth credentials saved", "green");

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Zoho Cliq Setup
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(64));
  log("\n🤖 STEP 3: Set Up Cliq Bot\n", "cyan");

  log("Now let's get your Cliq organization details:\n", "bright");
  log("1. Go to: " + config.urls.cliq, "yellow");
  log("2. Click your profile (top right) → Settings", "yellow");
  log("3. Go to Organization tab", "yellow");
  log("4. Copy the Organization ID (format: 123456789)\n", "yellow");

  config.orgId = await question("Enter Organization ID: ");

  log("\n✓ Organization ID: " + config.orgId, "green");

  log("\nNow create the Cliq bot:\n", "bright");
  log(
    "1. Go to: " + config.urls.cliq + "/company/" + config.orgId + "/bots",
    "yellow"
  );
  log('2. Click "Create Bot"', "yellow");
  log('3. Choose "Bot" (not Message Action)', "yellow");
  log("4. Name: ComplianceBot", "yellow");
  log("5. Description: AI-Orchestrated Compliance Engine", "yellow");
  log('6. Click "Save & Proceed"', "yellow");
  log("7. Copy the Bot ID from the URL (last number in the URL)\n", "yellow");

  await question(
    colors.bright + "Press Enter after creating the bot..." + colors.reset
  );

  config.botId = await question("\nEnter Bot ID: ");
  config.botName =
    (await question("Enter Bot Name [ComplianceBot]: ")) || "ComplianceBot";

  log(
    "\n✓ Bot created: " + config.botName + " (ID: " + config.botId + ")",
    "green"
  );

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Zoho Catalyst Setup
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(64));
  log("\n⚡ STEP 4: Set Up Catalyst Project\n", "cyan");

  log("Catalyst is our serverless backend:\n", "bright");
  log("1. Go to: " + config.urls.catalyst, "yellow");
  log('2. Click "Create New Project"', "yellow");
  log("3. Project Name: compliance-command-center", "yellow");
  log("4. Choose any data center (preferably same as above)", "yellow");
  log('5. Click "Create"', "yellow");
  log("6. After creation, go to Project Settings", "yellow");
  log("7. Copy the Project ID and Project Key\n", "yellow");

  await question(
    colors.bright +
      "Press Enter after creating Catalyst project..." +
      colors.reset
  );

  config.catalystProjectId = await question("\nEnter Catalyst Project ID: ");
  config.catalystProjectKey = await question("Enter Catalyst Project Key: ");

  log("\n✓ Catalyst project configured", "green");

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Generate Configuration Files
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(64));
  log("\n📝 STEP 5: Generate Configuration\n", "cyan");

  // Create .env file
  const envContent = `# Zoho Configuration
ZOHO_DATA_CENTER=${config.dataCenter}
ZOHO_CLIENT_ID=${config.clientId}
ZOHO_CLIENT_SECRET=${config.clientSecret}
ZOHO_ORGANIZATION_ID=${config.orgId}

# Cliq Bot Configuration
CLIQ_BOT_ID=${config.botId}
CLIQ_BOT_NAME=${config.botName}
CLIQ_BASE_URL=${config.urls.cliq}
CLIQ_API_URL=${config.urls.api}/cliq/v2

# Catalyst Configuration
CATALYST_PROJECT_ID=${config.catalystProjectId}
CATALYST_PROJECT_KEY=${config.catalystProjectKey}
CATALYST_BASE_URL=${config.urls.catalyst}
CATALYST_API_URL=${config.urls.api}/catalyst/v1

# Zia Configuration
ZIA_API_URL=${config.urls.api}/zia/v1
ZIA_COMPLIANCE_SKILL_ID=compliance_extractor_v1
ZIA_RISK_SKILL_ID=risk_predictor_v1

# OAuth URLs
OAUTH_AUTHORIZE_URL=${config.urls.accounts}/oauth/v2/auth
OAUTH_TOKEN_URL=${config.urls.accounts}/oauth/v2/token
OAUTH_REDIRECT_URI=${config.urls.cliq}/oauth/callback

# Application Settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Feature Flags
ENABLE_AUTO_MONITORING=true
ENABLE_RISK_PREDICTION=true
ENABLE_AUDIT_TRAIL=true
ENABLE_EXTERNAL_STORAGE=false

# External Storage (Optional - for production)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_S3_BUCKET=
# AWS_REGION=us-east-1
`;

  fs.writeFileSync(path.join(__dirname, "../.env"), envContent);
  log("✓ Created .env file", "green");

  // Create config.json for easy access
  const configJson = {
    dataCenter: config.dataCenter,
    organizationId: config.orgId,
    bot: {
      id: config.botId,
      name: config.botName,
    },
    catalyst: {
      projectId: config.catalystProjectId,
      projectKey: config.catalystProjectKey,
    },
    urls: config.urls,
    setupCompleted: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, "../config.json"),
    JSON.stringify(configJson, null, 2)
  );
  log("✓ Created config.json", "green");

  // ═══════════════════════════════════════════════════════════
  // STEP 6: Next Steps
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(64));
  log("\n🎉 Configuration Complete!\n", "green");

  log("Next Steps:", "bright");
  log("\n1. Deploy Catalyst Backend:", "yellow");
  log("   cd catalyst");
  log("   catalyst deploy\n");

  log("2. Upload Cliq Bot Code:", "yellow");
  log(
    "   • Go to: " +
      config.urls.cliq +
      "/company/" +
      config.orgId +
      "/bots/" +
      config.botId
  );
  log('   • Click "Code" tab');
  log("   • Upload files from: cliq-bot/");
  log('   • Click "Save & Deploy"\n');

  log("3. Configure Zia Skills:", "yellow");
  log("   • Go to: " + config.urls.accounts + "/zia/skills");
  log("   • Import: zia-skills/compliance-extractor.json");
  log("   • Import: zia-skills/risk-predictor.json");
  log("   • Train both models with sample data\n");

  log("4. Test the Bot:", "yellow");
  log("   • Open Cliq: " + config.urls.cliq);
  log("   • Find your bot: @" + config.botName);
  log("   • Send: /compliance-help\n");

  log("Configuration files saved:", "cyan");
  log("  • .env (environment variables)");
  log("  • config.json (application config)\n");

  log("═".repeat(64) + "\n", "cyan");

  log("Want to see the deployment guide? Check: docs/setup-guide.md\n", "blue");

  rl.close();
}

main().catch((err) => {
  console.error(
    "\n" + colors.red + "❌ Setup failed: " + err.message + colors.reset
  );
  rl.close();
  process.exit(1);
});
