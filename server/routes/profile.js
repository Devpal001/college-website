import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired } from '../middleware/auth.js';

import { sendError } from '../lib/httpError.js';
import { requireString, optionalString } from '../lib/validate.js';

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
    sendError(res, error);
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
    sendError(res, error);
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

    // Whitelist updatable fields + validate types/lengths (never trust req.body).
    const cleanUpdates = {};
    if (updates.full_name !== undefined) {
      cleanUpdates.full_name = requireString(updates.full_name, 'full_name', { max: 200 });
    }
    // phone / avatar_url are optional fields in the schema: an explicit null
    // (or empty string) means "clear the field" and must NOT fail validation.
    // Previously requireString() rejected null -> "avatar_url must be between
    // 1 and 500 characters" on every profile save with an empty optional field.
    if (updates.phone !== undefined) {
      cleanUpdates.phone = optionalString(updates.phone, 'phone', { max: 20 }) ?? null;
    }
    if (updates.avatar_url !== undefined) {
      cleanUpdates.avatar_url = optionalString(updates.avatar_url, 'avatar_url', { max: 500 }) ?? null;
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
    sendError(res, error);
  }
});

export default router;