<?php
declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261004120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add child height measurements';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE height_log (height_mm INT NOT NULL, note LONGTEXT DEFAULT NULL, id BINARY(16) NOT NULL, occurred_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, server_seq BIGINT NOT NULL, child_id BINARY(16) NOT NULL, created_by_id BINARY(16) DEFAULT NULL, INDEX IDX_HEIGHT_LOG_CHILD (child_id), INDEX IDX_HEIGHT_LOG_CREATOR (created_by_id), UNIQUE INDEX uniq_height_log_child_seq (child_id, server_seq), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE height_log ADD CONSTRAINT FK_HEIGHT_LOG_CHILD FOREIGN KEY (child_id) REFERENCES child (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE height_log ADD CONSTRAINT FK_HEIGHT_LOG_CREATOR FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE height_log');
    }
}
