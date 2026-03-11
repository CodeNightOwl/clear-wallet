<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>输入签名凭证</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close" color="primary">取消</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-label>请输入后端签名凭证</ion-label>
        </ion-item>
        <ion-item v-if="accountAddress">
          <ion-label>账户地址</ion-label>
          <ion-text slot="end" style="font-size: 0.8rem;">{{ accountAddress.substring(0, 10) }}...{{ accountAddress.substring(accountAddress.length - 8) }}</ion-text>
        </ion-item>

        <ion-item>
          <ion-input
            ref="authTokenInputRef"
            label-placement="floating"
            aria-label="auth_token"
            type="password"
            v-model="authToken"
            autocomplete="off"
            :clear-input="false"
            :clear-on-edit="false"
            :spellcheck="false"
            placeholder="请输入 auth_token"
          >
            <div slot="label"><ion-text color="danger">(Auth Token)</ion-text></div>
          </ion-input>
        </ion-item>
      </ion-list>

      <ion-item>
        <ion-button
          @click="handleSubmit"
          :disabled="isSubmitting || !authToken"
          expand="block"
        >
          确认
        </ion-button>
      </ion-item>

      <ion-alert
        :is-open="alertOpen"
        header="提示"
        :message="alertMsg"
        :buttons="['OK']"
        @didDismiss="alertOpen = false"
      ></ion-alert>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonAlert,
  IonList,
  IonButtons,
  IonText,
  modalController,
} from "@ionic/vue";

interface Props {
  accountAddress?: string
}

const props = defineProps<Props>();
const authToken = ref("");
const alertOpen = ref(false);
const alertMsg = ref("");
const isSubmitting = ref(false);
const authTokenInputRef = ref<any>(null);
const accountAddress = ref(props.accountAddress);

const close = () => {
  return modalController?.dismiss(null, "cancel");
};

const handleSubmit = async () => {
  if (!authToken.value || isSubmitting.value) return;

  isSubmitting.value = true;

  try {
    if (!accountAddress.value) {
      alertMsg.value = "无法识别账户地址";
      alertOpen.value = true;
      return;
    }

    // 获取当前的 authTokens 映射
    const sessionAuthTokens = await chrome.storage.session.get('authTokens');
    const authTokensMap = sessionAuthTokens.authTokens ?? {};

    // 保存到 session storage（使用账户地址作为 key）
    authTokensMap[accountAddress.value] = authToken.value;
    await chrome.storage.session.set({ authTokens: authTokensMap });

    await modalController.dismiss(authToken.value, 'confirm');
  } catch (error) {
    alertMsg.value = "保存失败，请重试";
    alertOpen.value = true;
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  setTimeout(() => {
    authTokenInputRef.value?.$el?.setFocus?.();
  }, 100);
});
</script>