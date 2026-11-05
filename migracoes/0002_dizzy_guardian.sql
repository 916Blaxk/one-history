CREATE TABLE `chaves_integracao` (
	`id` text PRIMARY KEY NOT NULL,
	`ficha_id` text NOT NULL,
	`hash` text NOT NULL,
	`rotulo` text NOT NULL,
	`criado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chaves_integracao_hash_unique` ON `chaves_integracao` (`hash`);--> statement-breakpoint
CREATE INDEX `chaves_integracao_ficha` ON `chaves_integracao` (`ficha_id`);