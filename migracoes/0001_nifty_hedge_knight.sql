PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rolagens` (
	`id` text PRIMARY KEY NOT NULL,
	`campanha_id` text,
	`ficha_id` text,
	`usuario_id` text,
	`em` integer NOT NULL,
	`autor` text NOT NULL,
	`rotulo` text DEFAULT '' NOT NULL,
	`det` text NOT NULL,
	`total` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_rolagens`("id", "campanha_id", "ficha_id", "usuario_id", "em", "autor", "rotulo", "det", "total") SELECT "id", "campanha_id", NULL, NULL, "em", "autor", '', "det", "total" FROM `rolagens`;--> statement-breakpoint
DROP TABLE `rolagens`;--> statement-breakpoint
ALTER TABLE `__new_rolagens` RENAME TO `rolagens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `rolagens_campanha` ON `rolagens` (`campanha_id`,`em`);--> statement-breakpoint
CREATE INDEX `rolagens_ficha` ON `rolagens` (`ficha_id`,`em`);