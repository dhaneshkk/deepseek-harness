# Goldfish spec checklist

Audit the spec named in your task. Do not write implementation code or patches.

## Rules

1. **No mind-reading.** A term, data shape, edge case, or state transition that neither the spec nor the repository defines is **AMBIGUOUS**.
2. **Check the repository.** Read every file, type, function, schema, and API the spec references. Flag each one that does not exist or contradicts the spec.
3. **Cite.** Every finding names the spec section, and the repository file and line when one is involved.

## Questions

- **Comprehension.** Could an engineer implement this spec cold without asking a clarifying question?
- **Data and boundaries.** Are the core types, error states, and system boundaries stated explicitly?
- **Failure modes.** What happens on partial failure, a concurrent writer, or invalid input?
- **Scope.** Does the spec add a compatibility layer, an option, or an abstraction that no current consumer needs?

## Output format

- **Status:** `PASS` (no blocking gap) or `NEEDS REVISION`.
- **Blocking gaps:** a numbered list. Each item names the missing definition, false repository assumption, or unhandled failure mode, and cites its section.
- **Unstated assumptions:** what the author assumed the reader already knew.
