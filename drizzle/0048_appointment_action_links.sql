CREATE TABLE IF NOT EXISTS appointment_action_links (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studio_id INT NOT NULL,
  appointment_id INT NOT NULL,
  action ENUM('confirmed', 'late', 'reschedule_requested') NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY appointment_action_links_token_unique (token_hash),
  KEY appointment_action_links_appointment_idx (appointment_id, action),
  KEY appointment_action_links_studio_idx (studio_id, expires_at)
);

CREATE TABLE IF NOT EXISTS appointment_action_alerts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studio_id INT NOT NULL,
  appointment_id INT NOT NULL,
  action_link_id INT NOT NULL,
  action ENUM('confirmed', 'late', 'reschedule_requested') NOT NULL,
  status ENUM('new', 'viewed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewed_at TIMESTAMP NULL,
  UNIQUE KEY appointment_action_alerts_link_unique (action_link_id),
  KEY appointment_action_alerts_studio_status_idx (studio_id, status, created_at),
  KEY appointment_action_alerts_appointment_idx (appointment_id, created_at)
);
