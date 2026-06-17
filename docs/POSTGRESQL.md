# 🗄️ Guía de PostgreSQL (Local vs Docker) y Reset de Base de Datos

Este documento explica cómo está configurada la base de datos PostgreSQL en tu entorno de desarrollo, la diferencia entre la instancia local y la de Docker, y cómo limpiar (resetear) la base de datos desde cero.

---

## 🔍 Entendiendo tu Entorno (Local vs Docker)

En tu máquina local, tienes dos instancias de PostgreSQL compitiendo por el puerto `5432`:

1. **Postgres Local (macOS Service):**
   * Se ejecuta directamente en tu Mac como un servicio del sistema.
   * Tu archivo `.env` usa `DB_HOST=localhost`, lo que hace que tu servidor NestJS se conecte a esta instancia local.
   * **Usuario:** `ecommerce` (o `postgres`)
   * **Base de Datos:** `ecommerce_dev`

2. **Postgres en Docker (`docker-compose`):**
   * Se ejecuta dentro de un contenedor aislado de Docker.
   * Se configura en tu `docker-compose.yml`.
   * **Usuario:** `ecommerce`
   * **Password:** `password`
   * **Base de Datos:** `ecommerce_dev`

### ¿Cómo saber a cuál estás conectado?
Puedes ver qué procesos están escuchando en el puerto `5432` con este comando en la terminal:
```bash
lsof -i :5432
```
* Si ves un proceso llamado `postgres` ejecutado por tu usuario de macOS, es la **instancia local**.
* Si ves un proceso llamado `com.docker` o similar, es la **instancia de Docker**.

---

## 🗑️ Cómo Limpiar la Base de Datos desde Cero

Dependiendo de a qué base de datos quieras aplicar el reset, usa uno de los siguientes métodos:

### Método A: Resetear la Base de Datos Local de tu Mac (La que usa tu Backend)

Dado que tu NestJS se conecta al Postgres local de tu Mac, para vaciarla por completo y volver a iniciar desde cero ejecuta en tu terminal:

1. **Eliminar y recrear el esquema `public`:**
   ```bash
   PGPASSWORD=change_me_in_production psql -h localhost -U ecommerce -d ecommerce_dev -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
   *(Este comando elimina todas las tablas, relaciones, tipos de datos y registros al instante).*

2. **Ejecutar las migraciones para crear las tablas vacías:**
   ```bash
   npm run migration:run
   ```

---

### Método B: Resetear la Base de Datos de Docker (Contenedor)

Si en el futuro cambias tu `.env` para usar el Postgres de Docker (por ejemplo, cambiando `DB_PASSWORD=password`), la forma más rápida de resetearla es:

1. **Apagar los contenedores y eliminar sus volúmenes persistentes:**
   ```bash
   docker compose down -v
   ```
   *(El flag `-v` elimina el disco virtual `postgres_data` donde se guardan los datos).*

2. **Iniciar los contenedores de nuevo (crea una base de datos vacía):**
   ```bash
   docker compose up -d
   ```

3. **Ejecutar las migraciones:**
   ```bash
   npm run migration:run
   ```

---

## 💡 Comandos Útiles de PostgreSQL en la Terminal

### 1. Entrar a la consola interactiva (`psql`)
* **A la base de datos local:**
  ```bash
  PGPASSWORD=change_me_in_production psql -h localhost -U ecommerce -d ecommerce_dev
  ```
* **A la base de datos de Docker:**
  ```bash
  docker compose exec postgres psql -U ecommerce -d ecommerce_dev
  ```

### 2. Comandos útiles dentro de `psql`
Una vez dentro de la terminal de Postgres (`ecommerce_dev=#`), puedes usar:
* `\dt` : Listar todas las tablas.
* `\d nombre_tabla` : Ver la estructura de una tabla específica.
* `\dx` : Listar extensiones instaladas (como `uuid-ossp`).
* `\q` : Salir de la terminal de Postgres y regresar a la de macOS.
