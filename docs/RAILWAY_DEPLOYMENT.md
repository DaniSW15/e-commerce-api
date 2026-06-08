# 🚂 Railway Deployment Guide - E-Commerce API

Guía completa para deploy en Railway (100% gratis con $5/mes de crédito).

---

## 📋 Tabla de Contenidos

- [Ventajas de Railway](#ventajas-de-railway)
- [Setup Inicial](#setup-inicial)
- [Deploy Paso a Paso](#deploy-paso-a-paso)
- [Configurar Base de Datos](#configurar-base-de-datos)
- [Variables de Entorno](#variables-de-entorno)
- [Monitoreo](#monitoreo)
- [Troubleshooting](#troubleshooting)
- [Costos](#costos)

---

## ✨ Ventajas de Railway

```
✅ $5 USD/mes GRATIS de por vida
✅ PostgreSQL + Redis incluidos
✅ Auto-deploy desde GitHub
✅ SSL automático
✅ Logs en tiempo real
✅ Métricas incluidas
✅ No se duerme (siempre activo)
✅ Custom domains
```

---

## 🚀 Setup Inicial

### 1. Crear Cuenta en Railway

**URL:** https://railway.app

```bash
# Opciones de registro:
1. GitHub (Recomendado)
2. Email
```

**IMPORTANTE:** Conecta con GitHub para auto-deploys.

---

### 2. Verificar Archivos del Proyecto

Tu proyecto ya tiene estos archivos configurados:

```
✅ railway.json          # Configuración de build
✅ nixpacks.toml         # Build system
✅ .env.railway.example  # Template de variables
✅ package.json          # Scripts de npm
```

---

## 📦 Deploy Paso a Paso

### Opción A: Deploy desde GitHub (Recomendado)

#### Paso 1: Push tu código a GitHub

```bash
# Si aún no tienes el repo en GitHub
git add .
git commit -m "feat: preparar deployment para Railway"
git branch -M main
git remote add origin https://github.com/tu-usuario/ecommerce-api.git
git push -u origin main
```

#### Paso 2: Crear Proyecto en Railway

1. Ve a https://railway.app/new
2. Click en **"Deploy from GitHub repo"**
3. Selecciona tu repositorio `ecommerce-api`
4. Railway detectará automáticamente:
   - ✅ Node.js
   - ✅ npm
   - ✅ Build command
   - ✅ Start command

#### Paso 3: Agregar PostgreSQL

1. En tu proyecto de Railway, click **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway creará automáticamente:
   - ✅ Base de datos PostgreSQL
   - ✅ Variable `DATABASE_URL`
   - ✅ Conexión automática

#### Paso 4: Agregar Redis

1. Click **"+ New"** nuevamente
2. Selecciona **"Database"** → **"Add Redis"**
3. Railway creará:
   - ✅ Redis instance
   - ✅ Variable `REDIS_URL`

#### Paso 5: Configurar Variables de Entorno

En Railway Dashboard → Tu servicio → **"Variables"**:

```bash
# Click "Raw Editor" y pega:

NODE_ENV=production
PORT=3000

# Database (auto-filled)
DATABASE_URL=${{DATABASE_URL}}
DATABASE_SYNC=false
DATABASE_LOGGING=false

# Redis (auto-filled)
REDIS_URL=${{REDIS_URL}}
REDIS_TTL=3600

# JWT (IMPORTANTE: Genera nuevos secretos)
JWT_SECRET=GENERA_UN_SECRET_AQUI_CON_EL_COMANDO_ABAJO
JWT_REFRESH_SECRET=GENERA_OTRO_SECRET_DIFERENTE_AQUI
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Storage (usar local por ahora)
USE_LOCAL_STORAGE=true
LOCAL_STORAGE_PATH=/app/uploads

# Stripe (obtén keys de test)
STRIPE_SECRET_KEY=sk_test_tu_key_aqui
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

**Generar JWT Secrets:**
```bash
# En tu terminal local, ejecuta 2 veces:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Paso 6: Deploy Automático

Railway deployará automáticamente cuando:
- ✅ Hagas push a `main`
- ✅ Cambies variables de entorno
- ✅ Agregues servicios

**Ver logs en tiempo real:**
```
Railway Dashboard → Tu servicio → "Deployments" → Ver logs
```

---

### Opción B: Deploy desde CLI

```bash
# 1. Instalar Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Inicializar proyecto
railway init

# 4. Link a proyecto existente (o crear nuevo)
railway link

# 5. Deploy
railway up

# 6. Ver logs
railway logs

# 7. Abrir en navegador
railway open
```

---

## 🗄️ Configurar Base de Datos

### Ejecutar Migraciones

**Opción 1: Desde Railway CLI**
```bash
# Conectar a Railway
railway link

# Ejecutar migraciones
railway run npm run migration:run
```

**Opción 2: Desde Railway Dashboard**
```bash
# Dashboard → Tu servicio → Settings → Deploy Lifecycle
# Add "Release Command":
npm run migration:run
```

### Seed Inicial (Opcional)

```bash
# Crear datos de prueba
railway run npm run seed
```

### Acceder a la Base de Datos

**Opción 1: Railway CLI**
```bash
railway connect postgres
```

**Opción 2: Usar cliente externo (TablePlus, pgAdmin)**
```bash
# Railway Dashboard → PostgreSQL → "Connect"
# Copia las credenciales:
Host: containers-us-west-xxx.railway.app
Port: 5432
Database: railway
User: postgres
Password: xxxxx
```

---

## 🔐 Variables de Entorno Críticas

### Variables Mínimas para Funcionar

```bash
# 1. Database (auto)
DATABASE_URL=${{DATABASE_URL}}

# 2. Redis (auto)
REDIS_URL=${{REDIS_URL}}

# 3. JWT (manual - CRÍTICO)
JWT_SECRET=tu-secret-aqui
JWT_REFRESH_SECRET=tu-refresh-secret-aqui

# 4. Storage (local por ahora)
USE_LOCAL_STORAGE=true

# 5. Stripe (modo test)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Obtener Stripe Keys (Test Mode)

1. Ve a https://dashboard.stripe.com/register
2. Completa registro
3. Ve a **Developers → API keys**
4. Copia:
   - **Secret key** (sk_test_xxx)
5. Ve a **Developers → Webhooks**
6. Click **"Add endpoint"**
7. URL: `https://tu-app.railway.app/api/v1/webhooks/stripe`
8. Eventos: Selecciona `payment_intent.succeeded`, `payment_intent.payment_failed`
9. Copia el **Webhook signing secret**

---

## 📊 Monitoreo

### Health Check

Tu API tiene un endpoint de health:
```bash
# Verificar que funciona
curl https://tu-app.railway.app/health

# Respuesta esperada:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}
```

### Logs en Tiempo Real

**Railway Dashboard:**
```
Tu servicio → "Deployments" → Ver logs
```

**Railway CLI:**
```bash
railway logs --tail 100
```

### Métricas

Railway Dashboard → Tu servicio → "Metrics":
- ✅ CPU usage
- ✅ Memory usage
- ✅ Network traffic
- ✅ Request count

---

## 🚨 Troubleshooting

### Error: "Build failed"

```bash
# Verificar logs de build
Railway Dashboard → Deployments → Ver logs de build

# Causas comunes:
1. npm install falló → Verificar package.json
2. TypeScript errores → Ejecutar npm run build localmente
3. Falta variable de entorno → Agregar en Railway
```

### Error: "Application crashed"

```bash
# Ver logs
railway logs

# Causas comunes:
1. DATABASE_URL no configurado
2. Puerto incorrecto (debe ser process.env.PORT)
3. Migraciones no ejecutadas
```

### Error: "Cannot connect to database"

```bash
# Verificar que PostgreSQL está agregado
Railway Dashboard → Verifica que PostgreSQL aparece

# Verificar DATABASE_URL
railway variables

# Test conexión
railway run npm run typeorm:check
```

### Error: "Redis connection failed"

```bash
# Verificar Redis service
Railway Dashboard → Verifica que Redis aparece

# Verificar REDIS_URL
railway variables

# En tu código, asegúrate de manejar Redis como opcional en desarrollo
```

---

## 💰 Costos

### Plan Gratis ($5/mes de crédito)

```
Incluye:
- $5 USD de crédito GRATIS cada mes
- 500 horas de ejecución
- PostgreSQL pequeño
- Redis pequeño

Tu proyecto consumirá aproximadamente:
- API (Web Service): ~$3/mes
- PostgreSQL: ~$1/mes
- Redis: ~$0.50/mes
---------------
Total: ~$4.50/mes (GRATIS con tu crédito)
```

### Monitorear Uso

```
Railway Dashboard → Account → Usage

Ver:
- Crédito restante
- Uso por servicio
- Proyecciones
```

### Cuando Superes $5/mes

Opciones:
1. **Optimizar:** Reducir recursos
2. **Pagar:** $5-10/mes adicionales
3. **Migrar:** A VPS más económico

---

## 🎯 Checklist de Deployment

Antes de hacer deploy:

- [ ] Código en GitHub
- [ ] Proyecto creado en Railway
- [ ] PostgreSQL agregado
- [ ] Redis agregado
- [ ] Variables de entorno configuradas
- [ ] JWT secrets generados
- [ ] Stripe keys (test mode) obtenidas
- [ ] Build exitoso
- [ ] Health check responde
- [ ] Migraciones ejecutadas
- [ ] Endpoint de test funciona

---

## 🔗 Links Útiles

- **Railway Dashboard:** https://railway.app/dashboard
- **Documentación Railway:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Stripe Test Cards:** https://stripe.com/docs/testing

---

## 📞 Soporte

**Si tienes problemas:**

1. Revisa los logs en Railway Dashboard
2. Verifica variables de entorno
3. Consulta Railway Discord (muy activa)
4. Revisa el [README.md](../README.md) del proyecto

---

## 🚀 Próximos Pasos Después del Deploy

1. **Configurar Custom Domain:**
   - Railway Dashboard → Settings → Domains
   - Agregar tu dominio

2. **Configurar Webhooks de Stripe:**
   - Apuntar a tu URL de Railway

3. **Monitoreo:**
   - Considerar Sentry para errores
   - Configurar alertas

4. **Frontend:**
   - Deploy tu frontend en Vercel
   - Configurar CORS con tu dominio de Railway

---

**¡Listo! Tu API está en producción 🎉**

```bash
# Verifica que funciona:
curl https://tu-app.railway.app/health
curl https://tu-app.railway.app/api/v1/health
```
