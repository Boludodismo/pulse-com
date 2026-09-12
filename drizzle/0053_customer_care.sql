CREATE TABLE IF NOT EXISTS care_rules (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL,
 name VARCHAR(120) NOT NULL, kind VARCHAR(20) NOT NULL, amount INT NOT NULL DEFAULT 0,
 unit VARCHAR(10) NOT NULL DEFAULT 'days', send_time VARCHAR(5) NOT NULL DEFAULT '09:00',
 body TEXT NOT NULL, enabled TINYINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY care_rules_studio_name (studio_id,name)
);
CREATE TABLE IF NOT EXISTS care_events (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, rule_id INT NOT NULL,
 client_id INT NOT NULL, appointment_id INT NULL, artist_id INT NULL,
 due_date VARCHAR(10) NOT NULL, occurrence_key VARCHAR(128) NOT NULL UNIQUE,
 token VARCHAR(64) NOT NULL UNIQUE, message TEXT NOT NULL, queue_id INT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'pending', feedback TEXT NULL,
 feedback_at TIMESTAMP NULL, read_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX care_events_studio_client (studio_id,client_id), INDEX care_events_due (status,due_date)
);
CREATE TABLE IF NOT EXISTS care_tags (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, client_id INT NOT NULL,
 label VARCHAR(60) NOT NULL, UNIQUE KEY care_tags_client_label (studio_id,client_id,label)
);
CREATE TABLE IF NOT EXISTS care_sessions (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, client_id INT NOT NULL,
 artist_id INT NULL, appointment_id INT NULL, source_key VARCHAR(80) NOT NULL UNIQUE,
 completed_at VARCHAR(19) NOT NULL
);
