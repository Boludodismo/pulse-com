CREATE TABLE IF NOT EXISTS artist_cards (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, artist_id INT NOT NULL, token VARCHAR(64) NOT NULL,
 published TINYINT NOT NULL DEFAULT 0, headline VARCHAR(160) NOT NULL DEFAULT '', description TEXT NOT NULL,
 links TEXT NOT NULL, images TEXT NOT NULL, UNIQUE KEY card_artist(studio_id,artist_id), UNIQUE KEY card_token(token)
);
CREATE TABLE IF NOT EXISTS procurement_contacts (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, supplier_id INT NOT NULL,
 confirmed_by INT NOT NULL, UNIQUE KEY contact_studio(studio_id,supplier_id)
);
CREATE TABLE IF NOT EXISTS procurement_templates (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, name VARCHAR(120) NOT NULL, body TEXT NOT NULL,
 UNIQUE KEY procurement_template(studio_id,name)
);
CREATE TABLE IF NOT EXISTS procurement_alerts (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, material_id INT NOT NULL, episode VARCHAR(64) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'open', recipient_artist_id INT NULL, notify_enabled TINYINT NOT NULL DEFAULT 0,
 notified_at DATETIME NULL, last_error TEXT NULL, UNIQUE KEY procurement_material(studio_id,material_id)
);
CREATE TABLE IF NOT EXISTS procurement_quotes (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, material_id INT NOT NULL, supplier_id INT NOT NULL,
 quantity DECIMAL(12,3) NOT NULL, recipient_phone VARCHAR(32) NOT NULL, message TEXT NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'draft', approved_by INT NULL, approved_at DATETIME NULL,
 sent_at DATETIME NULL, provider_message_id VARCHAR(255) NULL, last_error TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
