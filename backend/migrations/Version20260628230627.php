<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260628230627 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE bottle_log (amount_ml INT NOT NULL, milk_type VARCHAR(20) DEFAULT \'breastmilk\' NOT NULL, note LONGTEXT DEFAULT NULL, id BINARY(16) NOT NULL, occurred_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, server_seq BIGINT NOT NULL, user_id BINARY(16) NOT NULL, INDEX IDX_488B0023A76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE nursing_log (side VARCHAR(10) NOT NULL, duration_minutes INT DEFAULT NULL, note LONGTEXT DEFAULT NULL, id BINARY(16) NOT NULL, occurred_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, server_seq BIGINT NOT NULL, user_id BINARY(16) NOT NULL, INDEX IDX_611D5D4CA76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE pumping_log (amount_ml INT NOT NULL, side VARCHAR(10) DEFAULT NULL, storage_location VARCHAR(10) DEFAULT NULL, note LONGTEXT DEFAULT NULL, id BINARY(16) NOT NULL, occurred_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, server_seq BIGINT NOT NULL, user_id BINARY(16) NOT NULL, INDEX IDX_606B38C2A76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE weight_log (weight_grams INT NOT NULL, note LONGTEXT DEFAULT NULL, id BINARY(16) NOT NULL, occurred_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, server_seq BIGINT NOT NULL, user_id BINARY(16) NOT NULL, INDEX IDX_6BBB9E9CA76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE bottle_log ADD CONSTRAINT FK_488B0023A76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id)');
        $this->addSql('ALTER TABLE nursing_log ADD CONSTRAINT FK_611D5D4CA76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id)');
        $this->addSql('ALTER TABLE pumping_log ADD CONSTRAINT FK_606B38C2A76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id)');
        $this->addSql('ALTER TABLE weight_log ADD CONSTRAINT FK_6BBB9E9CA76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE bottle_log DROP FOREIGN KEY FK_488B0023A76ED395');
        $this->addSql('ALTER TABLE nursing_log DROP FOREIGN KEY FK_611D5D4CA76ED395');
        $this->addSql('ALTER TABLE pumping_log DROP FOREIGN KEY FK_606B38C2A76ED395');
        $this->addSql('ALTER TABLE weight_log DROP FOREIGN KEY FK_6BBB9E9CA76ED395');
        $this->addSql('DROP TABLE bottle_log');
        $this->addSql('DROP TABLE nursing_log');
        $this->addSql('DROP TABLE pumping_log');
        $this->addSql('DROP TABLE weight_log');
    }
}
