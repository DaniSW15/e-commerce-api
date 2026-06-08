# 🚀 Quick Start - Deploy to Railway

**Deployment rápido y GRATIS ($5/mes de crédito) en Railway**

---

## ⚡ Inicio Rápido (5 minutos)

### 1. Ejecutar script de setup

```bash
./scripts/railway-setup.sh
```

Este script:
- ✅ Verifica archivos de configuración
- ✅ Genera JWT secrets
- ✅ Verifica Git status
- ✅ Muestra próximos pasos

### 2. Push a GitHub

```bash
git add .
git commit -m "feat: ready for Railway deployment"
git push -u origin main
```

### 3. Deploy en Railway

1. **Ir a:** https://railway.app/new
2. **Click:** "Deploy from GitHub repo"
3. **Seleccionar:** Tu repositorio `ecommerce-api`
4. **Agregar PostgreSQL:** Click "+ New" → Database → PostgreSQL
5. **Agregar Redis:** Click "+ New" → Database → Redis

### 4. Configurar Variables de Entorno

Railway Dashboard → Tu servicio → **"Variables"** → **"Raw Editor"**:

```bash
NODE_ENV=production
PORT=3000

# Database (auto-filled)
DATABASE_URL=${{DATABASE_URL}}
DATABASE_SYNC=false

# Redis (auto-filled)
REDIS_URL=${{REDIS_URL}}

# JWT (copiar del script)
JWT_SECRET=tu-secret-generado-por-el-script
JWT_REFRESH_SECRET=tu-refresh-secret-generado

# Storage
USE_LOCAL_STORAGE=true

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 5. Obtener Stripe Keys (Test)

1. **Registro:** https://dashboard.stripe.com/register
2. **API Keys:** Dashboard → Developers → API keys
3. **Copiar:** Secret key (sk_test_xxx)
4. **Webhook:** Developers → Webhooks → Add endpoint
   - URL: `https://tu-app.railway.app/api/v1/webhooks/stripe`
   - Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 6. Verificar Deployment

```bash
# Health check
curl https://tu-app.railway.app/health

# Debe responder:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

## 📚 Documentación Completa

Para guía detallada, ver: **[docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md)**

Incluye:
- Troubleshooting
- Migraciones de base de datos
- Monitoreo y logs
- Custom domains
- Costos y optimización

---

## 💰 Costo

```
$5 USD/mes GRATIS (crédito permanente)

Tu proyecto usará ~$4.50/mes:
✅ API Service: ~$3/mes
✅ PostgreSQL: ~$1/mes
✅ Redis: ~$0.50/mes

= GRATIS mientras no superes $5/mes
```

---

## 🆘 Ayuda Rápida

**Build fails:**
```bash
# Ver logs
Railway Dashboard → Deployments → Ver logs

# Verificar local
npm run build
```

**App crashes:**
```bash
# Verificar variables
Railway Dashboard → Variables

# Verificar DATABASE_URL y REDIS_URL están configurados
```

**Database error:**
```bash
# Ejecutar migraciones
railway run npm run migration:run
```

---

## ✅ Checklist

- [ ] Script ejecutado (`./scripts/railway-setup.sh`)
- [ ] Código en GitHub
- [ ] Proyecto creado en Railway
- [ ] PostgreSQL agregado
- [ ] Redis agregado
- [ ] Variables configuradas
- [ ] JWT secrets copiados
- [ ] Stripe keys agregadas
- [ ] Health check responde

---

**¡Listo! Tu API está en producción 🎉**

**URL:** https://tu-app.railway.app
