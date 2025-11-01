// js/infra_acts.js

import { getCurrentState, saveSystemState, addVibration, logToConsole } from './core_logic.js'; 

/**
 * LOGOS-ENERGY (電力) または LOGOS-NET (通信) の論理的供給レベルを調整する作為。
 * @param {string} infrastructureType - 'ENERGY' または 'NET'
 */
export async function actAdjustSupply(infrastructureType) {
    const inputId = infrastructureType === 'ENERGY' ? 'energy_act_amount' : 'net_act_amount';
    const inputElement = document.getElementById(inputId);
    const amount = parseFloat(inputElement?.value);

    if (isNaN(amount) || amount < 0 || amount > 100) {
        logToConsole(`[ERROR/INFRA]: 有効な供給量（0-100%）を入力してください。`, 'error-message');
        return;
    }

    const state = getCurrentState();
    const targetKey = infrastructureType === 'ENERGY' ? 'energy_supply' : 'net_stability';
    const logName = infrastructureType === 'ENERGY' ? '電力供給 (ENERGY)' : '通信安定性 (NET)';

    // 作為の実行 (論理的供給レベルの変更)
    const newInfrastructureState = {
        ...state.infrastructure,
        [targetKey]: { 
            value: amount, 
            last_change: Date.now() 
        }
    };
    
    await saveSystemState({ infrastructure: newInfrastructureState });

    // 作為はVibration（論理的コスト）を発生させる
    const vibeCost = 1.0; 
    await addVibration(vibeCost); 

    logToConsole(`[INFRA ACT]: **${logName}** の論理的供給レベルが **${amount.toFixed(1)}%** に調整されました。Vibration +${vibeCost.toFixed(2)}。`, 'system-message');
}
