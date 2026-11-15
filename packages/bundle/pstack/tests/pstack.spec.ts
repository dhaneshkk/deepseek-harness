/**
 * The pstack bundle over a real Loader tree: the shipped patch rows resolve
 * their lazy config from the asset provider, the bundled skill provider
 * publishes every skill as user-invoked only, and every persona carries the
 * absolute skill paths it names.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'
import { afterEach, describe, expect, it } from 'vitest'
import * as pstack from '../src/index.ts'
import { loadAssets, packageRoot, PSTACK_ASSETS_SERVICE, renderPersona, type PstackAssets } from '../src/index.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PATCH = readFileSync(resolve(ROOT, 'cordis.patch.yml'), 'utf8')
const SKILL_NAMES = readdirSync(resolve(ROOT, 'skills'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

const disposers: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of disposers.splice(0)) await dispose()
})

/** Tool-row configs a probe plugin observed, keyed by tool name. */
type ObservedToolConfigs = Map<string, Record<string, unknown>>

/**
 * Boot the shipped patch rows through the Loader. The asset row and the skill
 * provider row run the real plugins; every delegation-tool row runs a probe
 * that records its resolved config, because a real tool needs a full agent
 * spine that this package does not own.
 * @returns the booted context and the observed tool configs.
 */
async function bootPatch(): Promise<{ ctx: Context; tools: ObservedToolConfigs }> {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pstack-'))
  const tools: ObservedToolConfigs = new Map()
  const globals = globalThis as unknown as Record<string, unknown>
  globals.__pstackAssets = pstack
  globals.__pstackSkillFileSystem = SkillFileSystem
  globals.__pstackTools = tools
  writeFileSync(join(dir, 'assets.mjs'), `
const m = globalThis.__pstackAssets
export const name = m.name
export const apply = ctx => m.apply(ctx)
`)
  writeFileSync(join(dir, 'skill-filesystem.mjs'), `
const m = globalThis.__pstackSkillFileSystem
export const name = m.name
export const inject = m.inject
export const Config = m.Config
export const apply = (ctx, config) => m.apply(ctx, config)
`)
  writeFileSync(join(dir, 'tool.mjs'), 'export function apply(_ctx, config) { globalThis.__pstackTools.set(config.toolName, config) }\n')
  const url = (file: string): string => pathToFileURL(join(dir, file)).href
  const rows = PATCH
    .replace("name: '@deepseek-ai/dsh-pstack'", `name: '${url('assets.mjs')}'`)
    .replace("name: '@deepseek-ai/dsh-skill-filesystem'", `name: '${url('skill-filesystem.mjs')}'`)
    .replaceAll("name: '@deepseek-ai/dsh-tool-subagent'", `name: '${url('tool.mjs')}'`)
    .split('\n')
    .filter(line => !line.startsWith('#') && line !== '- insert:')
    .map(line => line.slice(4))
    .join('\n')
  writeFileSync(join(dir, 'cordis.yml'), rows)

  const ctx = new Context()
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  await ctx.plugin(SkillRegistry)
  await ctx.loader.create({ name: 'cordis:include', config: { path: url('cordis.yml') } })
  await ctx.loader.await()
  disposers.push(async () => { await ctx.fiber.dispose() })
  return { ctx, tools }
}

describe('dsh-pstack bundle', () => {
  it('declares its patch, assets, and skills in the published manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
      files?: string[]
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.files).toEqual(expect.arrayContaining(['cordis.patch.yml', 'agents', 'skills']))
  })

  it('publishes every bundled skill through its isolated provider, hidden from the model', async () => {
    const { ctx } = await bootPatch()
    const skills = (await ctx.skills.list()).filter(skill => skill.provider === 'pstack')
    expect(skills.map(skill => skill.name)).toEqual(SKILL_NAMES)
    expect(skills.every(skill => !skill.invocation.modelInvocable && skill.invocation.userInvocable)).toBe(true)
    expect(SKILL_NAMES).toEqual(expect.arrayContaining(['poteto-mode', 'egm-review', 'setup-pstack', 'create-formal-verification-skill']))
  })

  it('binds each delegation tool to its persona, filter, and model', async () => {
    const { ctx, tools } = await bootPatch()
    const assets = ctx.get(PSTACK_ASSETS_SERVICE) as PstackAssets
    expect([...tools.keys()].sort()).toEqual([
      'comment_sicko', 'goldfish_reviewer', 'poteto_agent', 'poteto_worker', 'pstack_review_flash', 'pstack_review_pro',
    ])
    expect(tools.get('poteto_agent')).toMatchObject({
      provider: 'spawn',
      backgroundMode: 'continuable',
      persona: assets.personas.potetoAgent,
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
    })
    expect(tools.get('poteto_worker')).toMatchObject({ persona: assets.personas.potetoAgent, agentOptions: { model: 'deepseek-v4-flash' } })
    expect(tools.get('goldfish_reviewer')).toMatchObject({
      backgroundMode: 'one-shot',
      persona: assets.personas.goldfishReviewer,
      toolFilter: { allow: ['read', 'glob', 'grep', 'skill'] },
    })
    expect(tools.get('comment_sicko')).toMatchObject({ persona: assets.personas.commentSicko })
    expect(tools.get('comment_sicko')).not.toHaveProperty('toolFilter')
    expect(tools.get('pstack_review_pro')).not.toHaveProperty('persona')
    for (const config of tools.values()) expect(config.provider).toBe('spawn')
  })

  it('renders personas with absolute paths that exist and no leftover placeholder', () => {
    const assets = loadAssets(packageRoot())
    expect(assets.skillDir).toBe(resolve(ROOT, 'skills'))
    for (const persona of Object.values(assets.personas)) {
      expect(persona).not.toMatch(/\{\{|^---/)
      const paths = persona.match(/`[^`<]+`/g)?.map(quoted => quoted.slice(1, -1)).filter(text => text.startsWith(ROOT)) ?? []
      expect(paths.length).toBeGreaterThan(0)
      for (const path of paths) expect(existsSync(path), path).toBe(true)
    }
    expect(assets.personas.potetoAgent).toContain(resolve(ROOT, 'skills/poteto-mode/SKILL.md'))
    expect(assets.personas.goldfishReviewer).toContain(resolve(ROOT, 'skills/egm-review/references/goldfish-checklist.md'))
  })

  it('rejects a persona without frontmatter or with an unknown placeholder', () => {
    expect(() => renderPersona('a.md', 'Body', {})).toThrow('has no YAML frontmatter')
    expect(() => renderPersona('a.md', '---\nname: a\n---\nUse {{missing}}.', {})).toThrow('unknown placeholder {{missing}}')
    expect(renderPersona('a.md', '---\nname: a\n---\nUse {{x}}.\n', { x: '/p' })).toBe('Use /p.')
  })

  it('fails loud when the package root lacks a referenced skill file', () => {
    const empty = mkdtempSync(join(tmpdir(), 'dsh-pstack-empty-'))
    mkdirSync(join(empty, 'skills'))
    expect(() => loadAssets(empty)).toThrow(/ENOENT/)
  })
})
