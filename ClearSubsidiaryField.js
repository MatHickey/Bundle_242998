/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define([ 'N/search' ], function(search) {
    var MODE;
    /**
     * Function to be executed after page is initialized.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.mode
     *        {String} The mode in which the record is being accessed (create,
     *        copy, or edit)
     * 
     * @return {void}
     * 
     * @since 2015.2
     * 
     * @static
     * @function pageInit
     */
    function pageInit(scriptContext) {
        // console.log(scriptContext);
        MODE=scriptContext.mode;
        if(scriptContext.mode=='create'){
            scriptContext.currentRecord.setValue({fieldId:'subsidiary',value:''});
        }
    }

    /**
     * Function to be executed when field is changed.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * @param scriptContext.fieldId
     *        {String} Field name
     * @param [scriptContext.lineNum]
     *        {Number} Line number. Will be undefined if not a sublist or matrix
     *        field
     * @param [scriptContext.columnNum]
     *        {Number} Matrix column number. Will be undefined if not a matrix
     *        field
     * 
     * @return {void}
     * 
     * @since 2015.2
     * 
     * @static
     * @function fieldChanged
     */
    function fieldChanged(scriptContext) {
        //console.log(scriptContext);
        // if(scriptContext.fieldId=='entity' && MODE=='create'){
        //     scriptContext.currentRecord.setValue({fieldId:'subsidiary',value:''});
        // }
    }

    /**
     * Function to be executed when field is slaved.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * @param scriptContext.fieldId
     *        {String} Field name
     * 
     * @return {void}
     * 
     * @since 2015.2
     * 
     * @static
     * @function postSourcing
     */
    function postSourcing(scriptContext) {
        // console.log(scriptContext);
        if(MODE=='create'){
            // if(scriptContext.fieldId=='subsidiary'){
            //     console.log('sub',scriptContext);
            //     scriptContext.currentRecord.setValue({fieldId:'subsidiary',value:''});
            // }
            if(scriptContext.fieldId=='entity'){
                console.log('ent',scriptContext);
                scriptContext.currentRecord.setValue({fieldId:'subsidiary',value:''});
            }
        }

    }

    /**
     * Function to be executed after sublist is inserted, removed, or edited.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * 
     * @return {void}
     * 
     * @since 2015.2
     * 
     * @static
     * @function sublistChanged
     */
    function sublistChanged(scriptContext) {

    }

    /**
     * Function to be executed after line is selected.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * 
     * @return {void}
     * 
     * @since 2015.2
     * 
     * @static
     * @function lineInit
     */
    function lineInit(scriptContext) {

    }

    /**
     * Validation function to be executed when field is changed.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * @param scriptContext.fieldId
     *        {String} Field name
     * @param [scriptContext.lineNum]
     *        {Number} Line number. Will be undefined if not a sublist or matrix
     *        field
     * @param [scriptContext.columnNum]
     *        {Number} Matrix column number. Will be undefined if not a matrix
     *        field
     * 
     * @return {Boolean} <code>true</code> if field value is valid;
     *         <code>false</code> otherwise
     * 
     * @since 2015.2
     * 
     * @static
     * @function validateField
     */
    function validateField(scriptContext) {

    }

    /**
     * Validation function to be executed when sublist line is committed.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * 
     * @return {Boolean} <code>true</code> if sublist line is valid;
     *         <code>false</code> otherwise
     * 
     * @since 2015.2
     * 
     * @static
     * @function validateLine
     */
    function validateLine(scriptContext) {

    }

    /**
     * Validation function to be executed when sublist line is inserted.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * 
     * @return {Boolean} <code>true</code> to allow line insertion;
     *         <code>false</code> to prevent it
     * 
     * @since 2015.2
     * 
     * @static
     * @function validateInsert
     */
    function validateInsert(scriptContext) {

    }

    /**
     * Validation function to be executed when record is deleted.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * @param scriptContext.sublistId
     *        {String} Sublist name
     * 
     * @return {Boolean} <code>true</code> to allow line deletion;
     *         <code>false</code> to prevent it
     * 
     * @since 2015.2
     * 
     * @static
     * @function validateDelete
     */
    function validateDelete(scriptContext) {

    }

    /**
     * Validation function to be executed when record is saved.
     * 
     * @governance XXX
     * 
     * @param scriptContext
     *        {Object}
     * @param scriptContext.currentRecord
     *        {Record} Current form record
     * 
     * @return {Boolean} <code>true</code> to allow record to be saved;
     *         <code>false</code> to prevent it
     * 
     * @since 2015.2
     * 
     * @static
     * @function saveRecord
     */
    function saveRecord(scriptContext) {

    }

    return {
    	pageInit: pageInit
    	// ,fieldChanged: fieldChanged
    	,postSourcing: postSourcing
    	// ,sublistChanged: sublistChanged
    	// ,lineInit: lineInit
    	// ,validateField: validateField
    	// ,validateLine: validateLine
    	// ,validateInsert: validateInsert
    	// ,validateDelete: validateDelete
    	// ,saveRecord: saveRecord
    }
});
