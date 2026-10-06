/** Compile the isolated asset with tokens from the sole palette authority; no font or stylesheet requests under its CSP. */
export function compileActivationAsset(html, styles) {
  const tokens = styles.match(/:root(?:\[[^\]]+\])*\{[^}]*\}/g)
  if (!tokens?.length || !html.includes('<style id="activation-tokens"></style>')) throw new Error('Activation theme source or insertion point is missing')
  return html.replace('<style id="activation-tokens"></style>', `<style id="activation-tokens">${tokens.join('\n')}</style>`)
}
