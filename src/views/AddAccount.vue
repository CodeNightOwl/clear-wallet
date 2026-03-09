<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title v-if="!isEdit">Add Account</ion-title>
        <ion-title v-else>Edit Account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-item>
        <ion-input
          label="Name"
          labelPlacement="stacked"
          v-model="name"
          fill="outline"
        ></ion-input>
      </ion-item>
      <ion-item>
        <ion-button @click="getRandomName">Generate Random Name</ion-button>
      </ion-item>
      <ion-item v-if="!authSign">
        <ion-icon
          style="margin-right: 0.5rem; cursor: pointer"
          @click="paste('pastePk')"
          :icon="clipboardOutline"
          button
        />
        <!-- <ion-input
          label="PK"
          labelPlacement="stacked"
          id="pastePk"
          v-model="pk"
          fill="outline"
          placeholder="后端签名模式可留空"
        ></ion-input> -->
      </ion-item>
      <ion-item>
        <ion-input
          label="Address (地址)"
          labelPlacement="stacked"
          v-model="address"
          fill="outline"
          placeholder="钱包地址（后端签名模式必填）"
          autocomplete="on"
        ></ion-input>
      </ion-item>
      <ion-item>
        <ion-input
          label="Auth Sign (后端签名)"
          labelPlacement="stacked"
          v-model="authSign"
          fill="outline"
          placeholder="从后端获取的鉴权签名"
        ></ion-input>
      </ion-item>
      <ion-item>
        <ion-input
          label="Group ID (指纹浏览器序号)"
          labelPlacement="stacked"
          v-model="groupId"
          fill="outline"
          placeholder="指纹浏览器环境序号"
        ></ion-input>
      </ion-item>
      <template v-if="!isEdit && !authSign">
        <ion-item>
          <ion-button @click="generateRandomPk">Generate Random Private Key</ion-button>
        </ion-item>
        <ion-item>
          <ion-button @click="mnemonicModal = true" expand="full"
            >Extract Private Key From A Mnemonic</ion-button
          >
        </ion-item>
      </template>
      <ion-item>
        <div style="margin-left: auto; display: flex">
          <ion-button @click="onCancel">Cancel</ion-button>
          <ion-button
            @click="
              () => {
                isEdit ? onEditAccount() : onAddAccount();
              }
            "
            expand="full"
            color="primary"
            >{{ isEdit ? "Edit Account" : "Add Account" }}</ion-button
          >
        </div>
      </ion-item>
      <ion-alert
        :is-open="alertOpen"
        header="Error"
        :message="alertMsg"
        :buttons="['OK']"
        @didDismiss="alertOpen = false"
      ></ion-alert>

      <ion-modal :is-open="mnemonicModal" @didDismiss="mnemonic = ''">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="mnemonicModal = false">Close</ion-button>
            </ion-buttons>
            <ion-title>Extract PK from mnemonic</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item>
            <ion-label>Enter mnemonic</ion-label>
          </ion-item>
          <ion-item>
            <ion-textarea
              style="overflow-y: scroll; width: 100%"
              aria-label="Enter mnemonic"
              :rows="10"
              :cols="10"
              v-model="mnemonic"
            ></ion-textarea>
          </ion-item>
          <ion-item>
            <ion-label>Enter Index (default: 0)</ion-label>
          </ion-item>
          <ion-item>
            <ion-input aria-label="mnemonic index" v-model="mnemonicIndex"></ion-input>
          </ion-item>
          <ion-item>
            <ion-button @click="mnemonicModal = false" color="light">Close</ion-button>
            <ion-button @click="extractMnemonic">Extract</ion-button>
          </ion-item>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { ref } from "vue";
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
  IonIcon,
  onIonViewWillEnter,
  modalController,
  IonModal,
  IonButtons,
  IonTextarea,
} from "@ionic/vue";
import { ethers } from "ethers";
import {
  saveSelectedAccount,
  getSelectedAccount,
  getAccounts,
  saveAccount,
  smallRandomString,
  paste,
  getSettings,
  replaceAccounts,
} from "@/utils/platform";
import router from "@/router";
import { useRoute } from "vue-router";
import type { Account, Settings } from "@/extension/types";
import UnlockModal from "@/views/UnlockModal.vue";
import { encrypt, getCryptoParams } from "@/utils/webCrypto";

import { clipboardOutline } from "ionicons/icons";
import { getFromMnemonic, getRandomPk } from "@/utils/wallet";
import { setUnlockModalState } from "@/utils/unlockStore";

const name = ref("");
const pk = ref("");
const address = ref("");
const authSign = ref("");
const groupId = ref("");
const alertOpen = ref(false);
const alertMsg = ref("");
const route = useRoute();
const isEdit = route.path.includes("/edit");
const paramAddress = route.params.address ?? "";
const mnemonicModal = ref(false);
const mnemonic = ref("");
const mnemonicIndex = ref(0);

