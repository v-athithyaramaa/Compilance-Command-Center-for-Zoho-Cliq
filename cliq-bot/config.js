# Compliance Command Center - Bot Configuration
module.exports = {
    // Catalyst Configuration
    catalystBaseUrl: process.env.CATALYST_BASE_URL || 'https://your-app.catalyst.zoho.com',
    catalystProjectId: process.env.CATALYST_PROJECT_ID || '',
    
    // Zia Configuration
    ziaApiUrl: process.env.ZIA_API_URL || 'https://zia.zoho.com/api/v1',
    ziaModelId: process.env.ZIA_MODEL_ID || 'compliance_extractor_v1',
    ziaIntentModelId: process.env.ZIA_INTENT_MODEL_ID || 'compliance_intent_v1',
    
    // Creator Configuration
    creatorAppId: process.env.CREATOR_APP_ID || 'compliance_tracker',
    
    // Cliq Configuration
    complianceTeamChannelId: process.env.COMPLIANCE_TEAM_CHANNEL_ID || '',
    
    // OAuth Token (managed by Zoho automatically in production)
    zohoAuthToken: process.env.ZOHO_AUTH_TOKEN || '',
    
    // Risk Settings
    riskThreshold: parseFloat(process.env.RISK_THRESHOLD) || 7.5,
    alertDaysAhead: parseInt(process.env.ALERT_DAYS_AHEAD) || 3,
    
    // Feature Flags
    features: {
        passiveMonitoring: true,
        riskPrediction: true,
        autoReporting: true,
        aiExtraction: process.env.ZIA_API_URL !== 'disabled'
    }
};
