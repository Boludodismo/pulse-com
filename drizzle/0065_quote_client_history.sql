ALTER TABLE quote_proposals
  ADD COLUMN sent_at datetime NULL,
  ADD COLUMN sent_by_user_id int NULL,
  ADD COLUMN sent_source varchar(24) NULL,
  ADD COLUMN responded_at datetime NULL,
  ADD COLUMN response_source varchar(24) NULL,
  ADD COLUMN response_text text NULL,
  ADD COLUMN response_by_user_id int NULL,
  ADD COLUMN question_at datetime NULL,
  ADD COLUMN question_text text NULL;
ALTER TABLE appointments ADD COLUMN quote_id int NULL;
CREATE INDEX appointments_quote_idx ON appointments (studioId, quote_id, clientId, artistId, status);
-- Only recorded acceptance is historical evidence; no invented send date.
INSERT IGNORE INTO care_tags (studio_id, client_id, label)
SELECT DISTINCT studio_id, client_id, 'orçamento respondido'
FROM quote_proposals WHERE accepted_at IS NOT NULL;
