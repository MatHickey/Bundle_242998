/**
 * This is a Suitelet that creates an invoice for a project milestone
 *
 * @exports BB.SS.SL.GenerateMilestoneInvoice
 *
 * @author Michael Golichenko <mgolichenko@bluebanyansolutions.com>
 * @version 0.0.1
 *
 * @NApiVersion 2.x
 * @NModuleScope public
 * @NScriptType Suitelet
 **/

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/http', 'N/record', './BB SS/SS Lib/BB.SS.Invoice.Service', './BB SS/SS Lib/BB.SS.VendorBill.Service'],
    /**
     * @param httpModule {http}
     * @param recordModule {record}
     * @param invoiceService
     * @param vendorBillService
     */
    function(httpModule, recordModule, invoiceService, vendorBillService){

    var _exports = {};

    /**
     * <code>onRequest</code> event handler
     *
     * @governance 47
     * @param context {Object}
     * @param context.request {ServerRequest} Incoming request object
     * @param context.response {ServerResponse} Outgoing response object
     *
     * @return {void}
     *
     * @static
     * @function onRequest
     */
    function onRequest(context){
        var _response = {
            status: 'success',
            errors: []
        };
        if(context.request.method == http.Method.GET){
            var _projectId = context.request.parameters.projectId,
                _milestone = context.request.parameters.milestone,
                _type = context.request.parameters.type;
            if(_projectId && _milestone && /^m[0-3]$/gi.test(_milestone)){
                try{
                    switch (_type){
                        case recordModule.Type.INVOICE:
                            invoiceService.createInvoiceFromProjectIdAndMilestoneName(_projectId, _milestone);
                            break;
                        case recordModule.Type.VENDOR_BILL:
                            vendorBillService.createVendorBillFromProjectIdAndMilestoneName(_projectId, _milestone);
                            break;
                        default:
                            _response.errors.push(["Invalid transaction type. Only", recordModule.Type.INVOICE, recordModule.Type.VENDOR_BILL, "are applicable."].join(" "));
                            break;
                    }


                } catch(ex) {
                    _response.errors.push(ex)
                }

            }
            if(!_projectId){
                _response.errors.push("Project id is not provided.");
            }
            if(!_milestone){
                _response.errors.push("Milestone is not provided.")
            }
        } else {
            _response.errors.push("Only GET method is allowed.")
        }
        if(_response.errors.length > 0){
            _response.errors.status = 'failed';
        }
        context.response.setHeader({name: 'Content-Type', value: 'application/json'});
        context.response.write(JSON.stringify(_response));
    }

    _exports.onRequest = onRequest;
    return _exports;
});