let accountsProm: Promise<Account[] | undefined>;
let settingsProm: Promise<Settings | undefined>;

const resetFields = () => {
  name.value = "";
  pk.value = "";
  address.value = "";
  authSign.value = "";
  groupId.value = "";
};

const openModal = async () => {
  const modal = await modalController.create({
    component: UnlockModal,
    animated: true,
    focusTrap: false,
    backdropDismiss: false,
    componentProps: {
      unlockType: "addAccount",
    },
  });
  await modal.present();
  setUnlockModalState(true);
  const { role, data } = await modal.onWillDismiss();
  if (role === "confirm") return data;
  setUnlockModalState(false);
  return false;
};

onIonViewWillEnter(async () => {
  if (isEdit && paramAddress) {
    accountsProm = getAccounts();
    settingsProm = getSettings();
    const accounts = (await accountsProm) as Account[];
    const acc = accounts.find((account) => account.address === paramAddress);
    if (acc) {
      name.value = acc.name;
      authSign.value = acc.auth_sign || "";
      groupId.value = acc.groupId || "";
    }
  }
});

const deleteAccount = async (address: string, accounts: Account[]) => {
  const findIndex = accounts.findIndex((a) => a.address === address);
  const pArr: Array<Promise<void>> = [];
  if (findIndex !== -1) {
    accounts.splice(findIndex, 1);
    pArr.push(replaceAccounts([...accounts]));
  }
  await Promise.all(pArr);
};

const onEditAccount = async () => {
  if (name.value.length < 1) {
    alertMsg.value = "Name cannot be empty.";
    alertOpen.value = true;
    return;
  }
  const accounts = (await accountsProm) as Account[];
  const account = accounts.find((acc) => acc.address === paramAddress);
  if (!account) {
    alertMsg.value = "Account not found.";
    alertOpen.value = true;
    return;
  }
  
  // 保留原始账户的所有字段，只更新需要修改的字段
  const savedAcc: Account = {
    ...account,  // 保留所有原始字段
    name: name.value,
    auth_sign: authSign.value,
    groupId: groupId.value,
  };
  
  // 直接替换账户列表中的该账户，而不是删除再添加
  const findIndex = accounts.findIndex((a) => a.address === paramAddress);
  if (findIndex !== -1) {
    accounts[findIndex] = savedAcc;
  }

  await replaceAccounts([...accounts]);

  // 检查是否更新了当前选中的账户，如果是，也需要更新 selectedAccount
  const selectedAccount = await getSelectedAccount();
  if (selectedAccount && selectedAccount.address === paramAddress) {
    await saveSelectedAccount(savedAcc);
  }

  router.push("/tabs/accounts");
};

