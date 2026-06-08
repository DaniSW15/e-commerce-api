# Contributing to E-Commerce API

¡Gracias por tu interés en contribuir! 🎉

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [¿Cómo puedo contribuir?](#cómo-puedo-contribuir)
- [Proceso de Desarrollo](#proceso-de-desarrollo)
- [Guía de Estilo](#guía-de-estilo)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

---

## 📜 Código de Conducta

Este proyecto adhiere al [Contributor Covenant](https://www.contributor-covenant.org/). Al participar, se espera que mantengas un ambiente respetuoso y profesional.

---

## 🚀 ¿Cómo puedo contribuir?

### Reportar Bugs

1. **Verifica** que el bug no haya sido reportado antes en [Issues](https://github.com/yourusername/ecommerce-api/issues)
2. Usa el template de **Bug Report**
3. Incluye:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Stack trace completo
   - Versión de Node.js, PostgreSQL, Redis

### Proponer Features

1. Abre un **Feature Request** en Issues
2. Describe:
   - El problema que resuelve
   - Propuesta de solución
   - Alternativas consideradas
   - Impacto en el código existente

### Mejorar Documentación

- Errores tipográficos
- Aclaraciones
- Ejemplos adicionales
- Traducciones

---

## 🛠️ Proceso de Desarrollo

### Setup Inicial

```bash
# 1. Fork y clone
git clone https://github.com/your-username/ecommerce-api.git
cd ecommerce-api

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Editar .env con tus credenciales

# 4. Start database
docker-compose up -d

# 5. Run migrations
npm run migration:run

# 6. Start dev server
npm run start:dev
```

### Workflow

```bash
# 1. Crear branch desde develop
git checkout develop
git pull origin develop
git checkout -b feature/mi-feature

# 2. Hacer cambios y commits
git add .
git commit -m "feat: descripción del cambio"

# 3. Asegurar que tests pasan
npm run test
npm run test:e2e
npm run lint

# 4. Push y crear PR
git push origin feature/mi-feature
```

### Branch Naming

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Feature | `feature/descripcion` | `feature/add-wishlist` |
| Bug Fix | `fix/descripcion` | `fix/auth-token-expiration` |
| Hotfix | `hotfix/descripcion` | `hotfix/security-patch` |
| Docs | `docs/descripcion` | `docs/update-readme` |
| Refactor | `refactor/descripcion` | `refactor/extract-validation` |

### Commit Messages

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Formato
<type>[optional scope]: <description>

# Types válidos
feat:     Nueva feature
fix:      Bug fix
docs:     Cambios en documentación
style:    Formateo (no afecta código)
refactor: Refactoring (sin cambio de funcionalidad)
perf:     Mejora de performance
test:     Agregar/modificar tests
chore:    Tareas de mantenimiento
ci:       Cambios en CI/CD

# Ejemplos
feat(auth): add password reset via email
fix(orders): prevent duplicate order creation
docs(api): update authentication endpoints
test(products): add e2e tests for search
```

---

## 🎨 Guía de Estilo

### TypeScript

```typescript
// ✅ Usar tipos explícitos
function getUserById(id: string): Promise<User> {
  return this.userRepository.findOne({ where: { id } });
}

// ❌ Evitar any
function processData(data: any) { }

// ✅ Preferir interfaces para objetos
interface CreateUserDto {
  email: string;
  password: string;
}

// ✅ Usar readonly cuando sea apropiado
class UserService {
  constructor(
    private readonly userRepository: Repository<User>,
  ) {}
}
```

### NestJS Conventions

```typescript
// ✅ Decoradores claros
@Controller('products')
export class ProductsController {
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}

// ✅ DTOs con validación
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

### Naming Conventions

```typescript
// Classes: PascalCase
class UserService { }
class ProductRepository { }

// Files: kebab-case
user.service.ts
create-product.dto.ts
jwt-auth.guard.ts

// Constants: UPPER_SNAKE_CASE
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

// Variables/Functions: camelCase
const currentUser = getUser();
async function validateToken() { }
```

---

## 🧪 Testing

### Tests Requeridos

Todo PR debe incluir tests:

```typescript
// Unit test
describe('UserService', () => {
  it('should create a new user', async () => {
    const dto = { email: 'test@example.com', password: 'Pass123!' };
    const result = await service.create(dto);
    
    expect(result).toBeDefined();
    expect(result.email).toBe(dto.email);
  });
});

// E2E test
describe('POST /auth/register', () => {
  it('should register a new user', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'Pass123!' })
      .expect(201)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
      });
  });
});
```

### Coverage Mínimo

- **Unit tests:** 80% de cobertura
- **E2E tests:** Flujos críticos cubiertos (auth, checkout, payments)

```bash
# Verificar coverage
npm run test:cov

# Debe pasar
npm run test
npm run test:e2e
npm run lint
```

---

## 📬 Pull Request Process

### Checklist

Antes de crear el PR:

- [ ] Código sigue las convenciones del proyecto
- [ ] Tests agregados/modificados
- [ ] Todos los tests pasan (`npm test && npm run test:e2e`)
- [ ] Lint pasa (`npm run lint`)
- [ ] Documentación actualizada (si aplica)
- [ ] Commits siguen Conventional Commits
- [ ] Branch actualizado con `develop`

### Template del PR

```markdown
## Descripción
[Descripción clara de los cambios]

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva feature
- [ ] Breaking change
- [ ] Documentación

## Testing
- [ ] Unit tests agregados
- [ ] E2E tests agregados
- [ ] Tests manuales realizados

## Checklist
- [ ] Código sigue style guidelines
- [ ] Self-review realizado
- [ ] Documentación actualizada
- [ ] Sin warnings de lint
- [ ] Tests pasan localmente
```

### Review Process

1. **Automated Checks:** CI debe pasar (lint, tests, build)
2. **Code Review:** Al menos 1 aprobación requerida
3. **Testing:** Revisor verifica tests
4. **Merge:** Squash merge a `develop`

### Post-Merge

- Branch de feature se elimina automáticamente
- Deploy a staging se ejecuta automáticamente
- Verificar que staging funciona correctamente

---

## 🏷️ Versioning

Seguimos [Semantic Versioning](https://semver.org/):

- **MAJOR:** Cambios incompatibles en API
- **MINOR:** Nueva funcionalidad compatible
- **PATCH:** Bug fixes compatibles

```bash
# Ejemplo de release
v1.2.3
│ │ │
│ │ └─ Patch (bug fixes)
│ └─── Minor (new features)
└───── Major (breaking changes)
```

---

## ❓ Preguntas

Si tienes dudas:

1. Revisa la [documentación](../README.md)
2. Busca en [Issues cerrados](https://github.com/yourusername/ecommerce-api/issues?q=is%3Aissue+is%3Aclosed)
3. Abre un nuevo Issue con la etiqueta `question`

---

## 🙏 Agradecimientos

¡Gracias por contribuir al proyecto! Cada contribución, sin importar su tamaño, es valiosa.

---

**Happy Coding! 🚀**
