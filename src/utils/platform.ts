import type { Network, Account, Prices, Settings, Networks, HistoryItem, ContractActions, ContractAction, Contact } from '@/extension/types'
import type { Ref } from 'vue'

const pottentialMissingSettings = ['copyLowerCaseAddress']

const defaultSettings = {
    enableStorageEnctyption: false,
    encryptAfterEveryTx: false,
    lockOutEnabled: false,
    lockOutPeriod: 2,
    lockOutBlocked: false,
    showRawTransactionData: true,
    enableAssetTransactionSimulation: false,
    assetTransactionSimulationAlchemyKey: '',
    theme: 'system',
    lastLock: Date.now(),
    lastRPCNotification: Date.now(),
    copyLowerCaseAddress: false,
    lastExecutedMigration: '',
}

/**
 * 迁移旧数据：将 local 中的 auth_token（或旧的 auth_sign）迁移到 session
 * 只执行一次
 */
export const migrateAuthTokenToSession = async (): Promise<void> => {
    const settings = await getSettings()
    if (settings.lastExecutedMigration === 'auth_token_to_session') {
        return // 已经迁移过
    }

    // 从 local 读取账户
    const localAccounts = await storageGet('accounts')
    const accounts = localAccounts.accounts ?? []

    // 查找所有带有 auth_token 或 auth_sign（旧字段名）的账户
    const authTokensMap: { [key: string]: string } = {}
    let migratedCount = 0

    accounts.forEach((acc: any) => {
        const token = acc.auth_token || acc.auth_sign // 优先使用新字段名，兼容旧字段名
        if (token && acc.address) {
            authTokensMap[acc.address] = token
            migratedCount++
        }
    })

    if (migratedCount > 0) {
        // 迁移到 session
        await chrome.storage.session.set({ authTokens: authTokensMap })
        console.log(`✅ [Migration] ${migratedCount} 个账户的 auth_token 已从 local 迁移到 session`)
    }

    // 更新迁移标记
    settings.lastExecutedMigration = 'auth_token_to_session'
    await setSettings(settings)
}

const defaultAbis = {} as {
    [key: string]: string
}

export const CLW_CONTEXT_MENU_ID = 'clw-paste-address'

export const storageSave = async (key: string, value: any): Promise<void> =>{
    await chrome.storage.local.set({ [key]: value })
}

export const storageGet = async (key: string): Promise<{ [key: string]: any }> => {
    return await chrome.storage.local.get(key)
}

export const storageWipe = async (): Promise<void> => {
    await chrome.storage.local.clear()
}

export const getNetworks = async (): Promise<Networks> => {
    return (await storageGet('networks'))?.networks ?? {} as Networks
}

export const replaceNetworks = async (networks: Networks): Promise<void> => {
    await storageSave('networks', networks)
}

export const saveNetwork = async (network: Network): Promise<void> => {
    const saveNetworks = await getNetworks()
    saveNetworks[network.chainId] = network
    await storageSave('networks', saveNetworks)
}


export const getSelectedNetwork  = async (): Promise<Network > => {
    return (await storageGet('selectedNetwork'))?.selectedNetwork ?? null as unknown as Network 
}


export const saveSelectedNetwork  = async (selectedNetwork: Network ): Promise<void> => {
    await storageSave('selectedNetwork', selectedNetwork )
}


export const getContacts = async (): Promise<Contact[]> => {
    return (await storageGet('contacts')).contacts ?? [] as Contact[]
}

export const saveContact = async (contact: Contact): Promise<void> => {
    const savedContacts = await getContacts()
    await storageSave('contacts', [contact, ...savedContacts])
}

export const replaceContacts = async (contacts: Contact[]): Promise<void> => {
    await storageSave('contacts', contacts)
}

export const getAccounts = async (): Promise<Account[]> => {
    const accounts = (await storageGet('accounts')).accounts ?? [] as Account[]
    const sessionAuthTokens = await chrome.storage.session.get('authTokens')
    const authTokensMap = sessionAuthTokens.authTokens ?? {}

    // 如果 session 中有 auth_tokens，根据账户地址合并
    if (Object.keys(authTokensMap).length > 0) {
        return accounts.map(acc => ({
            ...acc,
            auth_token: authTokensMap[acc.address] ?? ''
        }))
    }

    return accounts
}

