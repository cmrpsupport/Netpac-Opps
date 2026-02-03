-- SQLite Schema for CMRP Opportunities Management
-- Generated from PostgreSQL database

-- Foreign Key Constraints:
-- Foreign key: opportunity_revisions.opportunity_uid -> opps_monitoring.uid
-- Foreign key: user_column_preferences.user_id -> users.id
-- Foreign key: user_roles.role_id -> roles.id
-- Foreign key: user_roles.user_id -> users.id
-- Foreign key: proposal_schedule.user_id -> users.id
-- Foreign key: proposal_story_entries.parent_entry_id -> proposal_story_entries.id
-- Foreign key: drive_folder_audit.opportunity_uid -> opps_monitoring.uid
-- Foreign key: drive_folder_audit.opportunity_uid -> opps_monitoring.uid
-- Foreign key: proposal_story_entries.opportunity_uid -> opps_monitoring.uid
-- Foreign key: user_notifications.user_id -> users.id
-- Foreign key: user_notifications.opportunity_uid -> opps_monitoring.uid
-- Foreign key: user_notifications.created_by -> users.id
-- Foreign key: quotations.owner_id -> users.id
-- Foreign key: quotation_line_items.quotation_id -> quotations.id
-- Foreign key: quotation_line_items.catalog_item_id -> catalog_items.id
-- Foreign key: quotation_revisions.quotation_id -> quotations.id
-- Foreign key: quotation_comments.quotation_id -> quotations.id
-- Foreign key: quotation_comments.line_item_id -> quotation_line_items.id
-- Foreign key: quotation_comments.author_id -> users.id

CREATE TABLE account_manager_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  snapshot_type TEXT NOT NULL,
  account_manager TEXT NOT NULL,
  total_opportunities INTEGER DEFAULT 0,
  submitted_count INTEGER DEFAULT 0,
  submitted_amount REAL DEFAULT 0,
  submitted_percentage REAL DEFAULT 0,
  op100_count INTEGER DEFAULT 0,
  op100_amount REAL DEFAULT 0,
  op100_percentage REAL DEFAULT 0,
  op90_count INTEGER DEFAULT 0,
  op90_amount REAL DEFAULT 0,
  op90_percentage REAL DEFAULT 0,
  op60_count INTEGER DEFAULT 0,
  op60_amount REAL DEFAULT 0,
  op60_percentage REAL DEFAULT 0,
  op30_count INTEGER DEFAULT 0,
  op30_amount REAL DEFAULT 0,
  op30_percentage REAL DEFAULT 0,
  lost_count INTEGER DEFAULT 0,
  lost_amount REAL DEFAULT 0,
  lost_percentage REAL DEFAULT 0,
  inactive_count INTEGER DEFAULT 0,
  inactive_amount REAL DEFAULT 0,
  inactive_percentage REAL DEFAULT 0,
  ongoing_count INTEGER DEFAULT 0,
  ongoing_amount REAL DEFAULT 0,
  ongoing_percentage REAL DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  pending_amount REAL DEFAULT 0,
  pending_percentage REAL DEFAULT 0,
  decline_count INTEGER DEFAULT 0,
  decline_amount REAL DEFAULT 0,
  decline_percentage REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  declined_count INTEGER,
  revised_count INTEGER
);
CREATE TABLE catalog_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'pc',
  base_price REAL NOT NULL DEFAULT 0.00,
  currency TEXT DEFAULT 'PHP',
  supplier TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE catalog_upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  uploaded_by TEXT,
  rows_imported INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  error_log TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE custom_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  description TEXT,
  total_opportunities INTEGER DEFAULT 0,
  submitted_count INTEGER DEFAULT 0,
  submitted_amount REAL DEFAULT 0,
  op100_count INTEGER DEFAULT 0,
  op100_amount REAL DEFAULT 0,
  op90_count INTEGER DEFAULT 0,
  op90_amount REAL DEFAULT 0,
  op60_count INTEGER DEFAULT 0,
  op60_amount REAL DEFAULT 0,
  op30_count INTEGER DEFAULT 0,
  op30_amount REAL DEFAULT 0,
  lost_count INTEGER DEFAULT 0,
  lost_amount REAL DEFAULT 0,
  inactive_count INTEGER DEFAULT 0,
  ongoing_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  declined_count INTEGER DEFAULT 0,
  revised_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  is_manual INTEGER DEFAULT 0
);
CREATE TABLE custom_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  user_id TEXT,
  week_start_date TEXT NOT NULL,
  day_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  time TEXT,
  is_all_day INTEGER DEFAULT 0,
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE dashboard_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_type TEXT NOT NULL,
  total_opportunities INTEGER,
  submitted_count INTEGER,
  submitted_amount REAL,
  op100_count INTEGER,
  op100_amount REAL,
  op90_count INTEGER,
  op90_amount REAL,
  op60_count INTEGER,
  op60_amount REAL,
  op30_count INTEGER,
  op30_amount REAL,
  lost_count INTEGER,
  lost_amount REAL,
  inactive_count INTEGER,
  ongoing_count INTEGER,
  pending_count INTEGER,
  declined_count INTEGER,
  revised_count INTEGER,
  saved_date TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  snapshot_date TEXT NOT NULL,
  created_by TEXT,
  is_manual INTEGER DEFAULT 0,
  description TEXT
);
CREATE TABLE drive_folder_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_uid TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  folder_id TEXT,
  folder_url TEXT,
  folder_name TEXT,
  performed_by TEXT NOT NULL,
  performed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  operation_details TEXT DEFAULT '{}'
);
CREATE TABLE forecast_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_uid TEXT NOT NULL,
  old_forecast_date TEXT,
  new_forecast_date TEXT NOT NULL,
  changed_by TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  comment TEXT
);
CREATE TABLE migration_log (
  id TEXT PRIMARY KEY,
  migration_name TEXT NOT NULL,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);
