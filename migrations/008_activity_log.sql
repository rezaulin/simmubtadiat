-- Activity Log (Audit Trail)
CREATE TABLE IF NOT EXISTS activity_log (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    action      VARCHAR(50) NOT NULL, -- 'login','failed_login','logout','create','update','delete','export','bulk_action'
    target      VARCHAR(100),         -- target table name
    target_id   INT,
    detail      JSONB,                -- before/after data, or extra info
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);
