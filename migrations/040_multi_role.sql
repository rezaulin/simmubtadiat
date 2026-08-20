-- 1. Create the new user_roles table to support multiple roles per user
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    UNIQUE(user_id, role)
);

-- 2. Migrate existing roles from users.role to user_roles
INSERT INTO user_roles (user_id, role)
SELECT id, role FROM users WHERE role IS NOT NULL
ON CONFLICT DO NOTHING;
