/**
 * routes/publish.js — publicação da escala: pré-visualização, emails para
 * líderes/voluntários e exportação em PDF (pdfkit).
 */
import { Router } from 'express'
import PDFDocument from 'pdfkit'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'
import { sendEmail } from '../auth/email.js'
import { escapeHtml } from '../lib/html.js'
import { monthLabel, sundaysOf, shortDate } from '../lib/dates.js'

export const publishRouter = Router()

publishRouter.use(requireRole('admin'))

/** Carrega a estrutura completa da escala de um mês. */
async function loadSchedule(monthId, churchId) {
  const monthRes = await pool.query('SELECT * FROM months WHERE id = $1 AND church_id = $2', [
    monthId,
    churchId,
  ])
  const month = monthRes.rows[0]
  if (!month) throw new HttpError(404, 'Mês não encontrado.')
  const sundays = sundaysOf(month.year, month.month)

  const teams = await pool.query(
    `SELECT t.id, t.name, t.color, l.name AS leader_name, l.email AS leader_email
     FROM teams t LEFT JOIN users l ON l.id = t.leader_id
     WHERE t.church_id = $1 ORDER BY t.sort_order, t.name`,
    [churchId],
  )
  const positions = await pool.query(
    `SELECT p.id, p.team_id, p.name FROM positions p
     JOIN teams t ON t.id = p.team_id WHERE t.church_id = $1
     ORDER BY p.sort_order, p.name`,
    [churchId],
  )
  const assignments = await pool.query(
    `SELECT s.position_id, s.sunday, s.is_manual, u.id AS user_id, u.name AS user_name
     FROM assignments s JOIN users u ON u.id = s.user_id WHERE s.month_id = $1`,
    [monthId],
  )

  const cellByPos = new Map() // positionId -> { sunday: {userId, userName, isManual} }
  for (const a of assignments.rows) {
    const iso = toIso(a.sunday)
    if (!cellByPos.has(a.position_id)) cellByPos.set(a.position_id, {})
    cellByPos.get(a.position_id)[iso] = {
      userId: a.user_id,
      userName: a.user_name,
      isManual: a.is_manual,
    }
  }

  const posByTeam = new Map()
  for (const p of positions.rows) {
    if (!posByTeam.has(p.team_id)) posByTeam.set(p.team_id, [])
    posByTeam.get(p.team_id).push({ id: p.id, name: p.name, cells: cellByPos.get(p.id) || {} })
  }

  return {
    month,
    label: monthLabel(month.year, month.month),
    sundays,
    teams: teams.rows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      leaderName: t.leader_name,
      leaderEmail: t.leader_email,
      positions: posByTeam.get(t.id) || [],
    })),
  }
}

// GET /data/publish/:monthId — pré-visualização.
publishRouter.get(
  '/:monthId',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const schedule = await loadSchedule(req.params.monthId, churchId)

    const scheduledUsers = new Set()
    let manualCount = 0
    for (const team of schedule.teams) {
      for (const pos of team.positions) {
        for (const cell of Object.values(pos.cells)) {
          scheduledUsers.add(cell.userId)
          if (cell.isManual) manualCount += 1
        }
      }
    }

    res.json({
      month: { id: schedule.month.id, label: schedule.label, status: schedule.month.status },
      sundays: schedule.sundays,
      teams: schedule.teams,
      summary: {
        teamCount: schedule.teams.length,
        leaderCount: schedule.teams.filter((t) => t.leaderEmail).length,
        scheduledVolunteers: scheduledUsers.size,
        manualOverrides: manualCount,
      },
    })
  }),
)

// POST /data/publish/:monthId/email-leaders — envia a escala a cada líder.
publishRouter.post(
  '/:monthId/email-leaders',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const schedule = await loadSchedule(req.params.monthId, churchId)

    let sent = 0
    for (const team of schedule.teams) {
      if (!team.leaderEmail) continue
      const text = formatTeamText(team, schedule.sundays)
      await sendEmail({
        to: team.leaderEmail,
        subject: `Escala de ${schedule.label} — ${team.name}`,
        text,
        html: `<pre style="font-family:Barlow,monospace;font-size:14px">${escapeHtml(text)}</pre>`,
      }).catch(() => {})
      sent += 1
    }
    res.json({ ok: true, sent })
  }),
)

