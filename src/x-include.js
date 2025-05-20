function setupXInclude(G) {
    if (!G.$foui) return console.error('First Orion UI core is not loaded!')
    const $foui = G.$foui
    $foui.include = (elHost, urls) => {
        const _ = $foui._
        const unwrap = elHost._foui_unwrap
        let baseUrl
        for (let elCurrent = elHost; elCurrent; elCurrent = elCurrent.parentElement) {
            baseUrl = elCurrent._foui_base_url
            if (baseUrl) break
        }
        if (!baseUrl)
            baseUrl = document.baseURI
        if (_.isArray(urls)) {
            const tasks = []
            _.each(urls, url => {
                url = url.trim()
                if (url) {
                    let fullUrl = new URL(url, baseUrl).href
                    let loader
                    if (url[0] == '#') {
                        let id = url.substring(1)
                        loader = new Promise(resolve => {
                            let el = document.getElementById(id)
                            resolve(el && el.innerHTML || '')
                        })
                    } else {
                        loader = fetch(fullUrl).then(r => r.text())
                    }
                    tasks.push(loader.then(html => {
                        const el = document.createElement('div')
                        el._x_ignore = true
                        el.innerHTML = html
                        let all = [...el.childNodes]
                        return new Promise((resolve) => {
                            const process = (i) => {
                                if (i < all.length) {
                                    const elChild = all[i]
                                    elChild.remove()
                                    if (elChild.tagName === 'SCRIPT') {
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
                                            elExecute.innerHTML = `${elChild.innerHTML}\r\n//From ${url}\r\n//# sourceURL=${file}`
                                            $foui.importScriptIndex++
                                        }
                                        document.body.append(elExecute)
                                        if (!wait) process(i + 1)
                                    } else {
                                        elChild._foui_base_url = fullUrl
                                        if (unwrap) {
                                            elChild._x_dataStack = elHost._x_dataStack
                                            elHost.before(elChild)
                                        } else {
                                            elHost.append(elChild)
                                        }
                                        process(i + 1)
                                    }
                                } else {
                                    if ($foui.config.debug)
                                        console.log(`Included ${url}`)
                                    if (unwrap)
                                        elHost.remove()
                                    resolve()
                                }
                            }
                            process(0)
                        })
                    }).catch(ex => {
                        console.error(`Fails to include ${url}`, ex)
                    }))
                }
            })
            return Promise.all(tasks)
        } else {
            return Promise.reject(`Fails to include ${urls} !`)
        }
    }
    $foui.ready(() => {
        const _ = $foui._
        const { directive, prefixed, addRootSelector } = Alpine
        addRootSelector(() => `[${prefixed('include')}]`)
        directive('include', (el, { expression, modifiers }, { effect, evaluateLater }) => {
            if (!expression) return
            el._foui_unwrap = modifiers.includes('unwrap')
            let urls = expression.trim()
            if (urls.startsWith('#') || urls.startsWith('.') || urls.startsWith('/') || urls.startsWith('http://') || urls.startsWith('https://')) {
                $foui.include(el, [urls])
            } else {
                let evaluate = evaluateLater(expression)
                effect(() => evaluate(value => {
                    if (_.isArray(value)) {
                        $foui.include(el, value)
                    } else if (_.isString(value)) {
                        $foui.include(el, [value])
                    } else {
                        $foui.include(el, [urls])
                    }
                }))
            }
        })
    })
}