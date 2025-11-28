# Compliance Command Center - Setup Guide

## Prerequisites

Before deploying Compliance Command Center, ensure you have:

1. **Zoho Accounts & Services**
   - Zoho Cliq organization account
   - Zoho Creator account
   - Zoho Catalyst account
   - Zoho Projects account (optional, for enhanced dependency tracking)
   - Zoho Writer account (for report generation)

2. **Development Tools**
   - Node.js 14+ (for local testing)
   - Zoho CLI (`npm install -g zoho-extension-toolkit`)
   - Git (for version control)

3. **API Access**
   - Zoho OAuth credentials
   - Zia Skills API access
   - Catalyst project ID

## Installation Steps

### 1. Deploy Zoho Catalyst Backend

```bash
# Navigate to Catalyst directory
cd catalyst/

# Initialize Catalyst project
catalyst init

# Configure project
catalyst config

# Deploy DataStore tables
catalyst datastore create --config datastore/schema.json

# Deploy serverless functions
catalyst functions deploy

# Deploy cron jobs
catalyst cron deploy
```

**DataStore Tables to Create:**

- `compliance_events` - Stores all compliance events
- `risk_predictions` - AI-generated risk predictions
- `compliance_analytics` - Daily analytics aggregation
- `audit_logs` - Immutable audit trail
- `ml_training_data` - Historical data for ML

### 2. Configure Zia Skills Models

```bash
# Upload Zia Skills configuration
zia-cli upload-model --file zia-skills/compliance-extractor.json
zia-cli upload-model --file zia-skills/risk-predictor.json

# Train models (requires training data)
zia-cli train-model --model-id compliance_extractor_v1
zia-cli train-model --model-id risk_predictor_v1
```

**Note:** Zia models require historical conversation data for training. Initial deployment uses rule-based extraction until sufficient training data is available.

### 3. Set Up Zoho Creator App

1. Create new Creator app: "Compliance Tracker"
2. Import forms:
   - `ComplianceLogs` - Main compliance events table
   - `Project_Settings` - Project monitoring configuration
   - `Channel_Settings` - Channel monitoring settings
   - `Required_Documentation` - Documentation templates

3. Configure Connections:
   - `compliance_connection` - OAuth connection to Creator
   - `zia_connection` - Zia Skills API connection
   - `catalyst_connection` - Catalyst functions connection
   - `cliq_connection` - Cliq API connection
   - `projects_connection` - Zoho Projects API connection

### 4. Deploy Deluge Scripts

```bash
# Upload Deluge scripts to Creator
# These run as workflows triggered by webhooks

# 1. Event Aggregator (Webhook trigger)
creator-cli upload-script --app compliance_tracker --script deluge-scripts/event-aggregator.deluge

# 2. Report Generator (Scheduled - Weekly)
creator-cli upload-script --app compliance_tracker --script deluge-scripts/report-generator.deluge --schedule "0 9 * * 1"

# 3. Dependency Mapper (Scheduled - Daily)
creator-cli upload-script --app compliance_tracker --script deluge-scripts/dependency-mapper.deluge --schedule "0 8 * * *"
```

### 5. Install Zoho Cliq Bot

```bash
# Navigate to Cliq bot directory
cd cliq-bot/

# Build extension package
zip -r compliance-bot.zip *

# Upload to Cliq Marketplace (or install privately)
# Go to Zoho Cliq > Bots & Tools > Add Bot > Upload Extension
```

**Configuration Required:**

- Set `CATALYST_BASE_URL` in bot configuration
- Set `ZIA_API_URL` for Zia Skills integration
- Configure OAuth connections

**Bot Permissions:**

- Read messages in channels
- Post messages
- Create webhooks
- Access user information
- Upload/download files

### 6. Deploy Dashboard Widget

```bash
# Build widget files
cd widget/

# If using build tools
npm install
npm run build

# Deploy to Catalyst static hosting
catalyst hosting deploy

# Get widget URL
catalyst hosting list
```

**Add Widget to Cliq:**

1. Go to Cliq > Channel Settings
2. Add Custom Widget
3. Enter widget URL from Catalyst hosting
4. Set refresh interval to 30 seconds

### 7. Configure Environment Variables

Create `.env` file in Catalyst project:

```env
# Catalyst Configuration
CATALYST_PROJECT_ID=your_project_id
CATALYST_BASE_URL=https://your-app.catalyst.zoho.com

# Zia Configuration
ZIA_API_URL=https://zia.zoho.com/api/v1
ZIA_MODEL_ID=compliance_extractor_v1
ZIA_INTENT_MODEL_ID=compliance_intent_v1

# Creator Configuration
CREATOR_APP_ID=compliance_tracker
CREATOR_OWNER=your_zoho_account

# Cliq Configuration
CLIQ_ORG_ID=your_org_id
COMPLIANCE_TEAM_CHANNEL_ID=your_compliance_channel_id

# External Storage (Optional)
AWS_S3_BUCKET=compliance-audit-logs
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Email Configuration
COMPLIANCE_TEAM_EMAIL=compliance@company.com
NO_REPLY_EMAIL=no-reply@company.com

# Risk Thresholds
RISK_THRESHOLD=7.5
ALERT_DAYS_AHEAD=3

# Report Settings
AUTO_REPORT_SCHEDULE=weekly
```

## Post-Installation Configuration

