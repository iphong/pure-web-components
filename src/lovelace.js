const div = document.createElement('div')
document.body.appendChild(div)

div.innerHTML = `
<style>
#logger {
	position: absolute;
    z-index: 1000;
    bottom: 10px;
    right: 10px;
    background: grey;
    border: 1px solid red;
}
</style>
<pre id="logger">

</pre>
`

class ExampleCardConfigEditor extends HTMLElement {
	constructor() {
		super()
		console.log('editor: new instance')
		this.attachShadow({ mode: 'open' })
	}

	setConfig(config) {
		this.config = config
		this.shadowRoot.innerHTML = this.render(config)
	}

	handleChange = async (e) => {
		if (e.target.id === 'import') {
			const reader = new FileReader()
			const text = await reader.readAsText(e.target.files[0])
			reader.addEventListener('loadend', e => {
				const event = new Event('config-changed', {
					bubbles: true,
					composed: true
				})
				event.detail = {
					config: {
						...this.config,
						content: reader.result
					}
				}
				this.dispatchEvent(event)
				e.target.value = ''
			})
			return
		}
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

	handleClick = e => {
		const tab = e.target.closest('paper-tab')
		if (tab) {
			const href = tab.getAttribute('href')
			this.shadowRoot.querySelectorAll(href).forEach(content => {
				for (let child of content.parentNode.children) {
					child.setAttribute('hidden', 'true')
				}
				content.removeAttribute('hidden')
			})
		}
	}

	connectedCallback() {
		if (this.isConnected) {
			this.shadowRoot.addEventListener('change', this.handleChange, true)
			this.shadowRoot.addEventListener('click', this.handleClick, true)
		}
	}

	disconnectedCallback() {
		this.shadowRoot.removeEventListener('change', this.handleChange, true)
		this.shadowRoot.removeEventListener('click', this.handleClick, true)
	}

	render(config = this.config) {
		return `
<paper-tabs selected="0" scrollable>
	<paper-tab href="#tab-general">General</paper-tab>
	<paper-tab href="#tab-design">Design</paper-tab>
	<paper-tab href="#tab-bindings">Bindings</paper-tab>
	<paper-tab href="#tab-actions">Actions</paper-tab>
</paper-tabs>
<div id="tabs">
	<div id="tab-general">
		<paper-input label="Entity" id="entity" value="${config.entity}"></paper-input>
		
		<br>
		<label>Import Design</label>
		<input label="Import Design" id="import" type="file"></input>
	</div>
	<div id="tab-design" hidden>
		GUI configuration for design 
		<textarea label="content" id="content" rows="10" style="width: 100%;">${config.content}</textarea>
	</div>
	<div id="tab-bindings" hidden>
		GUI configuration for bindings
	</div>
	<div id="tab-actions" hidden>
		GUI configuration for actions 
	</div>
</div>
		`
	}
}

class ExampleCard extends HTMLElement {

	storedValues = []

	constructor() {
		super()
		this.attachShadow({ mode: 'open' })
	}

	get hass() {
		return this._hass
	}

	set hass(hass) {
		this._hass = hass
		this.renderState()
	}

	static getConfigElement() {
		return document.createElement('example-card-config-editor')
	}

	static getStubConfig() {
		return {
			entity: 'light.bedroom_light',
			content: '',
			actions: [],
			bindings: []
		}
	}

	setConfig(config) {
		this.config = config
		this.shadowRoot.innerHTML = config.content
		this.storedValues = []
	}

	renderState() {
		const { hass, config } = this
		if (!hass || !config) return
		let entity = hass.states[config.entity] || { state: 'unavailable', attributes: {} }
		this.config.bindings.forEach(({ selector, type, bind }, index) => {
			if (!selector || !bind || !type) return
			this.shadowRoot.querySelectorAll(selector).forEach(target => {
				const prevState = this.storedValues[index]
				let nextState = null
				try {
					const getState = new Function('hass', 'config', 'entity', 'state', 'attr', bind)
					nextState = getState.call(target, hass, config, entity, entity.state, entity.attributes)
				} catch (e) {
					console.log('BINDING --> FAILED', bind)
				}
				if (prevState == null || nextState !== prevState) {
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
		this.config.actions.forEach(({ selector, type, call }) => {
			if (!selector || !call || !type) return
			const target = e.target.closest(selector)
			if (type === e.type && target) {
				try {
					const setState = new Function('hass', 'config', 'entity', call)
					setState.call(target, hass, config, entity)
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
console.log('Custom Element: EXAMPLE-CARD.')