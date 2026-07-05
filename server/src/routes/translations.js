/**
 * routes/translations.js — gestão de traduções (overrides sobre o dicionário
 * base do frontend). GET /public é acessível sem sessão para a UI de entrada.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { requireOrgAdmin } from '../middleware/auth.js'

export const translationsRouter = Router()

// GET /data/translations/public — overrides agrupados por idioma (sem sessão).
translationsRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT key, language, value FROM translations')
    const byLang = {}
    for (const r of rows) {
      byLang[r.language] = byLang[r.language] || {}
      byLang[r.language][r.key] = r.value
    }
    res.json({ overrides: byLang })
  }),
)

translationsRouter.use(requireOrgAdmin)

// GET /data/translations?lang= — lista overrides.
translationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const lang = (req.query.lang || '').toString().trim()
    const params = []
    let where = ''
    if (lang) {
      params.push(lang)
      where = 'WHERE language = $1'
    }
    const { rows } = await pool.query(
      `SELECT id, key, language, value FROM translations ${where} ORDER BY key, language`,
      params,
    )
    const languages = await pool.query('SELECT DISTINCT language FROM translations ORDER BY language')
    res.json({
      translations: rows.map((r) => ({ id: r.id, key: r.key, language: r.language, value: r.value })),
      languages: languages.rows.map((r) => r.language),
    })
  }),
)

const upsertSchema = z.object({
  key: z.string().trim().min(1, 'A chave é obrigatória.'),
  language: z.string().trim().min(2, 'Idioma inválido.'),
  value: z.string(),
})

// POST /data/translations — cria/atualiza um override.
translationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body)
    const { rows } = await pool.query(
      `INSERT INTO translations (key, language, value) VALUES ($1, $2, $3)
       ON CONFLICT (key, language) DO UPDATE SET value = EXCLUDED.value
       RETURNING id, key, language, value`,
      [data.key, data.language, data.value],
    )
    res.status(201).json({ translation: rows[0] })
  }),
)

// DELETE /data/translations/:id — apaga um override.
translationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Tradução')
    await pool.query('DELETE FROM translations WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  }),
)

// POST /data/translations/add-language — semeia um idioma com um conjunto de chaves.
const addLangSchema = z.object({
  language: z.string().trim().min(2, 'Idioma inválido.'),
  sourceLanguage: z.string().trim().optional().default('pt-PT'),
  keys: z.array(z.string()).optional().default([]),
})

translationsRouter.post(
  '/add-language',
  asyncHandler(async (req, res) => {
    const { language, sourceLanguage, keys } = addLangSchema.parse(req.body)

    // Chaves a semear: as fornecidas + as existentes no idioma de origem.
    const source = await pool.query('SELECT key, value FROM translations WHERE language = $1', [
      sourceLanguage,
    ])
    const seed = new Map()
    for (const k of keys) seed.set(k, '')
    for (const r of source.rows) if (!seed.has(r.key)) seed.set(r.key, '')

    if (seed.size === 0) throw new HttpError(400, 'Sem chaves para semear o novo idioma.')

    let created = 0
    await pool.withTransaction(async (client) => {
      for (const [key, value] of seed.entries()) {
        const r = await client.query(
          `INSERT INTO translations (key, language, value) VALUES ($1, $2, $3)
           ON CONFLICT (key, language) DO NOTHING RETURNING id`,
          [key, language, value],
        )
        if (r.rows[0]) created += 1
      }
    })
    res.status(201).json({ ok: true, created })
  }),
)
