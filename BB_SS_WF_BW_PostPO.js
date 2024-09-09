/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @author Matthew Lehman
 */
define(['N/runtime', 'N/search', 'N/record', 'N/https', 'N/format', 'N/encode'], function(runtime, search, record, https, format, encode) {


    function onAction(scriptContext) {
        var currentRec = scriptContext.newRecord;

        var po_num = currentRec.getValue({ //doc number - po number
            fieldId: 'tranid'
        });
        var extId = currentRec.id;
        var expectedShipDate = currentRec.getValue({ // expected ship date - ship date
            fieldId: 'shipdate'
        });
        var cust_ord_req_memo = currentRec.getValue({ // shipping notes - shipping instructions
            fieldId: 'custbody_bb_shipping_notes'
        });
        //TODO set address sublist fields
        var addSubRec = currentRec.getSubrecord({
            fieldId: 'shippingaddress'
        });
        var shp_att = addSubRec.getValue({ // shipping attention
            fieldId: 'attention'
        });
        var shp_comp_name = addSubRec.getValue({ // addressee
            fieldId: 'addressee'
        });
        var shp_add1 = addSubRec.getValue({ //addr1
            fieldId: 'addr1'
        });
        var shp_add2 = addSubRec.getValue({ //addr2
            fieldId: 'addr2'
        });
        var shp_add3 = addSubRec.getValue({ // addr3
            fieldId: 'addr3'
        });
        var shp_city = addSubRec.getValue({ // city
            fieldId: 'city'
        });
        var shp_state = addSubRec.getValue({ // state
            fieldId: 'state'
        });
        var shp_zip = addSubRec.getValue({ // zip code
            fieldId: 'zip'
        });
        var shp_cntry = addSubRec.getValue({ // country
            fieldId: 'country'
        });
        var shp_phone = addSubRec.getValue({ // check phone number on shippping subrecord
            fieldId: 'addrphone'
        });
        var shp_complete = currentRec.getValue({ // ship complete
            fieldId: 'shipcomplete'
        });
        var shp_residential = currentRec.getValue({ // ship residential
            fieldId: 'custbody_bb_resi_delivery_checkbox'
        });
        var deliv_appt_req = currentRec.getValue({ // call ahead
            fieldId: 'custbody_bb_require_call_ahead'
        });
        var lift_gate = currentRec.getValue({ // lift gate
            fieldId: 'custbody_bb_liftgate_reqd_checkbox'
        });
        var shp_notes = currentRec.getValue({ // shipping notes
            fieldId: 'custbody_bb_shipping_notes'
        });
        var shp_method = currentRec.getValue({ // shipping carrier or shipping method
            fieldId: 'shipmethod'
        });

        var lineCount = currentRec.getLineCount({
            sublistId: 'item'
        });
        var request_items = [];
        for (var i = 0; i < lineCount; i++) {

            var item = currentRec.getSublistText({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            var itemId = currentRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            })
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


            var itemType = search.lookupFields({
                type: search.Type.ITEM,
                id: itemId,
                columns: ['type']
            });

            var type = itemType.type;
            var typeName = type[0].value;
            log.debug('Item Type', typeName);

            if (typeName == 'InvtPart') {
                request_items.push({
                    item: item,
                    qty: qty,
                    unit_price: unit_price,
                    lineId: lineId
                });
            }
        }
        var payload = {
            "po_num": po_num,
            "company_name": shp_comp_name,
            "recId": extId,
            "job_type": shp_residential,
            "ship_atten": shp_att,
            "ship_cntry": shp_cntry,
            "ship_addr1": shp_add1,
            "ship_addr2": shp_add2,
            "ship_addr3": shp_add3,
            "ship_city": shp_city,
            "ship_state": shp_state,
            "ship_zip": shp_zip,
            "ship_phone": shp_phone,
            "ship_residential": shp_residential,
            "ship_complete": shp_complete,
            "lift_gate": lift_gate,
            "expected_shp_dt": expectedShipDate,
            "call_ahead": deliv_appt_req,
            "ship_notes": shp_notes,
            "ship_method": shp_method,
            "items": request_items

        };

        var ssConfig = record.load({
            type: 'customrecord_bb_solar_success_configurtn',
            id: 1
        });
        var env = ssConfig.getText({
            fieldId: 'custrecord_bb_post_pos_baywa_enviro'
        });

        var response = oauth.callEndpoint(env, 'BayWa', 'POST', 'script=585&deploy=1', payload);

        log.debug('RESPONSE', response);
        var rsp = response;
        var htmlMsg = rsp.htmlBase64;
        var failedMsg = '';
        if (rsp.status == 'success') {
            var dateObj = format.parse({
                value: new Date(),
                type: format.Type.DATETIME
            });
            var dateFormat = format.format({
                value: dateObj,
                type: format.Type.DATETIME
            });

            var html = encode.convert({
                string: htmlMsg,
                inputEncoding: encode.Encoding.BASE_64,
                outputEncoding: encode.Encoding.UTF_8
            });

            var msg = rsp.msg;

            record.submitFields({
                type: currentRec.type,
                id: currentRec.id,
                values: {
                    'custbody_bb_bw_post_po_dt': dateFormat,
                    'custbody_bb_bw_post_po_html': html
                },
                options: {
                    ignoreMandatoryFields: true
                }

            });

        } else {
            var html = encode.convert({
                string: htmlMsg,
                inputEncoding: encode.Encoding.BASE_64,
                outputEncoding: encode.Encoding.UTF_8
            });

            record.submitFields({
                type: currentRec.type,
                id: currentRec.id,
                values: {
                    'custbody_bb_bw_post_po_html': html
                },
                options: {
                    ignoreMandatoryFields: true
                }

            });

        }

    }

    return {
        onAction: onAction
    };

});