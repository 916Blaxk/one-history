CREATE TABLE `mensagens_mesa` (
	`id` text PRIMARY KEY NOT NULL,
	`campanha_id` text NOT NULL,
	`usuario_id` text,
	`autor` text NOT NULL,
	`tipo` text NOT NULL,
	`texto` text NOT NULL,
	`destinatario` text,
	`visivel_para` text,
	`em` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mensagens_mesa_campanha` ON `mensagens_mesa` (`campanha_id`,`em`);--> statement-breakpoint
CREATE TABLE `mesa_imagens` (
	`campanha_id` text NOT NULL,
	`id` text NOT NULL,
	`dados` text NOT NULL,
	PRIMARY KEY(`campanha_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `mesas` (
	`campanha_id` text PRIMARY KEY NOT NULL,
	`estado` text NOT NULL,
	`atualizado` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `rolagens` ADD `expressao` text;--> statement-breakpoint
ALTER TABLE `rolagens` ADD `detalhe` text;