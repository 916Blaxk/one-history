ALTER TABLE `usuarios` ADD `estilo_dado` text;--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_estilo_dado` ON `usuarios` (`estilo_dado`);