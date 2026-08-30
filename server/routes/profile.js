import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// All profile routes require authentication
router.use(authRequired);

// ============================================
// GET /api/profile/me
// Returns the authenticated user's profile,
// role, and linked student/teacher record.
// ============================================
router.get('/me', async (req, res) => {
  try {
    const profile = req.profile;

    let student = null;
    let teacher = null;
    let department = null;

    if (profile.role === 'student') {
      const { data: studentData } = await supabase
        .from('students')
        .select('*, departments(*)')
        .eq('profile_id', profile.id)
        .single();
      // No error → link exists
      if (studentData) student = studentData;
      department = studentData?.departments || null;
    }

    if (profile.role === 'teacher') {
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('*, departments(*)')
        .eq('profile_id', profile.id)
        .single();
      if (teacherData) teacher = teacherData;
      department = teacherData?.departments || null;
    }

    res.json({ profile, student, teacher, department });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/profile/:id
// View a profile — own profile only, unless admin.
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id !== req.user.id && req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only view your own profile' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PUT /api/profile/:id
// Update own profile, or any profile if admin.
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (id !== req.user.id && req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }

    // Prevent role self-escalation: non-admins cannot change role.
    if (updates.role && req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
      delete updates.role;
    }

    // Whitelist updatable fields
    const allowedFields = ['full_name', 'phone', 'avatar_url'];
    const cleanUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) cleanUpdates[field] = updates[field];
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;