// POST /data/publish/:monthId/notify-volunteers — email personalizado por voluntário.
publishRouter.post(
  '/:monthId/notify-volunteers',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const schedule = await loadSchedule(req.params.monthId, churchId)

    // Agrupa por voluntário.
    const byUser = new Map() // userId -> { name, items: [{team, position, sunday}] }
    const emailById = new Map()
    for (const team of schedule.teams) {
      for (const pos of team.positions) {
        for (const [sunday, cell] of Object.entries(pos.cells)) {
          if (!byUser.has(cell.userId)) byUser.set(cell.userId, { name: cell.userName, items: [] })
          byUser.get(cell.userId).items.push({ team: team.name, position: pos.name, sunday })
        }
      }
    }
    const ids = [...byUser.keys()]
    if (ids.length) {
      const emails = await pool.query('SELECT id, email FROM users WHERE id = ANY($1)', [ids])
      for (const row of emails.rows) emailById.set(row.id, row.email)
    }

    let sent = 0
    for (const [userId, data] of byUser.entries()) {
      const email = emailById.get(userId)
      if (!email) continue
      const lines = data.items
        .sort((a, b) => a.sunday.localeCompare(b.sunday))
        .map((i) => `• ${shortDate(i.sunday)} — ${i.team} / ${i.position}`)
      const text = `Olá ${data.name},\n\nA tua escala de ${schedule.label}:\n\n${lines.join('\n')}\n\nObrigado!`
      await sendEmail({
        to: email,
        subject: `A tua escala de ${schedule.label}`,
        text,
        html: `<p>Olá ${escapeHtml(data.name)},</p><p>A tua escala de <strong>${escapeHtml(schedule.label)}</strong>:</p><ul>${data.items
          .map((i) => `<li>${shortDate(i.sunday)} — ${escapeHtml(i.team)} / ${escapeHtml(i.position)}</li>`)
          .join('')}</ul>`,
      }).catch(() => {})
      sent += 1
    }
    res.json({ ok: true, sent })
  }),
)

// GET /data/publish/:monthId/pdf — exporta a escala em PDF.
publishRouter.get(
  '/:monthId/pdf',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const schedule = await loadSchedule(req.params.monthId, churchId)

    const filename = `escala_${schedule.month.year}_${String(schedule.month.month).padStart(2, '0')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 34 })
    doc.pipe(res)
    renderPdf(doc, schedule)
    doc.end()
  }),
)

// ── PDF rendering ───────────────────────────────────────────────────────────

function renderPdf(doc, schedule) {
  const { sundays } = schedule
  const pageLeft = doc.page.margins.left
  const pageRight = doc.page.width - doc.page.margins.right
  const usableWidth = pageRight - pageLeft
  const nameColWidth = 150
  const dateColWidth = (usableWidth - nameColWidth) / Math.max(sundays.length, 1)

  doc.fontSize(18).fillColor('#111827').text(`Escala — ${schedule.label}`, { align: 'left' })
  doc.moveDown(0.5)

  let hasManual = false

  for (const team of schedule.teams) {
    if (team.positions.length === 0) continue

    ensureSpace(doc, 60)
    doc.fontSize(12).fillColor(isHex(team.color) ? team.color : '#334155').text(team.name)
    doc.moveDown(0.2)

    let y = doc.y
    const rowHeight = 18

    // Cabeçalho.
    drawCell(doc, pageLeft, y, nameColWidth, rowHeight, 'Posição', {
      bold: true,
      bg: '#334155',
      color: '#ffffff',
    })
    sundays.forEach((s, i) => {
      drawCell(doc, pageLeft + nameColWidth + i * dateColWidth, y, dateColWidth, rowHeight, shortDate(s), {
        bold: true,
        bg: '#334155',
        color: '#ffffff',
        align: 'center',
      })
    })
    y += rowHeight

    // Linhas.
    team.positions.forEach((pos, idx) => {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        y = doc.y
      }
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      drawCell(doc, pageLeft, y, nameColWidth, rowHeight, pos.name, { bg })
      sundays.forEach((s, i) => {
        const cell = pos.cells[s]
        let label = ''
        if (cell) {
          label = cell.userName
          if (cell.isManual) {
            label += ' *'
            hasManual = true
          }
        }
        drawCell(doc, pageLeft + nameColWidth + i * dateColWidth, y, dateColWidth, rowHeight, label, {
          bg,
          align: 'center',
        })
      })
      y += rowHeight
    })

    doc.y = y + 10
    doc.moveDown(0.5)
  }

  if (hasManual) {
    doc.moveDown(0.5)
    doc.fontSize(8).fillColor('#64748b').text('* alteração manual (cooperador indisponível).')
  }
}

function drawCell(doc, x, y, w, h, text, { bold = false, bg = '#ffffff', color = '#0f172a', align = 'left' } = {}) {
  doc.save()
  doc.rect(x, y, w, h).fill(bg)
  doc.lineWidth(0.4).strokeColor('#cbd5e1').rect(x, y, w, h).stroke()
  doc
    .fillColor(color)
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(7.5)
    .text(text ?? '', x + 3, y + 5, { width: w - 6, height: h - 4, align, ellipsis: true })
  doc.restore()
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage()
  }
}

function formatTeamText(team, sundays) {
  const lines = [`Escala — ${team.name}`, '']
  for (const pos of team.positions) {
    lines.push(pos.name + ':')
    for (const s of sundays) {
      const cell = pos.cells[s]
      lines.push(`  ${shortDate(s)}: ${cell ? cell.userName + (cell.isManual ? ' (manual)' : '') : '—'}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function isHex(c) {
  return /^#[0-9a-fA-F]{6}$/.test(c || '')
}

function toIso(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}