const onAddAccount = async () => {
  let p1 = Promise.resolve();
  if (name.value.length < 1) {
    alertMsg.value = "Name cannot be empty.";
    alertOpen.value = true;
    return;
  }
  
  // 如果有 auth_sign，使用后端签名模式
  if (authSign.value.length > 0) {
    // 后端签名模式：只需要地址和 auth_sign
    let accountAddress = "";
    
    // 如果用户填写了地址，使用用户填写的地址
    if (address.value.length > 0) {
      // 验证地址格式
      try {
        ethers.getAddress(address.value);
        accountAddress = ethers.getAddress(address.value);
      } catch (e) {
        alertMsg.value = "Invalid address format.";
        alertOpen.value = true;
        return;
      }
    } 
    // 如果用户没有填写地址，从私钥生成
    else if (pk.value.length > 0) {
      if (pk.value.length === 64) {
        pk.value = `0x${pk.value.trim()}`;
      }
      if (pk.value.length !== 66) {
        alertMsg.value = "Please provide a valid private key or address.";
        alertOpen.value = true;
        return;
      }
      const wallet = new ethers.Wallet(pk.value);
      accountAddress = wallet.address;
    } else {
      alertMsg.value = "Please provide either address or private key.";
      alertOpen.value = true;
      return;
    }
    
    // 私钥可以是任意值（用于满足数据结构）
    if (pk.value.length === 0) {
      pk.value = "0x" + "0".repeat(64);
    } else if (pk.value.length === 64) {
      pk.value = `0x${pk.value.trim()}`;
    }
    
    if (!accountsProm) {
      accountsProm = getAccounts();
    }
    if (!settingsProm) {
      settingsProm = getSettings();
    }
    const accounts = (await accountsProm) as Account[];
    const settings = (await settingsProm) as Settings;
    
    if (settings.enableStorageEnctyption) {
      const pass = await openModal();
      if (!pass) {
        alertMsg.value = "Cannot add account without encryption password.";
        alertOpen.value = true;
        return;
      }
      const cryptoParams = await getCryptoParams(pass);
      if ((accounts.length ?? 0) < 1) {
        p1 = saveSelectedAccount({
          address: accountAddress,
          name: name.value,
          pk: pk.value,
          encPk: await encrypt(pk.value, cryptoParams),
          auth_sign: authSign.value,
          groupId: groupId.value,
        });
      } else {
        if (accounts.find((account) => account.address === accountAddress)) {
          alertMsg.value = "Account already exists.";
          alertOpen.value = true;
          return;
        }
      }
      const p2 = saveAccount({
        address: accountAddress,
        name: name.value,
        pk: pk.value,
        encPk: await encrypt(pk.value, cryptoParams),
        auth_sign: authSign.value,
        groupId: groupId.value,
      });
      await Promise.all([p1, p2]);
    } else {
      if ((accounts.length ?? 0) < 1) {
        p1 = saveSelectedAccount({
          address: accountAddress,
          name: name.value,
          pk: pk.value,
          encPk: "",
          auth_sign: authSign.value,
          groupId: groupId.value,
        });
      } else {
        if (accounts.find((account) => account.address === accountAddress)) {
          alertMsg.value = "Account already exists.";
          alertOpen.value = true;
          return;
        }
      }
      const p2 = saveAccount({
        address: accountAddress,
        name: name.value,
        pk: pk.value,
        encPk: "",
        auth_sign: authSign.value,
        groupId: groupId.value,
      });
      await Promise.all([p1, p2]);
    }
  } else {
    // 本地签名模式：必须有真实的私钥
    if (pk.value.length === 64) {
      pk.value = `0x${pk.value.trim()}`;
    }
    if (pk.value.length !== 66) {
      alertMsg.value = "Please provide a valid private key for local signing, or add auth_sign for backend signing.";
      alertOpen.value = true;
      return;
    }

    const wallet = new ethers.Wallet(pk.value);
    if (!accountsProm) {
      accountsProm = getAccounts();
    }
    if (!settingsProm) {
      settingsProm = getSettings();
    }
    const accounts = (await accountsProm) as Account[];
    const settings = (await settingsProm) as Settings;
    if (settings.enableStorageEnctyption) {
      const pass = await openModal();
      if (!pass) {
        alertMsg.value = "Cannot add account without encryption password.";
        alertOpen.value = true;
        return;
      }
      const cryptoParams = await getCryptoParams(pass);
      if ((accounts.length ?? 0) < 1) {
        p1 = saveSelectedAccount({
          address: wallet.address,
          name: name.value,
          pk: pk.value,
          encPk: await encrypt(pk.value, cryptoParams),
        });
      } else {
        if (accounts.find((account) => account.address === wallet.address)) {
          alertMsg.value = "Account already exists.";
          alertOpen.value = true;
          return;
        }
      }
      const p2 = saveAccount({
        address: wallet.address,
        name: name.value,
        pk: pk.value,
        encPk: await encrypt(pk.value, cryptoParams),
      });
      await Promise.all([p1, p2]);
    } else {
      if ((accounts.length ?? 0) < 1) {
        p1 = saveSelectedAccount({
          address: wallet.address,
          name: name.value,
          pk: pk.value,
          encPk: "",
        });
      } else {
        if (accounts.find((account) => account.address === wallet.address)) {
          alertMsg.value = "Account already exists.";
          alertOpen.value = true;
          return;
        }
      }
      const p2 = saveAccount({
        address: wallet.address,
        name: name.value,
        pk: pk.value,
        encPk: "",
      });
      await Promise.all([p1, p2]);
    }
  }
  if (isEdit) {
    router.push("/tabs/accounts");
  } else {
    router.push("/tabs/home");
  }
  resetFields();
};

const generateRandomPk = () => {
  pk.value = getRandomPk();
};

const getRandomName = () => {
  name.value = smallRandomString();
};

const onCancel = () => {
  if (isEdit) {
    router.push("/tabs/accounts");
  } else {
    router.push("/tabs/home");
  }
};

const extractMnemonic = () => {
  mnemonic.value = mnemonic.value.trim().replace(/\s+/g, " ");
  mnemonicIndex.value = Number(mnemonicIndex.value);
  const wordCount = mnemonic.value.trim().split(" ").length;

  if (wordCount !== 12 && wordCount !== 24) {
    alertMsg.value = "Invalid mnemonic.";
    alertOpen.value = true;
    return;
  }
  if (mnemonicIndex.value < 0) {
    alertMsg.value = "Invalid index.";
    alertOpen.value = true;
    return;
  }
  pk.value = getFromMnemonic(mnemonic.value, mnemonicIndex.value);
  mnemonicModal.value = false;
};
</script>

<style scoped>
.input-fill-outline.sc-ion-input-md-h {
  min-height: 38px;
}
</style>
