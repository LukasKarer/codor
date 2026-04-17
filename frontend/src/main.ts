import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { loader } from '@guolao/vue-monaco-editor'

import App from './App.vue'
import router from './router'
import { i18n } from './plugins/i18n'
import './style.css'

// Configure Monaco Editor to load from CDN
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs',
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

app.mount('#app')
