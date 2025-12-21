# Fashion Fit - Hosting Guide

## Overview

This guide covers hosting options for both the **backend API** (Node.js/Express) and **frontend mobile app** (React Native/Expo).

---

## 🎯 Frontend (Mobile App)

### What is it?
Your frontend is a **React Native/Expo mobile app** - it runs on users' devices, not on a server.

### Distribution Options:

#### **1. Expo Application Services (EAS) - RECOMMENDED** ⭐
- **Best for**: Production apps, easy deployment
- **Cost**: Free tier available, then $29/month+
- **Features**:
  - Build iOS and Android apps in the cloud
  - Submit directly to App Store and Google Play
  - Over-the-air (OTA) updates
  - App signing and certificates managed automatically

**Setup:**
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
eas build --platform android
eas submit --platform ios  # Submit to App Store
eas submit --platform android  # Submit to Play Store
```

#### **2. Local Builds**
- Build APK/IPA files locally
- Manually submit to app stores
- More control, but more complex

**Setup:**
```bash
# iOS (requires Mac)
expo build:ios

# Android
expo build:android
```

### App Store Distribution:
- **iOS**: Apple App Store (requires Apple Developer account - $99/year)
- **Android**: Google Play Store (requires Google Play Developer account - $25 one-time)

---

## 🚀 Backend (Node.js/Express API)

### Current Setup:
- ✅ **MongoDB Atlas** - Already configured (cloud database)
- ✅ **Cloudinary** - Already configured (image storage)
- ❌ **Express Server** - Needs hosting

### Recommended Hosting Options:

#### **1. Railway - RECOMMENDED FOR STARTUPS** ⭐⭐⭐
- **Best for**: Startups, easy setup, good free tier
- **Cost**: Free tier (500 hours/month), then $5/month+
- **Pros**:
  - Deploy from GitHub in minutes
  - Automatic HTTPS
  - Environment variables management
  - Database included (PostgreSQL) - but you're using MongoDB Atlas
  - Great developer experience
- **Cons**: Can be more expensive at scale

**Setup:**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `api` folder
5. Add environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `OPENAI_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `RESEND_API_KEY`
   - `STRIPE_SECRET_KEY` (if using)
6. Railway auto-detects Node.js and deploys!

**Deploy Command:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

---

#### **2. Render - GREAT FREE TIER** ⭐⭐
- **Best for**: Free tier users, simple deployments
- **Cost**: Free tier (spins down after 15min inactivity), then $7/month+
- **Pros**:
  - Generous free tier
  - Auto-deploy from GitHub
  - Automatic HTTPS
  - Easy environment variables
- **Cons**: 
  - Free tier has cold starts (15min spin-down)
  - Slower on free tier

**Setup:**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repo
5. Settings:
   - **Root Directory**: `api`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
6. Add environment variables
7. Deploy!

---

#### **3. Vercel - SERVERLESS** ⭐⭐
- **Best for**: Serverless functions, edge computing
- **Cost**: Free tier, then $20/month+
- **Pros**:
  - Excellent free tier
  - Global CDN
  - Auto-scaling
  - Great for API routes
- **Cons**: 
  - Need to restructure for serverless (functions)
  - 10-second timeout on free tier (can upgrade)

**Setup:**
1. Install Vercel CLI: `npm i -g vercel`
2. In `api` folder: `vercel`
3. Follow prompts
4. Add environment variables in dashboard

**Note**: You'll need to convert Express routes to serverless functions or use Vercel's Express adapter.

---

#### **4. Heroku - CLASSIC CHOICE**
- **Best for**: Traditional hosting, familiar platform
- **Cost**: No free tier anymore, starts at $7/month
- **Pros**:
  - Well-established
  - Add-ons marketplace
  - Easy deployment
- **Cons**: 
  - More expensive
  - No free tier

**Setup:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create fashion-fit-api

# Add environment variables
heroku config:set MONGODB_URI=...
heroku config:set JWT_SECRET=...

