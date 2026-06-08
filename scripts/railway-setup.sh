#!/bin/bash

# ==================================================
# Quick Deploy to Railway - E-Commerce API
# ==================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     🚂 Railway Deployment Setup Script              ║"
echo "║     E-Commerce API - Quick Start                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar que estamos en el proyecto correcto
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  Error: package.json not found. Run this from project root.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project directory verified${NC}"

# Verificar archivos de Railway
echo ""
echo "Checking Railway configuration files..."

files=(
    "railway.json"
    "nixpacks.toml"
    ".env.railway.example"
    "docs/RAILWAY_DEPLOYMENT.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file exists${NC}"
    else
        echo -e "${YELLOW}✗ $file missing${NC}"
    fi
done

# Verificar Git
echo ""
echo "Checking Git status..."

if [ -d ".git" ]; then
    echo -e "${GREEN}✓ Git repository initialized${NC}"
    
    # Verificar si hay cambios sin commit
    if [[ -n $(git status -s) ]]; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
        echo ""
        read -p "Do you want to commit changes now? (y/n): " commit_now
        
        if [ "$commit_now" = "y" ]; then
            git add .
            echo ""
            read -p "Enter commit message: " commit_msg
            git commit -m "$commit_msg"
            echo -e "${GREEN}✓ Changes committed${NC}"
        fi
    else
        echo -e "${GREEN}✓ No uncommitted changes${NC}"
    fi
    
    # Verificar remote
    if git remote get-url origin > /dev/null 2>&1; then
        remote_url=$(git remote get-url origin)
        echo -e "${GREEN}✓ Git remote configured: $remote_url${NC}"
    else
        echo -e "${YELLOW}⚠️  No Git remote configured${NC}"
        echo ""
        echo "To add GitHub remote:"
        echo "  git remote add origin https://github.com/your-username/ecommerce-api.git"
        echo "  git push -u origin main"
    fi
else
    echo -e "${YELLOW}⚠️  Git not initialized${NC}"
    echo ""
    read -p "Initialize Git repository? (y/n): " init_git
    
    if [ "$init_git" = "y" ]; then
        git init
        git add .
        git commit -m "feat: initial commit - ready for Railway deployment"
        echo -e "${GREEN}✓ Git initialized${NC}"
    fi
fi

# Generar JWT secrets
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📝 IMPORTANT: Copy these JWT secrets for Railway:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}JWT_SECRET:${NC}"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
echo ""
echo -e "${YELLOW}JWT_REFRESH_SECRET:${NC}"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Next steps
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo ""
echo "1. Push to GitHub (if not done):"
echo "   git push -u origin main"
echo ""
echo "2. Go to Railway:"
echo "   https://railway.app/new"
echo ""
echo "3. Click 'Deploy from GitHub repo'"
echo ""
echo "4. Select your repository"
echo ""
echo "5. Add PostgreSQL database:"
echo "   Click '+ New' → Database → PostgreSQL"
echo ""
echo "6. Add Redis:"
echo "   Click '+ New' → Database → Redis"
echo ""
echo "7. Configure environment variables:"
echo "   - Copy the JWT secrets above"
echo "   - Add Stripe test keys"
echo "   - See .env.railway.example for full list"
echo ""
echo "8. View deployment guide:"
echo "   docs/RAILWAY_DEPLOYMENT.md"
echo ""
echo -e "${GREEN}✅ Setup script completed!${NC}"
echo ""

# Ofrecer abrir documentación
read -p "Open Railway deployment guide? (y/n): " open_docs

if [ "$open_docs" = "y" ]; then
    if command -v open > /dev/null; then
        open docs/RAILWAY_DEPLOYMENT.md
    elif command -v xdg-open > /dev/null; then
        xdg-open docs/RAILWAY_DEPLOYMENT.md
    else
        echo "Please open docs/RAILWAY_DEPLOYMENT.md manually"
    fi
fi

echo ""
echo -e "${BLUE}Good luck with your deployment! 🚂${NC}"
