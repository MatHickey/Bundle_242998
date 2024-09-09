/**
 * name of the function MUST be process
 */
function process(email)
{
    //Print out FROM email address
    var fromEmails =   email.getFrom();
    for (var i=0; i<fromEmails.length; i++)
        logAddress('FROM', fromEmails[i]);

    //Print out TO email address
    var author,recipient;
    var toEmails =   email.getTo();
    for (var i=0; i<toEmails.length; i++)
        var toEmail = logAddress('TO', toEmails[i]);
    if(toEmail){
        // send a copy to BB
        var emailAddr = toEmail.split('@')[0];
        var employeeSearch = nlapiSearchRecord("employee",null,
            [
                [["email","contains","@bluebanyansolutions.com"],"OR",["email","contains","@blubanyan.com"]],
                "AND",
                ["isinactive","is","F"]
            ],
            [
                new nlobjSearchColumn("entityid").setSort(false),
                new nlobjSearchColumn("email")
            ]
        );
        if(employeeSearch){
            author = employeeSearch[0].id;
            recipient = emailAddr + '@blubanyan.com';
            // nlapiSendEmail(author, recipient, '[copy] '+email.getSubject(), email.getHtmlBody() || email.getTextBody());
            // nlapiLogExecution('debug', 'Email copy sent', JSON.stringify({author:author,recipient:recipient,subject:email.getSubject()}));
        }
    }

    //Print out CC email Addresses
    var ccEmails =   email.getCc();
    var i=0; i<ccEmails.length; i++
        logAddress('CC', ccEmails[i]);

    //Print out Reply To Email Address
    nlapiLogExecution('debug', 'Reply To Address', email.getReplyTo());

    //Print out Email Sent Date
    nlapiLogExecution('debug', 'Send Date', email.getSentDate());

    //Print out Email Subject
    nlapiLogExecution('debug', 'Email Subject', email.getSubject());

    //Print out Email TEXT Body
    nlapiLogExecution('debug', 'Email Text Body', email.getTextBody());

    //Print out Email HTML Body
    nlapiLogExecution('debug', 'Email HTML Body', email.getHtmlBody());

    //Grab an Array of ALL Attachments
    var attachFiles = email.getAttachments();
    nlapiLogExecution('debug', 'Attachments Size', attachFiles.length);

    //Loop through list of ALL Attachments and find out details of each file
    if (attachFiles != null) {
        // loop here for informational purposes only at this time
        for (var a in attachFiles) {

            var attachment = attachFiles[a];

            //Print out Attached File Name
            nlapiLogExecution(
                'debug',
                'File Name',
                attachment.getName()
            );

            //Print out Attached File Type
            nlapiLogExecution(
                'debug',
                'File Type',
                attachment.getType()
            );

            //attachment.setFolder(-15); // Folder Id
            //var fileId = nlapiSubmitFile(attachment);
        }
    }



    // nlapiLogExecution('debug', '*************************', '*************************');
    // var emailBodyTxt = email.getTextBody();
    //
    // var regexOrderNum = /Order Number:(.*?)(?=$|Order Assigned To:)/gm;
    // var orderNumber = getValue(regexOrderNum,emailBodyTxt);
    // nlapiLogExecution('debug', 'orderNumber', orderNumber);
    //
    // var regexSchDt = /Scheduled Date:(.*?)(?=$|Scheduled Duration:)/gm;
    // var schdlDate = getValue(regexSchDt,emailBodyTxt);
    // nlapiLogExecution('debug', 'schdlDate', schdlDate);
    //
    // var regexAssignedTo = /Order Assigned To:(.*?)(?=$|Scheduled Date:)/gm;
    // var assignedTo = getValue(regexAssignedTo,emailBodyTxt);
    // nlapiLogExecution('debug', 'assignedTo', assignedTo);

    nlapiLogExecution('debug', '****** DATA CAPTURE ******', '*************************');
    try {
        var emailBodyTxt = email.getTextBody();
        if (!emailBodyTxt) emailBodyTxt = email.getHtmlBody();
        emailBodyTxt = emailBodyTxt.replace(/<\/?[^>]+(>|$)/g, "");
        nlapiLogExecution('debug', 'Email Text USED', emailBodyTxt);

        var regexOrderNum = /Order Number:(.*?)(?=$|Order Assigned To:)/gm;
        var orderNumber = (getEmailValue(regexOrderNum, emailBodyTxt).match(/(SO)?[\d]+/gmi) || [""])[0].trim();
        nlapiLogExecution('debug', 'orderNumber', orderNumber);
        if (!orderNumber) {
            nlapiLogExecution('error', 'NO ORDER NUMBER FOUND', 'Check the email format');
            if (author && recipient) {
                var body = email.getHtmlBody() || email.getTextBody();
                body += '\n\n' + 'NO ORDER NUMBER FOUND';
                nlapiSendEmail(author, recipient, '[ERROR] ' + email.getSubject(), body);
            }
            return;
        }

        var regexAssignedTo = /Assigned To:(.*?)(?=$|Scheduled Date:)/gm;
        var assignedToName = getEmailValue(regexAssignedTo, emailBodyTxt).replace('*', '').trim();
        nlapiLogExecution('debug', 'assignedToName', assignedToName);
		
		var assignedToObj = getAssignedToObj(assignedToName);
		var assignedToId = assignedToObj.id;
        nlapiLogExecution('debug', 'assignedToId', assignedToId);

        var regexSchDt = /Scheduled Date:(.*?)(?=$|Scheduled Duration:)/gm;
        var schdlDate = getEmailValue(regexSchDt, emailBodyTxt).replace('*', '').trim();
        nlapiLogExecution('debug', 'schdlDate', schdlDate);

        var schdlDateObj = (schdlDate)?new Date(Date.parse(schdlDate)):null;
        nlapiLogExecution('debug', 'schdlDateObj', schdlDateObj);

        var schdlDateFormatted = (schdlDateObj)?nlapiDateToString(schdlDateObj, 'date'):null;
        nlapiLogExecution('debug', 'schdlDateFormatted', schdlDateFormatted);
		
		var regexAppointmentNumber = /Appointment Number:(.*?)(?=$|Appointment Status:)/gm;
        var apptNum = getEmailValue(regexAppointmentNumber, emailBodyTxt).replace('*', '').trim();
        nlapiLogExecution('debug', 'apptNum', apptNum);


		var regexAppointmentStatus = /Appointment Status:(.*?)(?=$|Customer:)/gm;
        var apptStatus = getEmailValue(regexAppointmentStatus, emailBodyTxt).replace('*', '').trim();
        nlapiLogExecution('debug', 'apptStatus', apptStatus);
        
        //Added by Myron 3/12/2020
        var today = new Date();
        var newNotes = "";
        var regexNotes = /Appointment Notes:(.*?)(?=$|Closure Notes:)/gm;
        var apptNotes = getEmailValue(regexNotes, emailBodyTxt).replace('*', '').trim();
        nlapiLogExecution('debug', 'apptNotes', isNull(apptNotes));
        if(isNull(apptNotes)){
            newNotes = "";
            nlapiLogExecution('debug', 'newNotes', newNotes);
        }else{
            newNotes = nlapiDateToString(today, 'date') + ' - ' + assignedToName + ': '+apptNotes+';';
            nlapiLogExecution('debug', 'newNotes', newNotes);
        }
		
		var apptStatusID = getAppointmentStatusId(apptStatus);
		nlapiLogExecution('debug', 'apptStatusID', apptStatusID);


        // try to find the related records for this
        var records = getRelatedRecords(orderNumber);
        nlapiLogExecution('debug', 'related records', JSON.stringify(records));

        if (records.length == 0) {
            nlapiLogExecution('error', 'NO RELATED RECORDS FOUND', 'Check the order id or email format');
            if (author && recipient) {
                var body = email.getHtmlBody() || email.getTextBody();
                body += '\n\n' + 'NO RELATED RECORDS FOUND - If SO exists, check the Project Action on the line.';
                nlapiSendEmail(author, recipient, '[ERROR] ' + email.getSubject(), body);
            }
            return;
        }

        // should be the first result
        var dateField = records[0].dateField;
		//var teamField = records[0].teamField;
        var project = records[0].project;
        var projectAction = records[0].projectAction;
        var package = records[0].package;
        var salesOrder = records[0].salesOrder;
		var originalApptNum = records[0].appointmentNumber;
        var cHistory = records[0].currtHistory;
		var currentStatusType = records[0].statusType;

        if (!projectAction.value) {
            nlapiLogExecution('error', 'NO RELATED PROJECT ACTION FOUND', 'Check the order id or email format');
            if (author && recipient) {
                var body = email.getHtmlBody() || email.getTextBody();
                body += '\n\n' + 'NO RELATED PROJECT ACTION FOUND';
                nlapiSendEmail(author, recipient, '[ERROR] ' + email.getSubject(), body);
            }
            return;
        }

		var statusName = (!schdlDateFormatted)?"Ready":null;
        var statusId = (statusName)?findDocumentStatusByPackageAndStatusName(package.value, statusName):findDocumentStatusbyPackageAndMSIMapping(package.value, apptStatusID);
        nlapiLogExecution('debug','document status id',statusId);

        if(!statusId){
            nlapiLogExecution('error','NO STATUS ID FOUND','Check that this package has a "scheduled" document status.');
            if(author && recipient){
                var body = email.getHtmlBody() || email.getTextBody();
                body += '\n\n'+'NO STATUS ID FOUND - Check that this package has a "scheduled" document status.';
                nlapiSendEmail(author, recipient, '[ERROR] '+email.getSubject(), body);
            }
            return;
        }

        var projectActionRecordId; //why is this needed? You have the value in projectAction.value?
        var recSearch = nlapiSearchRecord('customrecordtype',null,
            [['scriptid','is','customrecord_bb_project_action']],
            [new nlobjSearchColumn('internalid')]);
        if(recSearch){
            projectActionRecordId = recSearch[0].id;
        }
        nlapiLogExecution('debug','projectActionRecordId',projectActionRecordId);
    } catch (e) {
        nlapiLogExecution('error',e.name,e.message);
    } // end primary data capture before setting record field values
	



	
    try {
        if (projectActionRecordId) {
            // attach the email as a note
            var note = nlapiCreateRecord('note');
            //note.setFieldValue('notetype', ''); // 3=email 7=note
            note.setFieldValue('note', emailBodyTxt);
            note.setFieldValue('title', 'Service Pro Appointment Notice');
            note.setFieldValue('record', projectAction.value);
            note.setFieldValue('recordtype', projectActionRecordId);
            var noteId = nlapiSubmitRecord(note);
            nlapiLogExecution('debug', 'note:' + noteId, 'attached to customrecord_bb_project_action:' + projectAction.value);
        }
    } catch (e) {
        nlapiLogExecution('error','NOTE: '+e.name,e.message);
    }
	
	nlapiLogExecution('debug', 'originalApptNum', originalApptNum);
	nlapiLogExecution('debug', 'originalApptNum is null', isNull(originalApptNum));
	nlapiLogExecution('debug', 'apptNum', apptNum);
	nlapiLogExecution('debug', 'appt nums match', (originalApptNum == apptNum));

	var triggerAllFields = (isNull(originalApptNum) || originalApptNum == apptNum);
	var triggerPAStatus = (currentStatusType)?(currentStatusType.text != 'Approved'):true;

    var retryCount=0;
    do {
        try {
		    var fieldsToSet = ['custrecord_bb_msi_current_appt_num','custrecord_bb_msi_pa_appointment_status'];//, 'custrecord_bb_msi_curr_appt_schdl_date'];
            var fieldValues = [apptNum, apptStatusID];//, schdlDateFormatted];
			
			if(triggerPAStatus){ //added by Tyler, 3/23/2020
				//push document status
				fieldsToSet.push('custrecord_bb_document_status');
				fieldValues.push(statusId);
				//push Document Status date
				fieldsToSet.push('custrecord_bb_document_status_date');
				fieldValues.push(nlapiDateToString(new Date(), 'date'));
			}

			if(triggerAllFields){//add certain fields, ONLY IF, the appointmentNumber matches
				//push assignedToTech
				fieldsToSet.push('custrecord_bb_proj_act_assigned_to_tech');
				fieldValues.push(assignedToId);
				//push scheduled date
				fieldsToSet.push('custrecord_msi_schdl_date');
				fieldValues.push(schdlDateFormatted);
				//push appt number
				fieldsToSet.push('custrecord_bb_msi_appt_num');
				fieldValues.push(apptNum);
                //push appt notes
                fieldsToSet.push('custrecord_bb_doc_reject_comm_history');
                fieldValues.push(newNotes+'\n'+cHistory);// added by myron 3/12/2020
                //push assigntoname
                fieldsToSet.push('custrecord_bb_proj_act_assigne_text');
                fieldValues.push(assignedToName);// added by myron 3/19/2020
			}
			

            var errorCode=null;
            // PA
            if(salesOrder.splink){
                fieldsToSet.push('custrecord_bb_proj_actn_sp_link');
                fieldValues.push('<a href="'+salesOrder.splink+'" target="_blank">'+salesOrder.tranid+'</a>');
            }
            // custrecord_bb_proj_act_assigned_to_tech, custrecord_bb_document_status, custrecord_bb_document_status_date
            //nlapiSubmitField('customrecord_bb_project_action', projectAction.value, fieldsToSet, fieldValues);
			setFieldValues('customrecord_bb_project_action', projectAction.value, fieldsToSet, fieldValues);//moved to load/submit so that it could trigger workflows as needed
			
            nlapiLogExecution('debug', 'project action fields set', JSON.stringify([fieldsToSet,fieldValues]));
        } catch (e) {
            nlapiLogExecution('error', retryCount+' PROJECT ACTION: ' + e.name, 'customrecord_bb_project_action:'+projectAction.value+' '+e.message);
            errorCode = e.name;
        }
        retryCount++;
    } while (errorCode=='RCRD_HAS_BEEN_CHANGED' && retryCount<10);

    retryCount=0;
    do {
        try {
		
			if(!triggerAllFields) return;
            errorCode=null;
            // PROJECT - site audit scheduled date or the site installation scheduled date - based on the item field value
            // custentity_bb_site_audit_scheduled_date
            // custentity_bb_install_scheduled_date
			var projectFieldsToSet = [];
			if(dateField)projectFieldsToSet.push(dateField);
			if(package.text == 'Install')projectFieldsToSet.push('custentity_tsp_installation_team');
			
			var projectValuesToSet = [];
			if(dateField)projectValuesToSet.push(schdlDateFormatted);
			if(package.text == 'Install')projectValuesToSet.push(assignedToName);//assignedToName

            if (project && project.value) {
				
                //nlapiSubmitField('job', project.value, projectFieldsToSet, projectValuesToSet);
				setFieldValues('job', project.value, projectFieldsToSet, projectValuesToSet);
                nlapiLogExecution('debug', 'job:' + project.value + ' Project date set', JSON.stringify([projectFieldsToSet,projectValuesToSet]));
            } else {
                nlapiLogExecution('error', 'Project or Date field missing', 'Cannot update project record.');
            }
            retryCount++;
        } catch (e) {
            nlapiLogExecution('error', retryCount+' '+e.name, 'job:'+project.value+' '+e.message);
            errorCode = e.name;
        }
    } while (errorCode=='RCRD_HAS_BEEN_CHANGED' && retryCount<10);
    nlapiLogExecution('debug','*********** email capture **************','******* complete ***********');

}


