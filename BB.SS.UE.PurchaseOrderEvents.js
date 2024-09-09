/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 * @author Matt Lehman
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/record', 'N/search'], function(record, search) {

    function beforeLoad(scriptContext) {
        scriptContext.form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.BW.CS.GetItemAvailibility.js';
        var config = record.load({
            type: 'customrecord_bb_solar_success_configurtn',
            id: 1
        });
        var bayWayVendor = config.getValue({fieldId: 'custrecord_bb_baywa_vendor'});
        var currentVendor = scriptContext.newRecord.getValue({fieldId: 'entity'});

        if (config.getValue({fieldId: 'custrecord_bb_bay_check_po_item_avail'}) && bayWayVendor == currentVendor) {
            scriptContext.form.addButton({
                id: 'custpage_baywa_availability',
                label: 'Check BayWa r.e. Availability',
                functionName: 'getItemAvailability'
            });
        }
    }
    
    return {
        beforeLoad: beforeLoad,
    };

});