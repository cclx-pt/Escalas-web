import { test } from 'node:test'
import assert from 'node:assert/strict'

// config.js exige estas variáveis no import; a BD não é contactada nestes testes.
process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { createLoadUser, requireRole, requireApproved } = await import('./auth.js')
const { signSession, SESSION_COOKIE } = await import('../auth/jwt.js')

const CHURCH = '11111111-1111-1111-1111-111111111111'
const OTHER_CHURCH = '22222222-2222-2222-2222-222222222222'

const tokenUser = {
  id: 'u1',
  email: 'a@x.pt',
  name: 'A',
  role: 'admin',
  church_id: CHURCH,
  is_org_admin: false,
  approved_at: new Date(),
}

function fakeRes() {
  return {
    cleared: [],
    statusCode: 200,
    clearCookie(name) {
      this.cleared.push(name)
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json() {
      return this
    },
  }
}

async function run(dbUser, { token = signSession(tokenUser), activeChurchId } = {}) {
  if (activeChurchId) token = signSession(tokenUser, { activeChurchId })
  const loadUser = createLoadUser(async () => dbUser)
  const req = { cookies: { [SESSION_COOKIE]: token } }
  const res = fakeRes()
  let nextErr
  await loadUser(req, res, (err) => {
    nextErr = err
  })
  return { req, res, nextErr }
}

test('loadUser: utilizador ativo mantém a sessão', async () => {
  const { req } = await run({ ...tokenUser, is_active: true })
  assert.equal(req.user.sub, 'u1')
  assert.equal(req.user.role, 'admin')
  assert.equal(req.churchId, CHURCH)
})

test('loadUser: conta desativada perde o acesso de imediato', async () => {
  const { req, res } = await run({ ...tokenUser, is_active: false })
  assert.equal(req.user, null)
  assert.deepEqual(res.cleared, [SESSION_COOKIE])
})

test('loadUser: conta apagada perde o acesso de imediato', async () => {
  const { req } = await run(null)
  assert.equal(req.user, null)
})

test('loadUser: papel despromovido na BD prevalece sobre o do token', async () => {
  const { req } = await run({ ...tokenUser, role: 'volunteer', is_active: true })
  assert.equal(req.user.role, 'volunteer')

  const res = fakeRes()
  let called = false
  requireRole('admin')(req, res, () => {
    called = true
  })
  assert.equal(called, false)
  assert.equal(res.statusCode, 403)
})

test('loadUser: aprovação na BD tem efeito sem novo login', async () => {
  const pendingToken = signSession({ ...tokenUser, role: 'volunteer', approved_at: null })
  const { req } = await run(
    { ...tokenUser, role: 'volunteer', approved_at: new Date(), is_active: true },
    { token: pendingToken },
  )
  let called = false
  requireApproved(req, fakeRes(), () => {
    called = true
  })
  assert.equal(called, true)
})

test('loadUser: igreja ativa é ignorada se já não for org admin', async () => {
  const { req } = await run(
    { ...tokenUser, is_org_admin: false, is_active: true },
    { activeChurchId: OTHER_CHURCH },
  )
  assert.equal(req.churchId, CHURCH)
})

test('loadUser: org admin mantém a igreja ativa', async () => {
  const { req } = await run(
    { ...tokenUser, is_org_admin: true, is_active: true },
    { activeChurchId: OTHER_CHURCH },
  )
  assert.equal(req.churchId, OTHER_CHURCH)
})

test('loadUser: token inválido não autentica', async () => {
  const { req } = await run({ ...tokenUser, is_active: true }, { token: 'lixo' })
  assert.equal(req.user, null)
})
