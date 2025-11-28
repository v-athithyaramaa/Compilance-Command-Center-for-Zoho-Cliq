#!/bin/bash

# Compliance Command Center - Setup Script
# This script will guide you through the setup process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Compliance Command Center - Setup Assistant"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (yes/no): " overwrite
    if [ "$overwrite" != "yes" ]; then
        echo "Setup cancelled. Existing .env preserved."
        exit 0
    fi
fi

# Create .env from template
echo -e "${CYAN}📋 Creating .env file from template...${NC}"
cp .env.example .env
echo -e "${GREEN}✓ .env file created${NC}"

echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""
echo -e "${CYAN}Now you need to edit .env and add your credentials.${NC}"
echo ""
echo "Required steps:"
echo ""
echo "1. Get Zoho OAuth credentials:"
echo "   https://accounts.zoho.com/developerconsole"
echo ""
echo "2. Get Organization ID:"
echo "   https://cliq.zoho.com → Settings → Organization"
echo ""
echo "3. Create Cliq Bot:"
echo "   https://cliq.zoho.com/company/YOUR_ORG_ID/bots"
echo ""
echo "4. Create Catalyst Project:"
echo "   https://console.catalyst.zoho.com"
echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""

# Ask if user wants to open the file
read -p "Open .env file for editing now? (yes/no): " open_file

if [ "$open_file" = "yes" ]; then
    # Try different editors
    if command -v code &> /dev/null; then
        code .env
        echo -e "${GREEN}✓ Opened .env in VS Code${NC}"
    elif command -v notepad &> /dev/null; then
        notepad .env &
        echo -e "${GREEN}✓ Opened .env in Notepad${NC}"
    elif command -v nano &> /dev/null; then
        nano .env
    else
        echo -e "${YELLOW}Could not find a text editor. Please open .env manually.${NC}"
    fi
fi

echo ""
echo -e "${CYAN}📖 See SETUP_CHECKLIST.md for detailed instructions!${NC}"
echo ""
echo "After filling in your credentials, run:"
echo -e "${GREEN}  npm run validate${NC}"
echo ""
echo "Then deploy with:"
echo -e "${GREEN}  cd catalyst && catalyst deploy${NC}"
echo ""
