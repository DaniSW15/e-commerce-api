import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWishlist1781140109749 implements MigrationInterface {
  name = 'AddWishlist1781140109749';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wishlists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4f3c30555daa6ab0b70a1db772c" UNIQUE ("userId"), CONSTRAINT "PK_d0a37f2848c5d268d315325f359" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "wishlist_products" ("wishlistId" uuid NOT NULL, "productId" uuid NOT NULL, CONSTRAINT "PK_3df342f184769b72b659a3f0bfa" PRIMARY KEY ("wishlistId", "productId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1093804660d48f293c2cfd1665" ON "wishlist_products"  ("wishlistId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ac7763bf2cb10e44ba0f0b7a1" ON "wishlist_products"  ("productId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlists" ADD CONSTRAINT "FK_4f3c30555daa6ab0b70a1db772c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_products" ADD CONSTRAINT "FK_1093804660d48f293c2cfd16658" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_products" ADD CONSTRAINT "FK_2ac7763bf2cb10e44ba0f0b7a1c" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wishlist_products" DROP CONSTRAINT "FK_2ac7763bf2cb10e44ba0f0b7a1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_products" DROP CONSTRAINT "FK_1093804660d48f293c2cfd16658"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlists" DROP CONSTRAINT "FK_4f3c30555daa6ab0b70a1db772c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2ac7763bf2cb10e44ba0f0b7a1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1093804660d48f293c2cfd1665"`,
    );
    await queryRunner.query(`DROP TABLE "wishlist_products"`);
    await queryRunner.query(`DROP TABLE "wishlists"`);
  }
}
