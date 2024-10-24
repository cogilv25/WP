DROP TABLE IF EXISTS `pang_highscore`;
DROP TABLE IF EXISTS `pang_user`;
-- -----------------------------------------------------
-- Table `user`
-- -----------------------------------------------------
CREATE TABLE `pang_user` (
	`id` INT NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(20) NOT NULL,
    `provider_uid` VARCHAR(512) NOT NULL,
    `name` VARCHAR(10) NOT NULL,
    `avatar` VARCHAR(512) NOT NULL,
    PRIMARY KEY(`id`),
    CONSTRAINT `unique_provider_id`
        UNIQUE(`provider`, `provider_uid`)
);

-- -----------------------------------------------------
-- Table `highscore`
-- -----------------------------------------------------
CREATE TABLE `pang_highscore` (
	`id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `score` INT NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_highscore_has_user`
		FOREIGN KEY (`user_id`)
        REFERENCES `pang_user`(`id`)
);