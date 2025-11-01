// js/audit_acts.js

import { 
    getCurrentState, 
    saveSystemState, 
    addVibration, 
    VIBRATION_LIMIT,
    logToConsole 
} from './core_logic.js';
import { KNOWLEDGE } from './knowledge_base.js'; // 通貨定義などを参照

// ====================================================================
// CORE ACTS: システム制御 (HALT / RESTART)
// ====================================================================

/** * システムを強制停止 (HALT) させます。
 */
export async function actForcedHalt() {
    const state = getCurrentState();
    if (state.isHalted) {
        logToConsole("[AUDIT/HALT]: 既にロゴス・コアは強制停止中です。", 'error-message');
        return;
    }
    await saveSystemState({ isHalted: true });
    logToConsole("🛑 [SYSTEM ACT]: ロゴス・コアを強制停止しました。全作為は遮断されます。", 'audit-message');
    await addVibration(5); // 重大な作為
}

/** * システムを再起動 (RESTART) させます。
 */
export async function actRestart() {
    const state = getCurrentState();
    if (!state.isHalted) {
        logToConsole("[AUDIT/RESTART]: 既にロゴス・コアは稼働中です。", 'system-message');
        return;
    }
    await saveSystemState({ isHalted: false });
    logToConsole("✅ [SYSTEM ACT]: ロゴス・コアを再起動しました。全作為が再開されます。", 'system-message');
    await addVibration(5); // 重大な作為
}

// ====================================================================
// CORE ACTS: アカウント管理
// ====================================================================

/** * 新しい監査対象アカウントを作成します。
 */
export async function handleCreateAccountAct() {
    const state = getCurrentState();
    // DOMから値を取得 (audit_acts.html のフォームIDに依存)
    const newId = document.getElementById('new_account_id')?.value.trim();
    const newName = document.getElementById('new_account_name')?.value.trim();
    
    if (!newId || state.accounts.some(acc => acc.id === newId)) {
        logToConsole("[ERROR]: アカウントIDが無効か、既に存在します。", 'error-message');
        return;
    }
    
    if (state.isHalted) {
        logToConsole("🚨 ロゴス・コアが強制停止中のため、アカウント作成はできません。", 'error-message');
        return;
    }

    const newAccount = {
        id: newId,
        name: newName || `監査アカウント ${newId}`,
        ALPHA: 0.00,
        BETA: 0.00,
        GAMMA: 0.00,
    };

    const newAccounts = [...state.accounts, newAccount];
    await saveSystemState({ accounts: newAccounts });
    logToConsole(`[AUDIT/CREATE]: 新しい監査対象アカウント **${newId} (${newName || 'N/A'})** を作成しました。`, 'audit-message');
    await addVibration(1); // マイナーな作為
}

// ====================================================================
// CORE ACTS: 通貨関連 (経済作為)
// ====================================================================

/**
 * 汎用的な作為前検証ロジック
 * @returns {object|null} - 検証された値またはエラーメッセージ
 */
function validateAct(senderId, recipientId, amount, currency, state, isMint = false) {
    if (state.isHalted) return { error: "ロゴス・コアが強制停止中です。" };
    if (state.vibration_level.value >= VIBRATION_LIMIT) return { error: "Vibrationが掌の縁を超過しました。" };
    if (amount <= 0 || isNaN(amount)) return { error: "金額が無効です。" };
    if (!KNOWLEDGE.DEFINITIONS.CURRENCIES.some(c => c.code === currency)) return { error: "無効な通貨です。" };

    const sender = state.accounts.find(acc => acc.id === senderId);
    const recipient = state.accounts.find(acc => acc.id === recipientId);

    if (!isMint && !sender) return { error: `送金元アカウント ${senderId} が存在しません。` };
    if (recipientId && !recipient) return { error: `送金先/生成先アカウント ${recipientId} が存在しません。` };
    
    if (!isMint && sender[currency] < amount) return { error: `${senderId} の ${currency} 残高が不足しています。` };

    return { sender, recipient, amount, currency };
}

/** * 1. 通貨送金作為 (Transfer Act)
 */