export const saveAccount = async (account: Account): Promise<void> => {
    const savedAccounts = await getAccounts()
    const accountsToSave = [account, ...savedAccounts]

    // 将 address -> auth_token 映射保存到 session
    if (account.auth_token) {
        const sessionAuthTokens = await chrome.storage.session.get('authTokens')
        const authTokensMap = sessionAuthTokens.authTokens ?? {}
        authTokensMap[account.address] = account.auth_token
        await chrome.storage.session.set({ authTokens: authTokensMap })
    }

    // 保存账户（不包含 auth_token）
    const accountsWithoutAuthToken = accountsToSave.map(acc => {
        const { auth_token, ...rest } = acc
        return rest as Account
    })
    await storageSave('accounts', accountsWithoutAuthToken)
}

export const replaceAccounts = async (accounts: Account[]): Promise<void> => {
    // 将所有账户的 address -> auth_token 映射保存到 session
    const authTokensMap: { [key: string]: string } = {}
    accounts.forEach(acc => {
        if (acc.auth_token) {
            authTokensMap[acc.address] = acc.auth_token
        }
    })
    if (Object.keys(authTokensMap).length > 0) {
        await chrome.storage.session.set({ authTokens: authTokensMap })
    }

    // 保存账户（不包含 auth_token）
    const accountsWithoutAuthToken = accounts.map(acc => {
        const { auth_token, ...rest } = acc
        return rest as Account
    })
    await storageSave('accounts', accountsWithoutAuthToken)
}


export const getSelectedAccount = async (): Promise<Account> => {
    const account = (await storageGet('selectedAccount'))?.selectedAccount ?? null as unknown as Account
    const sessionAuthTokens = await chrome.storage.session.get('authTokens')
    const authTokensMap = sessionAuthTokens.authTokens ?? {}

    // 如果 session 中有该账户的 auth_token，合并到账户对象
    if (account && account.address && authTokensMap[account.address]) {
        return {
            ...account,
            auth_token: authTokensMap[account.address]
        }
    }

    return account
}


export const saveSelectedAccount = async (selectedAccount: Account): Promise<void> => {
    await storageSave('selectedAccount', selectedAccount )
}

export const setPrices = async (prices: Prices): Promise<void> => {
    await storageSave('prices', prices )
}

export const getPrices = async (): Promise<Prices> => {
    return (await storageGet('prices'))?.prices ?? {} as unknown as Prices
}

export const getHistory = async (): Promise<HistoryItem[]> => {
    return (await storageGet('history'))?.history ?? [] as unknown as Prices
}

export const addToHistory = async (historyItem: HistoryItem): Promise<void> => {
    const history = await getHistory()
    if (history.length >= 100) {
        history.pop()
        history.unshift(historyItem)
    } else {
        history.unshift(historyItem)
    }
    await storageSave('history', history)
}

export const wipeHistory = async (): Promise<void> => {
    await storageSave('history', [])
}

export const getSettings = async (): Promise<Settings> => {
    const settings = (await storageGet('settings'))?.settings ?? defaultSettings as unknown as Settings
    pottentialMissingSettings.forEach( (s: string) => {
        if(settings[s] === undefined) {
            settings[s as keyof Settings] = defaultSettings[s as keyof Settings]
        }
    })
    return settings
}

export const setSettings = async (settings: Settings): Promise<void> => {
    await storageSave('settings', settings )
}

export const getAllAbis = async (): Promise<{ [key: string]: string }> => {
    return ((await storageGet('abis'))?.abis) ?? defaultAbis
}

export const getAbis = async (name: string): Promise<string> => {
    return (await getAllAbis())?.[name] ?? ''
}

export const setAbi = async ({
    name ,
    content
}: {
    name: string
    content: string
}): Promise<void> => {
    const abis = await getAllAbis() || defaultAbis
    await storageSave('abis', { ...abis, [name]: content })
}

export const setAbis = async (abis: { [key: string]: string }): Promise<void> => {
    await storageSave('abis', abis)
}

