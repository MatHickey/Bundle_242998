/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @author Matt Lehman
 */
define([],

function() {
    


    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {
        var packageActionName = scriptContext.currentRecord.getText({fieldId: 'name'});
        var pattern = new RegExp(/[()]/);
        log.debug('has parentheses', pattern.test(packageActionName));
        if (pattern.test(packageActionName)) {
            alert('The Package Action Name contains a Parentheses, Parentheses are not allowed in the name, please remove the parentheses and try again.');
            return false;
        } else {
            return true;
        }


    }

    return {
        saveRecord: saveRecord
    };
    
});
