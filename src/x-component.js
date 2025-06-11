function setupXComponent(G) {
    if (!G.$foui) return console.error('First Orion UI core is not loaded!')
    const $foui = G.$foui
    if (!$foui.setups) $foui.setups = {}
    if (!$foui.components) $foui.components = {}
    $foui.ready(() => {
        const _ = $foui._
        const { directive, prefixed, addRootSelector, magic,
            closestDataStack, mergeProxies, initTree, mutateDom, reactive } = Alpine
        const ATTR_UI = 'foui'
        const ATTR_CLOAK = 'fo-cloak'
        const DEFAULT_NAMESPACE = 'foui'

        const DIR_COMP = prefixed('component')
        const DIR_IMPORT = prefixed('import')
        const DIR_DATA = prefixed('data')
        const DIR_INIT = prefixed('init')
        const DIR_IGNORE = prefixed('ignore')
        const allNamespaces = [DEFAULT_NAMESPACE]

        let styleElement = document.createElement('style')
        styleElement.setAttribute('id', 'first-orion-ui-component-common-styles')
        styleElement.innerHTML = `
    [${ATTR_UI}] {display : block}
    [${ATTR_CLOAK}] {display: none !important;}
    `
        document.head.prepend(styleElement)
        function addNamespace(ns) {
            if (!ns) return
            ns = ns.trim()
            if (allNamespaces.indexOf(ns) === -1)
                allNamespaces.push(ns)
        }
        function getNamespaceFromXcomponent(dirName) {
            let p1 = dirName.indexOf(':')
            if (p1 === -1) return DEFAULT_NAMESPACE
            let p2 = dirName.indexOf('.', p1)
            return p2 === -1 ? dirName.substring(p1 + 1) : dirName.substring(p1 + 1, p2)
        }
        function isComponent(el) {
            if (el._foui_type) return true
            if (el.tagName) {
                let p = el.tagName.indexOf('-')
                if (p === -1) return false
                let ns = el.tagName.substring(0, p).toLowerCase()
                if ($foui.config.autoImport === true)
                    return true
                if (allNamespaces.indexOf(ns) !== -1) {
                    return true
                }
            }
            return false
        }
        function getParentComponent(el) {
            return visitParent(el, isComponent)
        }
        function visitParent(el, filter) {
            if (!el.parentNode) return null
            if (filter(el.parentNode)) return el.parentNode
            return visitParent(el.parentNode, filter)
        }
        function visitComponents(elContainer, callback) {
            if (elContainer.tagName === 'TEMPLATE') {
                if (elContainer._x_teleport) {
                    if (isComponent(elContainer._x_teleport)) callback(elContainer._x_teleport)
                    return visitComponents(elContainer._x_teleport, callback)
                }
                return visitComponents(elContainer.content, callback)
            }
            _.each(elContainer.querySelectorAll('*'), el => {
                if (isComponent(el)) callback(el)
                if (el.tagName === 'TEMPLATE') {
                    if (el._x_teleport) {
                        if (isComponent(el._x_teleport)) callback(el._x_teleport)
                        return visitComponents(el._x_teleport, callback)
                    }
                    return visitComponents(el.content, callback)
                }
            })
        }
        function findClosestComponent(el, filter) {
            if (!el) return null
            if (el._foui_type) {
                if (_.isString(filter)) {
                    let type = filter
                    filter = (el) => el._foui_type === type
                }
                if (!filter || filter(el)) return el
            }
            if (el._x_teleportBack) {
                return findClosestComponent(el._x_teleportBack.parentNode, filter)
            }
            return findClosestComponent(el.parentNode, filter)
        }
        function normalizeFilter(filter, defNamespace) {
            if (_.isFunction(filter)) return filter
            if (_.isPlainObject(filter)) {
                return (el) => {
                    if (el._foui_type !== filter.type) return false
                    if (filter.namespace && el._foui_namespace !== filter.namespace) return false
                    return true
                }
            } else {
                let namespace = ''
                let type = filter
                let parts = filter.split(':')
                if (parts.length > 1) {
                    namespace = parts[0] || defNamespace
                    type = parts[1]
                }
                return (el) => {
                    if (el._foui_type !== type) return false
                    if (namespace && el._foui_namespace !== namespace) return false
                    return true
                }
            }

        }
        function getApiOf(el, filter) {
            const comp = findClosestComponent(el, filter)
            if (!comp) return null
            const baseApis = {
                $of(type) {
                    if (!type) return getApiOf((comp._x_teleportBack || comp).parentNode)
                    return getApiOf(
                        (comp._x_teleportBack || comp).parentNode, normalizeFilter(type, comp._foui_namespace))
                },
                get $meta() { return getComponentMeta(comp) },
                get $parent() { return getParentComponent(comp) },
                $closest(filter) {
                    return findClosestComponent(comp, normalizeFilter(filter, comp._foui_namespace))
                },
                $find(filter) {
                    return findChildComponents(comp, normalizeFilter(filter, comp._foui_namespace))
                },
                $findOne(filter) {
                    let comps = findChildComponents(comp, normalizeFilter(filter, comp._foui_namespace))
                    return comps.length > 0 ? comps[0] : null
                }
            }
            return mergeProxies([baseApis, comp._foui_api || {}, ...closestDataStack(comp)])
        }
        function getComponentMeta(el) {
            return {
                type: el._foui_type,
                namespace: el._foui_namespace
            }
        }
        function findChildComponents(elContainer, filter) {
            if (_.isString(filter)) {
                let type = filter
                filter = (el) => el._foui_type === type
            }
            let result = []
            visitComponents(elContainer, (el) => {
                if (!filter || filter(el))
                    result.push(el)
            })
            return result
        }
        $foui.addNamespace = addNamespace
        $foui.getComponentMeta = getComponentMeta
        $foui.isComponent = isComponent
        $foui.visitComponents = visitComponents
        $foui.findChildComponents = findChildComponents
        $foui.getParentComponent = getParentComponent
        $foui.findClosestComponent = findClosestComponent
        $foui.$api = (el) => getApiOf(el)
        $foui.$data = Alpine.$data
        $foui.setHtml = (el, html) => {
            el.innerHTML = ''
            let dom = $foui.dom(html)
            if (_.isArray(dom))
                el.append(...dom)
            else
                el.append(dom)
        }
        $foui.defer = (callback) => {
            queueMicrotask(callback)
        }
        $foui.dom = (html) => {
            const elTemp = document.createElement('div')
            elTemp._x_ignore = true
            elTemp.innerHTML = html
            $foui.extractNamespaces(elTemp)
            $foui.prepareComponents(elTemp)
            return elTemp.childNodes.length === 1 ? elTemp.firstChild : [...elTemp.childNodes]
        }
        $foui.nextTick = Alpine.nextTick
        $foui.effect = Alpine.effect
        $foui.focus = (el, options) => el && el.focus && el.focus(options || { preventScroll: true })
        $foui.scrollIntoView = (el, options) => el && el.scrollIntoView && el.scrollIntoView(options || { block: 'nearest' })
        $foui.extractNamespaces = (elContainer) => {
            _.each([elContainer, ...elContainer.querySelectorAll('*')], el => {
                if (el.tagName === 'TEMPLATE') {
                    $foui.extractNamespaces(el.content)
                }
                _.each(el.attributes, attr => {
                    let name = attr.name
                    if (name.startsWith(DIR_COMP)) {
                        let ns = getNamespaceFromXcomponent(name)
                        addNamespace(ns)
                    } else if (name.startsWith(DIR_IMPORT) && attr.value) {
                        let comps = attr.value.trim()
                        if (comps.startsWith('[') && comps.endsWith(']')) {
                            //comps = evaluate(el, attr.value)
                            return
                        } else {
                            comps = comps.split(';')
                        }
                        _.each(comps, comp => {
                            let p = comp.indexOf(':')
                            if (p !== -1) {
                                let ns = comp.substring(0, p)
                                addNamespace(ns)
                            }
                        })
                    }
                })
            })
        }
        $foui.prepareComponents = (elContainer) => {
            visitComponents(elContainer, el => {
                if ($foui.config.autoImport === true)
                    $foui.import(el.tagName.replace('-', ':').toLowerCase())
                el.setAttribute(ATTR_CLOAK, '')
                el.setAttribute(DIR_IGNORE, '')
            })
        }
        _.each($foui.config.importMap, (v, k) => {
            if (k !== '*') $foui.addNamespace(k)
        })
        $foui.extractNamespaces(document)
        $foui.prepareComponents(document)
        addRootSelector(() => `[${DIR_COMP}]`)
        magic('api', el => getApiOf(el))
        // magic('prop', el => {
        //     return (name, fallback) => {
        //         let comp = findClosestComponent(el)
        //         if (!comp) return null
        //         return Alpine.bound(comp, `${name}`, fallback)
        //     }
        // })

        // try to make watching props work
        // magic('watch', el => {
        //     return (expression, callback) => {
        //         let comp = findClosestComponent(el)
        //         if (!comp) return null

        //         // console.log('Magic watch:', expression, 'Component:', comp._foui_type)

        //         // If the expression is a function, we evaluate it
        //         if (typeof expression === 'function') {
        //             expression = expression.call(getApiOf(comp))
        //         }

        //         // If the expression is a string, we evaluate it as an Alpine expression
        //         if (typeof expression === 'string') {
        //             const evaluate = Alpine.evaluate.bind(Alpine, comp, expression)
        //             Alpine.effect(() => {
        //                 const value = evaluate()
        //                 callback(value)
        //             })
        //         } else {
        //             console.warn('Magic watch expects a string or function as the first argument')
        //         }
        //     }
        // })

        magic('prop', el => {
            return (name, fallback) => {
                let comp = findClosestComponent(el)

                if (!comp) return null

                // Find the bound value for the given name
                const value = Alpine.bound(comp, `${name}`, fallback)

                // If null or undefined return the value
                if (value === null || value === undefined) return value

                // try casting as object
                try {
                    const parsedValue = JSON.parse(value);
                    if (typeof parsedValue === 'object' && parsedValue !== null) {
                        return parsedValue;
                    }
                } catch (e) {
                    // If parsing fails, we just return the original value
                }

                try {
                    // If the value is a string, we try to evaluate it as a function
                    const func = new Function(`return ${value}`);

                    if (typeof func === 'function') {
                        // This should make sure that the function is called in the context of the component
                        // If using the API syntax, instead of vanilla Alpine
                        let api = getParentComponent(comp) ? getApiOf(getParentComponent(comp)) : getApiOf(comp);

                        // Only return the result as a function if it is callable
                        // Otherwise, return the value directly
                        const result = (typeof func.call(api) === 'function') ? func.call(api) : value;

                        return result;
                    }
                } catch (e) {
                    //
                }

                return value
            }
        })

        directive('model', (el, { expression, value }, { effect, evaluateLater }) => {
            let evaluate = evaluateLater(expression)
            effect(() => {
                evaluate(value => {
                    if (value === undefined || value === null) return
                    if (el.tagName.toLowerCase() === 'input' && el.type === 'checkbox') {
                        el.checked = !!value
                    } else if (el.tagName.toLowerCase() === 'input' && el.type === 'radio') {
                        el.checked = (el.value === value)
                    } else {
                        el.value = value
                    }

                    // console.log('Model effect', expression, value)
                })
            })
            el.addEventListener('input', () => {
                let val = el.value

                if (el.tagName.toLowerCase() === 'input' && el.type === 'checkbox') {
                    val = el.checked
                } else if (el.tagName.toLowerCase() === 'input' && el.type === 'radio') {
                    val = el.checked ? el.value : null
                }
                $foui.setHtml(el, val)

                // check if the model expression contains $prop() syntax
                if (expression.includes('$prop(')) {
                    // If it does, we assume it's a function call and we evaluate it
                    let propName = expression.substring(expression.indexOf('(') + 1, expression.indexOf(')'))
                    let comp = findClosestComponent(el)
                    
                    if (!comp) return null

                    if (getParentComponent(comp)) {
                        comp = getParentComponent(comp)
                    }

                    // strip any quotes from the propName
                    propName = propName.replace(/['"]/g, '').trim()

                    const boundVariable = comp.getAttribute(`${prefixed('bind')}:${propName}`) || comp.getAttribute(`:${propName}`) || comp.getAttribute(propName)

                    if (!boundVariable) {
                        console.warn(`No bound variable found for ${propName} in component ${comp._foui_type}`);
                        return;
                    }

                    const api = getApiOf(comp)

                    // check api for the bound variable
                    if (!api || api[boundVariable] === undefined) {
                        console.warn(`No API found for ${boundVariable} in component ${comp._foui_type}`);
                        return;
                    }

                    api[boundVariable] = val;
                } else {
                    // Otherwise, we just set the value
                    $foui.$data(el, expression, val);
                }
            })
        })

        directive('shtml', (el, { expression }, { effect, evaluateLater }) => {
            let evaluate = evaluateLater(expression)
            effect(() => {
                evaluate(value => {
                    $foui.setHtml(el, value)
                })
            })
        })

        directive('component', (el, { expression, value, modifiers }, { cleanup }) => {
            if (el.tagName.toLowerCase() !== 'template') {
                return console.warn('x-component can only be used on a <template> tag', el)
            }
            const namespace = value || $foui.config.namespace || DEFAULT_NAMESPACE
            const compName = `${namespace}-${expression}`
            const unwrap = modifiers.includes('unwrap')
            const elScript = el.content.querySelector("script")
            if (elScript) {
                const elExecute = document.createElement("script")
                _.each(elScript.attributes, a => elExecute.setAttribute(a.name, a.value))
                elExecute.setAttribute('component', compName)
                elExecute.innerHTML = `
$foui.setups["${compName}"] = ($el)=>{
${elScript.innerHTML}
}
//# sourceURL=__foui__/${compName}.js
`
                document.body.append(elExecute)
                elScript.remove()
            }
            function copyAttributes(elFrom, elTo) {
                _.each(elFrom.attributes, attr => {
                    if (DIR_COMP === attr.name || attr.name.startsWith(DIR_COMP)) return
                    try {
                        let name = attr.name
                        if (name.startsWith('@'))
                            name = `${prefixed('on')}:${name.substring(1)}`
                        else if (name.startsWith(':'))
                            name = `${prefixed('bind')}:${name.substring(1)}`
                        if (DIR_INIT === name && elTo.getAttribute(DIR_INIT)) {
                            elTo.setAttribute(name, attr.value + ';' + elTo.getAttribute(DIR_INIT))
                        } else if (DIR_DATA === name && elTo.getAttribute(DIR_DATA)) {
                            elTo.setAttribute(name, '{...' + attr.value + ',...' + elTo.getAttribute(DIR_DATA) + '}')
                        } else if ('class' === name) {
                            elTo.setAttribute(name, attr.value + ' ' + (elTo.getAttribute('class') || ''))
                        } else if (!elTo.hasAttribute(name)) {
                            elTo.setAttribute(name, attr.value)
                        }
                    } catch (ex) {
                        console.warn(`Fails to set attribute ${attr.name}=${attr.value} in ${elTo.tagName.toLowerCase()}`)
                    }
                })
            }
            if (!customElements.get(compName.toLowerCase())) {
                $foui.components[compName] = class extends HTMLElement {
                    connectedCallback() {
                        let elComp = this
                        let elTopComp = getParentComponent(elComp)
                        while (elTopComp) {
                            if (!elTopComp.hasAttribute(ATTR_UI) && !elTopComp._foui_type) {
                                if ($foui.config.debug) console.log('Not ready to connect ' + this.tagName)
                                return
                            }
                            elTopComp = getParentComponent(elTopComp)
                        }
                        elComp.setAttribute(ATTR_UI, $foui.config.debug ? `${_.elapse()}` : '')
                        if ($foui.config.debug) console.log('Connect ' + this.tagName)
                        mutateDom(() => {
                            const slotContents = {}
                            const defaultSlotContent = []

                            _.each(this.childNodes, elChild => {
                                if (elChild.tagName && elChild.hasAttribute('slot')) {
                                    let slotName = elChild.getAttribute('slot') || ''
                                    let content = elChild.tagName === 'TEMPLATE' ?
                                        elChild.content.cloneNode(true).childNodes :
                                        [elChild.cloneNode(true)]

                                    if (slotContents[slotName]) {
                                        slotContents[slotName].push(...content)
                                    } else {
                                        slotContents[slotName] = content
                                    }
                                } else {
                                    defaultSlotContent.push(elChild.cloneNode(true))
                                }
                            })

                            if (unwrap) {
                                elComp = el.content.cloneNode(true).firstElementChild
                                elComp._foui_processing = true
                                copyAttributes(this, elComp)
                                this.after(elComp)
                                this.remove()
                            } else {
                                elComp._foui_processing = true
                                elComp.innerHTML = el.innerHTML
                            }
                            copyAttributes(el, elComp)

                            const elSlots = elComp.querySelectorAll("slot")

                            // get all slots in template tags
                            const elTemplates = elComp.querySelectorAll("template")

                            _.each(elTemplates, elTemplate => {
                                // if has attribute x-for, we need to process it
                                if (elTemplate.hasAttribute('x-for')) {
                                    // access the innerHTML of the template
                                    const templateContent = elTemplate.content;

                                    // if the template has a slot, we need to process it
                                    const templateSlots = templateContent.querySelectorAll("slot");
                                    // find the slot name in slotOptionContents that matches the template slot
                                    _.each(templateSlots, templateSlot => {
                                        const slotName = templateSlot.getAttribute('name') || '';

                                        if (slotContents[slotName]) {
                                            // replace the template slot with the contents of the slotOptionContents
                                            templateSlot.replaceWith(...slotContents[slotName]);
                                            // delete slotContents[slotName];
                                        }
                                    })
                                }
                            })

                            _.each(elSlots, elSlot => {
                                const name = elSlot.getAttribute('name')

                                let elsToAppend = name ? slotContents[name] : defaultSlotContent

                                if (!elsToAppend || elsToAppend.length === 0) {
                                    elsToAppend = Array.from(elSlot.childNodes)
                                }

                                elSlot.after(...elsToAppend)
                                elSlot.remove()
                            })
                            if (unwrap && isComponent(elComp)) return

                            elComp._foui_type = expression
                            elComp._foui_namespace = namespace
                            let setup = $foui.setups[compName]
                            if (setup) {
                                elComp._foui_api = reactive(setup(elComp))
                            }
                            if (!elComp.hasAttribute(DIR_DATA))
                                elComp.setAttribute(DIR_DATA, '{}')

                            let elParentComp = getParentComponent(elComp) || visitParent(elComp, el => el._foui_processing)
                            if (!elParentComp || elParentComp._foui_type) {
                                if ($foui.config.debug) console.log('Plan initTree ' + this.tagName)
                                queueMicrotask(() => {
                                    if (!elComp.isConnected) return
                                    elComp.removeAttribute(ATTR_CLOAK)
                                    elComp.removeAttribute(DIR_IGNORE)
                                    delete elComp._x_ignore
                                    if ($foui.config.debug) console.log('Process initTree ' + this.tagName)
                                    initTree(elComp)
                                    if (elComp._foui_processing) delete elComp._foui_processing
                                    if (elComp._foui_api) {
                                        let api = getApiOf(elComp)
                                        if (api.onMounted) api.onMounted()
                                    }
                                    _.each(elComp._foui_deferred_elements, el => {
                                        if (el._foui_api) {
                                            let api = getApiOf(el)
                                            if (api.onMounted) api.onMounted()
                                        }
                                    })
                                    delete elComp._foui_deferred_elements
                                })
                            } else {
                                // wait for parent component to be mounted
                                if ($foui.config.debug) console.log('Defer initTree ' + this.tagName)
                                if (!elParentComp._foui_deferred_elements)
                                    elParentComp._foui_deferred_elements = []
                                elParentComp._foui_deferred_elements.push(elComp)
                                if (elComp._foui_deferred_elements)
                                    elParentComp._foui_deferred_elements.push(...elComp._foui_deferred_elements)
                                queueMicrotask(() => {
                                    elComp.removeAttribute(ATTR_CLOAK)
                                    elComp.removeAttribute(DIR_IGNORE)
                                    delete elComp._x_ignore
                                })
                            }
                        })
                    }
                    disconnectedCallback() {
                        if ($foui.config.debug) console.log((this.hasAttribute(ATTR_UI) ? 'Disconnect ' : 'Not ready to disconnect ') + this.tagName)

                        if (this._foui_api) {
                            let api = getApiOf(this)
                            if (api.onUnmounted) api.onUnmounted()
                        }
                    }
                    attributeChangedCallback(name, oldValue, newValue) {
                        if (this._foui_api) {
                            let api = getApiOf(this)
                            if (api.onAttributeChanged) api.onAttributeChanged(name, oldValue, newValue)
                        }
                    }
                }
                customElements.define(compName.toLowerCase(), $foui.components[compName]);
            }
        })
    })
}