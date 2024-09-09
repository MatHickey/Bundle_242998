/**
 * autoComplete.js support module for retrieving results
 * 
 * @NApiVersion 2.x
 * @NModuleScope public
 * @NScriptType Suitelet
 * 
 * @copyright 2019 Blue Banyan Solutions, Inc.
 */

/**
 * Copyright 2019 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */
define(['N/search'], function(search) {
    function onRequest(context) {
        var response = context.response;
        var request = context.request;
        var projectId = context.request.parameters.projectId;
        if (context.request.method == 'GET') {
            // var bomArray = getProjectRelatedBomRecords(projectId);
            var mergedList = getItemManufacturers();
            response.write(JSON.stringify(mergedList));
        }
    }


    function getItemManufacturers() {
        var array = [];
        var inventoryitemSearchObj = search.create({
            type: "inventoryitem",
            filters:
            [
                ["type","anyof","InvtPart"], 
                "AND", 
                ["isinactive","is","F"]
            ],
            columns:
            [
                search.createColumn({
                    name: "manufacturer",
                    summary: "GROUP",
                    label: "Manufacturer"
                })
            ]
        });
        var searchResultCount = inventoryitemSearchObj.runPaged().count;
        log.debug("inventoryitemSearchObj result count",searchResultCount);
        inventoryitemSearchObj.run().each(function(result){
            array.push({
                manufacturer: result.getValue({name: 'manufacturer', summary: 'GROUP'}),
            })
            return true;
        });
        return array;
    }

    function getItemListValues() {
        // perform search of all bom items (sorted list)
        var itemArray = [];
        var itemList = search.load({
            id: 'customsearch_bb_bom_inventory_item_lis_2'
        });

        var resultIndex = 0;
        var resultStep = 1000; 

        do {
            var resultSet = itemList.run();
            var results = resultSet.getRange({
                start : resultIndex,
                end : resultIndex + resultStep
            });

            for (var i = 0; i < results.length; i++) {
                var itemObj = {};
                itemObj.manufacturer = results[i].getValue({
                    name : resultSet.columns[0],
                });
                itemObj.itemId = results[i].getValue({
                    name : resultSet.columns[1],
                });
                itemObj.itemName = results[i].getValue({
                    name : resultSet.columns[2],
                });
                itemObj.itemCategory = results[i].getText({
                    name : resultSet.columns[4]
                });
                itemArray.push(itemObj);
                // sublist = setLineValues(sublist, i, itemObj, projectBomArr);
            }

            resultIndex = resultIndex + resultStep;

        } while (results.length > 0)
        log.debug('item array results', itemArray);
        return itemArray;
    }


    function getProjectRelatedBomRecords(projectId) {
        var arr = [];
        var bomList = search.load({
            id: 'customsearch_bb_project_bom_records'
        });
        var additionalFilters = ["AND", ["custrecord_bb_project_bom_project","anyof", projectId]];
        log.debug('Project Related BOM Records', additionalFilters);
        var newFilterExpression = bomList.filterExpression.concat(additionalFilters);
        bomList.filterExpression = newFilterExpression;

        var resultIndex = 0;
        var resultStep = 1000; 

        do {
            var resultSet = bomList.run();
            var results = resultSet.getRange({
                start : resultIndex,
                end : resultIndex + resultStep
            });

            for (var i = 0; i < results.length; i++) {
                var bomRecord = {};
                bomRecord.bomId = results[i].getValue({
                    name : resultSet.columns[0],
                });

                bomRecord.itemId = results[i].getValue({
                    name : resultSet.columns[1]
                });

                bomRecord.quantity = results[i].getValue({
                    name : resultSet.columns[2]
                });

                bomRecord.project = results[i].getValue({
                    name : resultSet.columns[3]
                });

                arr.push(bomRecord);
            }

            resultIndex = resultIndex + resultStep;

        } while (results.length > 0)

        // log.debug('Project Related BOM records Array', arr);
        return arr;
    }

    return {onRequest:onRequest};
});