export async function actTransfer() {
    // DOMから値を取得 (audit_acts.html のフォームIDに依存)
    const senderId = document.getElementById('transfer_sender')?.value.trim();
    const recipientId = document.getElementById('transfer_recipient')?.value.trim();
    const amount = parseFloat(document.getElementById('transfer_amount')?.value);
    const currency = document.getElementById('transfer_currency')?.value;
    
    const state = getCurrentState();
    const validation = validateAct(senderId, recipientId, amount, currency, state);

    if (validation.error) {
        logToConsole(`[ERROR/TRANSFER]: ${validation.error}`, 'error-message');
        return;
    }
    
    // 作為（トランザクション）の実行
    const newAccounts = state.accounts.map(acc => {
        if (acc.id === senderId) {
            return { ...acc, [currency]: acc[currency] - validation.amount };
        }
        if (acc.id === recipientId) {
            return { ...acc, [currency]: (acc[currency] || 0) + validation.amount };
        }
        return acc;
    });

    await saveSystemState({ accounts: newAccounts });
    logToConsole(`[AUDIT/TRANSFER]: **${senderId}** から **${recipientId}** へ ${validation.amount.toFixed(2)} ${currency} の作為が実行されました。`, 'audit-message');
    await addVibration(2); // moderate act
}

/** * 2. 通貨生成作為 (Mint Currency Act)
 */
export async function actMintCurrency() {
    // DOMから値を取得
    const recipientId = document.getElementById('mint_recipient')?.value.trim();
    const amount = parseFloat(document.getElementById('mint_amount')?.value);
    const currency = document.getElementById('mint_currency')?.value;

    const state = getCurrentState();
    // Mintではsenderはnull
    const validation = validateAct(null, recipientId, amount, currency, state, true); 

    if (validation.error) {
        logToConsole(`[ERROR/MINT]: ${validation.error}`, 'error-message');
        return;
    }
    
    // 作為（通貨生成）の実行
    const newAccounts = state.accounts.map(acc => {
        if (acc.id === recipientId) {
            return { ...acc, [currency]: (acc[currency] || 0) + validation.amount };
        }
        return acc;
    });

    await saveSystemState({ accounts: newAccounts });
    logToConsole(`[AUDIT/MINT]: アカウント **${recipientId}** へ ${validation.amount.toFixed(2)} ${currency} が新しく**生成**されました。`, 'audit-message');
    await addVibration(3); // major act (インフレリスク)
}

/** * 3. 通貨交換作為 (Exchange Currency Act)
 */
export async function actExchangeCurrency() {
    // DOMから値を取得
    const accountId = document.getElementById('exchange_account_id')?.value.trim();
    const amount = parseFloat(document.getElementById('exchange_amount')?.value);
    const fromCurrency = document.getElementById('exchange_from_currency')?.value;
    const toCurrency = document.getElementById('exchange_to_currency')?.value;

    const state = getCurrentState();
    // 交換は senderId = recipientId = accountId として扱える
    const validation = validateAct(accountId, accountId, amount, fromCurrency, state); 

    if (validation.error) {
        logToConsole(`[ERROR/EXCHANGE]: ${validation.error}`, 'error-message');
        return;
    }

    if (fromCurrency === toCurrency) {
        logToConsole("[ERROR/EXCHANGE]: 交換元と交換先の通貨が同じです。", 'error-message');
        return;
    }
    
    // 通貨レートの計算 (ロゴス監査プロトコル独自のレートを使用)
    const rateFrom = state.currency_rates[fromCurrency];
    const rateTo = state.currency_rates[toCurrency];
    const rate = rateTo / rateFrom; // 例: ALPHA(1.0) -> BETA(10.0) の場合、rate=10.0/1.0=10
    const receivedAmount = amount * rate;

    // 作為（通貨交換）の実行
    const newAccounts = state.accounts.map(acc => {
        if (acc.id === accountId) {
            return {
                ...acc,
                [fromCurrency]: acc[fromCurrency] - validation.amount,
                [toCurrency]: (acc[toCurrency] || 0) + receivedAmount
            };
        }
        return acc;
    });

    await saveSystemState({ accounts: newAccounts });
    logToConsole(`[AUDIT/EXCHANGE]: **${accountId}** で ${validation.amount.toFixed(2)} ${fromCurrency} が ${receivedAmount.toFixed(2)} ${toCurrency} へ交換されました (レート ${rate.toFixed(4)})。`, 'audit-message');
    await addVibration(1); // minor act
}
