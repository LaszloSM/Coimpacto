# Credimpacto — Fundación CoimpactoB

Ecosistema de **plataforma web + aplicación móvil** para la línea Credimpacto de la Fundación CoimpactoB (https://coimpactob.com): digitalizar los grupos de ahorro y crédito comunitario (ACAP / GLAC) de Colombia — Juntas de Acción Comunal, Consejos Comunitarios étnicos y grupos no formalizados.

El chatbot de WhatsApp actual (n8n + Chatwoot) **se va a retirar**. Todo lo que hacía pasa a la web y a la app, con la información centralizada en la nube.

## Principios no negociables

- **No somos un banco.** La empresa (Credimpacto Tech S.A.S.) es un proveedor de software. Nunca custodia ni capta dinero del público: los fondos viven en una entidad vigilada aliada (SEDPE / banco, modelo BaaS). Ningún diseño, texto o flujo puede insinuar lo contrario.
- **La app es el libro contable del grupo**, no el dueño del dinero. Préstamos internos = acuerdos entre miembros, aprobados por el grupo.
- **Offline-first en móvil.** El tesorero registra aportes en reuniones sin señal; se sincroniza después. Toda escritura debe ser idempotente y auditable.
- **Datos sensibles y dinero:** seguridad por defecto (RLS, mínimo privilegio, sin secretos en código, auditoría de cada cambio). Habeas Data — Ley 1581 de 2012.
- **Usuarios con baja alfabetización digital:** interfaces visuales, simples, basadas en roles (Socio vs Junta: Presidente, Registrador, Portador de Caja, Contadores).

## Diseño aprobado del MVP

**Fuente de verdad:** [docs/designs/credimpacto-mvp-libro-contable.md](docs/designs/credimpacto-mvp-libro-contable.md) (aprobado en /office-hours, 2026-10-05). No construir fuera de su alcance.

- **MVP:** libro contable de la reunión ACAP (aportes, multas, préstamos internos con doble firma, abonos, arqueo, cierre de reunión y de ciclo, comprobantes, consolidado de la Fundación, migración).
- **Stack:** monorepo. Backend **Python Django + Django Ninja** sobre **PostgreSQL** gestionado en la nube (proveedor por decidir). Web **Next.js** = plataforma de administración y monitoreo de la Fundación. **App móvil nativa Expo desde el MVP** (decisión D2, 2026-10-06): reunión offline de la junta y vista de solo lectura del socio (D3). ML y agentes de IA en el mismo Python (sin IA en el MVP).
- **Supabase NO es parte del stack.** El proyecto actual `[proyecto-supabase]` es solo **fuente de migración**: sus RPC `fn_*` son la especificación de las reglas de negocio y sus datos (27 ACAP) se migran por ACAP.
- **Roles:** dos ejes, rol de plataforma (Admin, Dirección, Coordinador territorial, Facilitador de campo, Analista) y cargo por membresía y ciclo (Presidente, Portador de Caja, Registrador, Contador 1 y 2, Miembro). Se llaman **ACAP**.
- **Integridad:** libro solo-agregar, UUID del cliente, un dispositivo escritor por reunión, el servidor es la autoridad, dinero en pesos enteros, firmas de cargos distintos.

## Contexto existente

- Documento de referencia (legal, negocio, arquitectura, reglamentos, T&C): chat de Gemini "Modelo legal para fintech de ahorro comunitario" (PDF entregado por el equipo).
- Mockup analítico: https://coimpacto-b.vercel.app (referencia visual; sus módulos de IA, scoring, proyectos y academia quedan fuera del MVP).

## Stack de skills (usar siempre)

### gstack (Garry Tan) — orquestación y flujo de trabajo — **obligatorio**
Instalado globalmente en `~/.claude/skills/gstack`. Es el marco principal para planear, construir, revisar y lanzar.

- **Idea y planeación:** `/office-hours` (definir qué construir) → `/autoplan` o `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/plan-devex-review`. `/spec` para especificaciones.
- **Diseño:** `/design-consultation`, `/design-shotgun`, `/design-html`, `/design-review`, `/diagram`.
- **Construcción y calidad:** `/review` en cada cambio, `/investigate` para bugs, `/test-audit`, `/deslop-shared-libs`, `/health`, `/benchmark`.
- **Seguridad:** `/cso` (auditoría de seguridad) antes de cada release; `/careful`, `/guard`, `/freeze`/`/unfreeze` al tocar zonas críticas (dinero, auth, migraciones).
- **QA y lanzamiento:** `/qa`, `/qa-only`, `/ship`, `/land-and-deploy`, `/setup-deploy`, `/canary`, `/document-release`, `/retro`.
- **Contexto:** `/context-save`, `/context-restore`, `/learn`.
- Para navegar la web usar `/browse` de gstack; **no** usar las herramientas `mcp__claude-in-chrome__*`.
- Tras `git pull` en `~/.claude/skills/gstack`, volver a ejecutar `./setup` (en Windows copia archivos, no symlinks). Telemetría: `off`.

### Agent Skills (Addy Osmani) — disciplina de ingeniería
En `.claude/skills/`. Destacadas: `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `api-and-interface-design`, `security-and-hardening`, `observability-and-instrumentation`, `documentation-and-adrs` (registrar decisiones de arquitectura), `code-review-and-quality`, `deprecation-and-migration` (retiro del chatbot y de tablas legacy), `ci-cd-and-automation`, `shipping-and-launch`.

### Impeccable (Paul Bakaus) — calidad de diseño
En `.claude/skills/impeccable` + agentes en `.claude/agents/`. **Hooks activos** (`.claude/settings.json`): revisa la UI tras cada Edit/Write y hace un pase profundo al terminar. Ejecutar `/impeccable init` una vez definido el contexto de diseño.

### Taste Skill (Leonxlnx) — criterio estético
En `.claude/skills/`: `taste-skill`, `soft-skill`, `minimalist-skill`, `redesign-skill`, `brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code-skill`, entre otras.

### Emil Kowalski — diseño e interacción
En `.claude/skills/`: `emil-design-eng`, `animate`, `animate-expo` (app móvil), `review-animations`, `improve-animations`, `mobile-native`, `apple-design`, `pick-ui-library`, `prototype`, `break-ui`.

### Ponytail (Dietrich Gebert) — menos código
En `.claude/skills/ponytail*` (solo las skills, sin los hooks del plugin). **Siempre activo**: el cambio más pequeño que resuelve todo, reusar lo que ya existe, nada de abstracciones ni código "para después"; nunca recortar validación, seguridad, accesibilidad ni manejo de errores. `/ponytail-review` y `/ponytail-audit` para revisar.

### Flujo por defecto para cada funcionalidad
1. `/office-hours` o `spec-driven-development` → especificación.
2. `/autoplan` (o las revisiones de plan) → plan aprobado por el equipo.
3. Implementación incremental con TDD.
4. Diseño validado con Impeccable / Taste / Emil; `/design-review`.
5. `/review` + `/cso` → `/qa` → `/ship`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Design System
Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md.

Resumen: metáfora del cuaderno de la ACAP (renglones, corregir = tachado + reverso, sello «Bien contado» al cerrar), arqueo con el color real de cada billete, Atkinson Hyperlegible Next (`tnum`) en campo, Bitter solo en títulos de la oficina, un solo botón naranja por pantalla, solo modo claro. Vista previa: [docs/designs/preview/sistema-de-diseno.html](docs/designs/preview/sistema-de-diseno.html).
