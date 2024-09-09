/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * 
 * Requires Solar Success Bundle 242998
 */
define(['N/runtime','./BB SS/base64', 'N/error', 'N/xml', 'N/render', './BB SS/API Logs/API_Log', 'N/record', 'N/search','N/file','N/format'],

    function(runtime, base64, error, xmlModule, renderModule, apiLogModule, recordModule, search, file, format) {
		const USER_FIELD = 'custscript_wesco_user';
        const PASS_FIELD = 'custscript_wesco_password';

        var APILog,VENDOR_ID;

        var _processors = {
            'onShipNoticeRequest': function(xmlObject){
                log.debug('ASN', 'ShipNoticeHeader');
                var _noticeHeader = xmlObject.getElementsByTagName({tagName: 'ShipNoticeHeader'})[0];
                if(_noticeHeader){
                    log.debug('ASN','*****************');
                    var _noticeDate = _noticeHeader.getAttribute({name: 'noticeDate'});
                    var _deliveryDate = _noticeHeader.getAttribute({name: 'deliveryDate'});
                    var _shipmentDate = _noticeHeader.getAttribute({name: 'shipmentDate'});
                    var _shipmentId = _noticeHeader.getAttribute({name: 'shipmentID'});

                    var _carrierIdentifier = getTagText(xmlObject,'CarrierIdentifier');

                    var _noticeOrderRef = xmlObject.getElementsByTagName({tagName: 'OrderReference'})[0];
                    var _orderId = _noticeOrderRef.getAttribute({name: 'orderID'});
                    var _noticeItemLines = xmlObject.getElementsByTagName({tagName: 'ShipNoticeItem'});

                    // update api log
                    if(APILog) APILog.setValue({transaction:_orderId,entity:getVendorId()});
                    log.debug('loading order id',_orderId);

                    // update the PO - using load so we can update the line items
                    var _po = recordModule.load({type: 'purchaseorder', id: _orderId});

                    if(_shipmentDate){
                        var shipDate = parseDateStr(_shipmentDate);
                        log.debug('ship date str',shipDate);
                        _po.setValue({fieldId: 'shipdate', value: shipDate});
                    }
                    if(_shipmentId){
                        _po.setValue({fieldId: 'trackingnumbers', value: _shipmentId});
                    }
​
                    for(var i = 0; i < _noticeItemLines.length; i++){
                        var _noticeItemLine = _noticeItemLines[i];
                        var _itemLineQty = _noticeItemLine.getAttribute({name: 'quantity'});
                        var _itemLineNum = _noticeItemLine.getAttribute({name: 'lineNumber'});
                        log.debug(_itemLineNum + ' line', 'qty = '+_itemLineQty);
                        var lineNumber = _po.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: 'line',
                            value: _itemLineNum
                        });
                        if(lineNumber>=0){
                            var poQty = _po.getSublistValue({sublistId:'item',fieldId:'quantity',line:lineNumber});
                            if(_itemLineQty!=poQty){
                                //TODO: error/warning
                                log.error('line quantity does not match',{line:_itemLineNum,asnQty:_itemLineQty,lineQty:poQty});
                                //continue;
                                _po.setSublistValue({sublistId: 'item', fieldId: 'quantity', line: lineNumber, value: _itemLineQty});
                            }
                            if(_deliveryDate){
                                var delDate = parseDateStr(_deliveryDate);
                                log.debug('update line date',delDate);
                                _po.setSublistValue({sublistId: 'item', fieldId: 'expectedreceiptdate', line: lineNumber, value: delDate});
                            }
                        } else {
                            log.error("LINE_NOT_FOUND","The line number "+_itemLineNum+"in this ship notice was not found on this purchaseorder:"+_orderId);
                            //TODO: add errors to api log
                        }
                    }

                    var id = _po.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                    log.debug('purchaseorder:'+id,'updated with order confirmation');
                } else {
                    // no header found

                }
            },
            'onInvoiceDetailRequest': function(xmlObject){
                log.debug('onInvoiceDetailRequest','********* START *********');
                var _invHeader = xmlObject.getElementsByTagName({tagName: 'InvoiceDetailRequestHeader'})[0];
                if(!_invHeader) {
                    //TODO: return error
                }
                var invoiceID = _invHeader.getAttribute({name: 'invoiceID'});
                var invoiceDate = _invHeader.getAttribute({name: 'invoiceDate'});

                var _orderRef = xmlObject.getElementsByTagName({tagName: 'OrderReference'})[0];
                var poId = _orderRef.getAttribute({name: 'orderID'});

                log.debug('purchaseorder:'+poId,'invoiceID ref # '+invoiceID);
                var lines = {};
                var invoiceDetailItems = xmlObject.getElementsByTagName({tagName: 'InvoiceDetailItem'});
                
                for(var i = 0; i < invoiceDetailItems.length; i++){
                    var invoiceDetailItem = invoiceDetailItems[i];
                    var itemRef = invoiceDetailItem.getElementsByTagName({tagName: 'InvoiceDetailItemReference'})[0];
                    var unitPriceRef = invoiceDetailItem.getElementsByTagName({tagName: 'UnitPrice'})[0];
                    var grossAmountRef = invoiceDetailItem.getElementsByTagName({tagName: 'GrossAmount'})[0];
                    // var taxRef = invoiceDetailItem.getElementsByTagName({tagName: 'Tax'})[0];

                    var poLineNum = itemRef.getAttribute({name: 'lineNumber'});
                    var sim = getTagText(itemRef,'SupplierPartID');
                    // not able to avoid multiple searches for the item used because sim is a text field
                    lines[poLineNum] = {
                        item: getItemFromSIM(sim),
                        "sim": sim,
                        "disc": getTagText(itemRef,'Description'),
                        "quantity": invoiceDetailItem.getAttribute({name: 'quantity'}),
                        "uom": getTagText(invoiceDetailItem,'UnitOfMeasure'),
                        "unitPrice": getTagText(unitPriceRef,'Money'),
                        "grossAmount": getTagText(grossAmountRef,'Money')
                    }
                }
                log.debug('invoice lines',lines);

                // get the city, state, zip in case we need it for the location
                var shipToData = {city:null,state:null,zip:null};
                var invoicePartners = xmlObject.getElementsByTagName({tagName: 'InvoicePartner'});
                for(var p=0; p<invoicePartners.length; p++){
                    var contactRole = invoicePartners[p].getElementsByTagName({tagName:'Contact'})[0].getAttribute({name:'role'});
                    if(contactRole.toLowerCase()!='shipto') continue;
                    shipToData.city = getTagText(invoicePartners[p],'City');
                    shipToData.state = getTagText(invoicePartners[p],'State');
                    shipToData.zip = getTagText(invoicePartners[p],'PostalCode');
                }

                // ADDING THE Tax Item to the VB created this error
                /*{
                    "name": "YOU_CANNOT_ADD_AN_ITEM_AND_PURCHASE_ORDER_COMBINATION_THAT_DOES_NOT_EXIST_TO_A_VENDOR_BILL",
                    "message": "You cannot add an item and purchase order combination that does not exist to a Vendor Bill."
                }*/
                // So we need to update the PO with the tax item before transforming it



                var vb = recordModule.transform({
                    fromType: recordModule.Type.PURCHASE_ORDER,
                    fromId: poId,
                    toType: recordModule.Type.VENDOR_BILL,
                    isDynamic: true,
                });

                // tranid (Bill No)
                vb.setValue({fieldId:'tranid',value:invoiceID});

                for(var line in lines){
                    log.debug('line '+line+' data',lines[line]);
                    var poLineIndex = vb.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'line',
                        value: line
                    });
                    if(poLineIndex < 0) {
                        // this should only happen if they are billing for something that's not on the PO
                        vb.selectNewLine({sublistId: 'item'});
                    } else {
                        vb.selectLine({
                            sublistId: 'item',
                            line: poLineIndex
                        });
                    }
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: lines[line].item.value,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: lines[line].quantity,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: lines[line].unitPrice,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'description',
                        value: lines[line].sim + ': ' + lines[line].disc,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        //value: poData['location'],
                        value: vb.getValue({fieldId:'location'}),
                        ignoreFieldChange: false
                    });
                    vb.commitLine({sublistId: 'item'});
                }

                // TAXES
                var taxItem = getTaxItem();
                var _orderTax = xmlObject.getElementsByTagName({tagName: 'Tax'})[0];

                if(taxItem && _orderTax){
                    var _taxDetail = _orderTax.getElementsByTagName({tagName:'TaxDetail'})[0];
                    var taxAmount = getTagText(_taxDetail,'Money');
                    var taxDescription = getTagText(_taxDetail,'Description');

                    vb.selectNewLine({sublistId: 'item'});
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: taxItem.value,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: 1,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: taxAmount,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'description',
                        value: taxDescription,
                        ignoreFieldChange: false
                    });
                    vb.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        //value: poData['location'],
                        value: vb.getValue({fieldId:'location'}),
                        ignoreFieldChange: false
                    });
                    vb.commitLine({sublistId: 'item'});
                }

                // SAVE
                log.debug('saving vendor bill',vb.getLineCount({sublistId:'item'})+' lines');
                var vbId = vb.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                log.debug('vendorbill:'+vbId,'saved');
                if(APILog) APILog.setValue({transaction:vbId,entity:getVendorId()});


            },
            'onConfirmationRequest': function(xmlObject){
                // get the data
                var data = {};
                var _confHeader = xmlObject.getElementsByTagName({tagName: 'ConfirmationHeader'})[0];
                if(!_confHeader) {
                    //TODO: return error
                    log.error('ConfirmationHeader not found', 'exit script');
                    return false;
                }
                data.confirmID = _confHeader.getAttribute({name: 'confirmID'});
                data.noticeDate = _confHeader.getAttribute({name: 'noticeDate'});
                data.operation = _confHeader.getAttribute({name: 'operation'}); // new/update

                var _contact = _confHeader.getElementsByTagName({tagName: 'Contact'})[0];
                data.contactName = getTagText(_contact,"Name");
                data.contactStreet = getTagText(_contact,"Street");
                data.contactCity = getTagText(_contact,"City");
                data.contactState = getTagText(_contact,"State");
                data.contactZip = getTagText(_contact,"PostalCode");
                data.contactCountry = getTagText(_contact,"Country");

                var _confOrderReference = xmlObject.getElementsByTagName({tagName: 'OrderReference'})[0];
                data.orderId = _confOrderReference.getAttribute({name: 'orderID'});
                // update api log
                if(APILog) APILog.setValue({transaction: data.orderId,entity:getVendorId()});

                // get the PO line data for error checking
                var updatePO = getVendorUpdatePO();
                var poLineData = {};
                if(updatePO) {
                    var po = recordModule.load({type: 'purchaseorder', id: data.orderId, isDynamic: false});
                    var poLineItemCt = po.getLineCount({sublistId: 'item'});
                    for (var i = 0; i < poLineItemCt; i++) {
                        poLineData[po.getSublistValue({sublistId: 'item', line: i, fieldId: 'line'})] = {
                            lineIndex: i,
                            qty: po.getSublistValue({sublistId: 'item', line: i, fieldId: 'quantity'}),
                            amount: po.getSublistValue({sublistId: 'item', line: i, fieldId: 'amount'}),
                            rate: parseFloat(po.getSublistValue({sublistId: 'item', line: i, fieldId: 'rate'})).toFixed(2),
                            itemId: po.getSublistValue({sublistId: 'item', line: i, fieldId: 'item'}),
                            itemName: po.getSublistValue({sublistId: 'item', line: i, fieldId: 'item'})
                        }
                    }
                } else {
                    search.create({
                        type: "transaction",
                        filters:
                            [["internalid","anyof",data.orderId],"AND",["mainline","is","F"]],
                        columns:
                            ["line","quantity","item","amount","rate"]
                    }).run().each(function(result){
                        poLineData[result.getValue({name:'line'})] = {
                            qty: result.getValue({name:'quantity'}),
                            amount: result.getValue({name:'amount'}),
                            rate: parseFloat(result.getValue({name:'rate'})).toFixed(2),
                            itemId: result.getValue({name:'item'}),
                            itemName: result.getText({name:'item'})
                        }
                        return true;
                    });
                }

                log.debug('PO Line Data', poLineData);

                data.lines = [];
                var _confItemLines = xmlObject.getElementsByTagName({tagName: 'ConfirmationItem'});
                // loop the lines to get all the item data
                for (var l = 0; l < _confItemLines.length; l++) {
                    var _confItemLine = _confItemLines[l];
                    var _ConfirmationStatus = _confItemLine.getElementsByTagName("ConfirmationStatus")[0];

                    var cQty = _ConfirmationStatus.getAttribute({name: 'quantity'});
                    var cPrice = getTagText(_ConfirmationStatus,'Money');
                    cPrice = cPrice ? parseFloat(cPrice).toFixed(2) : null;
                    var lineNum = _confItemLine.getAttribute({name: 'lineNumber'});

                    var warningLevel = 'bb-norm';
                    if (cQty && cQty != poLineData[lineNum].qty) {
                        warningLevel = 'bb-warning';
                        if(updatePO)
                            po.setSublistValue({
                                sublistId: 'item',
                                line: poLineData[lineNum].lineIndex,
                                fieldId: 'quantity',
                                value: cQty
                            });
                    }
                    if (cPrice && cPrice != poLineData[lineNum].rate) {
                        warningLevel = 'bb-warning';
                        if(updatePO)
                            po.setSublistValue({
                                sublistId: 'item',
                                line: poLineData[lineNum].lineIndex,
                                fieldId: 'rate',
                                value: cPrice
                            });
                    }

                    // only show warning lines
                    if(warningLevel == 'bb-warning')
                        data.lines.push({
                            class: warningLevel, // css row color bb-norm or bb-warning
                            line: lineNum,
                            orgQty: poLineData[lineNum].qty,
                            qty: cQty,
                            deliveryDate: _ConfirmationStatus.getAttribute({name: 'deliveryDate'}),
                            uom: getTagText(_ConfirmationStatus,'UnitOfMeasure'),
                            orgPrice: poLineData[lineNum].rate,
                            price: cPrice,
                            comments: getTagText(_ConfirmationStatus,'Comments'),
                        });
                }
                log.debug('Conf Data', data);

                // find and load the html template file
                var confTemplateId;
                search.create({
                    type: 'file',
                    filters: ['name', 'is', 'cxml-order-conf.ftl']
                }).run().each(function (result) {
                    confTemplateId = result.id
                });

                var templateFile = file.load({
                    id: confTemplateId
                });
                var renderer = renderModule.create();
                renderer.templateContent = templateFile.getContents();
                renderer.addCustomDataSource({
                    format: renderModule.DataSource.OBJECT,
                    alias: 'data',
                    data: data
                });

                // write to html field on po custbody_bb_bw_post_po_html
                var html = renderer.renderAsString();
                log.debug('Data Table', html);
                if(updatePO) {
                    po.setValue({fieldId: "custbody_bb_bw_post_po_html", value: html});
                    var id = po.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                } else {
                    var id = recordModule.submitFields({
                        type: recordModule.Type.PURCHASE_ORDER,
                        id: data.orderId,
                        values: {
                            custbody_bb_bw_post_po_html: html
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields : true
                        }
                    });
                }
                log.debug('purchaseorder:' + id, 'updated with order confirmation');
            }
        };

        function getXmlObject(xmlStr){
            return xmlModule.Parser.fromString({text: xmlStr});
        }

        function getTagText(xmlObj,tagName){
            if(!xmlObj || !tagName) {
                log.error('xmlObj or tagName not found');
                return '';
            }
            var tagArry = xmlObj.getElementsByTagName({tagName: tagName});
            var tag = util.isArray(tagArry) ? tagArry[0] : tagArry;
            var tagText = (tag && tag.textContent) ? tag.textContent : '';
            return tagText;
        }

        function getPayloadId(xmlObj){
            var _body = xmlObj.getElementsByTagName({tagName: 'cXML'})[0];
            var _payloadId = undefined;
            var _errors = [];
            if(_body){
                if(_body.hasAttribute({name: 'payloadID'})){
                    _payloadId = _body.getAttribute({name: 'payloadID'});
                } else {
                    _errors.push('Invalid cXML. Missing \'payloadID\' attribute.')
                }
            } else {
                _errors.push('Invalid cXML. Missing cXML tag.')
            }
            return {
                payloadId: _payloadId,
                errors: _errors
            };
        }
