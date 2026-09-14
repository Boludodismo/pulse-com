ALTER TABLE `appointments`
  ADD COLUMN `includeArtistCard` tinyint NOT NULL DEFAULT 0 AFTER `artistId`;

-- Os agendamentos anteriores já seguiam a regra automática do cartão publicado.
-- Preservamos esse comportamento; novos agendamentos exigem escolha explícita.
UPDATE `appointments` SET `includeArtistCard` = 1;
