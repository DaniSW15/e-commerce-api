import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewsAndProductRating1781138476082 implements MigrationInterface {
  name = 'AddReviewsAndProductRating1781138476082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "comment" text, "userId" uuid NOT NULL, "productId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6bf8ffcec4ea9e0e4108dd9a68f" UNIQUE ("userId", "productId"), CONSTRAINT "PK_67c1501aea1b0633ec441b00bd5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "averageRating" numeric(3,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "reviewCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reviews" ADD CONSTRAINT "FK_964f13abf796aca25d7e5849c64" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reviews" ADD CONSTRAINT "FK_32edd80d91dff1bc19e79c8f16d" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_reviews" DROP CONSTRAINT "FK_32edd80d91dff1bc19e79c8f16d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reviews" DROP CONSTRAINT "FK_964f13abf796aca25d7e5849c64"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "reviewCount"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "averageRating"`,
    );
    await queryRunner.query(`DROP TABLE "product_reviews"`);
  }
}
