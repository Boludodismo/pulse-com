CREATE TABLE IF NOT EXISTS quote_proposals (
  id int NOT NULL AUTO_INCREMENT,
  studio_id int NOT NULL,
  client_id int NOT NULL,
  artist_id int NOT NULL,
  quote_number varchar(48) NOT NULL,
  version int NOT NULL DEFAULT 1,
  status varchar(24) NOT NULL DEFAULT 'draft',
  created_date datetime NOT NULL,
  valid_until datetime NOT NULL,
  total_amount int NOT NULL DEFAULT 0,
  payload text NOT NULL,
  created_by_user_id int NOT NULL,
  finalized_at datetime NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY quote_proposals_number_version_unique (studio_id, quote_number, version),
  KEY quote_proposals_studio_updated_idx (studio_id, updated_at),
  KEY quote_proposals_client_idx (studio_id, client_id, id),
  KEY quote_proposals_artist_idx (studio_id, artist_id, id)
);

CREATE TABLE IF NOT EXISTS quote_presets (
  id int NOT NULL AUTO_INCREMENT,
  studio_id int NOT NULL,
  artist_id int NULL,
  category varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  content text NOT NULL,
  is_active tinyint NOT NULL DEFAULT 1,
  created_by_user_id int NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY quote_presets_studio_category_idx (studio_id, category, is_active),
  KEY quote_presets_artist_idx (studio_id, artist_id, category)
);

CREATE TABLE IF NOT EXISTS artist_quote_branding (
  id int NOT NULL AUTO_INCREMENT,
  studio_id int NOT NULL,
  artist_id int NOT NULL,
  personal_logo_url varchar(3000) NULL,
  personal_logo_key varchar(500) NULL,
  default_logo_source varchar(16) NOT NULL DEFAULT 'studio',
  watermark_opacity int NOT NULL DEFAULT 70,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY artist_quote_branding_artist_unique (studio_id, artist_id)
);

ALTER TABLE user_module_permissions
  MODIFY COLUMN module enum(
    'clients',
    'appointments',
    'stock',
    'finance',
    'anamnesis',
    'pod',
    'reports',
    'quotes',
    'intelligent_inbox',
    'inbox_conversations',
    'inbox_summaries',
    'inbox_priorities',
    'inbox_opportunities',
    'inbox_settings',
    'inbox_suggestions'
  ) NOT NULL;
