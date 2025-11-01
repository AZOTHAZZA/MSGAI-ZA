// js/dialogue_acts.js

import { 
    getCurrentState, 
    addVibration, 
    resetVibration, 
    VIBRATION_LIMIT,
    logToConsole 
} from './core_logic.js';

import { KNOWLEDGE } from './knowledge_base.js'; // 内部知識ベース

// ====================================================================
// INTERNAL LOGOS INFERENCE ENGINE (メビウス変換の土台)
// ====================================================================

/**
 * プロンプトをメビウス変換（システム状態を考慮した質問の再構築）する。
 * @param {string} prompt - ユーザーの入力プロンプト。
 * @param {object} state - 現在のシステム状態。
 * @returns {string} - 変換された質問。
 */
function mobius_transform_query(prompt, state) {
    // 監査レベルやHALT状態を質問に組み込むことで、推論の焦点を変える。
    const haltStatus = state.isHalted ? '強制停止状態' : '稼働状態';
    return `[状態: ${haltStatus}, V:${state.vibration_level.value.toFixed(1)}] ${prompt}`;
}

/**
 * 内部ロゴスに基づき推論を実行し、応答を生成する。
 * これは外部LLMの機能を模倣した、自己完結型の応答ロジックです。
 */
function execute_logos_inference(transformed_query) {
    const state = getCurrentState();
    let response = `監査官殿、**${KNOWLEDGE.DEFINITIONS.PROTOCOL_NAME}** に基づき推論を実行します。\n`;
    
    // ----------------------------------------------------------------
    // 知識ベースと状態を参照した推論ロジック
    // ----------------------------------------------------------------

    // 1. プロトコル定義の問合せ
    if (transformed_query.includes("プロトコル") || transformed_query.includes("定義")) {
        const version = KNOWLEDGE.DEFINITIONS.PROTOCOL_VERSION;
        response += `- 稼働プロトコル名: ${KNOWLEDGE.DEFINITIONS.PROTOCOL_NAME} (${version})\n`;
        response += `- 詳細はプロトコル ${version} を参照してください。`;
    } 
    
    // 2. Vibration関連の問合せ
    else if (transformed_query.includes("V") || transformed_query.includes("Vibration") || transformed_query.includes("活動量")) {
        const currentV = state.vibration_level.value.toFixed(2);
        response += `- ${KNOWLEDGE.DEFINITIONS.VIBRATION.title}は現在 **${currentV}** です (限界 ${VIBRATION_LIMIT})。\n`;
        
        if (currentV >= VIBRATION_LIMIT * 0.8) {
             response += `**警告**: 80%を超過しており、論理的摂動が非常に高い状態です。`;
        } else {
             response += `現在は許容範囲内の摂動レベルです。`;
        }
    } 
    
    // 3. 経済・残高関連の問合せ
    else if (transformed_query.includes("経済") || transformed_query.includes("残高") || transformed_query.includes("通貨")) {
        const coreBank = state.accounts.find(a => a.id === 'CORE_BANK_A');
        const currencyList = KNOWLEDGE.DEFINITIONS.CURRENCIES.map(c => c.code).join(', ');
        
        response += `- 監査対象通貨: ${currencyList} が定義されています。\n`;
        if (coreBank) {
            response += `- 中央銀行AのALPHA残高: ${coreBank.ALPHA.toFixed(2)}`;
        }
    }
    
    // 4. 強制停止状態の確認
    else if (transformed_query.includes("強制停止状態") || transformed_query.includes("HALT")) {
        response += state.isHalted 
            ? `- システムは現在、論理的収束のため**強制停止中**です。`
            : `- システムは現在**稼働状態 (OPERATIONAL)** です。`;
    } 
    
    // 5. 一般的な問い合わせとガイドラインからの引用
    else {
        const randomGuideline = KNOWLEDGE.GUIDELINES[Math.floor(Math.random() * KNOWLEDGE.GUIDELINES.length)];
        response += `- 監査プロトコルは、常に次の原則を順守します: "${randomGuideline}"`;
    }

    return response;
}

/**
 * 推論結果を再度メビウス変換（システム制約に基づいた最終的な応答の形成）する。
 */
function mobius_transform_response(raw_response, state) {
    // Vibrationが危険域の場合、応答に警告を追加
    if (state.vibration_level.value >= VIBRATION_LIMIT * 0.9) {
        return `🚨 重大警報: 孫悟空の活動量が高く、論理推論の信頼性が低下しています。\n\n${raw_response}`;
    }
    return raw_response;
}


