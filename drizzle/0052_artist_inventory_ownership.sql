-- Saldos existentes permanecem no estoque do estúdio.
ALTER TABLE tenant_materials ADD COLUMN ownerArtistId INT NULL;
CREATE TABLE IF NOT EXISTS studio_material_artists (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studioId INT NOT NULL,
  tenantMaterialId INT NOT NULL,
  artistId INT NOT NULL,
  UNIQUE KEY studio_material_artist_unique (studioId, tenantMaterialId, artistId)
);
