<template>
  <ion-app>
    <ion-router-outlet aria-label="Main content" :aria-hidden="false" />
  </ion-app>
</template>

<script lang="ts" setup>
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import { onBeforeMount, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getSettings } from "@/utils/platform";
import { getSelectedAddress } from "@/utils/wallet";
import type { RequestArguments } from "@/extension/types";

const route = useRoute();
const router = useRouter();

window.addEventListener("hide.bs.modal", (event) => {
  (event.target as any)!.inert = true;
});
window.addEventListener("show.bs.modal", (event) => {
  (event.target as any)! = false;
});

const pageListener = (
  message: RequestArguments,
  sender: any,
  sendResponse: (a: any) => any
) => {
  if (chrome.runtime.lastError) {
    console.info("Error receiving message:", chrome.runtime.lastError);
  }
  if (message?.type === "CLWALLET_PAGE_MSG") {
    console.info("page listener:", message);

    (async () => {
      if (!message?.method) {
        sendResponse({
          code: 500,
          message: "Invalid request method",
        });
      } else {
        // ETH API
        switch (message.method) {
          case "paste": {
            const currentAddress = (await getSelectedAddress()) as string[];
            if (currentAddress.length > 0) {
              document.execCommand("insertText", false, currentAddress[0]);
            }
            sendResponse(true);
            break;
          }
          default: {
            sendResponse({
              error: true,
              message:
                "ClearWallet: Invalid PAGE request method " + (message?.method ?? ""),
            });
            break;
          }
        }
      }
    })();
  }
  return true;
};

if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(pageListener);
  console.info("page listener set");
}

onBeforeMount(() => {
  getSettings().then((settings) => {
    if (settings.theme !== "system") {
      document.body.classList.remove(settings.theme === "dark" ? "light" : "dark");
      document.body.classList.add(settings.theme);
    }
  });
});
</script>
