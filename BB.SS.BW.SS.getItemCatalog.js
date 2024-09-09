/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Get Item Catalog BayWa Custom Module
 */
define(['N/https', 'N/record', 'N/runtime', 'N/search', 'N/task', './BB SS/SS Lib/BB_SS_MD_SolarConfig', './BB SS/SS Lib/BB.SS.OAuth1.0Module.js', './BB SS/SS Lib/BB.SS.MD.GetItemCatalog'],

function(https, record, runtime, search, task, config, oauth, itemCatalog) {
   
    function execute(scriptContext) {
        // check the System Configuration flag for whether we should sync item prices daily or not
        var ssConfig = record.load({ // 2 units
            type: "customrecord_bb_solar_success_configurtn",
            id: 1
        });
        var itemSync = ssConfig.getValue({
            fieldId: 'custrecord_bb_bay_syn_item_catalog_daily'
        });
        if (itemSync) {

            var vendorId = ssConfig.getValue({fieldId: "custrecord_bb_baywa_vendor"});
            var vendorName = ssConfig.getText({fieldId: "custrecord_bb_baywa_vendor"});
            var vendorCurrency = ssConfig.getValue({fieldId: "custrecord_bb_baywa_currency"});

             // BB Framework call - get the current item prices from BayWa - usage = 10 units API request call
          	var env = ssConfig.getText({fieldId: 'custrecord_bb_bay_syn_item_catlog_enviro'}); //  **** returns sandbox env for testing only *****
            var response = oauth.callEndpoint(env, 'BayWa', 'GET', 'script=541&deploy=1', null);

            if (response) {

                // execute search for item Name and internal id - returns an array of objects to run indexOf Array and if the array item is found then return that item internal id

                var itemDetailRecordsArr = itemCatalog.getItemDetailRecords(vendorId); // 10 units
                var categories = {
                    productCategory: itemCatalog.getProductCategory(),
                    productSubCategory: itemCatalog.getProductSubCategory(),
                    productSubCategoryGroup: itemCatalog.getProductSubCategoryGroup()
                };

                try {
                    var itemArr = JSON.parse(response);  // oauth request returns a string
                    log.debug('itemArr', itemArr);
                    log.debug('array type of', typeof itemArr);
                    if (typeof itemArr == 'string') {
                        itemArr = JSON.parse(itemArr);
                    }
                    log.debug('array type of', typeof itemArr);
                    log.debug('array length', itemArr.length);
                    if (itemArr.length > 0) {
                        for (var i = 0; i < itemArr.length; i++) {
                            var itemDetails = itemArr[i];
                            log.debug('itemDetails', itemDetails);

                            // finds matching item name and returns internal item id, name and preferred vendor id
                            var matchingItem;
                            var matchingDetailRecord;
                            if (itemDetails) { 
                                if (itemDetailRecordsArr.length > 0) {

                                    matchingDetailRecord = itemCatalog.getMatchingDetailRecord(itemDetails, itemDetailRecordsArr);

                                    itemCatalog.upsertVendorItemDetailRecord(matchingDetailRecord, itemDetails, vendorId, ssConfig, categories);
                                } else {
                                    //creates new item if not found
                                    matchingDetailRecord = itemCatalog.getMatchingDetailRecord(matchingItem, itemDetailRecordsArr);
                                    itemCatalog.upsertVendorItemDetailRecord(matchingDetailRecord, itemDetails, vendorId, ssConfig, categories);
                                }
 
                                var itemCatalogScript = runtime.getCurrentScript();
                                log.debug('Remaining governance units', itemCatalogScript.getRemainingUsage());

                            }
                        }// end of loop


                        //calls scheduled script to process items not found in API request and removed preferred vendor 
                        var removePreferredVendor = task.create({
                            taskType: task.TaskType.SCHEDULED_SCRIPT
                        });
                        removePreferredVendor.scriptId = 'customscript_bb_ss_process_old_bw_items';
                        removePreferredVendor.deploymentId = 'customdeploy_bb_ss_process_old_bw_items';
                        removePreferredVendor.submit();

                    } else {
                        log.debug('The request body does not contain a list of items for update', 'exiting');
                    }


                } catch (error) {
                    log.debug('Error', error);
                }

            } else {
                log.debug('message', 'The response from BayWa return 0 results, please check the system credentials record for the correct details.');
            }
        } else {
            log.debug('Message', 'Sync Item Prices Daily not selected - exiting.');
        }

    }

    return {
        execute: execute
    };
    
});