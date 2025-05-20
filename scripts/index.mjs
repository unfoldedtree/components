

function setupFirstOrionUI(G = {}) {
    setupCore(G)
    setupXComponent(G)
    setupXImport(G)
    setupXInclude(G)
    setupXStyle(G)
    return G.$foui
}

export default setupFirstOrionUI

export {
    setupFirstOrionUI,
    setupCore,
    setupXComponent,
    setupXImport,
    setupXInclude,
    setupXStyle
}