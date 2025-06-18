// First Orion UI v0.15.0
function setupCore(G) {
    if (G.$foui) return // First Orion UI core is already loaded

    G.$foui = {
        config: {
            debug: false
        },
        ready(callback) {
            if (G.Alpine) {
                callback()
            } else {
                document.addEventListener('alpine:init', callback)
            }
        }
    }
    const initAt = new Date()
    const _ = G.$foui._ = {
        elapse() {
            return new Date() - initAt
        },
        isString(str) {
            return (str != null && typeof str.valueOf() === "string")
        },
        isArray(array) {
            return Array.isArray(array)
        },
        isFunction(func) {
            return typeof func === "function";
        },
        isPlainObject(item) {
            return item !== null && typeof item === 'object' && item.constructor === Object;
        },
        each(objOrArray, callback) {
            if (!objOrArray) return
            if (_.isArray(objOrArray)) {
                objOrArray.forEach((val, index) => {
                    callback(val, index, index)
                })
            } else {
                Object.entries(objOrArray).forEach(([key, val], index) => {
                    callback(val, key, index)
                })
            }
        },
        map(objOrArray, callback) {
            let result = []
            _.each(objOrArray, (val, key, index) => result.push(callback(val, key, index)))
            return result
        },
        filter(objOrArray, callback) {
            let result = []
            _.each(objOrArray, (val, key, index) => callback(val, key, index) && result.push(val))
            return result
        },
        extend(target, ...sources) {
            const length = sources.length
            if (length < 1 || target == null) return target
            for (let i = 0; i < length; i++) {
                const source = sources[i]
                if (!_.isPlainObject(source)) continue
                Object.keys(source).forEach((key) => {
                    var desc = Object.getOwnPropertyDescriptor(source, key)
                    if (desc.get || desc.set) {
                        Object.defineProperty(target, key, desc);
                    } else {
                        target[key] = source[key]
                    }
                })
            }
            return target
        }
    }
};function setupXComponent(G) {
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

                console.log('Magic prop:', name, 'Value:', value, 'Component:', comp._foui_type)

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
                    // This should make sure that the function is called in the context of the component
                    // If using the API syntax, instead of vanilla Alpine
                    let api = getParentComponent(comp) ? getApiOf(getParentComponent(comp)) : getApiOf(comp);

                    // try converting to anonymous function by adding parentheses and arrow, if not already
                    // and add "this." to all variables and functions to make sure they are called in the context of the component
                    let funcStr = value.trim()

                    funcStr = funcStr.replace(/([a-zA-Z_$][0-9a-zA-Z_$]*)/g, (match, p1) => {
                        if (['true', 'false', 'null', 'undefined'].includes(p1)) return p1
                        if (/^\d+$/.test(p1)) return p1 // numbers

                        // check that the variables or methods exist in the api
                        if (api && ((p1 in api) || (p1.startsWith('$') && !p1.startsWith('$event')))) {
                            console.log('Magic prop function variable/method:', p1, 'found in API');

                            if (p1.startsWith('this.')) {
                                return p1
                            }

                            return `this.${p1}`
                        } else {
                            console.log('Magic prop function variable/method:', p1, 'NOT found in API');
                        }

                        return match

                        // return `this.${p1}`
                    })

                    // with ...args to allow passing parameters


                    if (!funcStr.startsWith('(') && !funcStr.includes('=>')) {                                 
                        // with ...args to allow passing parameters
                        funcStr = `($event, args) => { return ${funcStr} }`
                    }

                    // inject event in the anonymous function if $event is used in the function string
                    // if (funcStr.includes('$event')) {
                    //     if (funcStr.startsWith('() =>')) {
                    //         funcStr = funcStr.replace('() =>', '($event) =>')
                    //     }
                    // }

                    const func = new Function(`return ${funcStr}`)

                    // Only return the result as a function if it is callable
                    // Otherwise, return the value directly
                    const result = (typeof func.call(api) === 'function') ? func.call(api) : value;

                    console.log('Magic prop result:', result, typeof result);

                    return result;
                } catch (e) {
                    console.warn('Magic prop function evaluation error:', e)
                }

                return value
            }
        })

        magic('slot', el => {
            return (name, fallback) => {
                let comp = findClosestComponent(el)
                if (!comp) return null

                // get original template for comp
                const api = getApiOf(comp)

                $foui.nextTick(() => {
                    // look for el in comp template with slot attribute that equals name
                    const slotTemplateContainer = comp.parentNode.querySelector(`${comp.tagName} > template[name="slots"]`)

                    if (slotTemplateContainer) {
                        const slotContents = slotTemplateContainer.content.querySelectorAll(`[slot="${name}"]`)

                        if (slotContents.length > 0) {
                            // Replace el's content with the slot contents, still just return name
                            const slotContent = Array.from(slotContents).map(el => el.cloneNode(true));
                            
                            const newHtml = slotContent.map(el => el.outerHTML).join('');

                            // console.log('Magic slot:', name, 'Component:', comp._foui_type, 'Found slot content:', newHtml);

                            $foui.setHtml(el, newHtml);
                        }
                    }
                });

                return name
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

        directive('component', (el, { expression, value, modifiers }, { effect, evaluateLater, cleanup }) => {
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

                            if (Object.keys(slotContents).length > 0) {
                                // add a hidden template to elComp
                                const elHiddenTemplate = document.createElement('template')
                                // add name slots
                                elHiddenTemplate.setAttribute('name', 'slots')

                                // create a div 
                                const elHiddenDiv = document.createElement('div')

                                _.each(slotContents, contents => {
                                    // add contents to the hidden template
                                    _.each(contents, content => {
                                        if (content.tagName && content.tagName.toLowerCase() === 'template') {
                                            elHiddenDiv.append(content.content.cloneNode(true))
                                        } else {
                                            elHiddenDiv.append(content)
                                        }
                                    })
                                })

                                elHiddenTemplate.content.appendChild(elHiddenDiv)
                                elComp.append(elHiddenTemplate)
                            }

                            // We need this to be able to process nested templates too, recursion?
                            // get all slots in template tags
                            function processTemplates(elContainer) {
                                const elTemplates = elContainer.querySelectorAll("template");

                                _.each(elTemplates, elTemplate => {
                                    // if has attribute x-for, we need to process it
                                    if (elTemplate.hasAttribute('x-for')) {
                                        // access the innerHTML of the template
                                        const templateContent = elTemplate.content;

                                        // if the template has a slot, we need to process it
                                        const templateSlots = templateContent.querySelectorAll("slot");

                                        // console.log("Template slots:", templateSlots);

                                        // find the slot name in slotOptionContents that matches the template slot
                                        _.each(templateSlots, templateSlot => {
                                            effect(() => {
                                                const slotName = templateSlot.getAttribute(`${prefixed('bind')}:name`) || templateSlot.getAttribute(':name') || templateSlot.getAttribute('name')

                                                const foundSlot = slotContents[slotName]

                                                if (foundSlot) {
                                                    templateSlot.replaceWith(...foundSlot);
                                                    templateSlot.remove();
                                                } else {
                                                    // If no slot found, wrap the name in the $slot magic to see if can be evaluated after dom rendering
                                                    // remove the name attribute from the slot
                                                    templateSlot.removeAttribute('name');
                                                    templateSlot.removeAttribute(`${prefixed('bind')}:name`);
                                                    templateSlot.removeAttribute(':name');

                                                    // replace the slot name attribute with the magic, needs to be in an template string format that is not evaluated here but in the magic
                                                    const slotNameWithMagic = "$slot(`" + slotName + "`)";
                                                    
                                                    templateSlot.setAttribute(`${prefixed('bind')}:name`, slotNameWithMagic);
                                                }
                                            })
                                        });

                                        // Recursively process nested templates
                                        processTemplates(templateContent);
                                    }
                                });
                            }

                            processTemplates(elComp);

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
};function setupXImport(G) {
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
};function setupXInclude(G) {
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
};function setupXStyle(G) {
    if (!G.$foui) return console.error('First Orion UI core is not loaded!')
    const $foui = G.$foui
    $foui.config.styleVariantPrefix = 'data-'
    $foui.ready(() => {
        const { directive, bound, reactive } = G.Alpine

        // Create multi-theme registries
        const registries = {};

        // Default registry
        registries['default'] = reactive({});

        // Theme configuration
        const themes = reactive({
            current: 'default'
        });

        // Function cache for storing compiled condition functions
        const conditionFnCache = new Map();

        // Register style component
        $foui.setStyle = function (theme, name, config) {
            if (undefined === config) {
                config = name;
                name = theme;
                theme = themes.current;
            }
            let registry = registries[theme]
            if (!registry) {
                registry = registries[theme] = reactive({});
            }
            registry[name] = {
                base: config.base || '',
                variants: config.variants || {},
                compoundVariants: config.compoundVariants || [],
                defaultVariants: config.defaultVariants || {},
                parts: config.parts || {},
                parent: config.parent || null
            };
        };

        // Get style configuration
        $foui.getStyle = function (theme, name) {
            if (undefined === name) {
                name = theme;
                theme = themes.current;
            }
            const registry = registries[theme];
            return registry[name];
        };

        // Batch register style components
        $foui.loadStyles = function (stylesConfig) {
            Object.entries(stylesConfig).forEach(([name, config]) => {
                $foui.setStyle(name, config);
            });
        };

        $foui.loadThemes = function (themeConfig) {
            Object.entries(themeConfig).forEach(([themeName, stylesConfig]) => {
                Object.entries(stylesConfig).forEach(([name, config]) => {
                    $foui.setStyle(themeName, name, config);
                });
            });
        };

        // Allow users to customize class category configuration
        $foui.configClassCategories = function (customCategories) {
            Object.assign(classCategories, customCategories);
        };

        // Set current theme
        $foui.setTheme = function (themeName) {
            themes.current = themeName;
            if (!registries[themeName]) {
                registries[themeName] = reactive({});
            }
        };

        // Get current theme
        $foui.getTheme = function () {
            return themes.current;
        };

        // Store current applied class names for each element
        const elementStyles = new WeakMap();

        // Improved class merging function, handling Tailwind class name conflicts
        // Class category configuration
        const classCategories = {
            margin: {
                regex: /^m[trblxy]?-/,
                key: /^m[trblxy]?-/
            },
            padding: {
                regex: /^p[trblxy]?-/,
                key: /^p[trblxy]?-/
            },
            textSize: {
                regex: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/
            },
            textAlign: {
                regex: /^text-(left|center|right|justify)$/
            },
            textColor: {
                regex: /^text-/,
                exclude: 'textSize,textAlign'
            },
            fontWeight: {
                regex: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/
            },
            backgroundColor: {
                regex: /^bg-/
            },
            borderColor: {
                regex: /^border-/,
                exclude: 'borderWidth'
            },
            borderWidth: {
                regex: /^border(-[0-9]+)?$|^border-(t|r|b|l|x|y)(-[0-9]+)?$/,
                key: /^border(-[trblxy])?/
            },
            borderRadius: {
                regex: /^rounded(-[trblse])?(-[a-z]+)?$/,
                key: /^rounded(-[trblse])?/
            },
            width: {
                regex: /^(w-|min-w-|max-w-)/,
                key: /^(w-|min-w-|max-w-)/
            },
            height: {
                regex: /^(h-|min-h-|max-h-)/,
                key: /^(h-|min-h-|max-h-)/
            },
            position: {
                regex: /^(top-|right-|bottom-|left-|inset-)/,
                key: /^(top-|right-|bottom-|left-|inset-)/
            },
            shadow: {
                regex: /^shadow(-[a-z]+)?$/
            },
            display: {
                regex: /^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden)$/
            },
            flex: {
                regex: /^flex-/,
                key: /^flex-[a-z]+/
            },
            grid: {
                regex: /^grid-/,
                key: /^grid-[a-z]+/
            },
            gap: {
                regex: /^gap-/,
                key: /^gap-[xy]?/
            },
            space: {
                regex: /^space-[xy]-/,
                key: /^space-[xy]-/
            }
        };

        // Improved class merging function, handling Tailwind class name conflicts
        function mergeClasses(...classes) {
            // Flatten and filter empty values
            const allClasses = classes
                .filter(Boolean)
                .join(' ')
                .split(' ')
                .filter(Boolean);

            // Store final class names by category
            const finalClassesByCategory = {};

            // Initialize Maps for all categories
            Object.keys(classCategories).forEach(category => {
                finalClassesByCategory[category] = new Map();
            });

            // Other uncategorized class names
            finalClassesByCategory.other = new Map();

            // Process each class name
            allClasses.forEach(cls => {
                let matched = false;

                // Check if matches any category
                for (const [category, config] of Object.entries(classCategories)) {
                    if (config.regex.test(cls)) {
                        // Check if needs to be excluded
                        if (config.exclude) {
                            let shouldExclude = false;

                            if (typeof config.exclude === 'string') {
                                // Split by comma and check if any excluded category matches
                                const excludedCategories = config.exclude.split(',');

                                for (const excludedCategory of excludedCategories) {
                                    const excludedConfig = classCategories[excludedCategory.trim()];
                                    if (excludedConfig && excludedConfig.regex.test(cls)) {
                                        shouldExclude = true;
                                        break;
                                    }
                                }
                            } else if (Array.isArray(config.exclude)) {
                                // Legacy support for regex array
                                shouldExclude = config.exclude.some(regex => regex.test(cls));
                            } else if (config.exclude instanceof RegExp) {
                                // Support for single regex
                                shouldExclude = config.exclude.test(cls);
                            }

                            if (shouldExclude) continue;
                        }

                        // Get key for storing in the map
                        let keyValue;
                        if (config.key) {
                            const match = cls.match(config.key);
                            keyValue = match ? match[0] : category;
                        } else {
                            keyValue = category;
                        }

                        finalClassesByCategory[category].set(keyValue, cls);
                        matched = true;
                        break;
                    }
                }

                // If no category matched, add to other category
                if (!matched) {
                    finalClassesByCategory.other.set(cls, cls);
                }
            });

            // Merge all category class names to final list
            const finalClasses = [];
            Object.values(finalClassesByCategory).forEach(categoryMap => {
                categoryMap.forEach(cls => finalClasses.push(cls));
            });

            return finalClasses;
        }

        function visitParentStyles(themeName, styleName, partName, callback) {
            if (!registries[themeName] || !registries[themeName][styleName]) return;
            const style = registries[themeName][styleName];
            if (style.parent) {
                visitParentStyles(style.parent, styleName, partName, callback);
            }
            callback(partName ? style.parts[partName] : style, themeName, styleName);
        }
        function getVariantValue(el, variantName) {
            const attrName = `${$foui.config.styleVariantPrefix}${variantName}`;
            let variantValue = bound(el, attrName);
            if (undefined === variantValue && el._x_part && el._x_part.hostElement) {
                const hostElement = el._x_part.hostElement;
                variantValue = bound(hostElement, attrName);
            }
            return variantValue;
        }

        // Update element classes based on style name and style configuration
        function updateElementClasses(el, styleName, partName) {
            // If styleConfig is not provided, get it from registry

            if (!$foui.getStyle(styleName)) return;

            // Clear previously applied class names
            if (elementStyles.has(el)) {
                const oldClasses = elementStyles.get(el);
                oldClasses.forEach(cls => el.classList.remove(cls));
            }

            // Collect class names to apply
            const classesToApply = [];
            const appliedVariants = {};
            const defaultVariants = {};

            // Add base style
            visitParentStyles(themes.current, styleName, partName,
                (style) => {
                    if (style.base) classesToApply.push(style.base);

                    if (style.variants) {
                        Object.keys(style.variants).forEach(variantName => {
                            let variantValue = appliedVariants[variantName];
                            if (undefined === variantValue)
                                variantValue = appliedVariants[variantName] = getVariantValue(el, variantName);
                            if (style.defaultVariants && style.defaultVariants[variantName] !== undefined)
                                defaultVariants[variantName] = style.defaultVariants[variantName];
                            if (undefined === variantValue)
                                variantValue = defaultVariants[variantName];

                            // If has variant value, add variant style
                            if (undefined !== variantValue) {
                                // For boolean attributes, convert to string to match style definition
                                const lookupValue = 'boolean' === typeof variantValue ? String(variantValue) : variantValue;

                                // Apply base variant style
                                if (style.variants[variantName] && style.variants[variantName][lookupValue]) {
                                    classesToApply.push(style.variants[variantName][lookupValue]);
                                }
                            }
                        });
                    }

                    // Process compound variants
                    if (style.compoundVariants) {
                        const allVariants = { ...defaultVariants, ...appliedVariants }
                        style.compoundVariants.forEach(compound => {
                            if (compound.conditions === undefined) return;
                            let conditionsMet = false;

                            // Check if condition is a string (function expression)
                            if (typeof compound.conditions === 'string') {
                                try {
                                    // Try to get function from cache
                                    let conditionFn = conditionFnCache.get(compound.conditions);

                                    // If not in cache, compile and cache
                                    if (!conditionFn) {
                                        // Use Function constructor instead of eval
                                        // Check if it's an arrow function or regular function definition
                                        if (compound.conditions.includes('=>') || compound.conditions.startsWith('function')) {
                                            // Create a wrapper function, return the parsed function
                                            conditionFn = new Function('return ' + compound.conditions)();
                                        } else {
                                            // Simple expression, create function directly
                                            conditionFn = new Function('v', 'el', 'return ' + compound.conditions);
                                        }
                                        conditionFnCache.set(compound.conditions, conditionFn);
                                    }

                                    // Execute function
                                    conditionsMet = conditionFn(allVariants, el);
                                } catch (error) {
                                    console.error('Error evaluating condition string:', error);
                                }
                            }
                            // Check if condition is a function
                            else if (typeof compound.conditions === 'function') {
                                // Pass all currently applied variant values and element
                                conditionsMet = compound.conditions(allVariants, el);
                            } else {
                                // Object form conditions
                                conditionsMet = Object.entries(compound.conditions).every(
                                    ([key, value]) => {
                                        // If value is array, check if current variant value is in array
                                        if (Array.isArray(value)) {
                                            return value.includes(allVariants[key]);
                                        }
                                        // Otherwise direct comparison
                                        return allVariants[key] === value;
                                    }
                                );
                            }

                            // If all conditions met, add compound style
                            if (conditionsMet) {
                                classesToApply.push(compound.classes);
                            }
                        });
                    }
                }
            );



            // Merge all class names and apply
            const mergedClasses = mergeClasses(...classesToApply);
            mergedClasses.forEach(cls => el.classList.add(cls));

            // Store applied class names
            elementStyles.set(el, mergedClasses);
        }


        // Register x-style directive
        directive('style', (el, { expression }, { effect }) => {
            if (el.tagName === 'TEMPLATE') return
            const styleName = expression;

            effect(() => {
                updateElementClasses(el, styleName);
            });
        });
        // Add support for x-part directive

        // Register x-part directive
        directive('part', (el, { expression }, { effect }) => {
            if (el.tagName === 'TEMPLATE') return
            // Get part name
            const partName = expression;
            // Find the nearest x-style element as host node
            let hostElement = el.parentElement;
            while (hostElement && !hostElement.hasAttribute('x-style')) {
                hostElement = hostElement.parentElement;
            }
            if (!hostElement) return;
            const componentName = hostElement.getAttribute('x-style');
            // Store part info for future updates
            if (!el._x_part) {
                el._x_part = {
                    hostElement,
                    componentName,
                    partName
                };
            }
            effect(() => {
                const componentStyle = $foui.getStyle(componentName);
                if (!componentStyle || !componentStyle.parts || !componentStyle.parts[partName]) return;
                // Update element classes
                updateElementClasses(el, componentName, partName);
            });

        });
    })
}

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