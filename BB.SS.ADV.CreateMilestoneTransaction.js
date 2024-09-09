/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */

 /*
 * Copyright 2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/runtime', 'N/record', 'N/search', './BB SS/SS Lib/BB.MD.AdvPaymentModules'],

function(runtime, record, search, advpay) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
        try {
            var transactionArray = runtime.getCurrentScript().getParameter({
                name: 'custscript_bb_adv_tran_array'
            });
            var array = JSON.parse(transactionArray);
            log.debug('array values', array);
            if (array.length > 0) {
                for (var i = 0; i < array.length; i++) {
                    advpay.createAdvancedMilestoneTransaction(array[i]);
                }
            }

        } catch (e) {
            log.error('error generation advanced payment schedule transactions', e);
        }
    }

    return {
        execute: execute
    };
    
});
