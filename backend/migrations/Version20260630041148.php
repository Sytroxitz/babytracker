<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260630041148 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Child-scoped schema: child / child_membership / invitation; log tables child_id + created_by_id';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE child (id BINARY(16) NOT NULL, name VARCHAR(120) NOT NULL, gender VARCHAR(10) NOT NULL, birth_date DATE NOT NULL, birth_weight_grams INT DEFAULT NULL, sync_counter INT DEFAULT 0 NOT NULL, created_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE child_membership (id BINARY(16) NOT NULL, role VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL, child_id BINARY(16) NOT NULL, user_id BINARY(16) NOT NULL, INDEX IDX_62202CEEDD62C21B (child_id), INDEX IDX_62202CEEA76ED395 (user_id), UNIQUE INDEX uniq_membership_child_user (child_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE invitation (id BINARY(16) NOT NULL, code VARCHAR(16) NOT NULL, created_at DATETIME NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME DEFAULT NULL, child_id BINARY(16) NOT NULL, created_by_id BINARY(16) NOT NULL, used_by_id BINARY(16) DEFAULT NULL, UNIQUE INDEX UNIQ_F11D61A277153098 (code), INDEX IDX_F11D61A2DD62C21B (child_id), INDEX IDX_F11D61A2B03A8386 (created_by_id), INDEX IDX_F11D61A24C2B72A8 (used_by_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE child_membership ADD CONSTRAINT FK_62202CEEDD62C21B FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE child_membership ADD CONSTRAINT FK_62202CEEA76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE invitation ADD CONSTRAINT FK_F11D61A2DD62C21B FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE invitation ADD CONSTRAINT FK_F11D61A2B03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id)');
        $this->addSql('ALTER TABLE invitation ADD CONSTRAINT FK_F11D61A24C2B72A8 FOREIGN KEY (used_by_id) REFERENCES app_user (id)');
        $this->addSql('ALTER TABLE app_user DROP sync_counter');
        $this->addSql('ALTER TABLE bottle_log DROP FOREIGN KEY `FK_488B0023A76ED395`');
        $this->addSql('DROP INDEX uniq_bottle_log_user_seq ON bottle_log');
        $this->addSql('DROP INDEX IDX_488B0023A76ED395 ON bottle_log');
        $this->addSql('ALTER TABLE bottle_log ADD created_by_id BINARY(16) DEFAULT NULL, CHANGE user_id child_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE bottle_log ADD CONSTRAINT FK_488B0023DD62C21B FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE bottle_log ADD CONSTRAINT FK_488B0023B03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_488B0023DD62C21B ON bottle_log (child_id)');
        $this->addSql('CREATE INDEX IDX_488B0023B03A8386 ON bottle_log (created_by_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_bottle_log_child_seq ON bottle_log (child_id, server_seq)');
        $this->addSql('ALTER TABLE nursing_log DROP FOREIGN KEY `FK_611D5D4CA76ED395`');
        $this->addSql('DROP INDEX IDX_611D5D4CA76ED395 ON nursing_log');
        $this->addSql('DROP INDEX uniq_nursing_log_user_seq ON nursing_log');
        $this->addSql('ALTER TABLE nursing_log ADD created_by_id BINARY(16) DEFAULT NULL, CHANGE user_id child_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE nursing_log ADD CONSTRAINT FK_611D5D4CDD62C21B FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE nursing_log ADD CONSTRAINT FK_611D5D4CB03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_611D5D4CDD62C21B ON nursing_log (child_id)');
        $this->addSql('CREATE INDEX IDX_611D5D4CB03A8386 ON nursing_log (created_by_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_nursing_log_child_seq ON nursing_log (child_id, server_seq)');
        $this->addSql('ALTER TABLE pumping_log DROP FOREIGN KEY `FK_606B38C2A76ED395`');
        $this->addSql('DROP INDEX uniq_pumping_log_user_seq ON pumping_log');
        $this->addSql('DROP INDEX IDX_606B38C2A76ED395 ON pumping_log');
        $this->addSql('ALTER TABLE pumping_log ADD created_by_id BINARY(16) DEFAULT NULL, CHANGE user_id child_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE pumping_log ADD CONSTRAINT FK_606B38C2DD62C21B FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE pumping_log ADD CONSTRAINT FK_606B38C2B03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_606B38C2DD62C21B ON pumping_log (child_id)');
        $this->addSql('CREATE INDEX IDX_606B38C2B03A8386 ON pumping_log (created_by_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_pumping_log_child_seq ON pumping_log (child_id, server_seq)');
        $this->addSql('ALTER TABLE weight_log DROP FOREIGN KEY `FK_6BBB9E9CA76ED395`');
        $this->addSql('DROP INDEX uniq_weight_log_user_seq ON weight_log');
        $this->addSql('DROP INDEX IDX_6BBB9E9CA76ED395 ON weight_log');
        $this->addSql('ALTER TABLE weight_log ADD created_by_id BINARY(16) DEFAULT NULL, CHANGE user_id child_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE weight_log ADD CONSTRAINT FK_6BBB9E9CDD62C21B FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE weight_log ADD CONSTRAINT FK_6BBB9E9CB03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_6BBB9E9CDD62C21B ON weight_log (child_id)');
        $this->addSql('CREATE INDEX IDX_6BBB9E9CB03A8386 ON weight_log (created_by_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_weight_log_child_seq ON weight_log (child_id, server_seq)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE child_membership DROP FOREIGN KEY FK_62202CEEDD62C21B');
        $this->addSql('ALTER TABLE child_membership DROP FOREIGN KEY FK_62202CEEA76ED395');
        $this->addSql('ALTER TABLE invitation DROP FOREIGN KEY FK_F11D61A2DD62C21B');
        $this->addSql('ALTER TABLE invitation DROP FOREIGN KEY FK_F11D61A2B03A8386');
        $this->addSql('ALTER TABLE invitation DROP FOREIGN KEY FK_F11D61A24C2B72A8');
        $this->addSql('ALTER TABLE bottle_log DROP FOREIGN KEY FK_488B0023DD62C21B');
        $this->addSql('ALTER TABLE nursing_log DROP FOREIGN KEY FK_611D5D4CDD62C21B');
        $this->addSql('ALTER TABLE pumping_log DROP FOREIGN KEY FK_606B38C2DD62C21B');
        $this->addSql('ALTER TABLE weight_log DROP FOREIGN KEY FK_6BBB9E9CDD62C21B');
        $this->addSql('DROP TABLE child');
        $this->addSql('DROP TABLE child_membership');
        $this->addSql('DROP TABLE invitation');
        $this->addSql('ALTER TABLE app_user ADD sync_counter BIGINT DEFAULT 0 NOT NULL');
        $this->addSql('ALTER TABLE bottle_log DROP FOREIGN KEY FK_488B0023B03A8386');
        $this->addSql('DROP INDEX IDX_488B0023DD62C21B ON bottle_log');
        $this->addSql('DROP INDEX IDX_488B0023B03A8386 ON bottle_log');
        $this->addSql('DROP INDEX uniq_bottle_log_child_seq ON bottle_log');
        $this->addSql('ALTER TABLE bottle_log DROP created_by_id, CHANGE child_id user_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE bottle_log ADD CONSTRAINT `FK_488B0023A76ED395` FOREIGN KEY (user_id) REFERENCES app_user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('CREATE UNIQUE INDEX uniq_bottle_log_user_seq ON bottle_log (user_id, server_seq)');
        $this->addSql('CREATE INDEX IDX_488B0023A76ED395 ON bottle_log (user_id)');
        $this->addSql('ALTER TABLE nursing_log DROP FOREIGN KEY FK_611D5D4CB03A8386');
        $this->addSql('DROP INDEX IDX_611D5D4CDD62C21B ON nursing_log');
        $this->addSql('DROP INDEX IDX_611D5D4CB03A8386 ON nursing_log');
        $this->addSql('DROP INDEX uniq_nursing_log_child_seq ON nursing_log');
        $this->addSql('ALTER TABLE nursing_log DROP created_by_id, CHANGE child_id user_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE nursing_log ADD CONSTRAINT `FK_611D5D4CA76ED395` FOREIGN KEY (user_id) REFERENCES app_user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('CREATE INDEX IDX_611D5D4CA76ED395 ON nursing_log (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_nursing_log_user_seq ON nursing_log (user_id, server_seq)');
        $this->addSql('ALTER TABLE pumping_log DROP FOREIGN KEY FK_606B38C2B03A8386');
        $this->addSql('DROP INDEX IDX_606B38C2DD62C21B ON pumping_log');
        $this->addSql('DROP INDEX IDX_606B38C2B03A8386 ON pumping_log');
        $this->addSql('DROP INDEX uniq_pumping_log_child_seq ON pumping_log');
        $this->addSql('ALTER TABLE pumping_log DROP created_by_id, CHANGE child_id user_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE pumping_log ADD CONSTRAINT `FK_606B38C2A76ED395` FOREIGN KEY (user_id) REFERENCES app_user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('CREATE UNIQUE INDEX uniq_pumping_log_user_seq ON pumping_log (user_id, server_seq)');
        $this->addSql('CREATE INDEX IDX_606B38C2A76ED395 ON pumping_log (user_id)');
        $this->addSql('ALTER TABLE weight_log DROP FOREIGN KEY FK_6BBB9E9CB03A8386');
        $this->addSql('DROP INDEX IDX_6BBB9E9CDD62C21B ON weight_log');
        $this->addSql('DROP INDEX IDX_6BBB9E9CB03A8386 ON weight_log');
        $this->addSql('DROP INDEX uniq_weight_log_child_seq ON weight_log');
        $this->addSql('ALTER TABLE weight_log DROP created_by_id, CHANGE child_id user_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE weight_log ADD CONSTRAINT `FK_6BBB9E9CA76ED395` FOREIGN KEY (user_id) REFERENCES app_user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('CREATE UNIQUE INDEX uniq_weight_log_user_seq ON weight_log (user_id, server_seq)');
        $this->addSql('CREATE INDEX IDX_6BBB9E9CA76ED395 ON weight_log (user_id)');
    }
}
