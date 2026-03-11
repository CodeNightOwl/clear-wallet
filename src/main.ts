import { createApp } from 'vue'
import App from './App.vue'
import router from './router';
import { IonicVue } from '@ionic/vue';
import { migrateAuthTokenToSession } from '@/utils/platform';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* Theme variables */
import './theme/variables.css';

// 迁移旧数据
migrateAuthTokenToSession().catch(err => {
  console.error('Failed to migrate auth_token:', err)
})

const app = createApp(App)
  .use(IonicVue, { scrollAssist: false, rippleEffect: false })
  .use(router);

router.isReady().then(() => {
  app.mount('#app');
});