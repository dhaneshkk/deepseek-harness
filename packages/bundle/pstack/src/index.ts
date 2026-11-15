/**
 * The pstack bundle's asset provider. It resolves the bundled skill root and
 * renders each delegation persona with the absolute skill paths the persona
 * names, then publishes both as {@link PSTACK_ASSETS_SERVICE} for the bundle's
 * patch rows to read through lazy `!!js` config.
 * @module @deepseek-ai/dsh-pstack
 */

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name. */
export const name = 'pstack-assets'

/** Service provided by this plugin and injected by the bundle's patch rows. */
export const PSTACK_ASSETS_SERVICE = 'pstackAssets'

/** Persona keys, one per pstack delegation persona. */
export type PersonaKey = 'potetoAgent' | 'commentSicko' | 'goldfishReviewer'

/** What the patch rows read from {@link PSTACK_ASSETS_SERVICE}. */
export interface PstackAssets {
  /** Absolute skill root that the bundle's skill provider scans. */
  skillDir: string
  /** Rendered persona text per delegation persona, frontmatter removed. */
  personas: Record<PersonaKey, string>
}

const PERSONA_FILES: Record<PersonaKey, string> = {
  potetoAgent: 'poteto-agent.md',
  commentSicko: 'comment-sicko.md',
  goldfishReviewer: 'goldfish-reviewer.md',
}

const FRONTMATTER = /^---\n[\s\S]*?\n---\n/
const PLACEHOLDER = /\{\{(\w+)\}\}/g

/**
 * The package root: `src/` and the built `lib/` both sit one level below it.
 * @returns the absolute package directory.
 */
export function packageRoot(): string {
  return fileURLToPath(new URL('..', import.meta.url))
}

/**
 * Remove a persona file's YAML frontmatter and substitute its placeholders.
 * @param file - persona file path, named in errors.
 * @param text - persona file contents.
 * @param vars - placeholder values by name.
 * @returns the persona body with every placeholder resolved.
 * @throws when the file has no frontmatter or names an unknown placeholder.
 */
export function renderPersona(file: string, text: string, vars: Readonly<Record<string, string>>): string {
  const match = FRONTMATTER.exec(text)
  if (match === null) throw new Error(`pstack: persona ${file} has no YAML frontmatter`)
  return text.slice(match[0].length).trim().replace(PLACEHOLDER, (_whole, key: string) => {
    const value = vars[key]
    if (value === undefined) throw new Error(`pstack: persona ${file} names unknown placeholder {{${key}}}`)
    return value
  })
}

/**
 * Resolve the skill paths under `root` and render every persona.
 * @param root - package directory holding `skills/` and `agents/`.
 * @returns the assets the patch rows read.
 * @throws when a referenced skill file or persona file is missing or malformed.
 */
export function loadAssets(root: string): PstackAssets {
  const skillDir = join(root, 'skills')
  const vars = {
    skillsDir: skillDir,
    potetoModeSkill: join(skillDir, 'poteto-mode', 'SKILL.md'),
    dshHostReference: join(skillDir, 'poteto-mode', 'references', 'dsh-host.md'),
  }
  for (const path of Object.values(vars)) statSync(path)
  const personas = {} as Record<PersonaKey, string>
  for (const [key, fileName] of Object.entries(PERSONA_FILES) as [PersonaKey, string][]) {
    const file = join(root, 'agents', fileName)
    personas[key] = renderPersona(file, readFileSync(file, 'utf8'), vars)
  }
  return { skillDir, personas }
}

/**
 * Provide the pstack assets as an ordinary Cordis service.
 * @param ctx - plugin context.
 */
export function apply(ctx: Context): void {
  ctx.provide(PSTACK_ASSETS_SERVICE, loadAssets(packageRoot()))
}
