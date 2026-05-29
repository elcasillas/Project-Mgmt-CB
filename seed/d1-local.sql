PRAGMA foreign_keys = ON;

INSERT INTO profiles (id, first_name, last_name, full_name, email, password_hash, role, status, last_active_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Avery', 'Stone', 'Avery Stone', 'admin@northstarpm.com', 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea', 'Admin', 'Active', datetime('now', '-1 hour')),
  ('22222222-2222-2222-2222-222222222222', 'Jordan', 'Lee', 'Jordan Lee', 'manager@northstarpm.com', 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea', 'Project Manager', 'Active', datetime('now', '-3 hours')),
  ('33333333-3333-3333-3333-333333333333', 'Taylor', 'Brooks', 'Taylor Brooks', 'member@northstarpm.com', 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea', 'Team Member', 'Active', datetime('now', '-1 day')),
  ('44444444-1111-1111-1111-111111111111', 'Morgan', 'Hale', 'Morgan Hale', 'viewer@northstarpm.com', 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea', 'Viewer', 'Pending', NULL)
ON CONFLICT(id) DO UPDATE SET
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  email = excluded.email,
  password_hash = excluded.password_hash,
  role = excluded.role,
  status = excluded.status,
  last_active_at = excluded.last_active_at,
  deleted_at = NULL,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO workspace_settings (id, workspace_name, default_project_status, default_project_priority, notifications_enabled)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Northstar PM', 'Planning', 'Medium', 1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO projects (id, name, description, owner_id, status, priority, start_date, target_end_date, progress, notes)
VALUES
  ('44444444-4444-4444-4444-444444444441', 'Q2 Client Portal', 'Launch the new client-facing delivery and approvals portal for enterprise accounts.', '22222222-2222-2222-2222-222222222222', 'Active', 'Critical', date('now', '-18 days'), date('now', '+21 days'), 68, 'Weekly steering committee every Tuesday.'),
  ('44444444-4444-4444-4444-444444444442', 'Revenue Ops Automation', 'Automate handoffs between sales, onboarding, and finance with workflow guardrails.', '11111111-1111-1111-1111-111111111111', 'Planning', 'High', date('now', '-7 days'), date('now', '+42 days'), 24, 'Vendor shortlist complete.'),
  ('44444444-4444-4444-4444-444444444443', 'Infrastructure Hardening', 'Reduce deployment risk and improve alerting, rollback, and access management.', '11111111-1111-1111-1111-111111111111', 'Active', 'High', date('now', '-30 days'), date('now', '+10 days'), 37, 'Pending firewall exception approval.')
ON CONFLICT(id) DO NOTHING;

INSERT INTO project_members (id, project_id, user_id)
VALUES
  ('pm-441-111', '44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111'),
  ('pm-441-222', '44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222222222'),
  ('pm-441-333', '44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333'),
  ('pm-442-111', '44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111'),
  ('pm-442-222', '44444444-4444-4444-4444-444444444442', '22222222-2222-2222-2222-222222222222'),
  ('pm-443-111', '44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111'),
  ('pm-443-333', '44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333')
ON CONFLICT(project_id, user_id) DO NOTHING;

INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, reporter_id, start_date, due_date, estimated_hours, purchase_items)
VALUES
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444441', 'Finalize SSO rollout plan', 'Coordinate launch checklist with security and customer success.', 'In Progress', 'Urgent', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', date('now', '-6 days'), date('now', '+3 days'), 16, '[{"id":"pi-sso-brief","name":"Rollout briefing packet"},{"id":"pi-sso-headsets","name":"Headsets for launch rehearsal"}]'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444441', 'Polish executive dashboard metrics', 'Refine data cards and validate refresh timing with finance.', 'In Review', 'High', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', date('now', '-8 days'), date('now', '+1 day'), 12, '[]'),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444442', 'Map automation dependencies', 'Confirm source systems, owners, and exceptions.', 'Not Started', 'Medium', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', date('now', '+1 day'), date('now', '+8 days'), 10, '[{"id":"pi-automation-license","name":"Sandbox connector license"}]'),
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444443', 'Close stale admin access', 'Remove unused elevated permissions across production systems.', 'Blocked', 'Urgent', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', date('now', '-14 days'), date('now', '-2 days'), 8, '[]'),
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444443', 'Draft rollback checklist', 'Prepare release checklist for incident response and rollback.', 'Done', 'High', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', date('now', '-12 days'), date('now', '-5 days'), 6, '[{"id":"pi-printouts","name":"Printed rollback runbook"}]')
ON CONFLICT(id) DO NOTHING;

INSERT INTO task_dependencies (id, task_id, depends_on_task_id)
VALUES
  ('td-552-551', '55555555-5555-5555-5555-555555555552', '55555555-5555-5555-5555-555555555551'),
  ('td-553-552', '55555555-5555-5555-5555-555555555553', '55555555-5555-5555-5555-555555555552')
ON CONFLICT(task_id, depends_on_task_id) DO NOTHING;

INSERT INTO comments (id, task_id, user_id, body)
VALUES
  ('comment-001', '55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'Security approved the SSO policy update. Final rollout note is still pending.'),
  ('comment-002', '55555555-5555-5555-5555-555555555551', '22222222-2222-2222-2222-222222222222', 'Scheduling launch rehearsal for Thursday afternoon.'),
  ('comment-003', '55555555-5555-5555-5555-555555555554', '33333333-3333-3333-3333-333333333333', 'Blocked on vendor response for the firewall change.')
ON CONFLICT(id) DO NOTHING;

INSERT INTO activity_logs (id, user_id, entity_type, entity_id, action, metadata)
VALUES
  ('activity-001', '22222222-2222-2222-2222-222222222222', 'project', '44444444-4444-4444-4444-444444444441', 'project_created', '{"projectName":"Q2 Client Portal"}'),
  ('activity-002', '11111111-1111-1111-1111-111111111111', 'task', '55555555-5555-5555-5555-555555555551', 'task_created', '{"title":"Finalize SSO rollout plan"}'),
  ('activity-003', '22222222-2222-2222-2222-222222222222', 'task', '55555555-5555-5555-5555-555555555552', 'task_status_changed', '{"from":"In Progress","to":"In Review"}'),
  ('activity-004', '11111111-1111-1111-1111-111111111111', 'project', '44444444-4444-4444-4444-444444444443', 'project_updated', '{"field":"target_end_date"}')
ON CONFLICT(id) DO NOTHING;
