/**
 * db/pool.js — pool de ligações PostgreSQL (node-postgres).
 *
 * Sem ORM: usamos SQL parametrizado ($1, $2, …) através de `query()`.
 */
import pg from 'pg'
import { config } from '../config.js'

const { Pool, types } = pg

// Faz o parse de BIGINT (COUNT, SUM) como Number em vez de string.
types.setTypeParser(20, (value) => (value === null ? null : Number(value)))

const pgPool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.ssl,
  max: config.db.poolSize,
})

pgPool.on('error', (err) => {
  console.error('[db] erro numa ligação inativa do pool (ignorado):', err.message)
})

export async function query(text, params) {
  return pgPool.query(text, params)
}

/** Executa uma função dentro de uma transação, com commit/rollback automáticos. */
export async function withTransaction(fn) {
  const client = await pgPool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export const pool = {
  query,
  withTransaction,
  end: () => pgPool.end(),
}