​
        function getProcessorName(xmlObj){
            var _requestElm = xmlObj.getElementsByTagName({tagName: 'Request'})[0];
            if(_requestElm){
                // first element after the Request node can be used to identify the request type (confirmation, asn, invoice)
                var _children = _requestElm.getElementsByTagName({tagName : '*'});
                return ['on', _children[0].tagName].join('');
            }
            return undefined;
        }
​
        function formatTempResponse(payloadIdData){
            var _template = '<cXML payloadID="${data.payloadId}" xml:lang="en" ' +
                'timestamp="${.now?iso_local}">\n' +
                '\t<Response>\n' +
                '\t\t<Status code="${data.code}" text="${data.text}"/>\n' +
                '\t</Response>\n' +
                '</cXML>';

            var _renderer = renderModule.create();
            _renderer.templateContent = _template;
            var _data = {};
            var _response = _template;
            _data.code = payloadIdData.errors instanceof Array && payloadIdData.errors.length > 0 ? 400 : 200;
            _data.text = _data.code === 400 ? payloadIdData.errors.join('\n') : 'OK';
            _data.payloadId = payloadIdData.payloadId ? payloadIdData.payloadId: '';
            _renderer.addCustomDataSource({
                format: renderModule.DataSource.OBJECT,
                alias: 'data',
                data: _data
            });
            return _renderer.renderAsString();
        }

        function getVendorId(){
            if(VENDOR_ID) return VENDOR_ID;
            var vendorId = "";
            search.create({type:'customrecord_bb_solar_success_configurtn',
                filters:["isinactive","is","F"],
                columns:["custrecord_bb_wesco_vendor"]}
            ).run().each(function(result){
                vendorId = result.getValue({name:"custrecord_bb_wesco_vendor"});
            });
            VENDOR_ID = vendorId;
            return vendorId;
        }
        function getVendorUpdatePO(){
            var updatePO = false;
            search.create({type:'customrecord_bb_solar_success_configurtn',
                filters:["isinactive","is","F"],
                columns:["custrecord_bbss_autoupdate_po"]}
            ).run().each(function(result){
                updatePO = result.getValue({name:"custrecord_bbss_autoupdate_po"});
            });
            return updatePO;
        }
        function getTaxItem(){
            var taxItem;
            search.create({type:'customrecord_bb_solar_success_configurtn',
                filters:["isinactive","is","F"],
                columns:["custrecord_bb_wesco_sales_tax_item"]}
            ).run().each(function(result){
                taxItem = {
                    value: result.getValue({name:"custrecord_bb_wesco_sales_tax_item"}),
                    text: result.getText({name:"custrecord_bb_wesco_sales_tax_item"}),
                };
            });
            return taxItem;
        }
        function getItemFromSIM(sim){
            var item;
            var customrecord_bb_vendor_item_detailsSearchObj = search.create({
                type: "customrecord_bb_vendor_item_details",
                filters:
                    [
                        ["custrecord_bb_vendor_part_number","is",sim],
                        "AND",
                        ["custrecord_bb_vendor_item_vendor","anyof",getVendorId()]
                    ],
                columns:
                    [
                        "custrecord_bb_vendor_item"
                    ]
            });
            var searchResultCount = customrecord_bb_vendor_item_detailsSearchObj.runPaged().count;
            log.debug("customrecord_bb_vendor_item_detailsSearchObj result count",searchResultCount);
            customrecord_bb_vendor_item_detailsSearchObj.run().each(function(result){
                item = {
                    text: result.getText({name:'custrecord_bb_vendor_item'}),
                    value: result.getValue({name:'custrecord_bb_vendor_item'})
                }
                return false;
            });
            return item;
        }
        function getPOData(poId,useLocation,shipToData){
            var poData = {};
            search.create({
                type:search.Type.PURCHASE_ORDER,
                filters:[['internalid','is',poId]],
                columns:['subsidiary','location','memo']
            }).run().each(function (result) {
                poData = {
                    subsidiary: result.getValue({name:'subsidiary'}),
                    location: result.getValue({name:'location'}),
                    memo: result.getValue({name:'memo'}),
                }
                return false;
            });
            if(!useLocation){
                delete poData.location;
            } else if(!poData.location && shipToData) {
                poData.location = getLocation(shipToData);
            }
            return poData;
        }
        function getLocation(shipToData) {
            // find the location based on the address info
            var location;
            var filters = [
                ["isinactive","is","F"]
            ];
            if(shipToData.zip) filters.push("AND",["zip","startswith",shipToData.zip.substr(0,5)])
            else if(shipToData.city) filters.push("AND",["city","startswith",shipToData.city])

            var locationSearchObj = search.create({
                type: "location",filters: filters,
                columns:[
                        search.createColumn({
                            name: "internalid",
                            sort: search.Sort.ASC
                        }),
                        "name",
                        "phone",
                        "address1",
                        "city",
                        "state",
                        "zip",
                        "country",
                        "locationtype",
                        "subsidiary"
                    ]
            });
            var searchResultCount = locationSearchObj.runPaged().count;
            log.debug("location Search result count",searchResultCount);
            locationSearchObj.run().each(function(result){
                log.debug('location data',result);
                // only grab the first result
                location = result.id;
                return false;
            });

            return location;
        }

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            log.debug('cXML Request','*********** START *************');
          /******* API LOG *********/ APILog = new apiLogModule.APILog({"request": context.request}); /******* API LOG *********/
          log.debug('api log created',APILog);
            try{
              var _responseStr = '';  
              var response = context.response;
              var request = context.request;
              
              if (!request.parameters.apilog && !userAuthenticated(context.request.headers)) {
                    var errObj = error.create({name: 'NOT_AUTHORIZED',message: 'This request was not authorized.',notifyOff: false});
                    log.error('Error: ' + errObj.name, errObj.message);
                	APILog.setValue({error:errObj});
                    //throw errObj;
                  	_responseStr = formatTempResponse({
                        payloadId: '',
                        errors: [errObj.message]
                    });
                    response.write(_responseStr);
                    return;
                }
              log.debug('authenticated or bypassed');
              // only accept POST
              if(/post/i.test(request.method)){
                    if(!request.body || (typeof request.body === 'string' && request.body.trim().length ===0)){
                        _responseStr = formatTempResponse({
                            payloadId: '',
                            errors: ['Missing request data.']
                        });
                        APILog.setValue({error:_responseStr});
                        response.write(_responseStr);
                        return;
                    }
                    //log.debug('xmlToJson',xmlToJson(request.body));
                    var _xmlObj = getXmlObject(request.body);
                    var _payloadIdData = getPayloadId(_xmlObj);
                    var _processorName = getProcessorName(_xmlObj);
                    if(_processors.hasOwnProperty(_processorName)){
                            // Check which deployment this came in on
                            /*
                             * 1 = Order Confirmation (customdeploy_wesco_cxml_ordr_conf)
                             * 2 = ASN (customdeploy_wesco_cxml_asn)
                             * 3 = Invoice (customdeploy_wesco_cxml_invoice)
                            */
                          /************** script parameters **************/
                          var scriptObj = runtime.getCurrentScript();
                          var deployId = scriptObj.deploymentId;
                          log.debug("Deployment Id",deployId);
                          /************** end script parameters **************/
                        // call the processor
                        _processors[_processorName](_xmlObj);
                    } else {
                        APILog.setValue({error:{name:"PROCESSOR_NOT_FOUND",message:"Payload processor was not found"}});
                        log.error('processor not found',_processorName);
                    }
                    _responseStr = formatTempResponse(_payloadIdData);
                    APILog.setValue({response:_responseStr});
                    response.write(_responseStr);
                    return;
                }

              /********** TEMP CODE FOR TESTING WITH API LOGS for data ******************/
              else {
                  log.debug('temp code to use api log as data');
                  var apiLogId = request.parameters.apilog;
                  if(apiLogId){
                      // load the api log record to get the xml sample data
                      var apiLogRec = recordModule.load({type:'customrecord_api_log',id:apiLogId,isDynamic:true});
                      log.debug('api log record loaded',apiLogId);
                      var _xmlObj = getXmlObject(apiLogRec.getValue({fieldId:'custrecord_api_body'}));
                      var _payloadIdData = getPayloadId(_xmlObj);
                      var _processorName = getProcessorName(_xmlObj);
                      log.debug('processor name',_processorName);
                      if(_processors.hasOwnProperty(_processorName)){
                          // Check which deployment this came in on
                          /*
                           * 1 = Order Confirmation (customdeploy_wesco_cxml_ordr_conf)
                           * 2 = ASN (customdeploy_wesco_cxml_asn)
                           * 3 = Invoice (customdeploy_wesco_cxml_invoice)
                          */
                          /************** script parameters **************/
                          var scriptObj = runtime.getCurrentScript();
                          var deployId = scriptObj.deploymentId;
                          log.debug("Deployment Id",deployId);
                          /************** end script parameters **************/
                          // call the processor
                          _processors[_processorName](_xmlObj);
                      } else {
                          //TODO: error
                          APILog.setValue({error:{name:"PROCESSOR_NOT_FOUND",message:"Payload processor was not found"}});
                          log.error('processor not found',_processorName);
                      }
                      _responseStr = formatTempResponse(_payloadIdData);
                      APILog.setValue({response:_responseStr});
                      response.write(_responseStr);
                      return;
                  } else {
                      log.error('api log id not valid or missing');
                  }
              }

                _responseStr = formatTempResponse({
                    payloadId: '',
                    errors: ['Method \'' + request.method + '\' is not supported.']
                });
                if(APILog) APILog.setValue({error:_responseStr});
                response.write(_responseStr);

            } catch(err){
                if(APILog) APILog.setValue({error:{name:err.name,message:err.message}});
                response.write(JSON.stringify(err,null,4));
            }
        }

        function parseDateStr(dtStr) { // format = 2019-08-22T00:00:00-04:00
            log.debug('parsing date string',dtStr);
            var dtArr = dtStr.split('T')[0].split('-');
            log.debug('data array',dtArr);
            var initialFormattedDateString = dtArr[1]+'/'+dtArr[2]+'/'+dtArr[0];
            var parsedDateStringAsRawDateObject = format.parse({
                value: initialFormattedDateString,
                type: format.Type.DATE
            });
            var formattedDateString = format.format({
                value: parsedDateStringAsRawDateObject,
                type: format.Type.DATE
            });
            return parsedDateStringAsRawDateObject;
        }

		function userAuthenticated(headers) {
            var scriptObj = runtime.getCurrentScript();
            var USER = scriptObj.getParameter({name: USER_FIELD});
            var PASS = scriptObj.getParameter({name: PASS_FIELD});
            //log.debug("Deployment Id: " + scriptObj.deploymentId);
            log.debug('deployment user/password', {user: USER, pass: PASS});
            var basicAuth = headers['authorization'];
            log.debug('basic auth', basicAuth);
            if (!basicAuth) return false;
            var auth = base64.decode(basicAuth.replace('Basic ', ''));
            log.debug('auth', auth);
            if (!auth) return false;
            auth = auth.split(':');
            var user = auth[0];
            var pass = auth[1];
            var authenticated = (pass == PASS && user == USER);
            log.debug('Authenticated',authenticated);
            return authenticated;
        }

        // Changes XML to JSON
        function xmlToJson(xml) {
            // Create the return object
            var obj = {};
          //if(typeof(xml) == "string" && xml.trim().length==0) return obj;

            require(['N/xml'],function(XML){
                if(typeof xml == 'string'){
                    // convert it to XML
                    xml = XML.Parser.fromString({
                        text : xml
                    });
                }

                //log.debug(xml.nodeName,xml.nodeType);
                if (xml.nodeType == 'ELEMENT_NODE') { // element
                    // do attributes
                    if (xml.hasAttributes()) {
                        //log.debug('attributes found',xml.attributes);
                        obj["@attributes"] = {};
                        for (var key in xml.attributes) {
                            //log.debug('attribute '+key,xml.attributes[key].value);
                            obj["@attributes"][key] = xml.attributes[key].value;
                        }
                    }
                } else if (xml.nodeType == 'TEXT_NODE' && xml.nodeValue.trim()) { // text
                    //log.debug('TEXT_NODE',xml.nodeValue);
                    obj = xml.nodeValue;
                }

                // do children
                if (xml.hasChildNodes()) {
                    var nodes = xml.childNodes;
                    //log.debug('child nodes',nodes);


                    if( nodes.length==1 && nodes[0].nodeType == 'TEXT_NODE' && !xml.hasAttributes()){
                        obj = nodes[0].nodeValue;
                    } else {
                        for(var i = 0; i < nodes.length; i++) {
                            var item = nodes[i];
                            var nodeName = item.nodeName=='#text' ? 'text' : item.nodeName;
                            //log.debug(i+':'+xml.nodeName+':'+nodeName,item);

                            if (typeof(obj[nodeName]) == "undefined") {
                                // object did not have this key
                                var nodeValue = xmlToJson(item);
                                //log.debug('no object key found - setting new key='+nodeName,nodeValue);
                                if(nodeValue) obj[nodeName] = nodeValue;
                            } else {
                                if (typeof(obj[nodeName].push) == "undefined") {
                                    // convert this node to an array
                                    var old = obj[nodeName];
                                    obj[nodeName] = [];
                                    obj[nodeName].push(old);
                                }
                              	var n = xmlToJson(item);
                              	if(n) obj[nodeName].push(n);
                            }
                        }
                    }
                }
            });

            return empty(obj) ? null : obj;
        };
  function empty(n){
	return !(!!n ? typeof n === 'object' ? Array.isArray(n) ? !!n.length : !!Object.keys(n).length : true : false);
}

        return {
            onRequest: onRequest
        };

    });