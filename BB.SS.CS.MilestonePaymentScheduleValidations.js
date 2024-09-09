/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Milestone payment schedule validations
 */

 /**
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/currentRecord'],

function(currentRecord) {
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {

    }


    function saveRecord(scriptContext) {
        var schedule = scriptContext.currentRecord;

        var m0Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m0_percent'}));
        var m1Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m1_percent'}));
        var m2Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m2_percent'}));
        var m3Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m3_percent'}));
        var m4Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m4_percent'}));
        var m5Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m5_percent'}));
        var m6Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m6_percent'}));
        var m7Percent = parseFloat(schedule.getValue({fieldId: 'custrecord_bb_m7_percent'}));

        var m0Amount = schedule.getValue({fieldId: 'custrecord_bb_m0_amount'});
        var m1Amount = schedule.getValue({fieldId: 'custrecord_bb_m1_amount'});
        var m2Amount = schedule.getValue({fieldId: 'custrecord_bb_m2_amount'});
        var m3Amount = schedule.getValue({fieldId: 'custrecord_bb_m3_amount'});
        var m4Amount = schedule.getValue({fieldId: 'custrecord_bb_m4_amount'});
        var m5Amount = schedule.getValue({fieldId: 'custrecord_bb_m5_amount'});
        var m6Amount = schedule.getValue({fieldId: 'custrecord_bb_m6_amount'});
        var m7Amount = schedule.getValue({fieldId: 'custrecord_bb_m7_amount'});
        var totalPercent = m0Percent + m1Percent + m2Percent + m3Percent + m4Percent + m5Percent + m6Percent + m7Percent;

        if (m0Percent > 0 && m0Amount > 0) {
            alert('You can only enter a percent or amount for M0 Milestone transactions. You cannot enter both.');
            return false;
        } else if (m1Percent > 0 && m1Amount > 0) {
            alert('You can only enter a percent or amount for M1 Milestone transactions. You cannot enter both.');
            return false;
        } else if (m2Percent > 0 && m2Amount > 0) {
            alert('You can only enter a percent or amount for M2 Milestone transactions. You cannot enter both.');
            return false;
        } else if (m3Percent > 0 && m3Amount > 0) {
            alert('You can only enter a percent or amount for M3 Milestone transactions. You cannot enter both.');
            return false;
        } else if (m4Percent > 0 && m4Amount > 0) {
            alert('You can only enter a percent or amount for M4 Milestone transactions. You cannot enter both.');
            return false;
        } else if (m5Percent > 0 && m5Amount > 0) {
            alert('You can only enter a percent or amount for M5 Milestone transactions. You cannot enter both.');
            return false;
        } else if (m6Percent > 0 && m6Amount > 0) {
            alert('You can only enter a percent or amount for M6 Milestone transactions. You cannot enter both.');
            return false;
        }  else if (m7Percent > 0 && m7Amount > 0) {
            alert('You can only enter a percent or amount for M7 Milestone transactions. You cannot enter both.');
            return false;
        } else if (totalPercent > 100 || totalPercent < 100) {
            alert('The percents you entered either exceed 100% or are less than 100%. Please change your percents values to equal exactly 100% across all milestone percents.');
        } else {
            return true;
        }

    }

    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    };
    
});