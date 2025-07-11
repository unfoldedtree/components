function setupXImport(G) {
    if (!G.$foui) return console.error('First Orion UI core is not loaded!')
    const $foui = G.$foui
    $foui.import = (comps) => {
        if (!comps) return
        const _ = $foui._
        const importMap = $foui.config.importMap
        //if (!importMap || !importMap['*'])
        //    return Promise.reject('You must setup import url template for the fallback namespace "*"')

        if (!$foui.imports) $foui.imports = {}
        if (!$foui.importScriptIndex) $foui.importScriptIndex = 1
        if (_.isString(comps)) comps = [comps]
        if (_.isArray(comps)) {
            const tasks = []
            _.each(comps, comp => {
                if (!comp) return
                let fullname = comp = comp.trim()
                let urlTpl = importMap['*']
                let url = null
                let namespace = ''
                let pos = comp.indexOf(':')
                if (pos !== -1) {
                    namespace = comp.substring(0, pos)
                    comp = comp.substring(pos + 1)
                    if (namespace) $foui.addNamespace(namespace)
                }
                pos = comp.lastIndexOf('/')
                let path = ''
                if (pos !== -1) {
                    path = comp.substring(0, pos + 1)
                    comp = comp.substring(pos + 1)
                }
                _.each(comp.split(','), component => {
                    component = component.trim()
                    let compInfo = { path, namespace, component, fullname: `${namespace ? namespace + ':' : ''}${path}${component}` }
                    if (compInfo.namespace && importMap[compInfo.namespace])
                        urlTpl = importMap[compInfo.namespace]
                    if (!urlTpl) {
                        return console.error(`Url template for namespace '${compInfo.namespace}' is not defined!`)
                    }
                    try {
                        const parse = new Function("data", "with (data){return `" + urlTpl + "`}")
                        url = parse(compInfo)
                    } catch (ex) {
                        console.error(`Fails to parse url template ${urlTpl} with component ${comp}`)
                        return
                    }
                    if (url && !$foui.imports[url]) {
                        let importMeta = { url, ...compInfo }
                        $foui.imports[url] = importMeta
                        tasks.push(fetch(url).then(r => {
                            if (!r.ok) throw Error(`${r.status} (${r.statusText})`)
                            return r.text()
                        }).then(html => {
                            const el = document.createElement('div')
                            el._x_ignore = true
                            el.innerHTML = html
                            importMeta.html = html
                            let all = [...el.childNodes]
                            return new Promise((resolve) => {
                                const process = (i) => {
                                    if (i < all.length) {
                                        const elChild = all[i]
                                        elChild.remove()
                                        if (elChild.tagName === 'LINK') {
                                            document.head.append(elChild)
                                            process(i + 1)
                                        } else if (elChild.tagName === 'SCRIPT') {
                                            if (elChild.hasAttribute('use-meta')) {
                                                elChild.innerHTML = `const __import_meta__ = ${JSON.stringify(importMeta)}\r\n` + elChild.innerHTML
                                            }
                                            const elExecute = document.createElement("script")
                                            const wait = elChild.src && !elChild.async
                                            if (wait) {
                                                elExecute.onload = () => {
                                                    process(i + 1)
                                                }
                                                elExecute.onerror = () => {
                                                    console.error(`Fails to load script from "${elExecute.src}"`)
                                                    process(i + 1)
                                                }
                                            }
                                            _.each(elChild.attributes, a => elExecute.setAttribute(a.name, a.value))
                                            if (!elChild.src) {
                                                let file = `__foui__/scripts/js_${$foui.importScriptIndex}.js`
                                                elExecute.setAttribute('file', file)
                                                elExecute.innerHTML = `${elChild.innerHTML}\r\n//# sourceURL=${file}`
                                                $foui.importScriptIndex++
                                            }
                                            document.body.append(elExecute)
                                            if (!wait) process(i + 1)
                                        } else if (elChild.tagName === 'TEMPLATE') {
                                            elChild.setAttribute('fo-cloak', '')
                                            $foui.extractNamespaces(elChild)
                                            $foui.prepareComponents(elChild)
                                            document.body.append(elChild)
                                            process(i + 1)
                                        } else {
                                            process(i + 1)
                                        }
                                    } else {
                                        if ($foui.config.debug)
                                            console.log(`Imported ${fullname} @ ${url}`)
                                        resolve()
                                    }
                                }
                                process(0)
                            })
                        }).catch(ex => {
                            console.error(`Fails to import ${fullname} @ ${url}`, ex)
                        }))
                    }
                })
            })
            return Promise.all(tasks)
        } else {
            return Promise.reject(`Fails to import ${comps} !`)
        }
    }
    $foui.ready(() => {
        const _ = $foui._
        const { directive, prefixed, addRootSelector } = Alpine
        addRootSelector(() => `[${prefixed('import')}]`)
        directive('import', (el, { expression, value }, { effect, evaluateLater }) => {
            if (!expression) return
            if (value) {
                if (value === 'dynamic' || value === 'dyn') {
                    let evaluate = evaluateLater(expression)
                    effect(() => evaluate(val => $foui.import(val)))
                } else {
                    console.error(`${prefixed('import')}:${value} is not allowed!`)
                }
            } else {
                $foui.import(expression.split(';'))
            }
        })
    })
}