CREATE TABLE opportunity_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_uid TEXT,
  revision_number INTEGER NOT NULL,
  changed_by TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  changed_fields TEXT,
  full_snapshot TEXT,
  forecast_date TEXT
);
CREATE TABLE opps_monitoring (
  encoded_date TEXT,
  project_name TEXT,
  project_code TEXT,
  rev INTEGER,
  client TEXT,
  solutions TEXT,
  sol_particulars TEXT,
  industries TEXT,
  ind_particulars TEXT,
  date_received TEXT,
  client_deadline TEXT,
  decision TEXT,
  account_mgr TEXT,
  pic TEXT,
  bom TEXT,
  status TEXT,
  submitted_date TEXT,
  margin REAL,
  final_amt REAL,
  opp_status TEXT,
  date_awarded_lost TEXT,
  lost_rca TEXT,
  l_particulars TEXT,
  a TEXT,
  c TEXT,
  r TEXT,
  u TEXT,
  d TEXT,
  remarks_comments TEXT,
  uid TEXT PRIMARY KEY,
  forecast_date TEXT,
  google_drive_folder_id TEXT,
  google_drive_folder_url TEXT,
  google_drive_folder_name TEXT,
  drive_folder_created_at TEXT,
  drive_folder_created_by TEXT,
  proposal_status TEXT,
  revision TEXT
);
CREATE TABLE opps_monitoring_backup_20250619 (
  encoded_date TEXT,
  project_name TEXT,
  project_code TEXT,
  rev INTEGER,
  client TEXT,
  solutions TEXT,
  sol_particulars TEXT,
  industries TEXT,
  ind_particulars TEXT,
  date_received TEXT,
  client_deadline TEXT,
  decision TEXT,
  account_mgr TEXT,
  pic TEXT,
  bom TEXT,
  status TEXT,
  submitted_date TEXT,
  margin REAL,
  final_amt REAL,
  opp_status TEXT,
  date_awarded_lost TEXT,
  lost_rca TEXT,
  l_particulars TEXT,
  a TEXT,
  c TEXT,
  r TEXT,
  u TEXT,
  d TEXT,
  remarks_comments TEXT,
  uid TEXT,
  forecast_date TEXT
);
CREATE TABLE playing_with_neon (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL
);
CREATE TABLE proposal_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL,
  proposal_name TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  day_index INTEGER NOT NULL,
  scheduled_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  is_completed INTEGER DEFAULT 0,
  completed_at TEXT,
  completed_by TEXT,
  completion_notes TEXT
);
CREATE TABLE proposal_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL,
  status TEXT NOT NULL,
  status_date TEXT NOT NULL,
  changed_by TEXT,
  change_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE proposal_story_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_uid TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  entry_type TEXT DEFAULT 'comment',
  title TEXT,
  content TEXT NOT NULL,
  entry_category TEXT,
  visibility TEXT DEFAULT 'internal',
  metadata TEXT DEFAULT '{}',
  edited_at TEXT,
  edited_by TEXT,
  is_deleted INTEGER DEFAULT 0,
  parent_entry_id INTEGER
);
CREATE TABLE quotation_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  line_item_id INTEGER,
  comment_text TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  mentioned_users TEXT DEFAULT '{}'::uuid[],
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE quotation_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  item_code TEXT,
  catalog_item_id INTEGER,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'materials',
  item_type TEXT,
  quantity REAL DEFAULT 1.00,
  unit TEXT DEFAULT 'pc',
  unit_price REAL DEFAULT 0.00,
  markup_percent REAL DEFAULT 0.00,
  subtotal REAL DEFAULT 0.00,
  total REAL DEFAULT 0.00,
  is_excluded INTEGER DEFAULT 0,
  technical_notes TEXT,
  line_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE quotation_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  quotation_snapshot TEXT NOT NULL,
  line_items_snapshot TEXT NOT NULL,
  created_by TEXT,
  change_summary TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT NOT NULL,
  revision_no TEXT DEFAULT '00',
  project_title TEXT NOT NULL,
  project_type TEXT,
  client_name TEXT,
  description TEXT,
  owner_id TEXT,
  created_by TEXT,
  status TEXT DEFAULT 'draft',
  markup_materials REAL DEFAULT 0.00,
  markup_labor REAL DEFAULT 0.00,
  markup_services REAL DEFAULT 0.00,
  tax_rate REAL DEFAULT 12.00,
  subtotal_materials REAL DEFAULT 0.00,
  subtotal_labor REAL DEFAULT 0.00,
  subtotal_services REAL DEFAULT 0.00,
  total_before_tax REAL DEFAULT 0.00,
  total_tax REAL DEFAULT 0.00,
  total_amount REAL DEFAULT 0.00,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}'
);
CREATE TABLE role_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  is_resigned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
CREATE TABLE schedule_task_completion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  day_index INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0,
  completed_at TEXT,
  completion_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE story_entry_types (
  type_name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color_class TEXT,
  requires_title INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_column_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  page_name TEXT NOT NULL,
  column_settings TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  opportunity_uid TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  read_at TEXT
);
CREATE TABLE user_roles (
  user_id TEXT PRIMARY KEY,
  role_id INTEGER PRIMARY KEY
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  is_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  roles TEXT DEFAULT '[]',
  account_type TEXT DEFAULT 'User',
  last_login_at TEXT
);
CREATE TABLE weekly_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  count INTEGER NOT NULL,
  amount REAL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);