function getEmailValue(regex,str){
    nlapiLogExecution('debug','getEmailValue '+regex,str);
    var result='';
    var m;
    while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        // The result can be accessed through the `m`-variable.
        m.forEach(function (match, groupIndex) {
            //nlapiLogExecution('debug', groupIndex +' Found match',match);
            result = match;
        });
    }
    return result;
}

function getRelatedRecords(tranid){
    var transactionSearch = nlapiSearchRecord("salesorder",null,
        [
            ["numbertext","is",tranid],
            "AND",
            ["custcol_bb_ss_proj_action","noneof","@NONE@"],
            "AND",
            ["mainline","is","F"]
        ],
        [
            new nlobjSearchColumn("custitem_msi_prj_date_fld","item",null),
            new nlobjSearchColumn("custbody_bb_project"),
            new nlobjSearchColumn("custcol_bb_ss_proj_action"),
            new nlobjSearchColumn("custrecord_bb_package","CUSTCOL_BB_SS_PROJ_ACTION",null),
            new nlobjSearchColumn("internalid"),
            new nlobjSearchColumn("tranid"),
            new nlobjSearchColumn('custbodyserviceprolink'),
			new nlobjSearchColumn("custrecord_bb_msi_appt_num","CUSTCOL_BB_SS_PROJ_ACTION",null),
            new nlobjSearchColumn("custrecord_bb_doc_reject_comm_history", "CUSTCOL_BB_SS_PROJ_ACTION"),// Added by Myron  3/12/2020
			new nlobjSearchColumn("custrecord_bb_action_status_type", "CUSTCOL_BB_SS_PROJ_ACTION")// Added by Tyler  3/23/2020
        ]
    ) || [];
    nlapiLogExecution('debug', tranid+' record result length',transactionSearch.length);
    var results = [];
    for(var i=0; i<transactionSearch.length; i++){
        var result = transactionSearch[i];
        results.push({
            dateField: result.getValue('custitem_msi_prj_date_fld',"item"),
            project: {value: result.getValue('custbody_bb_project'), text: result.getText('custbody_bb_project')},
            projectAction: {value: result.getValue('custcol_bb_ss_proj_action'), text: result.getText('custcol_bb_ss_proj_action') },
            salesOrder: {
				value: result.getValue('internalid'),
                text:tranid,
                splink:result.getValue('custbodyserviceprolink'),
                tranid:result.getValue('tranid')
            },
            package:{value:result.getValue('custrecord_bb_package',"CUSTCOL_BB_SS_PROJ_ACTION"),
                text:result.getText('custrecord_bb_package',"CUSTCOL_BB_SS_PROJ_ACTION")},
			appointmentNumber: result.getValue("custrecord_bb_msi_appt_num","CUSTCOL_BB_SS_PROJ_ACTION"),
            currtHistory: result.getValue('custrecord_bb_doc_reject_comm_history', "CUSTCOL_BB_SS_PROJ_ACTION"),// Added by Myron  3/12/2020
			statusType: {
				value: result.getValue('custrecord_bb_action_status_type', "CUSTCOL_BB_SS_PROJ_ACTION"),
				text: result.getText('custrecord_bb_action_status_type', "CUSTCOL_BB_SS_PROJ_ACTION")
			}
        });
    }
    return results;
}

