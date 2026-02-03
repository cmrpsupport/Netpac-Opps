# CMRP Opps Management - Render Deployment Guide

## 🚀 **DEPLOYMENT READY!** 

Your code is now prepared and pushed to GitHub. Follow these steps to deploy to Render:

---

## **Step 1: Deploy Backend (Node.js Server)**

1. **Go to Render**: Visit [https://render.com](https://render.com) and sign in
2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect to GitHub repository: `https://github.com/rjr-cmrp/CMRP-Opps-Management`
   - Select branch: `main`

3. **Configure Web Service**:
   ```
   Name: cmrp-opps-backend
   Root Directory: (leave empty)
   Environment: Node
   Build Command: npm install
   Start Command: node server.js
   Instance Type: Free (or paid if needed)
   ```

4. **Environment Variables** (CRITICAL - Add these in Render dashboard):
   ```
   DATABASE_URL = postgresql://username:password@your-prod-endpoint.neon.tech/your_database?sslmode=require
   JWT_SECRET = your-secure-random-string-here
   NODE_ENV = production
   FRONTEND_URL = https://your-frontend-url.onrender.com (add after frontend is deployed)
   ```

---

## **Step 2: Deploy Frontend (Static Site)**

1. **Create New Static Site**:
   - Click "New +" → "Static Site"
   - Connect same GitHub repository
   - Select branch: `main`

2. **Configure Static Site**:
   ```
   Name: cmrp-opps-frontend
   Root Directory: (leave empty)
   Build Command: (leave empty)
   Publish Directory: .
   ```

---

## **Step 3: Configuration Complete**

✅ **Already Done**: Your backend URL has been configured!

1. **Backend URL configured**: `https://cmrp-opps-backend.onrender.com`

2. **config.js already updated** with your backend URL:
   ```javascript
   // Your actual backend URL is already configured
   API_BASE_URL: 'https://cmrp-opps-backend.onrender.com'
   ```

3. **After frontend is deployed**: Update FRONTEND_URL environment variable in your backend service with your frontend URL

4. **No need to commit again** - the configuration is already pushed to GitHub!

---

## **Key Features Added for Deployment:**

✅ **CORS Support** - Backend now accepts requests from frontend  
✅ **Environment Port** - Uses Render's PORT environment variable  
✅ **API Configuration** - Dynamic API URLs for dev/production  
✅ **Proper npm scripts** - `npm start` runs the server  

---

## **Testing After Deployment:**

1. Visit your frontend URL
2. Test login functionality
3. Verify data loading from backend
4. Test CRUD operations
5. Check all dashboard pages

---

## **Troubleshooting:**

- **CORS errors**: Check FRONTEND_URL environment variable in backend
- **API not found**: Verify backend URL in config.js
- **Database errors**: Check DATABASE_URL environment variable
- **Authentication issues**: Verify JWT_SECRET is set
- **Module not found**: Ensure Start Command is `node server.js` not `npm start`

---

## **Your Repository:**
🔗 **GitHub**: https://github.com/rjr-cmrp/CMRP-Opps-Management

**Ready to deploy! 🎉**