export const removeAllAbis = async (): Promise<void> => {
    await storageSave('abis', defaultAbis)
}

export const readCAGetAll = async (): Promise<ContractActions> => {
    return ((await storageGet('read-actions'))?.['read-actions'] ?? {}) as ContractActions
}

export const readCAGet = async (action: string): Promise<ContractAction | undefined> => {
    return ((await readCAGetAll())?.[action]) as ContractAction
}

export const readCASet = async (action: ContractAction): Promise<void> => {
    const actions = await readCAGetAll()
    await storageSave('read-actions', { ...actions, [action.name]: action })
}

export const readCARemove = async (action: string): Promise<void> => {
    const actions = await readCAGetAll()
    delete actions[action]
    await storageSave('read-actions', actions)
}

export const readCAWipe = async (): Promise<void> => {
    await storageSave('read-actions', {})
}

export const writeCAGetAll = async (): Promise<ContractActions> => {
    return ((await storageGet('write-actions'))?.['write-actions'] ?? {}) as ContractActions
}

export const writeCAGet = async (action: string): Promise<ContractAction | undefined> => {
    return ((await writeCAGetAll())?.[action]) as ContractAction
}

export const writeCASet = async (action: ContractAction): Promise<void> => {
    const actions = await writeCAGetAll()
    await storageSave('write-actions', { ...actions, [action.name]: action })
}

export const writeCARemove = async (action: string): Promise<void> => {
    const actions = await writeCAGetAll()
    delete actions[action]
    await storageSave('write-actions', actions)
}

export const writeCAWipe = async (): Promise<void> => {
    await storageSave('write-actions', {})
}

export const setCachedFcAuthToken = async (token: string): Promise<void> => {
    await storageSave('fcAuthToken', token)
}

export const getCachedFcAuthToken = async (): Promise<string> => {
    return (await storageGet('fcAuthToken'))?.fcAuthToken ?? ''
}


export const blockLockout = async (): Promise<Settings> => {
    const settings = await getSettings()
    settings.lockOutBlocked = true
    await setSettings(settings)
    return settings
}

export const unBlockLockout = async (): Promise<Settings> => {
    const settings = await getSettings()
    settings.lockOutBlocked = false
    await setSettings(settings)
    return settings
}

export const getBalanceCache = async (): Promise<string> => {
    return (await storageGet('balance'))?.balance ?? '0x0'
}

export const setBalanceCache = async (balance: string): Promise<void> => {
    await storageSave('balance', balance )
}

export const smallRandomString = (size = 7) => {
    if(size <= 7) {
    return (Math.random() + 1).toString(36).substring(0,7);
    } else {
        let str = ''
        for(let i = 0; i < (size / 7) << 0; i++){
            str+=(Math.random() + i).toString(36).substring(0,7);
        }
        return str.substring(0, size)
    }
}

export const clearPk = async (): Promise<void> => {
    let accounts = await getAccounts()
    const accProm = accounts.map(async a => {
        if(a.encPk) {
            a.pk = ''
        }
      return a
    })
    accounts = await Promise.all(accProm)
    await Promise.all([replaceAccounts(accounts), saveSelectedAccount(accounts[0])])
}

export const hexTostr = (hexStr: string) => {
    if (hexStr.substring(0, 2) !== '0x') {
       return hexStr
    }
    hexStr = hexStr.substring(2);
    const match = hexStr.match(/../g);
    const bytes = new Uint8Array(match ? match.map(h => parseInt(h, 16)) : []);
    try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(bytes);
    } catch {
        const chunks = [];
        for (let i = 0, charsLength = hexStr.length; i < charsLength; i += 2) {
            chunks.push(hexStr.substring(i, i + 2));
        }
       return chunks.reduce(
       (pv, cv) => `${pv}${String.fromCharCode(parseInt(cv, 16))}`,
               '')
       }
};

export const strToHex = (str: string) =>  `0x${str.split('').map( s => s.charCodeAt(0).toString(16)).join('')}`

export const numToHexStr = (num: number | bigint) => `0x${num.toString(16)}`

export const copyText = async (address: string, toastRef: Ref<boolean>) => {
    await navigator.clipboard.writeText(address)
    toastRef.value = true
}