function findDocumentStatusByPackageAndStatusName(packageId, statusName){
    var customrecord_bb_document_statusSearch = nlapiSearchRecord("customrecord_bb_document_status",null,
        [
            //["custrecord_bb_doc_status_type","anyof",statusName],
            ["name","contains",statusName],
            "AND",
            ["custrecord_bb_doc_status_package","anyof",packageId]
        ],
        [
            new nlobjSearchColumn("name"),
            new nlobjSearchColumn("scriptid"),
            new nlobjSearchColumn("custrecord_bb_doc_status_package"),
            new nlobjSearchColumn("custrecord_bb_doc_status_type"),
            new nlobjSearchColumn("custrecord_bb_doc_status_seq").setSort(false)
        ]
    ) || [];
    return customrecord_bb_document_statusSearch.length>0 ? customrecord_bb_document_statusSearch[0].id : '';
}

function findDocumentStatusbyPackageAndMSIMapping(packageId, appointmentStatusId){
	nlapiLogExecution('debug', 'packageId', packageId);
	nlapiLogExecution('debug', 'appointmentStatusId', appointmentStatusId);

	var msiMappingStatusSearch = nlapiSearchRecord("customrecord_bbss_msi_survey_status",null,
		[
			["custrecord_bbss_msi_package","anyof",packageId],
			"AND",
			["custrecord_bb_msi_appointment_status","anyof",appointmentStatusId]
		],
		[
			new nlobjSearchColumn("custrecord_bbss_msi_project_action_statu"), 
			new nlobjSearchColumn("custrecord_bbss_msi_package"), 
			new nlobjSearchColumn("custrecord_bbss_msi_status"), 
			new nlobjSearchColumn("custrecord_bb_msi_appointment_status")
		]
	) || [];
	nlapiLogExecution('debug', 'findDocumentStatusbyPackageAndMSIMapping results', (msiMappingStatusSearch.length>0?msiMappingStatusSearch[0].getValue('custrecord_bbss_msi_project_action_statu'):'No results'));
	return msiMappingStatusSearch.length>0?msiMappingStatusSearch[0].getValue('custrecord_bbss_msi_project_action_statu') : '';
}

