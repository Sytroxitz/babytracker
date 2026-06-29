<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260628235907 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE UNIQUE INDEX uniq_bottle_log_user_seq ON bottle_log (user_id, server_seq)');
        $this->addSql('CREATE UNIQUE INDEX uniq_nursing_log_user_seq ON nursing_log (user_id, server_seq)');
        $this->addSql('CREATE UNIQUE INDEX uniq_pumping_log_user_seq ON pumping_log (user_id, server_seq)');
        $this->addSql('CREATE UNIQUE INDEX uniq_weight_log_user_seq ON weight_log (user_id, server_seq)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP INDEX uniq_bottle_log_user_seq ON bottle_log');
        $this->addSql('DROP INDEX uniq_nursing_log_user_seq ON nursing_log');
        $this->addSql('DROP INDEX uniq_pumping_log_user_seq ON pumping_log');
        $this->addSql('DROP INDEX uniq_weight_log_user_seq ON weight_log');
    }
}
