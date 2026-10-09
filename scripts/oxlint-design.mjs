// Match whole color literals and CSS colors without flagging URL fragments.
const hex = '#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w-])'
const palette = new RegExp(`^\\s*${hex}\\s*$|[\\s:,(]${hex}|\\b(?:rgba?|hsla?|oklch)\\(`)
const transitionAll = /transition:\s*all\b|\btransition-all\b/

export default {
  meta: { name: 'kuuki' },
  rules: {
    'design-tokens': {
      meta: { schema: [] },
      create(context) {
        function check(node, value) {
          if (typeof value !== 'string') return
          if (palette.test(value)) {
            context.report({
              node,
              message:
                'Use a semantic CSS variable from apps/next/src/app/styles.css (DESIGN.md: no palette literals in components).',
            })
          }
          if (transitionAll.test(value)) {
            context.report({ node, message: 'Name the transitioned properties (DESIGN.md).' })
          }
        }
        return {
          Literal(node) {
            check(node, node.value)
          },
          TemplateElement(node) {
            check(node, node.value.raw)
          },
        }
      },
    },
  },
}