function setFieldValues(type, id, fieldsToSet, fieldValuesToSet){
	var record = nlapiLoadRecord(type, id);
	
	for(var i = 0; i < fieldsToSet.length; i++){
		record.setFieldValue(fieldsToSet[i], fieldValuesToSet[i])
	}
	nlapiSubmitRecord(record, true, false);
}

function getAssignedToObj(assignedTo_name){
	var employeeSearch = nlapiSearchRecord("employee",null,
		[
			["entityid","is",assignedTo_name]
		], 
		[
			new nlobjSearchColumn("entityid").setSort(false)
		]
	) || [];
	nlapiLogExecution('debug', 'getAssignedToObj results', (employeeSearch.length>0?employeeSearch[0].id:'No results'));
	return employeeSearch.length>0?{id: employeeSearch[0].id, name:employeeSearch[0].getValue('entityid')}:null;
} 

function getAppointmentStatusId(appointmentStatus){
	var appointmentStatusSearch = nlapiSearchRecord("customrecord_bb_msi_appointment_status",null,
		[
			["name","is",appointmentStatus]
		], 
		[
			new nlobjSearchColumn("name").setSort(false)
		]
	) || [];
	nlapiLogExecution('debug', 'getAppointmentStatusId results', (appointmentStatusSearch.length>0?appointmentStatusSearch[0].id:'No results'));
	return appointmentStatusSearch.length>0?appointmentStatusSearch[0].id:null;
}


function logAddress(label, address)
{
    nlapiLogExecution('DEBUG',typeof address, address);
    var emailAddress;
    if(address != undefined && address.getName && address.getEmail){
        nlapiLogExecution('DEBUG', 'Email Address - ' + label + ': ', address.getName() + ', ' + address.getEmail());
        emailAddress = address.getEmail();
    } else {
        nlapiLogExecution('DEBUG', 'Email - ' + label, address);
        emailAddress = address;
    }
    return emailAddress;
}

function isNull(str)
{
	return str == null || str == undefined || str == '';
}