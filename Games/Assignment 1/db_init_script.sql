-- Schema pang
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `pang`;
CREATE SCHEMA `pang` DEFAULT CHARACTER SET utf8;
USE `pang`;

-- -----------------------------------------------------
-- Table `user`
-- -----------------------------------------------------
CREATE TABLE `user` (
	`id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(16) NOT NULL,
    `token` BINARY(64),
    `expiry` DATETIME,
    PRIMARY KEY(`id`)
);

-- -----------------------------------------------------
-- Table `highscore`
-- -----------------------------------------------------
CREATE TABLE `highscore` (
	`id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `score` INT NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_highscore_has_user`
		FOREIGN KEY (`user_id`)
        REFERENCES `user`(`id`)
);