### 1. Enable Channel Monitoring

In any Cliq channel:

```
/compliance-monitor on GDPR
```

This enables passive compliance monitoring for GDPR-related events in that channel.

### 2. Set Up Projects

Create project records in Creator `Project_Settings` form:

- Project ID (matches Zoho Projects or custom ID)
- Project Name
- Monitored Regulations (GDPR, SOC2, HIPAA, etc.)
- Channel ID (Cliq channel to monitor)
- Stakeholders (comma-separated user IDs)

### 3. Configure Compliance Team Channel

Set the `COMPLIANCE_TEAM_CHANNEL_ID` to receive high-priority alerts:

1. Create a dedicated #compliance-team channel
2. Get the channel ID from Cliq API or URL
3. Update environment variable
4. Add the bot to this channel

### 4. Train Zia Models (Optional but Recommended)

For best accuracy, train Zia models with your organization's data:

1. **Export Historical Conversations**

   ```bash
   # Export 6 months of compliance-related messages
   cliq-cli export-messages --channels compliance,legal,security --period 6m
   ```

2. **Annotate Training Data**
   - Label compliance events (approval, risk, decision, etc.)
   - Tag regulations (GDPR, SOC2, HIPAA)
   - Mark risk levels

3. **Upload to Zia Skills**

   ```bash
   zia-cli upload-training-data --model compliance_extractor_v1 --file training-data.json
   zia-cli retrain-model --model compliance_extractor_v1
   ```

4. **Validate Model**
   ```bash
   zia-cli test-model --model compliance_extractor_v1 --test-set validation.json
   ```

## Verification Steps

### 1. Test Bot Commands

In a Cliq channel:

```
/compliance-help
/compliance-health
/compliance-summary test-project
```

Expected: Bot responds with formatted cards

### 2. Test Passive Monitoring

1. Enable monitoring: `/compliance-monitor on`
2. Send a test message: "John approved the security review for GDPR compliance"
3. Check Creator `ComplianceLogs` for new record
4. Verify Catalyst `compliance_events` table has entry

### 3. Test Dashboard

1. Open dashboard widget in Cliq
2. Verify compliance score displays
3. Check regulation matrix shows configured regulations
4. Confirm charts render correctly

### 4. Test Risk Prediction

```
/compliance-risks 7
```

Expected: Bot shows predicted risks for next 7 days

### 5. Test Report Generation

```
/compliance-export test-project PDF
```

Expected:

- Confirmation message
- DM with report link when ready
- File in Zoho WorkDrive/Writer

## Troubleshooting

### Bot Not Responding

**Check:**

- Bot is installed and active in Cliq org
- Webhooks are configured correctly
- Catalyst functions are deployed
- OAuth connections are valid

**Debug:**

```bash
# View Catalyst function logs
catalyst logs --function message-handler --tail

# Test function directly
catalyst functions test --function message-handler --data test-payload.json
```

### No Events Being Captured

**Check:**

- Channel monitoring is enabled (`/compliance-monitor on`)
- Zia Skills model is deployed
- Deluge webhook is receiving data
- Creator form has correct permissions

**Debug:**

```bash
# Check Deluge execution logs
creator-cli logs --script event-aggregator --last 100

# Test Zia extraction manually
curl -X POST https://zia.zoho.com/api/v1/skills/extract \
  -H "Authorization: Zoho-oauthtoken $TOKEN" \
  -d '{"text": "Approved GDPR data processing", "model_id": "compliance_extractor_v1"}'
```

### Dashboard Not Loading

**Check:**

- Widget URL is correct
- Catalyst hosting is active
- CORS is configured
- Browser console for errors

**Debug:**

```bash
# Check hosting status
catalyst hosting status

# View hosting logs
catalyst hosting logs

# Test API endpoints
curl https://your-app.catalyst.zoho.com/functions/health-score?scope=test
```

### Risk Predictions Incorrect

**Initial Deployment:** Risk predictions use simplified heuristics. Accuracy improves as historical data accumulates.

**To Improve:**

1. Ensure 30+ days of compliance events captured
2. Verify Zoho Projects integration (for dependency data)
3. Retrain ML model weekly via Catalyst cron
4. Adjust risk thresholds in configuration

## Maintenance

### Weekly Tasks

- Review compliance health scores
- Verify audit logs are being exported
- Check for failed cron jobs
- Update Zia model training data

### Monthly Tasks

- Audit external storage (S3/GCS) for completeness
- Review and adjust risk thresholds
- Clean up old test data
- Update documentation templates

### Quarterly Tasks

- Full ML model retraining with 6 months data
- Security audit of OAuth connections
- Performance optimization review
- User feedback incorporation

## Support

For issues or questions:

- **Documentation:** `/docs` in this repository
- **Zoho Community:** https://help.zoho.com/portal/community
- **Catalyst Support:** https://catalyst.zoho.com/help

## Next Steps

After successful deployment:

1. ✅ Invite team to monitored channels
2. ✅ Run initial compliance audit
3. ✅ Set up weekly report distribution
4. ✅ Train team on bot commands
5. ✅ Customize regulation templates for your industry
6. ✅ Integrate with existing compliance workflows
7. ✅ Schedule demo for executive team

---

**Congratulations!** Your Compliance Command Center is now operational. The system will continuously monitor conversations, predict risks, and generate audit-ready documentation automatically.
