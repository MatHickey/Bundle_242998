/**
 * Includes a plugin definition for auto Invoicing.
 * 
 * @NApiVersion 2.x
 * @NScriptType plugintypeimpl
 */
define(['N/search','N/record','./BB SS/SS Lib/moment.min'], function(search,record,moment) {
    'use strict';
    return {
        existingInvoice: function(endDate, projectId, customerId){
            var endDateStr = moment(endDate).format('M/D/YYYY');
            var templateLookup = search.create({
                type: search.Type.INVOICE,
                columns: [
                    {name: 'internalid'},
                    {name: 'entity'},
                    {name:'custbody_bb_project'},
                    {name:'custbody_c2_inv_period_start_date'},
                    {name:'custbody_c2_inv_period_end_date'}
                ],
                filters: [{
                    name: 'entity',
                    operator: 'is',
                    values: [customerId]
                },{
                    name: 'custbody_bb_project',
                    operator: 'is',
                    values: [projectId]
                },{
                    name: 'custbody_c2_inv_period_end_date',
                    operator: search.Operator.ONORAFTER,
                    values: [endDateStr]
                } ]
            }).run().getRange({ start: 0, end: 10 });
            return templateLookup.length;
        },

        createInvoice: function(data) {
            return 0;
        },

        getRate: function(data) {
            try {
                return true;
            } catch (e) {
                return false;
            }
        },

        getInvoiceCustomers: function(projectID){
            //lookup offtaker records with project as parent
            var offTakerSearch = search.create({
                type:'customrecord_c2_project_offtaker',
                filters:['custrecord_c2_proj_offtkr_project','anyof',projectID],
                columns:['internalid']
            });
            var offTakerIDs = [];
            offTakerSearch.run.each(function(result){
                var curID = result.getValue({
                    name:'internalID'
                });
                offTakerIDs.push(curID);
            });
            return offTakerIDs;
        },

        helloWorld: function(){
            log.debug('This is a test', 'TEST!');
        },

        getOfftaker: function(projectID){
            return 0;
        },

        getRates: function(endDate,project){
            return undefined;
        }

    };
});