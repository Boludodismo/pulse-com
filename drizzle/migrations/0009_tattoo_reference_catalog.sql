INSERT INTO `catalog_brands` (`name`,`slug`,`origin`,`website`,`isActive`,`createdAt`,`updatedAt`) VALUES
('Skin Ink','skin-ink','Brasil','https://skinink.com.br',1,0,0),
('Cheyenne','cheyenne','Alemanha','https://cheyennetattoo.com/pt',1,0,0),
('Kwadron','kwadron','Polônia','https://www.kwadron.pl/pt',1,0,0),
('Electric Ink','electric-ink','Brasil','https://www.electricink.com.br',1,0,0),
('Easy Glow','easy-glow','Brasil','https://www.electricink.com.br/tatuagem/tintas/easy-glow',1,0,0),
('Intenze','intenze','Estados Unidos','https://www.electricink.com.br/tatuagem/tintas/intenze',1,0,0),
('World Famous','world-famous','Estados Unidos','https://www.worldfamoustattooink.com',1,0,0),
('Descarpack','descarpack','Brasil','https://portaldocliente.descarpack.com.br',1,0,0),
('Dynamic','dynamic','Estados Unidos','https://dynamiccolor.com',1,0,0),
('Genérico','generico',NULL,NULL,1,0,0)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`website`=VALUES(`website`),`isActive`=1;
--> statement-breakpoint
INSERT INTO `catalog_product_lines` (`brandId`,`name`,`category`,`description`,`isActive`,`createdAt`,`updatedAt`)
SELECT `id`,'Fine Line','Cartuchos e agulhas','Cartuchos RLF de encaixe universal, caixa com 20 unidades.',1,0,0 FROM `catalog_brands` WHERE `slug`='skin-ink'
UNION ALL SELECT `id`,'Round Liner','Cartuchos e agulhas','Cartuchos RL, caixa com 20 unidades.',1,0,0 FROM `catalog_brands` WHERE `slug`='skin-ink'
UNION ALL SELECT `id`,'Round Shader','Cartuchos e agulhas','Cartuchos RS, caixa com 20 unidades.',1,0,0 FROM `catalog_brands` WHERE `slug`='skin-ink'
UNION ALL SELECT `id`,'Round Magnum','Cartuchos e agulhas','Cartuchos magnum curvo, caixa com 20 unidades.',1,0,0 FROM `catalog_brands` WHERE `slug`='skin-ink'
UNION ALL SELECT `id`,'Safety Cartridges','Cartuchos e agulhas','Linha Safety com membrana de segurança.',1,0,0 FROM `catalog_brands` WHERE `slug`='cheyenne'
UNION ALL SELECT `id`,'Cartridge System','Cartuchos e agulhas','Linha de cartuchos universais.',1,0,0 FROM `catalog_brands` WHERE `slug`='kwadron'
UNION ALL SELECT `id`,'Universal Pro','Cartuchos e agulhas','Cartuchos de encaixe universal.',1,0,0 FROM `catalog_brands` WHERE `slug`='electric-ink'
UNION ALL SELECT `id`,'Tintas Electric Ink','Tintas e pigmentos','Pigmentos para cadastro sujeito à conferência sanitária.',1,0,0 FROM `catalog_brands` WHERE `slug`='electric-ink'
UNION ALL SELECT `id`,'Tintas Easy Glow','Tintas e pigmentos','Frascos em múltiplos volumes.',1,0,0 FROM `catalog_brands` WHERE `slug`='easy-glow'
UNION ALL SELECT `id`,'Intenze Colors','Tintas e pigmentos','Cores em frascos de referência de 30 ml.',1,0,0 FROM `catalog_brands` WHERE `slug`='intenze'
UNION ALL SELECT `id`,'World Famous Colors','Tintas e pigmentos','Cores em múltiplos volumes.',1,0,0 FROM `catalog_brands` WHERE `slug`='world-famous'
UNION ALL SELECT `id`,'Tintas bloqueadas no Brasil','Tintas e pigmentos','Itens mantidos apenas para alerta sanitário.',1,0,0 FROM `catalog_brands` WHERE `slug`='dynamic'
UNION ALL SELECT `id`,'Luvas nitrílicas','Barreiras e descartáveis','Caixa com 100 luvas, equivalente a 50 pares.',1,0,0 FROM `catalog_brands` WHERE `slug`='descarpack'
UNION ALL SELECT `id`,'Batoques','Batoques e acessórios','Batoques descartáveis por tamanho.',1,0,0 FROM `catalog_brands` WHERE `slug`='generico'
UNION ALL SELECT `id`,'Barreiras do estúdio','Barreiras e descartáveis','Filmes, sacos, papel e proteções.',1,0,0 FROM `catalog_brands` WHERE `slug`='generico'
UNION ALL SELECT `id`,'Higienização','Higienização e processamento','Produtos líquidos controlados por ml.',1,0,0 FROM `catalog_brands` WHERE `slug`='generico'
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`),`isActive`=1;
--> statement-breakpoint
SET @skin_fine := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Fine Line' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='skin-ink'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`taper`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@skin_fine,'Fine Line 0601','0601-RL-Fine','Cartuchos e agulhas','RLF',1,0.20,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line, detalhes e micropigmentação','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',1,1,0,0),
(@skin_fine,'Fine Line 1001','1001-RL-Fine','Cartuchos e agulhas','RLF',1,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line e detalhes','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',2,1,0,0),
(@skin_fine,'Fine Line 0403','0403-RL-Fine','Cartuchos e agulhas','RLF',3,0.15,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Linhas ultrafinas','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',3,1,0,0),
(@skin_fine,'Fine Line 0603','0603-RL-Fine','Cartuchos e agulhas','RLF',3,0.20,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line e detalhes','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',4,1,0,0),
(@skin_fine,'Fine Line 0803','0803-RL-Fine','Cartuchos e agulhas','RLF',3,0.25,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line e detalhes','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',5,1,0,0),
(@skin_fine,'Fine Line 1003','1003-RL-Fine','Cartuchos e agulhas','RLF',3,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Linhas finas','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',6,1,0,0),
(@skin_fine,'Fine Line 0405','0405-RL-Fine','Cartuchos e agulhas','RLF',5,0.15,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',7,1,0,0),
(@skin_fine,'Fine Line 0605','0605-RL-Fine','Cartuchos e agulhas','RLF',5,0.20,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',8,1,0,0),
(@skin_fine,'Fine Line 0805','0805-RL-Fine','Cartuchos e agulhas','RLF',5,0.25,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',9,1,0,0),
(@skin_fine,'Fine Line 1005','1005-RL-Fine','Cartuchos e agulhas','RLF',5,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Linhas finas','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',10,1,0,0),
(@skin_fine,'Fine Line 0407','0407-RL-Fine','Cartuchos e agulhas','RLF',7,0.15,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',11,1,0,0),
(@skin_fine,'Fine Line 0607','0607-RL-Fine','Cartuchos e agulhas','RLF',7,0.20,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',12,1,0,0),
(@skin_fine,'Fine Line 0807','0807-RL-Fine','Cartuchos e agulhas','RLF',7,0.25,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Fine line','fabricante','https://skinink.com.br/products/cartucho-skin-ink-fine-line-6977bcbd7d50e',13,1,0,0);
--> statement-breakpoint
SET @skin_rl := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Round Liner' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='skin-ink'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`taper`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@skin_rl,'Round Liner 0803','0803-RL','Cartuchos e agulhas','RL',3,0.25,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://skinink.com.br',1,1,0,0),
(@skin_rl,'Round Liner 1003','1003-RL','Cartuchos e agulhas','RL',3,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://skinink.com.br',2,1,0,0),
(@skin_rl,'Round Liner 1005','1005-RL','Cartuchos e agulhas','RL',5,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://skinink.com.br',3,1,0,0),
(@skin_rl,'Round Liner 1007','1007-RL','Cartuchos e agulhas','RL',7,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://skinink.com.br',4,1,0,0),
(@skin_rl,'Round Liner 1009','1009-RL','Cartuchos e agulhas','RL',9,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://skinink.com.br',5,1,0,0),
(@skin_rl,'Round Liner 1011','1011-RL','Cartuchos e agulhas','RL',11,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://skinink.com.br',6,1,0,0),
(@skin_rl,'Round Liner 1014','1014-RL','Cartuchos e agulhas','RL',14,0.30,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço largo','fabricante','https://skinink.com.br',7,1,0,0),
(@skin_rl,'Round Liner 1209','1209-RL','Cartuchos e agulhas','RL',9,0.35,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço sólido','fabricante','https://skinink.com.br',8,1,0,0),
(@skin_rl,'Round Liner 1211','1211-RL','Cartuchos e agulhas','RL',11,0.35,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço sólido','fabricante','https://skinink.com.br',9,1,0,0),
(@skin_rl,'Round Liner 1214','1214-RL','Cartuchos e agulhas','RL',14,0.35,'Long Taper',20,'Caixa com 20 cartuchos','un','cx',20,'Traço sólido','fabricante','https://skinink.com.br',10,1,0,0);
--> statement-breakpoint
SET @skin_rs := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Round Shader' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='skin-ink'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`taper`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@skin_rs,'Round Shader 1003','1003-RS','Cartuchos e agulhas','RS',3,0.30,NULL,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento pequeno','fabricante','https://skinink.com.br',1,1,0,0),
(@skin_rs,'Round Shader 1005','1005-RS','Cartuchos e agulhas','RS',5,0.30,NULL,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra','fabricante','https://skinink.com.br',2,1,0,0),
(@skin_rs,'Round Shader 1007','1007-RS','Cartuchos e agulhas','RS',7,0.30,NULL,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra','fabricante','https://skinink.com.br',3,1,0,0),
(@skin_rs,'Round Shader 1009','1009-RS','Cartuchos e agulhas','RS',9,0.30,NULL,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra','fabricante','https://skinink.com.br',4,1,0,0),
(@skin_rs,'Round Shader 1011','1011-RS','Cartuchos e agulhas','RS',11,0.30,NULL,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra','fabricante','https://skinink.com.br',5,1,0,0),
(@skin_rs,'Round Shader 1214','1214-RS','Cartuchos e agulhas','RS',14,0.35,NULL,20,'Caixa com 20 cartuchos','un','cx',20,'Preenchimento','fabricante','https://skinink.com.br',6,1,0,0);
--> statement-breakpoint
SET @skin_rm := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Round Magnum' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='skin-ink'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@skin_rm,'Round Magnum 1007','1007-RM','Cartuchos e agulhas','RMG',7,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra suave e preenchimento','fabricante','https://skinink.com.br',1,1,0,0),
(@skin_rm,'Round Magnum 1009','1009-RM','Cartuchos e agulhas','RMG',9,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento','fabricante','https://skinink.com.br',2,1,0,0),
(@skin_rm,'Round Magnum 1011','1011-RM','Cartuchos e agulhas','RMG',11,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento','fabricante','https://skinink.com.br',3,1,0,0),
(@skin_rm,'Round Magnum 1013','1013-RM','Cartuchos e agulhas','RMG',13,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento','fabricante','https://skinink.com.br',4,1,0,0),
(@skin_rm,'Round Magnum 1015','1015-RM','Cartuchos e agulhas','RMG',15,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas médias','fabricante','https://skinink.com.br',5,1,0,0),
(@skin_rm,'Round Magnum 1017','1017-RM','Cartuchos e agulhas','RMG',17,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas médias','fabricante','https://skinink.com.br',6,1,0,0),
(@skin_rm,'Round Magnum 1021','1021-RM','Cartuchos e agulhas','RMG',21,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas grandes','fabricante','https://skinink.com.br',7,1,0,0),
(@skin_rm,'Round Magnum 1025','1025-RM','Cartuchos e agulhas','RMG',25,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas grandes','fabricante','https://skinink.com.br',8,1,0,0),
(@skin_rm,'Round Magnum 1213','1213-RM','Cartuchos e agulhas','RMG',13,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Preenchimento sólido','fabricante','https://skinink.com.br',9,1,0,0),
(@skin_rm,'Round Magnum 1217','1217-RM','Cartuchos e agulhas','RMG',17,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Preenchimento sólido','fabricante','https://skinink.com.br',10,1,0,0),
(@skin_rm,'Round Magnum 1221','1221-RM','Cartuchos e agulhas','RMG',21,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas grandes','fabricante','https://skinink.com.br',11,1,0,0),
(@skin_rm,'Round Magnum 1223','1223-RM','Cartuchos e agulhas','RMG',23,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas grandes','fabricante','https://skinink.com.br',12,1,0,0);
--> statement-breakpoint
SET @cheyenne := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Safety Cartridges' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='cheyenne'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@cheyenne,'3 Liner 0.25','3RL-025','Cartuchos e agulhas','RL',3,0.25,20,'Caixa com 20 cartuchos','un','cx',20,'Linhas finas','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',1,1,0,0),
(@cheyenne,'5 Liner 0.25','5RL-025','Cartuchos e agulhas','RL',5,0.25,20,'Caixa com 20 cartuchos','un','cx',20,'Linhas finas','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',2,1,0,0),
(@cheyenne,'7 Liner 0.25','7RL-025','Cartuchos e agulhas','RL',7,0.25,20,'Caixa com 20 cartuchos','un','cx',20,'Linhas','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',3,1,0,0),
(@cheyenne,'9 Liner 0.30','9RL-030','Cartuchos e agulhas','RL',9,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Linhas','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',4,1,0,0),
(@cheyenne,'11 Liner 0.30','11RL-030','Cartuchos e agulhas','RL',11,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Linhas','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',5,1,0,0),
(@cheyenne,'14 Liner 0.30','14RL-030','Cartuchos e agulhas','RL',14,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Linhas largas','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',6,1,0,0),
(@cheyenne,'7 Soft Edge Magnum 0.30','7SEM-030','Cartuchos e agulhas','Soft Edge',7,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra suave','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',7,1,0,0),
(@cheyenne,'13 Soft Edge Magnum 0.30','13SEM-030','Cartuchos e agulhas','Soft Edge',13,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',8,1,0,0),
(@cheyenne,'23 Soft Edge Magnum 0.30','23SEM-030','Cartuchos e agulhas','Soft Edge',23,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas grandes','fabricante','https://cheyennetattoo.com/pt/tattoo-cartuchos/safety-cartuchos',9,1,0,0);
--> statement-breakpoint
SET @kwadron := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Cartridge System' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='kwadron'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@kwadron,'3 Round Liner 0.30','0303RL','Cartuchos e agulhas','RL',3,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',1,1,0,0),
(@kwadron,'5 Round Liner 0.30','0305RL','Cartuchos e agulhas','RL',5,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',2,1,0,0),
(@kwadron,'7 Round Liner 0.30','0307RL','Cartuchos e agulhas','RL',7,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',3,1,0,0),
(@kwadron,'9 Round Liner 0.35','0359RL','Cartuchos e agulhas','RL',9,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Traço sólido','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',4,1,0,0),
(@kwadron,'11 Round Liner 0.35','03511RL','Cartuchos e agulhas','RL',11,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Traço sólido','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',5,1,0,0),
(@kwadron,'9 Round Magnum 0.30','0309RMG','Cartuchos e agulhas','RMG',9,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',6,1,0,0),
(@kwadron,'13 Round Magnum 0.30','03013RMG','Cartuchos e agulhas','RMG',13,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',7,1,0,0),
(@kwadron,'15 Round Magnum 0.30','03015RMG','Cartuchos e agulhas','RMG',15,0.30,20,'Caixa com 20 cartuchos','un','cx',20,'Preenchimento','fabricante','https://www.kwadron.pl/pt/kwadron-cartridges',8,1,0,0);
--> statement-breakpoint
SET @electric_cart := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Universal Pro' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='electric-ink'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`needleCount`,`needleDiameter`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@electric_cart,'Universal Pro 07RL 0.35','07RL-035','Cartuchos e agulhas','RL',7,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Traço','fabricante','https://www.electricink.com.br/tatuagem/cartuchos/electric-ink',1,1,0,0),
(@electric_cart,'Universal Pro 09RMG 0.35','09RMG-035','Cartuchos e agulhas','RMG',9,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Sombra e preenchimento','fabricante','https://www.electricink.com.br/tatuagem/cartuchos/electric-ink',2,1,0,0),
(@electric_cart,'Universal Pro 15RMG 0.35','15RMG-035','Cartuchos e agulhas','RMG',15,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Preenchimento','fabricante','https://www.electricink.com.br/tatuagem/cartuchos/electric-ink',3,1,0,0),
(@electric_cart,'Universal Pro 23RMG 0.35','23RMG-035','Cartuchos e agulhas','RMG',23,0.35,20,'Caixa com 20 cartuchos','un','cx',20,'Áreas grandes','fabricante','https://www.electricink.com.br/tatuagem/cartuchos/electric-ink',4,1,0,0);
--> statement-breakpoint
SET @easy := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Tintas Easy Glow' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='easy-glow'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`volumeMl`,`colorName`,`anvisaStatus`,`requiresLotControl`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@easy,'Cor a escolher 15 ml','EASY-15','Tintas e pigmentos',1,'Frasco de 15 ml','ml','frasco',15,15,'Cor a escolher','pendente',1,'Pigmento; conferir registro por cor e lote','fabricante','https://www.electricink.com.br/tatuagem/tintas/easy-glow',1,1,0,0),
(@easy,'Cor a escolher 30 ml','EASY-30','Tintas e pigmentos',1,'Frasco de 30 ml','ml','frasco',30,30,'Cor a escolher','pendente',1,'Pigmento; conferir registro por cor e lote','fabricante','https://www.electricink.com.br/tatuagem/tintas/easy-glow',2,1,0,0),
(@easy,'Cor a escolher 60 ml','EASY-60','Tintas e pigmentos',1,'Frasco de 60 ml','ml','frasco',60,60,'Cor a escolher','pendente',1,'Pigmento; conferir registro por cor e lote','fabricante','https://www.electricink.com.br/tatuagem/tintas/easy-glow',3,1,0,0),
(@easy,'Cor a escolher 120 ml','EASY-120','Tintas e pigmentos',1,'Frasco de 120 ml','ml','frasco',120,120,'Cor a escolher','pendente',1,'Pigmento; conferir registro por cor e lote','fabricante','https://www.electricink.com.br/tatuagem/tintas/easy-glow',4,1,0,0),
(@easy,'Cor a escolher 240 ml','EASY-240','Tintas e pigmentos',1,'Frasco de 240 ml','ml','frasco',240,240,'Cor a escolher','pendente',1,'Pigmento; conferir registro por cor e lote','fabricante','https://www.electricink.com.br/tatuagem/tintas/easy-glow',5,1,0,0);
--> statement-breakpoint
SET @intenze := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Intenze Colors' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='intenze'));
--> statement-breakpoint
SET @world := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='World Famous Colors' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='world-famous'));
--> statement-breakpoint
SET @dynamic := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Tintas bloqueadas no Brasil' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='dynamic'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`volumeMl`,`colorName`,`anvisaStatus`,`requiresLotControl`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@intenze,'Cor a escolher 30 ml','INTENZE-30','Tintas e pigmentos',1,'Frasco de 30 ml','ml','frasco',30,30,'Cor a escolher','pendente',1,'Conferir registro Anvisa por produto','fabricante','https://www.electricink.com.br/tatuagem/tintas/intenze',1,1,0,0),
(@world,'Cor a escolher 15 ml','WF-15','Tintas e pigmentos',1,'Frasco de 15 ml','ml','frasco',15,15,'Cor a escolher','pendente',1,'Conferir registro Anvisa por produto','fabricante','https://www.worldfamoustattooink.com',1,1,0,0),
(@world,'Cor a escolher 30 ml','WF-30','Tintas e pigmentos',1,'Frasco de 30 ml','ml','frasco',30,30,'Cor a escolher','pendente',1,'Conferir registro Anvisa por produto','fabricante','https://www.worldfamoustattooink.com',2,1,0,0),
(@world,'Cor a escolher 60 ml','WF-60','Tintas e pigmentos',1,'Frasco de 60 ml','ml','frasco',60,60,'Cor a escolher','pendente',1,'Conferir registro Anvisa por produto','fabricante','https://www.worldfamoustattooink.com',3,1,0,0),
(@dynamic,'Dynamic Black','DYNAMIC-BLACK','Tintas e pigmentos',1,'Frasco','ml','frasco',30,30,'Preto','bloqueado',1,'Uso, venda e propaganda proibidos pela Anvisa','bloqueado','https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-proibe-maquina-e-tinta-para-tatuagens-sem-registro-sanitario-1',1,1,0,0),
(@dynamic,'Dynamic Triple Black','DYNAMIC-TRIPLE-BLACK','Tintas e pigmentos',1,'Frasco','ml','frasco',30,30,'Preto','bloqueado',1,'Uso, venda e propaganda proibidos pela Anvisa','bloqueado','https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-proibe-maquina-e-tinta-para-tatuagens-sem-registro-sanitario-1',2,1,0,0),
(@dynamic,'Dynamic Ganga Black','DYNAMIC-GANGA-BLACK','Tintas e pigmentos',1,'Frasco','ml','frasco',30,30,'Preto','bloqueado',1,'Uso, venda e propaganda proibidos pela Anvisa','bloqueado','https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-proibe-maquina-e-tinta-para-tatuagens-sem-registro-sanitario-1',3,1,0,0);
--> statement-breakpoint
SET @gloves := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Luvas nitrílicas' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='descarpack'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sourceUrl`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@gloves,'Luva nitrílica preta PP','NITRILICA-PRETA-PP','Barreiras e descartáveis','PP',100,'Caixa com 100 luvas = 50 pares','par','cx',50,'EPI para procedimento não estéril','fabricante','https://portaldocliente.descarpack.com.br/luva-nitrilica-powder-free-preta-descarpack.html',1,1,0,0),
(@gloves,'Luva nitrílica preta P','NITRILICA-PRETA-P','Barreiras e descartáveis','P',100,'Caixa com 100 luvas = 50 pares','par','cx',50,'EPI para procedimento não estéril','fabricante','https://portaldocliente.descarpack.com.br/luva-nitrilica-powder-free-preta-descarpack.html',2,1,0,0),
(@gloves,'Luva nitrílica preta M','NITRILICA-PRETA-M','Barreiras e descartáveis','M',100,'Caixa com 100 luvas = 50 pares','par','cx',50,'EPI para procedimento não estéril','fabricante','https://portaldocliente.descarpack.com.br/luva-nitrilica-powder-free-preta-descarpack.html',3,1,0,0),
(@gloves,'Luva nitrílica preta G','NITRILICA-PRETA-G','Barreiras e descartáveis','G',100,'Caixa com 100 luvas = 50 pares','par','cx',50,'EPI para procedimento não estéril','fabricante','https://portaldocliente.descarpack.com.br/luva-nitrilica-powder-free-preta-descarpack.html',4,1,0,0),
(@gloves,'Luva nitrílica preta GG','NITRILICA-PRETA-GG','Barreiras e descartáveis','GG',100,'Caixa com 100 luvas = 50 pares','par','cx',50,'EPI para procedimento não estéril','fabricante','https://portaldocliente.descarpack.com.br/luva-nitrilica-powder-free-preta-descarpack.html',5,1,0,0);
--> statement-breakpoint
SET @batoques := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Batoques' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='generico'));
--> statement-breakpoint
SET @barriers := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Barreiras do estúdio' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='generico'));
--> statement-breakpoint
SET @cleaning := (SELECT `id` FROM `catalog_product_lines` WHERE `name`='Higienização' AND `brandId`=(SELECT `id` FROM `catalog_brands` WHERE `slug`='generico'));
--> statement-breakpoint
INSERT INTO `catalog_variants` (`lineId`,`name`,`sku`,`category`,`format`,`packageQuantity`,`packageUnit`,`baseUnit`,`purchaseUnit`,`unitsPerPackage`,`application`,`evidenceStatus`,`sortOrder`,`isActive`,`createdAt`,`updatedAt`) VALUES
(@batoques,'Batoque P','BATOQUE-P','Batoques e acessórios','P',100,'Pacote configurável','un','pct',100,'Porcionamento individual de pigmento','pendente',1,1,0,0),
(@batoques,'Batoque M','BATOQUE-M','Batoques e acessórios','M',100,'Pacote configurável','un','pct',100,'Porcionamento individual de pigmento','pendente',2,1,0,0),
(@batoques,'Batoque G','BATOQUE-G','Batoques e acessórios','G',100,'Pacote configurável','un','pct',100,'Porcionamento individual de pigmento','pendente',3,1,0,0),
(@batoques,'Batoque GG','BATOQUE-GG','Batoques e acessórios','GG',100,'Pacote configurável','un','pct',100,'Porcionamento individual de pigmento','pendente',4,1,0,0),
(@barriers,'Filme PVC 30 cm × 300 m','FILME-30X300','Barreiras e descartáveis','30 cm',1,'Rolo de 300 m','m','rolo',300,'Barreira e proteção','pendente',1,1,0,0),
(@barriers,'Papel-toalha pacote com 2 rolos','PAPEL-2R','Barreiras e descartáveis','Rolo',2,'Pacote com 2 rolos','rolo','pct',2,'Limpeza durante o procedimento','pendente',2,1,0,0),
(@barriers,'Saco de lixo 15 L','SACO-15L','Barreiras e descartáveis','15 L',100,'Pacote configurável','un','pct',100,'Resíduo comum','pendente',3,1,0,0),
(@barriers,'Saco de lixo 30 L','SACO-30L','Barreiras e descartáveis','30 L',100,'Pacote configurável','un','pct',100,'Resíduo comum','pendente',4,1,0,0),
(@barriers,'Saco de lixo 50 L','SACO-50L','Barreiras e descartáveis','50 L',100,'Pacote configurável','un','pct',100,'Resíduo comum','pendente',5,1,0,0),
(@barriers,'Saco de lixo 100 L','SACO-100L','Barreiras e descartáveis','100 L',100,'Pacote configurável','un','pct',100,'Resíduo comum','pendente',6,1,0,0),
(@cleaning,'Álcool 70% 1 L','ALCOOL70-1L','Higienização e processamento','1 L',1,'Frasco de 1.000 ml','ml','frasco',1000,'Higienização conforme indicação do produto','pendente',1,1,0,0),
(@cleaning,'Hipoclorito 1 L','HIPOCLORITO-1L','Higienização e processamento','1 L',1,'Frasco de 1.000 ml','ml','frasco',1000,'Limpeza conforme diluição e indicação do fabricante','pendente',2,1,0,0),
(@cleaning,'Desinfetante 1 L','DESINFETANTE-1L','Higienização e processamento','1 L',1,'Frasco de 1.000 ml','ml','frasco',1000,'Limpeza de superfícies conforme fabricante','pendente',3,1,0,0),
(@cleaning,'Desinfetante 5 L','DESINFETANTE-5L','Higienização e processamento','5 L',1,'Galão de 5.000 ml','ml','galão',5000,'Limpeza de superfícies conforme fabricante','pendente',4,1,0,0);
