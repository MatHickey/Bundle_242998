/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @author Matt Lehman
 * @overview - Set Customer Native Address Sublist Fields
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
 
define(['N/record', 'N/search'], function(record, search) {

    function afterSubmit(scriptContext) {
        var trigger = scriptContext.type;
        var id = scriptContext.newRecord.id;
        var recordType = scriptContext.newRecord.type;
        log.debug('trigger', trigger);
        log.debug('record id', id);
        switch (trigger) {
            case 'create':
            case 'edit':
            case 'xedit':
                var customer = record.load({
                    type:recordType,
                    id: id,
                    isDynamic: true
                });
                var isAddressRecord = customer.getValue({fieldId: 'custentity_bb_is_address_rec_boolean'});

                var addressObj = {
                    addr1: customer.getValue({fieldId: 'custentity_bb_install_address_1_text'}),
                    addr2: customer.getValue({fieldId: 'custentity_bb_install_address_2_text'}),
                    city: customer.getValue({fieldId: 'custentity_bb_install_city_text'}),
                    state: customer.getText({fieldId: 'custentity_bb_install_state'}),
                    zip: customer.getValue({fieldId: 'custentity_bb_install_zip_code_text'}),
                    addressee : customer.getValue({fieldId: 'custentity_bb_home_owner_name_text'})
                };
                var isPerson = customer.getValue('isperson');
                if (isPerson == 'F'){
                  var name = customer.getValue('companyname');
                  addressObj['addressee'] = name;
                }
                // if (trigger != 'create') {
                    var addyString = addressObj.addressee + ' ' + addressObj.addr1 + ' ' + addressObj.city + ' ' + addressObj.state + ' ' + addressObj.zip;
                    if (!isAddressRecord) {
                        var addressLineCount = customer.getLineCount({
                            sublistId: 'addressbook'
                        });

                        if (addressLineCount > 0) {
                            customer.selectLine({
                                sublistId: 'addressbook',
                                line: 0
                            });

                            var addressBook = customer.getCurrentSublistSubrecord({
                                sublistId: 'addressbook',
                                fieldId: 'addressbookaddress'
                            });
                            var oldAddressee = addressBook.getValue({
                                fieldId: 'addressee',
                            });
                            var oldAddr1 = addressBook.getValue({
                                fieldId: 'addr1',
                            });
                            var oldCity = addressBook.getValue({
                                fieldId: 'city',
                            });
                            var oldState = addressBook.getValue({
                                fieldId: 'state',
                            });
                            var oldZip = addressBook.getValue({
                                fieldId: 'zip',
                            });

                            var oldAddyString = oldAddressee + ' ' + oldAddr1 + ' ' + oldCity + ' ' + oldState + ' ' + oldZip;

                            if (addyString != oldAddyString) {
                                log.debug('address object', JSON.stringify(addressObj));
                                setAddressSubFields(customer, addressObj);
                            }
                        } else {
                                log.debug('address object', JSON.stringify(addressObj));
                                setAddressSubFields(customer, addressObj);
                        }
                    }

                    // var oldRecord = scriptContext.oldRecord;
                    //
                    // var oldAddr1 = oldRecord.getValue({fieldId: 'custentity_bb_install_address_1_text'});
                    // var oldCity = oldRecord.getValue({fieldId: 'custentity_bb_install_city_text'});
                    // var oldState = oldRecord.getText({fieldId: 'custentity_bb_install_state'});
                    // var oldZip =  oldRecord.getValue({fieldId: 'custentity_bb_install_zip_code_text'});
                    // var oldAddyString = oldAddr1 + ' ' + oldCity + ' ' + oldState + ' ' + oldZip;
                    //
                    // var addressLineCount = customer.getLineCount({
                    //     sublistId: 'addressbook'
                    // });
                    //
                    // if ((addyString != oldAddyString) || addressLineCount == 0) {
                    //     log.debug('address object', JSON.stringify(addressObj));
                    //     setAddressSubFields(customer, addressObj);
                    // }

                // } else {
                //
                //     if (!isAddressRecord) {
                //
                //         log.debug('address object', JSON.stringify(addressObj));
                //
                //         setAddressSubFields(customer, addressObj);
                //
                //     }
                // }

                customer.save({
                    ignoreMandatoryFields: true
                });

            break;
        }

    }

    function setAddressSubFields(customer, addressObj) {
        if (addressObj.addr1) {
            var addressLineCount = customer.getLineCount({
                sublistId: 'addressbook'
            });
            if (addressLineCount == 0) {
                customer.selectNewLine({
                    sublistId: 'addressbook'
                });
            } else {
                customer.selectLine({
                    sublistId: 'addressbook',
                    line: 0
                });
            }
            var addressBook = customer.getCurrentSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress'
            });
            addressBook.setValue({
                fieldId: 'country',
                value: 'US'
            });
            addressBook.setValue({
                fieldId: 'addressee',
                value: addressObj.addressee
            });
            addressBook.setValue({
                fieldId: 'addr1',
                value: addressObj.addr1
            });
            if (addressObj.city) {
                addressBook.setValue({
                    fieldId: 'city',
                    value: addressObj.city
                });
            }
            if (addressObj.state) {
                addressBook.setValue({
                    fieldId: 'state',
                    value: addressObj.state
                });
            }
            if (addressObj.zip) {
                addressBook.setValue({
                    fieldId: 'zip',
                    value: addressObj.zip
                });
            }

            customer.commitLine({
                sublistId: 'addressbook'
            });

        }

    }

    return {
        afterSubmit : afterSubmit
    };
    
});