# Deploy
git push heroku main
```

---

#### **5. DigitalOcean App Platform**
- **Best for**: Production apps, predictable pricing
- **Cost**: $5/month+
- **Pros**:
  - Predictable pricing
  - Good performance
  - Auto-scaling
- **Cons**: More expensive than alternatives

---

#### **6. AWS (EC2/Lambda) - ENTERPRISE**
- **Best for**: Large scale, enterprise
- **Cost**: Pay-as-you-go (can be expensive)
- **Pros**:
  - Highly scalable
  - Many services
  - Enterprise-grade
- **Cons**: 
  - Complex setup
  - Can be expensive
  - Steep learning curve

---

## 📋 Recommended Setup for Launch

### **Phase 1: Beta Launch (Free/Cheap)**
```
Frontend: EAS Build (free tier)
Backend: Railway (free tier) or Render (free tier)
Database: MongoDB Atlas (free tier)
Storage: Cloudinary (free tier)
```

### **Phase 2: Growth (Paid)**
```
Frontend: EAS Build ($29/month)
Backend: Railway ($5-20/month) or Render ($7/month)
Database: MongoDB Atlas (M10 - $57/month)
Storage: Cloudinary (Pay-as-you-go)
```

### **Phase 3: Scale (Production)**
```
Frontend: EAS Build ($29/month)
Backend: Railway ($20-50/month) or AWS
Database: MongoDB Atlas (M30+ - $200+/month)
Storage: Cloudinary (Pay-as-you-go)
CDN: Cloudflare (optional)
```

---

## 🔧 Environment Variables Needed

Create a `.env` file on your hosting platform with:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fashion-fit

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# OpenAI
OPENAI_API_KEY=sk-...

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (Resend)
RESEND_API_KEY=re_...

# Stripe (optional, for payments)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin
ADMIN_SECRET=fashion-fit-admin-2025

# Server
PORT=3000
NODE_ENV=production
```

---

## 🚀 Quick Start: Deploy to Railway (Recommended)

### Step 1: Prepare Your Code
```bash
cd api
# Make sure server.js is in the root of api folder
# Make sure package.json has "start": "node server.js"
```

### Step 2: Deploy
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway will detect it's Node.js
7. Set root directory to `api` (if needed)
8. Add environment variables
9. Deploy!

### Step 3: Update Frontend API URL
In your mobile app, update the API base URL:

```typescript
// src/services/apiClient.ts
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'  // Development
  : 'https://your-app.railway.app';  // Production
```

---

## 📱 Frontend API Configuration

Update your frontend to point to your hosted backend:

### Option 1: Environment Variable (Recommended)
```typescript
// src/services/apiClient.ts
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
```

Then in `app.json` or `.env`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-backend.railway.app"
    }
  }
}
```

### Option 2: Build-time Configuration
```typescript
// src/config/api.ts
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-backend.railway.app';
```

---

## 🔒 Security Checklist

Before launching:
- [ ] Change all default secrets (JWT_SECRET, ADMIN_SECRET)
- [ ] Use HTTPS for all API calls
- [ ] Enable CORS only for your app domain
- [ ] Set up rate limiting
- [ ] Enable MongoDB Atlas IP whitelist
- [ ] Use environment variables (never commit secrets)
- [ ] Enable Cloudinary signed URLs (optional)
- [ ] Set up monitoring (Sentry, LogRocket, etc.)

---

## 📊 Monitoring & Analytics

### Recommended Tools:
1. **Sentry** - Error tracking (free tier)
2. **LogRocket** - Session replay (paid)
3. **Railway Metrics** - Built-in monitoring
4. **MongoDB Atlas Monitoring** - Database metrics
5. **Cloudinary Analytics** - Image usage

---

## 💰 Cost Estimate (Monthly)

### Minimal Setup (Beta):
- Railway/Render: $0-7
- MongoDB Atlas: $0 (free tier)
- Cloudinary: $0-10 (free tier)
- OpenAI: Pay-as-you-go (~$10-50)
- **Total: ~$10-70/month**

### Production Setup:
- Railway: $20
- MongoDB Atlas: $57 (M10)
- Cloudinary: $50-100
- OpenAI: $100-500
- EAS Build: $29
- **Total: ~$250-700/month**

---

## 🎯 My Recommendation

**For Launch:**
1. **Backend**: Railway (free tier, easy setup)
2. **Frontend**: EAS Build (free tier)
3. **Database**: MongoDB Atlas (free tier)
4. **Storage**: Cloudinary (free tier)

**Why Railway?**
- ✅ Easiest setup (5 minutes)
- ✅ Free tier for testing
- ✅ Auto-deploy from GitHub
- ✅ Great developer experience
- ✅ Scales easily

**Next Steps:**
1. Deploy backend to Railway
2. Update frontend API URL
3. Test thoroughly
4. Build app with EAS
5. Submit to app stores!

---

## 📚 Additional Resources

- [Railway Docs](https://docs.railway.app)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Render Docs](https://render.com/docs)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/getting-started/)

---

**Last Updated**: December 2025  
**Status**: ✅ Ready for Deployment

