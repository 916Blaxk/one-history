CREATE TABLE `campanhas` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`descricao` text NOT NULL,
	`mestre_id` text NOT NULL,
	`codigo` text NOT NULL,
	`criado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campanhas_codigo_unique` ON `campanhas` (`codigo`);--> statement-breakpoint
CREATE TABLE `fichas` (
	`id` text PRIMARY KEY NOT NULL,
	`dono_id` text NOT NULL,
	`campanha_id` text,
	`dados` text NOT NULL,
	`registro` text NOT NULL,
	`foto` text,
	`foto_v` integer DEFAULT 0 NOT NULL,
	`criado_em` integer NOT NULL,
	`atualizado` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fichas_dono` ON `fichas` (`dono_id`);--> statement-breakpoint
CREATE INDEX `fichas_campanha` ON `fichas` (`campanha_id`);--> statement-breakpoint
CREATE TABLE `membros` (
	`campanha_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`papel` text NOT NULL,
	`entrou_em` integer NOT NULL,
	PRIMARY KEY(`campanha_id`, `usuario_id`)
);
--> statement-breakpoint
CREATE INDEX `membros_usuario` ON `membros` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `rolagens` (
	`id` text PRIMARY KEY NOT NULL,
	`campanha_id` text NOT NULL,
	`em` integer NOT NULL,
	`autor` text NOT NULL,
	`det` text NOT NULL,
	`total` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rolagens_campanha` ON `rolagens` (`campanha_id`,`em`);--> statement-breakpoint
CREATE TABLE `sessoes` (
	`hash` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`expira` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessoes_usuario` ON `sessoes` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `tentativas` (
	`chave` text PRIMARY KEY NOT NULL,
	`n` integer NOT NULL,
	`ate` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`criado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);