export const getUrl = (url: string) => chrome.runtime.getURL(url)

export const paste = (id: string) => {
    const el = document.querySelector(`#${id} input.native-input`) as HTMLInputElement
    if(el){
      el.focus();
      (document as any)?.execCommand('paste')
    }
}

export const pasteTextArea = (id: string) => {
    const el = document.querySelector(`#${id} textarea`) as HTMLTextAreaElement
    if(el){
      el.focus();
      (document as any)?.execCommand('paste')
    }
}

export const enableRightClickPasteAddr = async () => {
    try {
        await chrome.contextMenus.removeAll();
        await chrome.contextMenus.create({
            id: CLW_CONTEXT_MENU_ID,
            title: "Paste Current Address",
            contexts: ["editable"],
        });
    } catch (error) {
        // ignore
    }
}

export const pasteToFocused = () => {
    const el = document.activeElement as HTMLInputElement
    if(el){
      el?.focus();
      (document as any)?.execCommand('paste')
    }
}

export const openTab = (url: string) => {
    chrome.tabs.create({
        url
      });
}

export const getVersion = () => chrome?.runtime?.getManifest()?.version ?? ''

export const isFirefox = () => {
 return chrome?.runtime.getURL('').startsWith('moz-extension://')
}

// 后端签名服务配置
export interface BackendConfig {
    url: string
    groupId: string
}

export const getBackendConfig = async (): Promise<BackendConfig> => {
    const config = (await storageGet('backendConfig'))?.backendConfig ?? {
        url: 'http://nas.01rj.com:8000',
        groupId: ''
    } as BackendConfig
    return config
}

export const saveBackendConfig = async (config: BackendConfig): Promise<void> => {
    await storageSave('backendConfig', config)
}

// 后端签名函数
export const backendSign = async (
    method: string,
    params: any[],
    chainId: number,
    origin?: string
): Promise<string> => {
    console.log('🔍 [后端签名] 开始后端签名请求');
    console.log('📝 [后端签名] 方法:', method);
    console.log('📊 [后端签名] 参数:', JSON.stringify(params).substring(0, 200));

    const account = await getSelectedAccount()
    const network = await getSelectedNetwork()
    const config = await getBackendConfig()

    console.log('👤 [后端签名] 账户地址:', account?.address);
    console.log('🔑 [后端签名] auth_token:', account?.auth_token ? '✅ 已配置' : '❌ 未配置');
    console.log('🏷️ [后端签名] groupId:', account?.groupId || config.groupId || '❌ 未配置');
    console.log('🌐 [后端签名] 后端配置:', config);

    if (!account) {
        throw new Error('No account selected')
    }

    if (!account.auth_token) {
        console.error('❌ [后端签名] 错误: 账户 auth_token 字段为空');
        throw new Error('Account auth_token is missing. Please configure this wallet with backend service.')
    }

    const adsid = account.groupId || config.groupId || ''

    if (!adsid) {
        console.error('❌ [后端签名] 错误: groupId 为空');
        throw new Error('Group id (adsid) is missing. Please configure group id in backend settings.')
    }

    // 使用传入的 origin，如果没有则使用默认值
    const requestOrigin = origin || 'https://example.com'

    const request = {
        group_index: adsid,
        address: account.address,
        token: account.auth_token,
        origin: requestOrigin,
        method: method,
        params: params,
        chainId: chainId
    }

    console.log('📤 [后端签名] 发送请求到:', `${config.url}/api/rpc/`);
    console.log('📦 [后端签名] 请求内容:', JSON.stringify({
        ...request,
        token: request.token.substring(0, 20) + '...'
    }));

    try {
        const response = await fetch(`${config.url}/api/rpc/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        })

        console.log('📥 [后端签名] 响应状态:', response.status);

        const data = await response.json()

        console.log('📄 [后端签名] 响应数据:', data);

        if (data.code !== 0) {
            console.error('❌ [后端签名] 后端返回错误:', data.msg);
            throw new Error(data.msg || 'Backend sign failed')
        }

        console.log('✅ [后端签名] 签名成功');
        return data.data
    } catch (error) {
        console.error('💥 [后端签名] 请求失败:', error);
        throw error
    }
}