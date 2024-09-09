/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Project BOM WFA script.
 */
define(['N/record', 'N/search', 'N/runtime'],

    function(record, search, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(scriptContext) {
            try {
                var values = {};
                var qty = 0;
                var currentItem = null;
                var item = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_bom_item'});
                var mappedBOMFieldId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_bom_field_id'});
                var mappedQtyFieldId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_bom_qty_field_id'});
                var defaultQtyNumber = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_bom_default_qty'});
                var inactive = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_bom_inactive'})

                var project = scriptContext.newRecord;
                var projectId = project.id;

                if (mappedBOMFieldId) {
                    currentItem = project.getValue({fieldId: mappedBOMFieldId});
                }
                if (mappedQtyFieldId) {
                    qty =  project.getValue({fieldId: mappedQtyFieldId})
                } else {
                    qty = defaultQtyNumber || 1;
                }
                var itemId = (currentItem) ? currentItem : item;


                if (currentItem && inactive) {
                    var bomId = getProjectBOM(currentItem, projectId);
                    // update bom record trigger project bom UE script
                    //inactivate bom record first
                    if (bomId) {
                        upsertProjectBom(bomId, currentItem, projectId, qty, inactive);
                    }
                    // create bom record after removing original bom
                    upsertProjectBom(bomId, item, projectId, qty, false);
                    if (mappedBOMFieldId && item) {
                        project.setValue({
                            fieldId: mappedBOMFieldId,
                            value: item
                        });
                    }

                } else if (!inactive) {
                    var bomId = getProjectBOM(itemId, projectId);
                    if (bomId) {
                        // update bom record?
                        //create bom record - trigger project bom UE script?
                        upsertProjectBom(null, itemId, projectId, qty, false);
                    }
                }
                return scriptContext.newRecord;
            } catch (e) {
                log.error('error project BOM update', e);
                return scriptContext.newRecord
            }
        }

        function getProjectBOM(itemId, projectId) {
            var bomId = null;
            if (itemId && projectId) {
                var customrecord_bb_project_bomSearchObj = search.create({
                    type: "customrecord_bb_project_bom",
                    filters:
                        [
                            ["custrecord_bb_project_bom_item", "anyof", itemId],
                            "AND",
                            ["custrecord_bb_project_bom_project", "anyof", projectId]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "Internal ID"}),
                            search.createColumn({name: "custrecord_bb_project_bom_project", label: "Project"}),
                            search.createColumn({name: "custrecord_bb_project_bom_item", label: "Item"}),
                            search.createColumn({name: "custrecord_bb_project_bom_quantity", label: "Quantity"}),
                            search.createColumn({name: "custrecord_bb_bom_amount", label: "Item Amount"})
                        ]
                });
                var searchResultCount = customrecord_bb_project_bomSearchObj.runPaged().count;
                log.debug("project BOM result count", searchResultCount);
                customrecord_bb_project_bomSearchObj.run().each(function (result) {
                    bomId = result.getValue({name: 'internalid'});
                    return true;
                });
            }
            return bomId;
        }

        function upsertProjectBom(bomId, itemId, projectId, qty, inactive) {
            if (bomId && inactive) {
                log.debug('inactive bom record');
                record.submitFields({
                    type: 'customrecord_bb_project_bom',
                    id: bomId,
                    values: {
                        'isinactive': true
                    },
                    options: {
                        ignoreMandatoryFields: true
                    }
                });
            } else if (bomId && !inactive) {
                // update bom record??
                log.debug('update bom record');
            } else {
                log.debug('create bom record');
                var projectBom = record.create({
                    type: 'customrecord_bb_project_bom',
                    isDynamic: true
                });
                projectBom.setValue({
                    fieldId: 'custrecord_bb_project_bom_project',
                    value: projectId
                });
                projectBom.setValue({
                    fieldId: 'custrecord_bb_project_bom_item',
                    value: itemId
                });
                projectBom.setValue({
                    fieldId: 'custrecord_bb_project_bom_quantity',
                    value: qty
                });
                projectBom.save({
                    ignoreMandatoryFields: true
                });
            }
        }

        return {
            onAction : onAction
        };

    });
