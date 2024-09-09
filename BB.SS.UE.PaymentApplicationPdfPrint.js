/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([],
    
    () => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
                try {
                        if (scriptContext.type === scriptContext.UserEventType.VIEW) {
                                const form = scriptContext.form;
                                form.addButton({
                                        id: 'custpage_btn_print_form',
                                        label: 'Print',
                                        functionName: 'printCustomForm()'
                                });
                                form.clientScriptModulePath = 'SuiteScripts/BB.SS.CS.PaymentApplicationPdfPrint.js';
                        }
                } catch (e) {
                        log.error('ERROR', e);
                }
        }


        return {beforeLoad}

    });
