/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - BB File System Client Script Validations
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
 
define(['N/currentRecord'],

function(currentRecord) {
    

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(context) {
        var currentRec = context.currentRecord;
        var link = currentRec.getValue({
            fieldId: 'custrecord_bb_file_link'
        });
        var message = 'You must upload your document to Amazon. Click the Choose File Button, select your document from your local system and click Upload to Amazon S3 Button,' +
            'when the upload is complete a link will be set from Amazon.';
        if (!link) {
            alert(message);
            return false;
        } else {
            return true;
        }

    }

    return {
        saveRecord: saveRecord
    };
    
});
