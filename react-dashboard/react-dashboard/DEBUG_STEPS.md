# Debug Steps for Access Denied Issue

## The Problem
Admin user still gets "Access Denied" on role-management page even after running WORKING_SETUP.sql.

## Step-by-Step Debugging

### 1. Verify Database Setup
Run `DEBUG_QUERIES.sql` in Supabase SQL Editor and check:
- ✅ Do you see 4 users (IDs 1-4)?
- ✅ Does login function return user_id = 1 for admin?
- ✅ Does admin (user_id 1) have Admin role assigned?
- ✅ Does admin have 60 permissions?
- ✅ Does `user_has_permission(1, 'roles.view')` return TRUE?

### 2. Check Browser localStorage
Open browser console (F12) and run:
```javascript
JSON.parse(localStorage.getItem('dashboard_user'))
```

**What should you see:**
```json
{
  "user_id": 1,
  "email": "admin@rajashreefashion.com",
  "full_name": "Rajashree Admin",
  "role": "Admin",
  "is_active": true
}
```

**If you see something DIFFERENT (especially if user_id is a UUID or missing), that's the problem!**

### 3. Clear Everything and Re-login

**Do this in order:**
1. Logout from the dashboard
2. Open DevTools (F12)
3. Go to Application tab → Local Storage
4. Right-click on localhost:3000 → Clear
5. Close browser tab completely
6. Open new tab → http://localhost:3000
7. Login: admin@rajashreefashion.com / Admin@123
8. Immediately check localStorage again (step 2)

### 4. Check Network Tab
After login:
1. Open DevTools → Network tab
2. Find the `/api/auth/login` request
3. Click on it → Response tab
4. Check what the response looks like

**Should show:**
```json
{
  "user": {
    "user_id": 1,
    "email": "admin@rajashreefashion.com",
   "full_name": "Rajashree Admin",
    "role": "Admin",
    "is_active": true
  }
}
```

###5. If Still Failing - Check Console Errors

The screenshot shows GotrueClient errors. This suggests you might have:
- Supabase Auth conflicts (dashboard_users vs users tables)
- Missing environment variables
- Supabase client initialization issues

**Check `.env.local` file has:**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 6. Common Issues & Fixes

**Issue: user_id is UUID instead of integer**
- Root cause: Login API is querying dashboard_users instead of users table
- Fix: The login_internal_user function should query `users` table (already in WORKING_SETUP.sql)

**Issue: user_id is undefined or null**
- Root cause: Login function not being called or failing
- Fix: Check if function exists in database (run DEBUG_QUERIES.sql)

**Issue: Login works but permissions still denied**
- Root cause: user_id doesn't match between localStorage and user_roles table
- Fix: Verify user_id in localStorage matches user_id in database

## What to Share with Me

After running DEBUG_QUERIES.sql, share:
1. The output of query #2 (Login Function Test)
2. The output of query #5 (Permission Function Test)
3. Screenshot of localStorage content
4. Screenshot of /api/auth/login network response

This will help me pinpoint the exact issue!
