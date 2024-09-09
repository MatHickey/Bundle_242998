/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Suhail Akhtar
 * @overview - Expense suitlet form
 */

/**
* Copyright 2017-2019 Blue Banyan Solutions, Inc.
* All Rights Reserved.
*
* This software and information are proprietary to Blue Banyan Solutions, Inc.
* Any use of the software and information shall be in accordance with the terms
* of the license agreement you entered into with Blue Banyan Solutions, Inc,
* including possible restrictions on redistribution, misuse, and alteration.
*/

define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/runtime', 'N/redirect', './BB SS/SS Lib/BB.SS.MD.SolarEdgeApiIIntegration.js','./BB SS/SS Lib/BB.SS.MD.AlsoEnergyPowerTrackApiIntegration.js'],

    function (record, search, serverWidget, runtime, redirect, solarEdge,alsoEnergy) {
        var ALSOENERGY = 1;
        var SOLAREDGE = 2;
        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            var projectId = context.request.parameters.recordId;
            var siteId = context.request.parameters.siteId;
            var source = context.request.parameters.source;
            var devices;
            if (source == SOLAREDGE) {
                var siteArray=siteId.split(',');
                for(var index in siteArray){
                    devices = solarEdge.getInventory(siteArray[index]);
                    createSolarEdgeDevices(JSON.parse(devices).Inventory, projectId,siteArray[index]);
                }

            } else if (source == ALSOENERGY) {
                var siteArray=siteId.split(',');
                for(var index in siteArray) {
                    devices = alsoEnergy.getInventory(siteId);
                    createAlsoEnergyDevices(JSON.parse(devices).hardware, projectId,siteArray[index]);
                }
            }
            redirect.toRecord({
                type : 'job',
                id : projectId,
                isEditMode: false
            });

        }

        /**
         * Function creates the Project devices record and links them with the appropriate project
         * @param Array: inventory - list of devices on the site
         * @param String: projectId - Project id
         */
        function createSolarEdgeDevices(inventory, projectId,siteId) {
            var existingProjectDevices = getSolarEdgeProjectDevices(projectId);
            for (deviceType in inventory) {
                for (var num = 0; num < inventory[deviceType].length; num++) {
                    var name = inventory[deviceType][num].name;
                    var sl = inventory[deviceType][num].SN;
                    var manu = inventory[deviceType][num].manufacturer
                    var model = inventory[deviceType][num].model
                    var existingKey = name + '?' + sl + '?' + manu + '?' + model;

                    if (!existingProjectDevices[existingKey]) {
                        var siteDeviceRec = record.create({
                            type: 'customrecord_bb_ss_proj_site_devices',
                            isDynamic: true
                        });
                        siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_name', value: inventory[deviceType][num].name });
                        siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_model', value: inventory[deviceType][num].model });
                        siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_manufacture', value: inventory[deviceType][num].manufacturer });
                        siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_sl', value: inventory[deviceType][num].SN });
                        siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_device_proj', value: projectId });
                        siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_device_site_id', value: siteId });
                        siteDeviceRec.save();
                    }

                }
            }
        }

        function createAlsoEnergyDevices(inventory, projectId, siteId){
            var siteDeviceType = runtime.getCurrentScript().getParameter({name: 'custscript_bb_ss_ae_site_device_type'});
            var deviceSource = runtime.getCurrentScript().getParameter({name: 'custscript_bb_ss_ae_device_source'});
            var productionPowerMeter = runtime.getCurrentScript().getParameter({name: 'custscript_bb_ss_prod_power_meter'});

            var existingProjectDevices = getAlsoEnergyProjectDevices(projectId);
            log.debug('existingProjectDevices',existingProjectDevices);
            for (var num=0;num< inventory.length;num++) {
                if (!existingProjectDevices[inventory[num].id]) {
                    var siteDeviceRec = record.create({
                        type: 'customrecord_bb_ss_proj_site_devices',
                        isDynamic: true
                    });
                    siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_name', value: inventory[num].name });
                    siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_model', value: inventory[num].config.deviceType });
                   // siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_manufacture', value: inventory[deviceType][num].manufacturer });
                    siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_site_device_sl', value: inventory[num].config.serialNumber });
                    siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_device_id', value: inventory[num].id });
                    siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_device_proj', value: projectId });
                    siteDeviceRec.setValue({ fieldId: 'custrecord_bb_ss_device_site_id', value: siteId });
                    if (inventory[num].config.deviceType === productionPowerMeter) {
                        siteDeviceRec.setValue({fieldId: 'custrecord_bb_ss_site_device_type', value: siteDeviceType});
                        siteDeviceRec.setValue({fieldId: 'custrecord_bb_ss_device_source', value: deviceSource});
                    }
                    siteDeviceRec.save();
                }
            }
        }

        /**
         * Function finds the existing devices related to the project
         * @param String: projectId - Project id
         * @returns Object : uniqueResultRec - Results of existing devices
         */
        function getSolarEdgeProjectDevices(projectId) {
            var customrecord_bb_ss_proj_site_devicesSearchObj = search.create({
                type: "customrecord_bb_ss_proj_site_devices",
                filters:
                    [
                        ["custrecord_bb_ss_device_proj.internalid", "anyof", projectId]
                    ],
                columns:
                    [
                        search.createColumn({ name: "custrecord_bb_ss_site_device_name", label: "Name" }),
                        search.createColumn({ name: "custrecord_bb_ss_site_device_sl", label: "Serial Number" }),
                        search.createColumn({ name: "custrecord_bb_ss_site_device_manufacture", label: "Manufacturer" }),
                        search.createColumn({ name: "custrecord_bb_ss_site_device_model", label: "Model" })
                    ]
            });
            var searchResultCount = customrecord_bb_ss_proj_site_devicesSearchObj.runPaged().count;
            var uniqueResultRec = {};
            customrecord_bb_ss_proj_site_devicesSearchObj.run().each(function (result) {

                var name = result.getValue('custrecord_bb_ss_site_device_name');
                var sl = result.getValue('custrecord_bb_ss_site_device_sl')
                var manu = result.getValue('custrecord_bb_ss_site_device_manufacture')
                var model = result.getValue('custrecord_bb_ss_site_device_model')
                var uniqueKey = name + '?' + sl + '?' + manu + '?' + model;
                uniqueResultRec[uniqueKey] = 'true';
                return true;
            });

            return uniqueResultRec;
        }

        /**
         * Function finds the existing devices related to the project
         * @param String: projectId - Project id
         * @returns Object : uniqueResultRec - Results of existing devices
         */
        function getAlsoEnergyProjectDevices(projectId){
            log.debug('projectId',projectId)
            var customrecord_bb_ss_proj_site_devicesSearchObj = search.create({
                type: "customrecord_bb_ss_proj_site_devices",
                filters:
                    [
//                      ["custrecord_bb_ss_device_proj.internalid", "anyof", projectId]  //changed to allow devices to load for single project
                        ["custrecord_bb_ss_device_proj.internalid", "is", projectId]
                    ],
                columns:
                    [
                        search.createColumn({ name: "custrecord_bb_ss_device_id", label: "id" }),
                    ]
            });
            var uniqueResultRec = {};
            customrecord_bb_ss_proj_site_devicesSearchObj.run().each(function (result) {
                log.debug('result',result);
                var id = result.getValue('custrecord_bb_ss_device_id');
                uniqueResultRec[id] = 'true';
                return true;
            });
            return uniqueResultRec;
        }

        return {
            onRequest: onRequest
        };

    });