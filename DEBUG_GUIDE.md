# Debugging Fashion Fit - Outfit Generation

## Quick Debug Steps

### 1. Check Backend Logs (Railway)
1. Go to https://railway.app
2. Open your project → Backend service
3. Click "Deployments" or "Logs" tab
4. Look for errors like:
   - `GET /recommendations error`
   - `AI enhancement failed`
   - `OpenAI API error`

### 2. Check Frontend Logs
**Option A: Metro Bundler (if running locally)**
- Check terminal where `npm start` or `expo start` is running
- Errors appear in red

**Option B: Device Debugging**
- Shake device → "Show Developer Menu"
- Tap "Debug Remote JS"
- Open Chrome DevTools → Console tab
- Look for: `Failed to generate outfits`

**Option C: React Native Debugger**
- Install: `npm install -g react-native-debugger`
- Run: `react-native-debugger`
- Connect device

### 3. Test Backend API Directly

Test if backend is working:
```bash
# Replace YOUR_USER_ID with actual user ID
curl "https://fashion-app-production-6083.up.railway.app/recommendations?userId=YOUR_USER_ID&occasion=casual&timeOfDay=afternoon&limit=3"
```

Or use Postman/Insomnia:
- URL: `https://fashion-app-production-6083.up.railway.app/recommendations`
- Method: GET
- Query params:
  - `userId`: Your user ID
  - `occasion`: casual
  - `timeOfDay`: afternoon
  - `limit`: 3

### 4. Common Issues & Fixes

**Issue: "Could not generate outfits. Try again."**
- Check Railway logs for backend errors
- Verify `OPENAI_API_KEY` is set in Railway
- Check if user has at least 3 items in wardrobe
- Verify backend is deployed and running

**Issue: "Need at least 3 items in wardrobe"**
- User needs to add more clothing items
- Check wardrobe count in database

**Issue: "Failed to generate recommendations"**
- Check Railway logs
- Verify MongoDB connection
- Check OpenAI API key

**Issue: Network error**
- Check if Railway URL is correct
- Verify backend is deployed
- Check internet connection

### 5. Enable Detailed Logging

The code now logs detailed errors:
- Frontend: Check console for `Error details:` object
- Backend: Check Railway logs for `Error stack:` and `Error details:`

### 6. Check Environment Variables (Railway)

Make sure these are set:
- `OPENAI_API_KEY` (required for AI enhancement)
- `MONGODB_URI` (required for database)
- `CLOUDINARY_CLOUD_NAME` (required for images)
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `JWT_SECRET` (required for auth)

### 7. Test Locally

If backend isn't working on Railway, test locally:
```bash
cd api
npm start
```

Then update `apiClient.ts` to use `http://localhost:4000` temporarily.

