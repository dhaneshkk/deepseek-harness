/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-pstack`.
 * @module @deepseek-ai/dsh-pstack/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-pstack'

/** Cordis companion plugin name. */
export const name = 'pstack-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package publishes immutable asset paths and
 * persona text once at activation; delegation lifecycle belongs to the shared
 * subagent service and skill discovery to the skill registry.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - plugin context carrying the invariant registry.
 * @returns the installed registration's disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
