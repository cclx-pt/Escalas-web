/**
 * db/seed.js — garante a organização de sistema, uma igreja e o admin inicial.
 *
 * Passwordless: o admin entra por código OTP enviado ao email configurado.
 * Executar com `npm run db:seed` (depois de `db:migrate`).
 */
import { config } from '../config.js'
import { pool } from './pool.js'

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function seed() {
  const orgName = config.seed.orgName
  const churchName = config.seed.churchName
  const email = config.seed.adminEmail.toLowerCase().trim()
  const name = config.seed.adminName

  // Organização de sistema.
  const org = await pool.query(
    `INSERT INTO organizations (name, slug, is_system)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [orgName, slugify(orgName)],
  )
  const orgId = org.rows[0].id

  // Igreja inicial.
  const church = await pool.query(
    `INSERT INTO churches (organization_id, name, slug, is_system)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [orgId, churchName, slugify(churchName)],
  )
  const churchId = church.rows[0].id

  // Admin inicial (aprovado, org admin).
  await pool.query(
    `INSERT INTO users (church_id, name, email, role, is_active, is_org_admin, approved_at)
     VALUES ($1, $2, $3, 'admin', TRUE, TRUE, now())
     ON CONFLICT (email) DO UPDATE SET
       role = 'admin', is_active = TRUE, is_org_admin = TRUE,
       approved_at = COALESCE(users.approved_at, now()), name = EXCLUDED.name`,
    [churchId, name, email],
  )

  console.log(`[db] Organização "${orgName}", igreja "${churchName}" e admin "${email}" garantidos.`)
}

seed()
  .catch((err) => {
    console.error('[db] Falha no seed:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
