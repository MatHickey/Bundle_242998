/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Vendor Item Detail User Events
 * @deployedon Vendor Item Detail Custom Record
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


define(['N/record', 'N/runtime', 'N/search'], function(record, runtime, search) {

    function afterSubmit(scriptContext) {
        if (scriptContext.type == 'delete') return;

        var ssConfig = record.load({
            type: 'customrecord_bb_solar_success_configurtn',
            id: 1
        });
        var exeContext = runtime.executionContext;
        log.debug('execution type', exeContext);

        // var itemDetailRecord = scriptContext.newRecord;
        var itemDetailRecord = record.load({
            type: 'customrecord_bb_vendor_item_details',
            id: scriptContext.newRecord.id
        });

        var itemDetailObj = {
            itemId: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item'}),
            itemText: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_text'}),
            vendorPartNumber: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_part_number'}),
            upcCode: itemDetailRecord.getValue({fieldId: 'custrecord_bb_upc_code'}),
            vendor: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_vendor'}),
            itemDescription: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_descript_txt'}),
            unitPrice: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_unit_price_cur'}),
            legalManufacturerName: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_mfg_name_txt'}),
            commonManufacturerName: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_common_mfg_txt'}),
            manufacturerCode: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_mfg_code_txt'}),
            itemStockStatus: itemDetailRecord.getText({fieldId: 'custrecord_bb_vendor_item_stock_status'}),
            productCategory: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_product_category'}),
            productSubCategory: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_product_sub_cat'}),
            productSubCatGroup: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_product_sub_cat_grp'}),
            itemThumbnailUrl: itemDetailRecord.getValue({fieldId: 'custrecord_bb_vendor_item_thumbnail_url'})
        };

        var itemRecord = processInventoryItemDetails(itemDetailObj, itemDetailRecord, ssConfig);

        var itemId = itemRecord.save({
            ignoreMandatoryFields: true
        });
        log.debug('item saved');

        if (!itemDetailObj.itemId) {
            record.submitFields({
                type: 'customrecord_bb_vendor_item_details',
                id: itemDetailRecord.id,
                values: {
                    'custrecord_bb_vendor_item': itemId
                },
                options: {
                    ignoreMandatoryFields: true
                }
            });
        }
    }


    function processInventoryItemDetails(itemDetailObj, itemDetailRecord, ssConfig) {
        log.debug('itemDetailObj', itemDetailObj);
        log.debug('itemDetailRecord', itemDetailRecord);
        var itemRecord;
        var isItemCreated;
        if(itemDetailObj.itemId) {
            log.debug('itemDetailObj', itemDetailObj.itemId);
            itemRecord = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: itemDetailObj.itemId,
                isDynamic: true
            });
            isItemCreated = false;
        } else {
            // create item record here


            isItemCreated = true;
            var bayWaName = itemDetailObj.manufacturerCode
            var cleanedName = cleanItemName(bayWaName);
            var existingId = checkExistingItem(cleanedName);
            if (!existingId) {
                itemRecord = record.create({
                    type: record.Type.INVENTORY_ITEM,
                    isDynamic: true
                });
            } else {
                itemRecord = record.load({
                    type: record.Type.INVENTORY_ITEM,
                    id: existingId,
                    isDynamic: true
                });
            }
            itemRecord.setValue({
                fieldId: 'itemid',
                value: cleanedName
            });
            var useSubsidiaries = ssConfig.getValue({fieldId: 'custrecord_bb_ss_has_subsidiaries'});
            if (ssConfig.getText({fieldId: 'custrecord_bb_config_m_subsid_item_opt'}) == 'Top Level & Include All Children') {
                if (useSubsidiaries)
                    itemRecord.setValue({
                        fieldId: 'subsidiary',
                        value: 1
                    });
                itemRecord.setValue({
                    fieldId: 'includechildren',
                    value: true
                });
            } 
            if (useSubsidiaries && ssConfig.getText({fieldId: 'custrecord_bb_config_m_subsid_item_opt'}) == 'Select Default Subsidiary') {
                var defaultSubSid = ssConfig.getValue({
                    fieldId: 'custrecord_bb_config_it_def_subsid'
                });
                itemRecord.setValue({
                    fieldId: 'subsidiary',
                    value: defaultSubSid
                });
            }
            log.debug('creating new item', 'creating new item');
        }

        setItemFields(itemDetailObj, itemRecord, itemDetailRecord, ssConfig, isItemCreated);
        return itemRecord;

    }


    function checkExistingItem(itemId) {
        var id = null;
        if (itemId) {
            var itemSearchObj = search.create({
                type: "item",
                filters:
                [
                    ["name","is", itemId]
                ],
                columns:
                [
                    "internalid",
                    "itemid"
                ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            log.debug("itemSearchObj result count",searchResultCount);
            itemSearchObj.run().each(function(result) {
                id = result.getValue({name: 'internalid'});
            })
        }
        return id;
    }


    function setItemFields(itemDetailObj, itemRecord, itemDetailRecord, ssConfig, isItemCreated) {
        log.debug('setItemFields - isItemCreated='+isItemCreated,itemDetailObj);
        var activeStatus = ssConfig.getValue({
            fieldId: 'custrecord_bb_bw_active_item_status'
        });

        if (isItemCreated) {
            // Item was just created - not loaded
            // only set fields to items on create an not update
            if (itemDetailObj.itemDescription) {
                itemRecord.setValue({
                    fieldId: 'salesdescription',
                    value: itemDetailObj.itemDescription
                });

                itemRecord.setValue({
                    fieldId: 'purchasedescription',
                    value: itemDetailObj.itemDescription
                });
            }
            if (itemDetailObj.productCategory) {
                itemRecord.setValue({
                    fieldId: 'custitem_bb_item_category',
                    value: itemDetailObj.productCategory
                });
            }
            if (itemDetailObj.productSubCategory) {
                itemRecord.setValue({
                    fieldId: 'custitem_bb_item_sub_category_list',
                    value: itemDetailObj.productSubCategory
                });
            }
            if (itemDetailObj.productSubCatGroup) {
                itemRecord.setValue({
                    fieldId: 'custitem_bb_item_subcat_group_list',
                    value: itemDetailObj.productSubCatGroup
                });
            }
            if (itemDetailObj.itemText) {
                // only set for first vendor loaded with this item creation
                itemRecord.setValue({
                    fieldId: 'vendorname',
                    value: itemDetailObj.itemText
                });
            }
            if (itemDetailObj.upcCode) {
                itemRecord.setValue({
                    fieldId: 'upccode',
                    value: itemDetailObj.upcCode
                });
            }
            if (itemDetailObj.commonManufacturerName) {
                itemRecord.setValue({
                    fieldId: 'manufacturer',
                    value: itemDetailObj.commonManufacturerName
                });
            }

            itemRecord.setValue({ // should be taxable value
                fieldId: 'taxschedule',
                value: 1
            });

        } // end of trigger check only set fields to items on create an not update

        log.debug('item stock status', itemDetailObj.itemStockStatus);
        if (itemDetailObj.itemStockStatus == 'Active') { // preferred vendor fields if status =  active
            if (itemDetailObj.itemDescription) {
                itemRecord.setValue({
                    fieldId: 'purchasedescription',
                    value: itemDetailObj.itemDescription
                });
            }
            itemRecord.setValue({
                fieldId: 'custitem_bb_item_status',
                value: activeStatus
            });

            var vendorLineNumber = itemRecord.findSublistLineWithValue({
                sublistId: 'itemvendor',
                fieldId: 'vendor',
                value : itemDetailObj.vendor
            });
            log.debug('sublist vendor linenumber', vendorLineNumber);
            if (vendorLineNumber != -1) {
                itemRecord.selectLine({
                    sublistId: 'itemvendor',
                    line: vendorLineNumber
                });
                itemRecord.setCurrentSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'purchaseprice',
                    value: itemDetailObj.unitPrice
                });
                if (isItemCreated){
                    // only set first vendor when item created
                    itemRecord.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'preferredvendor',
                        value: true
                    });
                }
                itemRecord.commitLine({
                    sublistId: 'itemvendor'
                });

            } else {
                addNewVendorLine(itemRecord, itemDetailObj, true);
            }

            // if the item is active - set the price for this vendor
            setItemPriceLevel(itemRecord, itemDetailObj, ssConfig);
            log.debug('set item price', 'set item price');

        } else {
            // item is not active - remove baywa as preferred vendor
            var inactiveValue = ssConfig.getValue({
                fieldId: 'custrecord_bb_bw_inactive_item_status'
            });
            itemRecord.setValue({
                fieldId: 'custitem_bb_item_status',
                value: inactiveValue
            });

            log.debug('Attempting to remove preferred vendor', 'Attempting to remove preferred vendor');
            var vendorLineNumber = itemRecord.findSublistLineWithValue({
                sublistId: 'itemvendor',
                fieldId: 'vendor',
                value : itemDetailObj.vendor
            });
            log.debug('sublist vendor linenumber', vendorLineNumber);
            if (vendorLineNumber != -1) {
                itemRecord.removeLine({
                    sublistId: 'itemvendor',
                    line: vendorLineNumber
                });
            }

        }// end of else

        if (itemDetailObj.itemThumbnailUrl) {
            itemRecord.setValue({
                fieldId: 'custitem_bb_item_thumbnail_url',
                value: itemDetailObj.itemThumbnailUrl
            });
        }

    }


    function addNewVendorLine(itemRecord, itemDetailObj, ispreferred) {
        log.debug('add new vendor:'+itemDetailObj.vendor,itemDetailObj)

        itemRecord.selectNewLine({
                sublistId: 'itemvendor'
            });
            itemRecord.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'vendor',
                value: itemDetailObj.vendor
            });
            itemRecord.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'purchaseprice',
                value: itemDetailObj.unitPrice
            });
            itemRecord.setCurrentSublistValue({ 
                sublistId: 'itemvendor',
                fieldId: 'preferredvendor',
                value: ispreferred
            });
            itemRecord.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'vendorcode',
                value: itemDetailObj.itemText
            });
            itemRecord.commitLine({
                sublistId: 'itemvendor'
            });
    }

    function setItemPriceLevel(itemRecord, itemDetailObj, ssConfig) { // listed as price1 with multiple currency pricing feature on item
        var priceObj;
        if (ssConfig.getValue({fieldId: 'custrecord_bb_config_m_cur_enabled'}) == false) {
            priceObj =  {
                sublist: 'price',
                price: 'price'
            };

            setSublistPriceValue(ssConfig, itemRecord, itemDetailObj, priceObj);

        } else {
            var currName = ssConfig.getText({
                fieldId: 'custrecord_bb_config_it_m_cur_opt'
            });
            function getPricelistID(currName) {
                switch (currName) {
                    case 'USA': return 'price1';
                    case 'British pound': return 'price2';
                    case 'Canadian Dollar': return 'price3';
                    case 'Euro': return 'price4';
                    default: return null
                }
            }
            var listId = getPricelistID(currName);
            if (currName) {
                priceObj =  {
                    sublist: listId,
                    price: 'price'
                };
                setSublistPriceValue(ssConfig, itemRecord, itemDetailObj, priceObj);
            }

        }

    }

    function setSublistPriceValue(ssConfig, itemRecord, itemDetailObj, priceObj) {
        itemRecord.selectLine({
            sublistId: priceObj.sublist,
            line: 0
        });

        itemRecord.setCurrentMatrixSublistValue({
            sublistId: priceObj.sublist,
            fieldId: priceObj.price,
            column: 0,
            value: itemDetailObj.unitPrice
        });

        itemRecord.commitLine({
            sublistId: priceObj.sublist,
        });
    }

    function cleanItemName(itemName) {
        var pattern = new RegExp(/[:]/);
        if (pattern.test(itemName)) {
            var nameArr = itemName.split(':');
            if (nameArr.length > 1) {
                var cleanName = nameArr.pop().trim();
                return cleanName;
            }
        } else {
            return itemName;
        }
    }


    return {
        afterSubmit: afterSubmit
    };

});