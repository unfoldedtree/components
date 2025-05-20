
function setupFirstOrionUI(G = {}) {
    setupCore(G)
    setupXComponent(G)
    setupXImport(G)
    setupXInclude(G)
    setupXStyle(G)
    return G.$foui
}

module.exports = {
    setupFirstOrionUI,
    setupCore,
    setupXComponent,
    setupXImport,
    setupXInclude,
    setupXStyle
}