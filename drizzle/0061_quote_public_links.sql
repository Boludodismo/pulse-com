ALTER TABLE quote_proposals
  ADD COLUMN public_token varchar(64) NULL AFTER payload,
  ADD COLUMN viewed_at datetime NULL AFTER public_token,
  ADD COLUMN accepted_at datetime NULL AFTER viewed_at,
  ADD UNIQUE KEY quote_proposals_public_token_unique (public_token);
