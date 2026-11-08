CREATE TABLE `monstros` (
	`id` text PRIMARY KEY NOT NULL,
	`dono_id` text NOT NULL,
	`nome` text NOT NULL,
	`dados` text NOT NULL,
	`imagens` text NOT NULL,
	`criado_em` integer NOT NULL,
	`atualizado` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monstros_dono` ON `monstros` (`dono_id`);