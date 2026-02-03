# Environment Setup Guide

This guide explains how to set up your development and production environments seamlessly.

## 📁 Environment Files

We now have separate environment files:
- `.env` - Your current/active environment (never commit this)
- `.env.development` - Development environment template
- `.env.production` - Production environment template
- `.env.example` - Example file for team members

## 🚀 Quick Start

### For Local Development:
```bash
# Switch to development environment
./env-manager.sh dev

# Start development server
npm run dev
```

### For Production Deployment:
```bash
# Switch to production environment
./env-manager.sh prod

# Start production server
npm start
```

## 🔧 What You Need to Update

### 1. Neon Database Setup

#### Development Branch (Neon):
1. Go to your Neon dashboard
2. Create a new branch called `development`
3. Copy the connection string
4. Update `.env.development` with your development database URL:
   ```
   DATABASE_URL=postgresql://your_dev_user:password@your-dev-endpoint.neon.tech/your_dev_db?sslmode=require
   ```

#### Production Branch (Neon):
1. Use your main branch as production
2. Copy the production connection string
3. Update `.env.production` with your production database URL:
   ```
   DATABASE_URL=postgresql://your_prod_user:password@your-prod-endpoint.neon.tech/your_prod_db?sslmode=require
   ```

### 2. Render Backend Setup

1. Go to your Render dashboard
2. Select your backend service
3. Go to Environment tab
4. Set these environment variables:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://your_prod_user:password@your-prod-endpoint.neon.tech/your_prod_db?sslmode=require
JWT_SECRET=your-very-strong-production-secret-key
FRONTEND_URL=https://your-frontend-app.onrender.com
API_BASE_URL=https://cmrp-opps-backend.onrender.com
APP_NAME=CMRP Opps Management
VERSION=1.0.0
```

**Important:** Replace the placeholder values with your actual:
- Database connection strings
- Frontend URL
- Strong JWT secret for production

### 3. Render Frontend Setup (if separate)

If you have a separate frontend service on Render:

1. Go to your frontend service
2. Set environment variables:
```bash
NODE_ENV=production
REACT_APP_API_URL=https://cmrp-opps-backend.onrender.com
```

## 🛠 Environment Management Commands

```bash
# Check current environment status
./env-manager.sh status

# Switch to development
./env-manager.sh dev

# Switch to production
./env-manager.sh prod

# Backup current environment
./env-manager.sh backup

# Restore from backup
./env-manager.sh restore

# Show help
./env-manager.sh help
```

## 🔒 Security Best Practices

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use strong, unique JWT secrets** for production
3. **Restrict CORS origins** in production
4. **Use environment variables** for all sensitive data
5. **Separate dev and prod databases** for safety

## 🌍 How It Works

### Development:
- Uses `localhost:3000` for API calls
- Connects to Neon development branch
- Allows all CORS origins for testing
- Uses development JWT secret

### Production:
- Uses your Render backend URL for API calls
- Connects to Neon production branch
- Restricts CORS to your frontend domains
- Uses strong production JWT secret

## 🚨 What to Update Right Now

1. **Update Neon database URLs** in `.env.development` and `.env.production`
2. **Set Render environment variables** as shown above
3. **Generate a strong JWT secret** for production
4. **Update frontend URLs** to match your actual Render domains

## 📝 Deployment Checklist

- [ ] Created Neon development branch
- [ ] Updated `.env.development` with dev database URL
- [ ] Updated `.env.production` with prod database URL
- [ ] Set all environment variables in Render backend
- [ ] Generated strong JWT secret for production
- [ ] Updated frontend URLs to match your domains
- [ ] Tested environment switching with `./env-manager.sh`
- [ ] Verified CORS settings work in production

## 🔄 Deployment Workflow

1. **Development:**
   ```bash
   ./env-manager.sh dev
   npm run dev
   ```

2. **Test Production Locally:**
   ```bash
   ./env-manager.sh prod
   npm start
   ```

3. **Deploy to Render:**
   - Push to GitHub
   - Render automatically deploys
   - Environment variables are set from Render dashboard

No more manual URL changes! 🎉

## 📝 Extra Notes & Tips

- **Switching Environments:**
  - Use `./env-manager.sh dev` for development and `./env-manager.sh prod` for production. This will copy the correct environment file to `.env`.
  - Always check your current environment with `./env-manager.sh status` before running or deploying.

- **Testing Production Locally:**
  - You can test your production setup locally by switching to prod and running `npm start`. This helps catch issues before deploying to Render.

- **Validation:**
  - Run `node validate-env.js` after switching environments to ensure all required variables are set.

- **.env File Safety:**
  - Never commit `.env`, `.env.development`, or `.env.production` to git. They are already in `.gitignore` for your safety.

- **Render PORT Variable:**
  - In production, Render sets the `PORT` variable automatically. You do not need to set it manually in `.env.production`.

- **Frontend/Backend URLs:**
  - Make sure your `FRONTEND_URL` and `API_BASE_URL` match your actual deployed domains for CORS and API calls to work correctly.

- **Database Branches:**
  - Always use separate Neon branches for development and production to avoid accidental data loss or corruption.

- **Security:**
  - Use a strong, unique `JWT_SECRET` in production. Never use your development secret in production.

- **Deployment:**
  - For production, just push to GitHub. Render will use the environment variables you set in its dashboard.

- **Troubleshooting:**
  - If you see environment errors, double-check your `.env` file and use the validation script for hints.

- **Team Collaboration:**
  - Share `.env.example` with your team so everyone knows what variables are needed, but never share real secrets.

---

By following these notes and the main guide above, you ensure a safe, robust, and seamless workflow from development to production!
