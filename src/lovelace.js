class ExampleCardConfigEditor extends HTMLElement {
	constructor() {
		super()
		console.log('editor: new instance')
	}

	setConfig(config) {
		this.config = config
		this.innerHTML = this.render(config)
		this.querySelector('#entity').value = config.entity
		this.querySelector('#css').value = config.css
		this.querySelector('#html').value = config.html
	}

	handleChange(e) {
		const event = new Event('config-changed', {
			bubbles: true,
			composed: true
		})
		event.detail = {
			config: {
				...this.config,
				[e.target.id]: e.target.value
			}
		}
		this.dispatchEvent(event)
	}

	connectedCallback() {
		if (this.isConnected) {
			this.addEventListener('change', this.handleChange, { capture: true })
		}
	}

	disconnectedCallback() {
		this.removeEventListener('change', this.handleChange, { capture: true })
	}

	render(config = this.config) {
		return `
			<paper-input label="Entity" id="entity" value="${config.entity}"></paper-input>
			<ha-code-editor label="CSS" mode="css" id="css"></ha-code-editor>
			<ha-code-editor label="HTML" mode="html" id="html"></ha-code-editor>
		`
	}
}

class ExampleCard extends HTMLElement {

	// static getConfigElement() {
	// 	return document.createElement('example-card-config-editor')
	// }

	static getStubConfig() {
		return {
			entity: 'light.bedroom_light',
			content: '',
			actions: [],
			bindings: []
		}
	}

	constructor(props) {
		super(props)
		this.attachShadow({ mode: 'open' })
	}

	setConfig(config) {
		this.config = config
		this.shadowRoot.innerHTML = config.content
		this.storedValues = []
		this.renderState()
	}
	set hass(hass) {
		this._hass = hass
		this.renderState()
	}
	get hass() {
		return this._hass
	}

	storedValues = []

	renderState() {
		const { hass, config } = this
		if (!hass || !config) return
		let entity = hass.states[config.entity] || { state: 'unavailable', attributes: {} }
		this.config.bindings.forEach(({ element, type, bind }, index) => {
			if (!element || !bind || !type) return
			this.shadowRoot.querySelectorAll(element).forEach(target => {
				const prevState = this.storedValues[index]
				let nextState = ''
				try {
					const getState = new Function('hass', 'config', 'entity', 'state', 'attr', bind)
					nextState = getState.call(target, hass, config, entity, entity.state, entity.attributes)
				} catch (e) {
					console.log('BINDING --> FAILED', bind)
				}
				if (typeof prevState === 'undefined' || nextState !== prevState) {
					switch (type) {
						case 'class':
							prevState && target.classList.remove(prevState)
							nextState && target.classList.add(nextState)
							break
						case 'text':
							target.innerText = nextState
							break
						case 'html':
							target.innerHTML = nextState
							break
						case 'value':
							target.value = nextState
							break
						case 'checked':
							target.checked = !!nextState
							break
						default:
							if (typeof nextState === 'undefined' || '' === `${nextState}`) {
								target.removeAttribute(type)
							} else {
								target.setAttribute(type, nextState)
							}
					}
					this.storedValues[index] = nextState
				}
			})
		})
	}
	handleAction = e => {
		const { hass, config } = this
		const entity_id = config.entity
		const entity = { state: 'unavailable', attributes: {}, ...hass.states[entity_id] }
		if (entity_id) {
			const [domain, id] = entity_id.split('.')
			const services = hass.services[domain]
			for (let service in services) {
				entity[service] = data => hass.callService(domain, service, { entity_id, ...data })
			}
		}
		this.config.actions.forEach(({ element, type, call }) => {
			if (!element || !call || !type) return
			if (type === e.type && e.target.matches(element)) {
				try {
					const setState = new Function('hass', 'config', 'entity', call)
					setState.call(e.target, hass, config, entity)
				} catch (e) {

				}
			}
		})
	}

	connectedCallback() {
		if (this.isConnected) {
			this.renderState()
			this.shadowRoot.addEventListener('change', this.handleAction, true)
			this.shadowRoot.addEventListener('click', this.handleAction, true)
		}
	}

	disconnectedCallback() {
		this.shadowRoot.removeEventListener('change', this.handleAction, true)
		this.shadowRoot.removeEventListener('click', this.handleAction, true)
	}
}

customElements.define('example-card-config-editor', ExampleCardConfigEditor)
customElements.define('example-card', ExampleCard)

window.customCards = window.customCards || []
window.customCards.push({
	type: 'example-card',
	name: 'Example Card'
})
console.log('Custom Element: EXAMPLE-CARD initialized.')