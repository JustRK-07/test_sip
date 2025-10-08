#!/bin/bash

# Automated Unused Code Checker
# Run this script monthly or before major releases

echo "🔍 Scanning for unused code and dependencies..."
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Navigate to backend directory
cd "$(dirname "$0")/.." || exit

# Counter for issues found
ISSUES=0

echo "📦 Checking for unused dependencies..."
echo "----------------------------------------"

# Check for unused npm packages (requires depcheck)
if command -v depcheck &> /dev/null; then
    depcheck --json > /tmp/depcheck.json 2>&1
    UNUSED_DEPS=$(jq -r '.dependencies | keys[]' /tmp/depcheck.json 2>/dev/null | wc -l)
    if [ "$UNUSED_DEPS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $UNUSED_DEPS unused dependencies:${NC}"
        jq -r '.dependencies | keys[]' /tmp/depcheck.json 2>/dev/null | sed 's/^/   - /'
        ISSUES=$((ISSUES + UNUSED_DEPS))
    else
        echo -e "${GREEN}✓ No unused dependencies found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  depcheck not installed. Install with: npm install -g depcheck${NC}"
fi

echo ""
echo "📝 Checking for unused imports..."
echo "----------------------------------------"

# Check for AgentAvailabilityTracker usage
AAT_USAGE=$(grep -r "AgentAvailabilityTracker" src/ 2>/dev/null | grep -v "Binary file" | wc -l)
if [ "$AAT_USAGE" -eq 0 ]; then
    if [ -f "src/services/AgentAvailabilityTracker.js" ]; then
        echo -e "${RED}❌ AgentAvailabilityTracker.js exists but is NEVER imported${NC}"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "${GREEN}✓ AgentAvailabilityTracker: $AAT_USAGE references${NC}"
fi

# Check for Bull/Redis usage
BULL_USAGE=$(grep -r "require.*bull" src/ 2>/dev/null | grep -v node_modules | wc -l)
REDIS_USAGE=$(grep -r "getRedisClient" src/ 2>/dev/null | grep -v "redis.js" | wc -l)

if [ "$BULL_USAGE" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  'bull' package installed but never imported${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ "$REDIS_USAGE" -le 1 ]; then
    echo -e "${YELLOW}⚠️  'redis' package barely used (only for shutdown?)${NC}"
    ISSUES=$((ISSUES + 1))
fi

# Check for node-cron usage
CRON_USAGE=$(grep -r "node-cron\|require.*cron" src/ 2>/dev/null | grep -v node_modules | wc -l)
if [ "$CRON_USAGE" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  'node-cron' package installed but never imported${NC}"
    ISSUES=$((ISSUES + 1))
fi

echo ""
echo "🗂️  Checking for dead files..."
echo "----------------------------------------"

# Check for files never imported
UNUSED_FILES=0

for file in src/services/*.js; do
    filename=$(basename "$file" .js)
    if [ "$filename" != "index" ]; then
        USAGE=$(grep -r "$filename" src/ 2>/dev/null | grep -v "$file" | grep -v "Binary file" | wc -l)
        if [ "$USAGE" -eq 0 ]; then
            echo -e "${RED}❌ $file is never imported${NC}"
            UNUSED_FILES=$((UNUSED_FILES + 1))
            ISSUES=$((ISSUES + 1))
        fi
    fi
done

if [ "$UNUSED_FILES" -eq 0 ]; then
    echo -e "${GREEN}✓ All service files are being used${NC}"
fi

echo ""
echo "📋 Checking for TODO/FIXME comments..."
echo "----------------------------------------"

OLD_TODOS=$(find src/ -type f -name "*.js" -exec grep -l "TODO\|FIXME" {} \; 2>/dev/null | wc -l)
if [ "$OLD_TODOS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $OLD_TODOS files with TODO/FIXME comments${NC}"
    find src/ -type f -name "*.js" -exec grep -Hn "TODO\|FIXME" {} \; 2>/dev/null | head -5
    if [ "$OLD_TODOS" -gt 5 ]; then
        echo "   ... and $((OLD_TODOS - 5)) more"
    fi
else
    echo -e "${GREEN}✓ No TODO/FIXME comments found${NC}"
fi

echo ""
echo "🗄️  Checking uploads directory..."
echo "----------------------------------------"

if [ -d "uploads" ]; then
    FILE_COUNT=$(find uploads/ -type f 2>/dev/null | wc -l)
    if [ "$FILE_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $FILE_COUNT files in uploads/ directory${NC}"
        echo "   Consider adding cleanup cron job"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "${GREEN}✓ uploads/ directory is clean${NC}"
    fi
fi

echo ""
echo "📊 SUMMARY"
echo "================================================"

if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✓ No issues found! Codebase is clean.${NC}"
    exit 0
else
    echo -e "${RED}Found $ISSUES potential issues${NC}"
    echo ""
    echo "📖 See CODE-CLEANUP-GUIDE.md for detailed cleanup instructions"
    echo "⚡ See QUICK-CLEANUP-CHECKLIST.md for quick wins"
    exit 1
fi
