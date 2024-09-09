/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Invoice Actual Description Item WFA script.
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
            var configObj = search.lookupFields({
                type: 'customrecord_bb_solar_success_configurtn',
                id: 1,
                columns: ['custrecord_bb_invoice_actuals_boolean']
            });
            var invoiceActuals = configObj.custrecord_bb_invoice_actuals_boolean;
            if (invoiceActuals) {
                var item = scriptContext.newRecord;
                var itemId = scriptContext.newRecord.id;
                var itemCategory = item.getText({fieldId: 'custitem_bb_item_category'});
                var itemSubCategory = item.getText({fieldId: 'custitem_bb_item_sub_category_list'});
                if (itemCategory) {
                    var categoryItem = upsertDescriptionItem(itemCategory);
                    log.debug('categoryItem', categoryItem);
                    if (categoryItem) {
                        item.setValue({
                            fieldId: 'custitem_bb_item_invoice_parent',
                            value: categoryItem
                        });
                    }
                }
                if (itemSubCategory) {
                    var subCategoryItem = upsertDescriptionItem(itemSubCategory);
                    log.debug('subCategoryItem', subCategoryItem);
                    if (subCategoryItem) {
                        item.setValue({
                            fieldId: 'custitem_bb_item_invoice_sub_parent',
                            value: subCategoryItem
                        });
                    }
                }
                return itemId;
            }

        } catch (e) {
            log.error('error generating invoice actual description items', e);
            return itemId;
        }
    }


    function upsertDescriptionItem(categoryName) {
        var itemId = null;
        if (categoryName) {
            var descriptionitemSearchObj = search.create({
                type: "descriptionitem",
                filters:
                [
                    ["type","anyof","Description","InvtPart","NonInvtPart","OthCharge","Service"], 
                    "AND", 
                    ["name","is", categoryName]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({
                        name: "itemid",
                        sort: search.Sort.ASC,
                        label: "Name"
                    })
                ]
            });
            descriptionitemSearchObj.run().each(function(result){
                itemId = result.getValue({name: 'internalid'});
                log.debug('item found');
                return true;
            });
        }
        if (categoryName && !itemId) {
            var descriptionItem = record.create({
                type: record.Type.DESCRIPTION_ITEM,
                isDynamic: true
            });
            descriptionItem.setValue({
                fieldId: 'itemid',
                value: categoryName
            });
            descriptionItem.setValue({
                fieldId: 'includechildren',
                value: true
            });
            var id = descriptionItem.save({
                ignoreMadatoryFields: true
            });
            log.debug('item created');
            return id;

        } else if (itemId) {
            return itemId;
        }
    }


    return {
        onAction : onAction
    };
    
});