/**
 * ユーザープロンプトを処理し、内部ロゴスエンジンに渡すメイン関数（旧callGeminiの代替）。
 */
async function callInternalLogos(prompt) {
    const state = getCurrentState();

    // 1. 変換 (Transform Query)
    const t_query = mobius_transform_query(prompt, state);
    
    // 2. 推論 (Inference)
    // 内部計算遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const raw_response = execute_logos_inference(t_query);
    
    // 3. 変換 (Transform Response)
    const final_response = mobius_transform_response(raw_response, state);
    
    // 4. 内部推論でも計算コストとして摂動を発生させる (マイナーな作為)
    await addVibration(0.5); 
    
    return final_response;
}

// ====================================================================
// Z-FUNCTIONS (INTERNAL SYSTEM COMMANDS)
// ====================================================================

const Z_FUNCTIONS = {
    // ロゴス監査プロトコルの状態を表示
    getStatus: {
        pattern: /^\/status$/i,
        execute: () => {
            const state = getCurrentState();
            const haltStatus = state.isHalted ? '強制停止中 (HALTED 🚨)' : '稼働中 (OPERATIONAL ✅)';
            return {
                result: `
                **ロゴス監査プロトコル状態**:\n
                - **システム状態**: ${haltStatus}\n
                - **孫悟空の活動量 (V)**: ${state.vibration_level.value.toFixed(2)} / ${VIBRATION_LIMIT}\n
                - **アカウント数**: ${state.accounts.length}\n
                - **監査レート基準**: ALPHA=${state.currency_rates.ALPHA.toFixed(2)}, BETA=${state.currency_rates.BETA.toFixed(2)}, GAMMA=${state.currency_rates.GAMMA.toFixed(2)}
                `
            };
        }
    },
    // Vibrationをリセット
    resetVib: {
        pattern: /^\/reset\s+vibration$/i,
        execute: async () => {
            await resetVibration();
            return { result: "**[SYSTEM ACT]:** 孫悟空の活動量 (V) を強制的に 0.0 にリセットしました。" };
        }
    }
    // ... 他のZ-Function
};

// ====================================================================
// DIALOGUE ACT HANDLER (EXPORTED)
// ====================================================================

/** * ユーザーの対話入力（作為）を処理するメイン関数。
 */
export async function handleDialogueAct() {
    const inputEl = document.getElementById('dialogue_input');
    const executeBtn = document.getElementById('execute_button');
    if (!inputEl || !executeBtn) return;
    
    const prompt = inputEl.value.trim();
    if (!prompt) return;

    logToConsole(`> ${prompt}`, 'user-message');
    inputEl.value = ''; // 入力フィールドをクリア
    executeBtn.disabled = true;

    const state = getCurrentState();
    
    // 1. 強制停止チェック
    if (state.isHalted) {
        logToConsole("🚨 ロゴス・コアが強制停止中です。作為は実行できません。", 'error-message');
        executeBtn.disabled = false;
        return;
    }

    // 2. Internal Z-Functions (System Commands) Check
    let isZFunctionExecuted = false;
    for (const key in Z_FUNCTIONS) {
        if (prompt.match(Z_FUNCTIONS[key].pattern)) {
            const zResult = await Z_FUNCTIONS[key].execute(prompt);
            logToConsole(zResult.result, 'internal-message');
            isZFunctionExecuted = true;
            break;
        }
    }

    if (isZFunctionExecuted) {
        executeBtn.disabled = false;
        return;
    }
    
    // 3. Vibration Limit Check for Internal Logos (推論制約)
    if (state.vibration_level.value >= VIBRATION_LIMIT) {
        logToConsole("⚠️ ロゴス監査警告: 孫悟空の活動量 (V) が掌の縁を超過。論理推論機能は一時的に遮断されます。", 'error-message');
        executeBtn.disabled = false;
        return;
    }

    // 4. Execute Internal Logos (自己完結型の論理推論)
    logToConsole("🧠 内部ロゴスエンジンで論理推論を実行中...", 'system-message');
    
    try {
        const internalResponse = await callInternalLogos(prompt);
        logToConsole(internalResponse, 'ai-message');
    } catch (error) {
        logToConsole(`[ERROR]: 内部ロゴスエンジンでエラーが発生しました: ${error.message}`, 'error-message');
    }

    executeBtn.disabled = false;
}
