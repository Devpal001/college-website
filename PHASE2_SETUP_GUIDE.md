# Phase 2 - Backend Foundation Setup Guide

## ✅ Phase 2 Components Completed

### 1. Database Schema Design
- **File**: `supabase/schema.sql`
- **Components**: 
  - 20+ database tables for comprehensive academic platform
  - Profile management with roles
  - Academic records (students, teachers, courses, subjects)
  - Attendance and marks systems
  - Timetable management
  - Announcements and events
  - Notification system
  - AI news agent infrastructure
  - Audit logging
  - Row Level Security (RLS) policies

### 2. Role-Based Access Control (RBAC)
- **File**: `src/lib/auth.js`
- **Components**:
  - User profile management with roles
  - Role checking functions
  - Student/teacher/admin-specific helpers
  - Authentication utilities

### 3. Environment Configuration
- **Files**: `.env.example`, `.env`
- **Components**:
  - Supabase configuration
  - AI provider settings
  - Application configuration
  - Feature flags
  - Security settings

### 4. API Layer Foundation
- **File**: `server/index.js`
- **Components**:
  - Express.js server
  - Comprehensive API endpoints
  - Profile management endpoints
  - Student/teacher endpoints
  - Academic data endpoints
  - Notification endpoints
  - AI news endpoints
  - Error handling

### 5. Authentication Hooks
- **File**: `src/hooks/useAuth.js`
- **Components**:
  - useAuth hook for React
  - ProtectedRoute component
  - Authentication state management

---

## 🚀 Setup Instructions

### Step 1: Supabase Database Setup

1. **Go to your Supabase Dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project: `knqirwyslekuiplagvvi`

2. **Run the Schema SQL**
   - Go to SQL Editor in Supabase dashboard
   - Copy the contents of `supabase/schema.sql`
   - Paste and execute the SQL script
   - This will create all tables, indexes, triggers, and RLS policies

3. **Get Service Role Key**
   - Go to Settings > API in Supabase dashboard
   - Copy the `service_role` key
   - Add it to your `.env` file:
     ```
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
     ```

### Step 2: Server Dependencies

1. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Update root package.json**
   - Add server startup script to the main `package.json`:
     ```json
     "scripts": {
       "dev": "vite",
       "server": "node server/index.js",
       "dev:all": "concurrently \"npm run dev\" \"npm run server\""
     }
     ```

3. **Install concurrently (for running both servers)**
   ```bash
   npm install --save-dev concurrently
   ```

### Step 3: Update Environment Variables

1. **Copy .env.example to .env** (if not already done)
   ```bash
   cp .env.example .env
   ```

2. **Fill in required values**:
   - `VITE_SUPABASE_URL`: Already set
   - `VITE_SUPABASE_ANON_KEY`: Already set
   - `SUPABASE_SERVICE_ROLE_KEY`: Get from Supabase dashboard
   - `OPENAI_API_KEY`: Get from OpenAI (for AI features)

### Step 4: Test the Setup

#### Test Database Connection
```bash
# Start the development server
npm run dev

# In another terminal, start the API server
npm run server
```

#### Test API Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Get departments
curl http://localhost:3001/api/departments

# Get announcements
curl http://localhost:3001/api/announcements
```

#### Test Authentication
1. **Sign up a test user**:
   - Navigate to `/signup`
   - Create a test account with role: `student`, `teacher`, or `admin`

2. **Test login**:
   - Navigate to `/login`
   - Login with your test credentials

3. **Test profile access**:
   - Check if user profile is created in database
   - Verify role assignment

---

## 🔧 Troubleshooting

### Database Issues
- **Problem**: Schema execution fails
- **Solution**: Check Supabase logs, ensure you have sufficient permissions

### Server Won't Start
- **Problem**: Port 3001 already in use
- **Solution**: Change port in `server/index.js` or kill the process using port 3001

### Environment Variables Not Loading
- **Problem**: Environment variables undefined
- **Solution**: Ensure `.env` file is in root directory, restart development server

### RLS Policies Blocking Access
- **Problem**: Database queries failing with permission errors
- **Solution**: Check RLS policies in Supabase dashboard, temporarily disable for testing

---

## 📋 Next Steps (Phase 3)

After completing Phase 2 setup, you're ready for Phase 3 - Academic Platform:

### Phase 3 Preview
1. **Student Dashboard**: Create student-specific dashboard with academic overview
2. **Teacher Dashboard**: Create teacher-specific dashboard with class management
3. **Attendance System**: Implement attendance tracking and display
4. **Marks System**: Implement marks/grades management
5. **Timetable System**: Implement schedule management

### Recommended Order
1. Create Student Dashboard page
2. Create Teacher Dashboard page  
3. Implement Attendance display
4. Implement Marks display
5. Implement Timetable display
6. Add navigation to new dashboards
7. Test with sample data

---

## 🧪 Testing Checklist

### Database Setup
- [ ] All tables created successfully
- [ ] Indexes created
- [ ] Triggers working
- [ ] RLS policies enabled
- [ ] Initial data seeded

### API Server
- [ ] Server starts without errors
- [ ] Health check endpoint works
- [ ] Profile endpoints work
- [ ] Student endpoints work
- [ ] Teacher endpoints work
- [ ] Academic data endpoints work

### Authentication
- [ ] User signup creates profile
- [ ] Role assignment works
- [ ] Login works correctly
- [ ] Session management works
- [ ] Protected routes work

### Environment
- [ ] Environment variables loaded
- [ ] Supabase connection works
- [ ] Service role key configured
- [ ] API keys configured

---

## 🎯 Phase 2 Success Criteria

Phase 2 is considered complete when:

✅ Database schema is deployed to Supabase
✅ All tables and relationships are working
✅ RLS policies are protecting sensitive data
✅ API server is running and responding
✅ Authentication system is working with roles
✅ Environment variables are properly configured
✅ Sample users can be created and logged in
✅ Basic API endpoints are tested and working

---

## 📚 Additional Resources

### Supabase Documentation
- [Supabase Dashboard](https://app.supabase.com)
- [Database Schema Guide](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### API Documentation
- [Express.js Documentation](https://expressjs.com/)
- [REST API Best Practices](https://restfulapi.net/)

### React Integration
- [React Router](https://reactrouter.com/)
- [Supabase React Integration](https://supabase.com/docs/guides/auth/social-login/auth-react)

---

## 🚨 Important Notes

1. **Security**: Never commit `.env` file to version control
2. **Service Role Key**: Use service role key only in server-side code
3. **RLS Policies**: Test RLS policies thoroughly before production
4. **Data Migration**: Plan how to migrate existing users if any
5. **Backup**: Always backup database before schema changes
6. **Testing**: Test with sample data before production use

---

## 📞 Support

If you encounter issues:

1. Check Supabase logs for database errors
2. Check server console for API errors
3. Verify environment variables are set correctly
4. Ensure all dependencies are installed
5. Check network connectivity to Supabase

Phase 2 provides the foundation for all future features. Take time to test thoroughly before proceeding to Phase 3.