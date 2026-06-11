import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductSearchIndex1781138062436 implements MigrationInterface {
  name = 'ProductSearchIndex1781138062436';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_products_search_gin" ON "products" USING gin(to_tsvector('spanish', coalesce("name", '') || ' ' || coalesce("description", '')))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_products_search_gin"`);
  }
}
