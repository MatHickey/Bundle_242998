/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *
 * Deployed to the sales order
 *
 * Updates the project action document status when the "work order" sales order status is updated
 * BBSS record customrecord_bbss_msi_survey_status (attached to the BBSS Config) for mapping MSI to BBSS status
 */
define(['N/record', 'N/search'], function (record, search) {

    function afterSubmit(context) {
        try {
            log.debug('context', context);
            var oldrec = context.oldRecord;
            var newrec = context.newRecord;
            var oldstatus;
            var servicepro = newrec.getValue({ fieldId: 'custbodysendtoservicepro' })
            var spLink = newrec.getValue({ fieldId: 'custbodyserviceprolink' });
            log.debug('service pro', {send:servicepro,link:spLink});
            if (!servicepro) {
                log.debug('not an MSI order');
                return;
            }
            //EXIT IF NOT MSI custbodysendtoservicepro
            if (oldrec) {
                oldstatus = oldrec.getValue({ fieldId: 'custbodyservicestatus' });
            };
            var projectaction;
            var docstatus;
            var lines = newrec.getLineCount({
                sublistId: 'item'
            });
            log.debug('lines', lines);
            for(var i=0; i<lines; i++) {
                var projectaction = newrec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_bb_ss_proj_action',
                    line: i
                });
                if(projectaction){
                    // find only the first one since status is a body level field we can't do multiple surveys
                    break;
                    log.debug('project action', projectaction);
                }
            }
            if (!projectaction){
                log.debug('no project action found on order lines', 'salesorder:'+newrec.id);
                return;
            }

            var newstatus = newrec.getValue({ fieldId: 'custbodyservicestatus' });
            log.debug('old status ' + oldstatus, 'new status ' + newstatus);
            if ((newstatus != oldstatus) && newstatus) {
               //add column for msi inspection record and look that up (try to hide if possible) or run a search for the items and loop them
                // find the line with the project action on it
                var packageitem = search.lookupFields({
                    type: 'customrecord_bb_project_action',
                    id: projectaction,
                    columns: ['custrecord_bb_package']
                });
                var packagetype = packageitem.custrecord_bb_package[0].value;
                if (!packagetype){
                    return;
                }
                var customrecord_bbss_msi_survey_statusSearchObj = search.create({
                    type: "customrecord_bbss_msi_survey_status",
                    filters:
                        [
                            ["custrecord_bbss_msi_status", "anyof", newstatus],
                            "AND", 
                            ["custrecord_bbss_msi_package","anyof",packagetype]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "custrecord_bbss_msi_status", label: "MSI Status" }),
                            search.createColumn({ name: "custrecord_bbss_msi_project_action_statu", label: "Project Action Status" })
                        ]
                });
                var searchResultCount = customrecord_bbss_msi_survey_statusSearchObj.runPaged().count;
                log.debug("customrecord_bbss_msi_survey_statusSearchObj result count", searchResultCount);
                if (searchResultCount == 0) {
                    return;
                }
                customrecord_bbss_msi_survey_statusSearchObj.run().each(function (result) {
                    docstatus = result.getValue('custrecord_bbss_msi_project_action_statu');
                    return true;
                });
                log.debug('statuses dont match', docstatus);
            }
            var values = {};
            if (docstatus) {
                values.custrecord_bb_document_status = docstatus;
            }
            if(spLink){
                // rich text field
                values.custrecord_bb_proj_actn_sp_link = '<a href="'+spLink+'" target="_blank">'+newrec.getValue({ fieldId: 'tranid' })+'</a>';
            }
            if(docstatus || spLink) {
                var id = record.submitFields({
                    type: 'customrecord_bb_project_action',
                    id: projectaction,
                    values: values,
                    options: {
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    }
                });
                log.debug('customrecord_bb_project_action:' + id, {custrecord_bb_document_status: docstatus,custrecord_bb_proj_actn_sp_link:spLink});
            } else {
                log.debug('no update');
            }
        } catch (e) {
            log.error(e.name, e.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    }
});
