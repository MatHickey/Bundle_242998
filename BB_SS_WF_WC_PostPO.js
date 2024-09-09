/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @author Matthew Lehman
 * @NModuleScope Public
 * @overview - Send Purchase Order to WesCo
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

define(['N/runtime', 'N/search', 'N/record', './BB SS/API Logs/API_Log', 'N/format', 'N/encode', 'N/file', 'N/render', 'N/email',  'N/xml', 'N/error'],
    function(runtime, search, record, https, format, encode, file, render, email, xml, error) {

    const UOM = {
        "each": "EA",
        "foot": "FT"
    }

    function onAction(scriptContext) {
        var currentRec = scriptContext.newRecord;
        var shipSubRec = currentRec.getSubrecord({ fieldId: 'shippingaddress' });
        var billSubRec = currentRec.getSubrecord({ fieldId: 'billingaddress' });

        var lineCount = currentRec.getLineCount({ sublistId: 'item' });
        var wescoVendorId = currentRec.getValue({fieldId:"entity"});
        var wescoSendVersion = currentRec.getValue({fieldId:'custbody_bb_wesco_send_version'}) || '1';

        // find all the wesco items on this PO so we don't do multiple searches
        var po_items = [];
        for (var i = 0; i < lineCount; i++) {
            po_items.push(currentRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            }));
        }
        if(po_items.length==0) return false;
        log.debug(currentRec.recType+':'+currentRec.id+' Items for vendor:'+wescoVendorId,po_items);

        var customrecord_bb_vendor_item_detailsSearchObj = search.create({
            type: "customrecord_bb_vendor_item_details",
            filters:
                [
                    ["custrecord_bb_vendor_item_vendor","anyof",wescoVendorId],
                    "AND",
                    ["custrecord_bb_vendor_item","anyof",po_items]
                ],
            columns:
                [
                    "custrecord_bb_vendor_item",
                    "custrecord_bb_vendor_item_text",
                    "custrecord_bb_vendor_part_number",
                    "custrecord_bb_vendor_item_descript_txt"
                ]
        });
        var searchResultCount = customrecord_bb_vendor_item_detailsSearchObj.runPaged().count;
        log.debug("wesco item result count",searchResultCount);
        if(searchResultCount==0) return false;

        var wescoItems = {};
        customrecord_bb_vendor_item_detailsSearchObj.run().each(function(result){
            wescoItems[result.getValue({name:"custrecord_bb_vendor_item"})] = {
                partNumber: result.getValue({name:"custrecord_bb_vendor_part_number"}),
                description: result.getValue({name:"custrecord_bb_vendor_item_descript_txt"}),
                partName: result.getValue({name:"custrecord_bb_vendor_item_text"})
            }
            return true;
        });
        log.debug('wesco items',wescoItems);

        var request_items = [];
        for (var i = 0; i < lineCount; i++) {
            var itemId = currentRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            //if(!wescoItems[itemId]) continue; // item not found as a wesco item
            var itemDetails = search.lookupFields({
                type: search.Type.ITEM,
                id: itemId,
                columns: ['type','manufacturer','purchasedescription','purchaseunit','leadtime']
            });
            log.debug('invenotryitem:'+itemId,itemDetails);
            if (itemDetails.type[0].value !== 'InvtPart') continue; // not an inventory part to send

            var item = currentRec.getSublistText({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            var qty = currentRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i
            });
            var unit_price = currentRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: i
            });
            var lineId = currentRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'line',
                line: i
            });

            request_items.push({
                item: xml.escape({
                    xmlText : item
                }),
                itemId: itemId,
                qty: qty,
                unit_price: unit_price,
                lineId: lineId,
                displayname: xml.escape({
                    xmlText : wescoItems[itemId] ? wescoItems[itemId].partName : item
                }),
                manufacturer: xml.escape({
                    xmlText : itemDetails.manufacturer
                }),
                purchasedescription: xml.escape({
                    xmlText : wescoItems[itemId] ? wescoItems[itemId].description : itemDetails.purchasedescription
                }),
                purchaseunit: itemDetails.purchaseunit[0] ? UOM[itemDetails.purchaseunit[0].text.toLowerCase()] : 'EA',
                supplierPartID: wescoItems[itemId] ? wescoItems[itemId].partNumber : '',
                leadtime: itemDetails.leadtime || '0'
            });
        }
        log.debug('request items',request_items);
        if(request_items.length==0) return false; // nothing to send

        wescoSendVersion = parseInt(wescoSendVersion);

        var payload = {
            "id": currentRec.id,
            "version": wescoSendVersion,
            "type": wescoSendVersion>1 ? 'update' : 'new',
            "po_num": currentRec.getValue({ fieldId: 'tranid' }),
            "memo": currentRec.getValue({ fieldId: 'memo' }),
            "recId": currentRec.id,
            "job_type": currentRec.getValue({ fieldId: 'custbody_bb_resi_delivery_checkbox' }),
            ship: {
                "id": shipSubRec.getValue({ fieldId: 'id' }),
                "company": shipSubRec.getValue({ fieldId: 'addressee' }),
                "atten": shipSubRec.getValue({ fieldId: 'attention' }),
                "cntry": shipSubRec.getValue({ fieldId: 'country' }),
                "addr1": shipSubRec.getValue({ fieldId: 'addr1' }),
                "addr2": shipSubRec.getValue({ fieldId: 'addr2' }),
                "addr3": shipSubRec.getValue({ fieldId: 'addr3' }),
                "city": shipSubRec.getValue({ fieldId: 'city' }),
                "state": shipSubRec.getValue({ fieldId: 'state' }),
                "zip": shipSubRec.getValue({ fieldId: 'zip' }),
                "phone": shipSubRec.getValue({ fieldId: 'addrphone' })
            },
            bill: {
                "id": billSubRec.getValue({ fieldId: 'id' }),
                "company": billSubRec.getValue({ fieldId: 'addressee' }),
                "atten": billSubRec.getValue({ fieldId: 'attention' }),
                "cntry": billSubRec.getValue({ fieldId: 'country' }),
                "addr1": billSubRec.getValue({ fieldId: 'addr1' }),
                "addr2": billSubRec.getValue({ fieldId: 'addr2' }),
                "addr3": billSubRec.getValue({ fieldId: 'addr3' }),
                "city": billSubRec.getValue({ fieldId: 'city' }),
                "state": billSubRec.getValue({ fieldId: 'state' }),
                "zip": billSubRec.getValue({ fieldId: 'zip' }),
                "phone": billSubRec.getValue({ fieldId: 'addrphone' })
            },
            "ship_residential": currentRec.getValue({ fieldId: 'custbody_bb_resi_delivery_checkbox' }),
            "ship_complete": currentRec.getValue({ fieldId: 'shipcomplete' }),
            "lift_gate": currentRec.getValue({ fieldId: 'custbody_bb_liftgate_reqd_checkbox' }),
            "expected_shp_dt": (currentRec.getValue({ fieldId: 'shipdate' }) || new Date()).toISOString().split('T')[0],
          	"duedate": (currentRec.getValue({ fieldId: 'duedate' }) || new Date()).toISOString().split('T')[0],
            "call_ahead": currentRec.getValue({ fieldId: 'custbody_bb_require_call_ahead' }),
            "ship_notes": xml.escape({
                xmlText : currentRec.getValue({ fieldId: 'custbody_bb_shipping_notes' })
            }),
            "ship_method": currentRec.getValue({ fieldId: 'shipmethod' }),
            "total": currentRec.getValue({ fieldId: 'total' }),
            "items": request_items
        };
        log.debug('payload',payload);

        // validate the address - Must be required to have these values
        if(!payload.ship.addr1 || !payload.ship.city || !payload.ship.state || !payload.ship.zip){
            var errObj = error.create({
                name:'INVALID_ADDRESS',
                message : 'The Ship To address is not valid. Please correct the address before sending to WESCO.',
                notifyOff: true
            });
            log.error('Error: ' + errObj.name , errObj.message);
            throw errObj;
        }

        // use search with inactive filter and take first row
        var ssConfigSearch = search.create({type:'customrecord_bb_solar_success_configurtn',
            filters:['isinactive','is','F'],
            columns:['custrecord_bb_wesco_cred_from_domain',
                     'custrecord_bb_wesco_cred_from_identity',
                     'custrecord_bb_wesco_cred_to_domain',
                     'custrecord_bb_wesco_cred_to_identity',
                     'custrecord_bb_wesco_sender_user_agent',
                     'custrecord_bb_wesco_sender_cred_domain',
                     'custrecord_bb_wesco_sender_cred_identity',
                     'custrecord_bb_wesco_sender_cred_secret',
                     'custrecord_bb_wesco_deployment_mode',
                     'custrecord_bb_wesco_post_po_template_id',
                    'custrecord_bb_ss_wesco_out_url'
                    ]
              });
        var ssConfig;
      	ssConfigSearch.run().each(function(result){ssConfig=result.toJSON().values});
      	log.debug('ssConfig',ssConfig);

        var header = {
            from: {
                domain: ssConfig.custrecord_bb_wesco_cred_from_domain,
                identity: ssConfig.custrecord_bb_wesco_cred_from_identity
            },
            to: {
                domain: ssConfig.custrecord_bb_wesco_cred_to_domain,
                identity: ssConfig.custrecord_bb_wesco_cred_to_identity
            },
            sender: {
                useragent: ssConfig.custrecord_bb_wesco_sender_user_agent,
                domain: ssConfig.custrecord_bb_wesco_sender_cred_domain,
                identity: ssConfig.custrecord_bb_wesco_sender_cred_identity,
                secret: ssConfig.custrecord_bb_wesco_sender_cred_secret
            }
        };
        var request = {
            deployment_mode: ssConfig.custrecord_bb_wesco_deployment_mode
        };

        var templateFileId = ssConfig.custrecord_bb_wesco_post_po_template_id;
      
        var templateFile = file.load({
            id: templateFileId
        });
        var renderer = render.create();
        renderer.templateContent = templateFile.getContents();
        renderer.addCustomDataSource({
            format: render.DataSource.OBJECT,
            alias: 'data',
            data: {
                payload_id: [currentRec.id, new Date().getTime(), runtime.accountId].join('.'),
                header: header,
                request: request,
                po: payload
            }
        });

        var cXmlString = renderer.renderAsString();
        var _api = https.post({
            url: ssConfig.custrecord_bb_ss_wesco_out_url,
            //url: 'https://eservetest.wescodist.com/auth/xml/BTSHttpReceive.dll',
            //url: 'https://eserve.wescodist.com/auth/xml/BTSHttpReceive.dll',
            body: cXmlString,
          	transaction: payload.id,
          	entity: wescoVendorId // Wesco
        });
        if(_api.response.code === 200){
            try {
                var _responseXml = xml.Parser.fromString({
                    text : _api.response.body
                });
                var _statusElem = _responseXml.getElementsByTagName({
                    tagName : 'Status'
                });
                if(_statusElem instanceof Array && _statusElem.length > 0){
                    _statusElem = _statusElem[0];
                }
            } catch (ex) {
                log.error(ex.name,ex.message);
                // throw ex;
            }
        }
        log.debug('WesCo POST PO response: ' + _api.response.code, _api.response.body);
        //sendEmail(cXmlString);

        // update the version number of the wesco send value
        wescoSendVersion += 1;
        record.submitFields({
            type: currentRec.type,
            id: currentRec.id,
            values: {
                custbody_bb_wesco_send_version: wescoSendVersion,
                custbody_bb_bw_post_po_dt: format.format({value: new Date(), type: format.Type.DATETIME})
            },
            options: {
                enableSourcing: false,
                ignoreMandatoryFields : true
            }
        });
    }

    function sendEmail(content){
        var senderId = 63;
        var recipientEmail = ['mgolichenko@bluebanyansolutions.com'];
        email.send({
            author: senderId,
            recipients: recipientEmail,
            subject: 'cXML data',
            body: ['<pre lang="xml">', content, '</pre>'].join('')
        });
    }

    return {
        onAction: onAction
    };

});