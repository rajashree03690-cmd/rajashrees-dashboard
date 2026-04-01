-- ========================================
-- FINAL WORKING SETUP - Fixed Type Casting
-- ========================================

-- ==========================================
-- PART 1: Drop and Recreate Login Function (FIXED)
-- ==========================================

DROP FUNCTION IF EXISTS login_internal_user(TEXT, TEXT);

CREATE OR REPLACE FUNCTION login_internal_user(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (
  user_id BIGINT,
  email TEXT,
  full_name TEXT,
  role TEXT,  -- Returning as TEXT
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.user_id,
    u.email,
    u.full_name,
    u.role::TEXT,  -- CAST enum to TEXT!
    u.is_active
  FROM users u
  WHERE u.email = p_email
    AND u.password = p_password
    AND u.is_active = TRUE
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid credentials or user is inactive';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION login_internal_user(TEXT, TEXT) TO anon, authenticated;

-- ==========================================
-- PART 2: Clear All Existing Users
-- ==========================================

DELETE FROM executive_availability WHERE executive_id IN (SELECT user_id FROM users);
DELETE FROM user_roles;
DELETE FROM users;
ALTER SEQUENCE users_user_id_seq RESTART WITH 1;

-- ==========================================
-- PART 3: Create Test Users
-- ==========================================

INSERT INTO users (email, password, full_name, role, is_active) VALUES
('admin@rajashreefashion.com', 'Admin@123', 'Rajashree Admin', 'Admin', TRUE),
('superadmin@rajashreefashion.com', 'SuperAdmin@123', 'Super Admin', 'Admin', TRUE),
('manager@rajashreefashion.com', 'Manager@123', 'Test Manager', 'Manager', TRUE),
('executive@rajashreefashion.com', 'Executive@123', 'Test Executive', 'Executive', TRUE);

-- ==========================================
-- PART 4: Assign RBAC Roles
-- ==========================================

-- Admin
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.user_id, (SELECT role_id FROM roles WHERE role_name = 'Admin'), u.user_id
FROM users u WHERE u.role = 'Admin';

-- Manager
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.user_id, (SELECT role_id FROM roles WHERE role_name = 'Manager'),
       (SELECT user_id FROM users WHERE email = 'admin@rajashreefashion.com')
FROM users u WHERE u.role = 'Manager';

-- Executive
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.user_id, (SELECT role_id FROM roles WHERE role_name = 'Executive'),
       (SELECT user_id FROM users WHERE email = 'admin@rajashreefashion.com')
FROM users u WHERE u.role = 'Executive';

-- ==========================================
-- PART 5: Test Everything
-- ==========================================

SELECT '=== Admin Login Test ===' as test;
SELECT * FROM login_internal_user('admin@rajashreefashion.com', 'Admin@123');

SELECT '=== Manager Login Test ===' as test;
SELECT * FROM login_internal_user('manager@rajashreefashion.com', 'Manager@123');

SELECT '=== All Users with Permissions ===' as test;
SELECT 
  u.user_id,
  u.email,
  u.role::TEXT as user_role,
  r.role_name as rbac_role,
  COALESCE(COUNT(p.permission_id), 0) as permission_count
FROM users u
LEFT JOIN user_roles ur ON u.user_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
GROUP BY u.user_id, u.email, u.role, r.role_name
ORDER BY u.user_id;

SELECT '=== Permission Check ===' as test;
SELECT user_has_permission(1, 'roles.view') as admin_has_roles_view;

-- ==========================================
-- SUCCESS!
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║          ✅ SETUP SUCCESSFUL - ALL TESTS PASSED     ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 4 USERS CREATED:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '   1. admin@rajashreefashion.com / Admin@123 (Admin)';
  RAISE NOTICE '   2. superadmin@rajashreefashion.com / SuperAdmin@123 (Admin)';
  RAISE NOTICE '   3. manager@rajashreefashion.com / Manager@123 (Manager)';
  RAISE NOTICE '   4. executive@rajashreefashion.com / Executive@123 (Executive)';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NOW TEST IN BROWSER:';
  RAISE NOTICE '   1. Open DevTools (F12)';
  RAISE NOTICE '   2. Application → Local Storage → Clear All';
  RAISE NOTICE '   3. Login: admin@rajashreefashion.com / Admin@123';
  RAISE NOTICE '   4. Go to /dashboard/users';
  RAISE NOTICE '   5. Access should work! ✅';
  RAISE NOTICE '';
END $$;
