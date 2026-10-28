import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../hooks/useI18n'
import Schedule from '../pages/Schedule'
import Volunteers from '../pages/Volunteers'
import TeamDetail from '../pages/TeamDetail'

const ana = { id: 'u-ana', name: 'Ana', availability: {} }
const bruno = { id: 'u-bruno', name: 'Bruno', availability: {} }

vi.mock('../services/api', () => ({
  translationsApi: { listPublic: () => Promise.resolve({ overrides: {} }) },
  scheduleApi: {
    get: () =>
      Promise.resolve({
        month: {
          id: 'm1',
          label: 'Novembro 2026',
          status: 'scheduling',
          sundays: ['2026-11-01', '2026-11-08'],
        },
        teams: [
          {
            id: 't1',
            name: 'Louvor',
            color: '#e11d48',
            positions: [{ id: 'p1', name: 'Guitarra' }],
            members: [ana, bruno],
            assignments: {},
          },
        ],
        conflicts: [],
      }),
  },
  teamsApi: {
    list: () => Promise.resolve({ teams: [] }),
    get: () =>
      Promise.resolve({
        team: {
          id: 't1',
          name: 'Louvor',
          color: '#e11d48',
          leaderId: null,
          planningPriority: 50,
          sortOrder: 100,
        },
        positions: [{ id: 'p1', name: 'Guitarra' }],
        members: [ana],
        available: [bruno],
      }),
  },
  volunteersApi: {
    list: () =>
      Promise.resolve({
        volunteers: [
          {
            id: 'u-ana',
            name: 'Ana',
            email: 'ana@x.pt',
            role: 'volunteer',
            isActive: true,
            teams: [],
          },
        ],
      }),
  },
}))

function renderPage(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  )
}

describe('nomes acessíveis', () => {
  it('editor de escala: cada seletor diz a posição e o domingo', async () => {
    renderPage(<Schedule id="m1" />)
    expect(await screen.findByRole('combobox', { name: 'Guitarra, 01/11' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Guitarra, 08/11' })).toBeInTheDocument()
    // O nome da equipa fica logo abaixo do h1 da página.
    expect(screen.getByRole('heading', { level: 2, name: 'Louvor' })).toBeInTheDocument()
  })

  it('cooperadores: interruptor e botões de ícone identificam a pessoa', async () => {
    renderPage(<Volunteers />)
    expect(await screen.findByRole('switch', { name: 'Ativo: Ana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Ana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apagar cooperador: Ana' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por equipa' })).toBeInTheDocument()
  })

  it('detalhe da equipa: remover posição/membro e seletores têm nome', async () => {
    renderPage(<TeamDetail id="t1" />)
    expect(await screen.findByRole('button', { name: 'Remover Guitarra' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover Ana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar posição' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nome da posição' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Líder' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Adicionar membro' })).toBeInTheDocument()
  })

  it('nenhum botão das páginas fica sem nome', async () => {
    for (const page of [
      <Schedule key="s" id="m1" />,
      <Volunteers key="v" />,
      <TeamDetail key="t" id="t1" />,
    ]) {
      const { unmount } = renderPage(page)
      await screen.findAllByRole('button')
      // Espera pelos dados (o loader não tem botões com ícone).
      await new Promise((r) => setTimeout(r, 0))
      for (const btn of screen.queryAllByRole('button')) {
        const name =
          btn.getAttribute('aria-label') || btn.textContent.trim() || btn.getAttribute('title')
        expect(name, btn.outerHTML).toBeTruthy()
      }
      unmount()
    }
  })
})
