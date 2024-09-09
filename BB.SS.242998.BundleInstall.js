/**
 * @NApiVersion 2.0
 * @NScriptType BundleInstallationScript
 */
define(['N/file','N/runtime','N/error','N/record','N/search','N/url','N/query'], function(file,runtime,error,record,search,url,query) {
  
  var REMOVE_FROM_ACCOUNTS = ['5791208','7580037','3997374','5791208_SB1','5267159_SB1','5267159','6586617','6586617_SB1','5367307','5367307_SB1','7223355','7223355_SB1','7065035','7065035_SB1','6324552','6324552_SB1']; // note uppercase
  
	var dependencyFiles = [
		'BB.Framework.Full-1.1.0.js',
		'BB.SS.AccrualJournal.js',
		'BB.SS.ApplyCustomerDeposits.js',
		'BB.SS.BayWa.js',
		'BB.SS.CS.CashflowProjection.js',
		'BB.SS.Customer.Model.js',
		'BB.SS.Customer.Service.js',
		'BB.SS.DemoDataGeneration.Service.js',
		'BB.SS.Entity.js',
		'BB.SS.FinancingType.Model.js',
		'BB.SS.FinancingType.Service.js',
		'BB.SS.GoogleMaps.js',
		'BB.SS.Invoice.Service.js',
		'BB.SS.Lead.Model.js',
		'BB.SS.Lead.Service.js',
		'BB.SS.MD.AccountingFieldCalculations.js',
		'BB.SS.MD.CashflowProjectionCS.js',
		'BB.SS.MD.CashflowProjectionSL.js',
		'BB.SS.MD.CreatePO.js',
		'BB.SS.MD.GetItemCatalog.js',
		'BB.SS.MD.Project.BOM.Adders.InlineEditor.js',
		'BB.SS.MD.UpsertSalesOrder.js',
		'BB.SS.Milestone.Service.js',
		'BB.SS.OAuthModule.js',
		'BB.SS.Project.AccountingFields.js',
		'BB.SS.Project.Model.js',
		'BB.SS.Project.Service.js',
		'BB.SS.Project.SubCustomer.js',
		'BB.SS.Project.TotalContractValueHistory.js',
		'BB.SS.Project.UpdateAdderQtyFromProjectSysSize.js',
		'BB.SS.Project.UpdateProjectFinancierOverview.js',
		'BB.SS.ProjectAction.Model.js',
		'BB.SS.ProjectAction.Service.js',
		'BB.SS.Projects.js',
		'BB.SS.Projects.PaymentMemo.js',
		'BB.SS.Proposal.Model.js',
		'BB.SS.Proposal.Service.js',
		'BB.SS.Prospect.Model.js',
		'BB.SS.Prospect.Service.js',
		'BB.SS.SalesOrder.Model.js',
		'BB.SS.SalesOrder.Service.js',
		'BB.SS.ScheduledScript.BatchProcessing.js',
		'BB.SS.SetTransactionAccountingMethod.js',
		'BB.SS.Transaction.Service.js',
		'BB.SS.Transform.js',
		'BB.SS.VendorBill.Service.js',
		'BB.SS.Weather-accuweather.js',
		'BB.SS.Weather.js',
		'BB.SS.MD.AlsoEnergy.js',
		'bb_framework_all.js',
		'BB_SS_MD_SolarConfig.js',
		'crypto-js.js',
		'custom_gmaps_all.js',
		'moment.min.js'
	];

	function fixDependencyFiles() {
		var scriptObj = runtime.getCurrentScript();
		var bundleArr = scriptObj.bundleIds;
		var basePath = '/SuiteBundles/Bundle 242998/BB SS/SS Lib/';
		if(bundleArr && bundleArr.length>0){
			// assumes it's only used in one bundle
			basePath = '/SuiteBundles/Bundle '+bundleArr[0]+'/BB SS/SS Lib/';
		}
		log.debug('bundleArray',JSON.stringify(bundleArr));

		for (var i=0; i < dependencyFiles.length; i++) {
			readdFile(basePath + dependencyFiles[i]);
			log.debug('(BB SS/SS Lib) file rebuild',basePath + dependencyFiles[i]);
		}
	}

	function readdFile(path) {
		var cryptoFile = file.load({
			id: path
		});
		var fileId = cryptoFile.id;
		var folderId = cryptoFile.folder;
		var contents = cryptoFile.getContents();
		file.delete({
			id: fileId
		});

		var newFile = file.create({
			name: cryptoFile.name,
			fileType: cryptoFile.fileType,
			contents: contents
		});
		newFile.folder = folderId;
		newFile.save();
	}
	/*********** MSI dependency work around **********************************/
	// Adds a field dynamically to the item record if the MSI record exists
	// install scripts cannot load custom modules so these methods are listed below.
	function msiInstall(){

		try{
			// rebuild these two files
			readdFile('/SuiteBundles/Bundle 242998/MSI/Lib/crypto-js.js');
			log.debug('(/SuiteBundles/Bundle 242998/MSI/Lib/crypto-js.js) file rebuild');

			// always set this field's formula even is MSI is not used
			var paRecId = getRecordId('customrecord_bb_project_action');
			var rec = record.load({type:'customrecordtype',id:paRecId});
			log.debug('rec',rec);
			var fieldCount = rec.getLineCount({sublistId:'customfield'});
			log.debug('field Count',fieldCount);

			var lineIndex = rec.findSublistLineWithValue({
				sublistId: 'customfield',
				fieldId: 'fieldcustcodeid',
				value: 'custrecord_bbss_public_doc_link'
			});
			log.debug('line index',lineIndex);

			var fieldInternalId = rec.getSublistValue({
				sublistId: 'customfield',
				fieldId: 'fieldid',
				line: lineIndex
			});
			log.debug('field id',fieldInternalId);

			var field = record.load({
				type: 'customrecordcustomfield',
				id: fieldInternalId,
				isDynamic: true
			});
			log.debug('field',field);

			field.setValue({
				fieldId:'isformula',
				value: true
			});

			var link = url.resolveScript({
				scriptId: 'customscript_bb_s3_sl_showfolder',
				deploymentId: 'customdeploy_bb_s3_sl_showfolder_public',
				returnExternalUrl: true
			});
			link = "'"+link+"&hide_drop_area=true&public=true&prefix=' || {custrecord_bb_proj_task_dm_folder_text}";
			log.debug('link',link);


			field.setValue({
				fieldId:'defaultvalue',
				value: link
			});
			field.save();
		} catch (e) {
			log.error('Update publid doc link error',{name:e.name,message:e.message});
		}




		// MSI Service Pro is depend on this list: customlistservicetemplates and the item field to set that value
		if(getRecordId('customlistservicetemplates')){
			var fieldId = hasRecordField({recordType:'noninventoryitem',fieldId:'custitem_msi_servicetemplate'});
			log.debug('item record field exists',fieldId);
			if(!fieldId){
				// create the item field
				var newFld = createField({
					label:'MSI Service Template',
					rectype: 'noninventoryitem'
					, scriptid: '_msi_servicetemplate'
					, description: 'Service Template used for Service Pro Integration'
					, fieldtype: 'List/Record'
					, selectrecordtype: "ServiceTemplates"  //"ServiceTemplates" //- case sensative
					, storevalue: true
				});
				log.audit('field created',newFld);
			}

			var statusFieldId = hasRecordField({recordType:'customrecord_bbss_msi_survey_status',fieldId:'custrecord_bbss_msi_status'});
			log.debug('msi doc status record field exists',statusFieldId);
			if(!statusFieldId){
				// create the item field
				var newFld = createField({
					label:'MSI Status',
					rectype: 'customrecord_bbss_msi_survey_status'
					, scriptid: '_bbss_msi_status'
					, description: 'Document Status used for Service Pro Integration'
					, fieldtype: 'List/Record'
					, selectrecordtype: "Service Status"  //"ServiceTemplates" //- case sensative
					, storevalue: true
					, showinlist: true
				});
				log.audit('field created',newFld);
			}

			// other MSI stuff
			try {
				// enable deployments
				var scriptDep = record.load({
					type: record.Type.SCRIPT_DEPLOYMENT,
					id: getRecordId('customdeploy_bbss_survey_salesorder')
				});
				// BB.SS.MSI.UE.CreateSiteSurveySalesOrder
				log.debug('script deployment',scriptDep);
				scriptDep.setValue({fieldId:'isdeployed',value:true});
				scriptDep.setValue({fieldId:'status',value:'RELEASED'});
				scriptDep.save();
				log.debug('msi deployment enabled','create survey work order / sales order');
				// status change deployment
				var scriptDep = record.load({
					type: record.Type.SCRIPT_DEPLOYMENT,
					id: getRecordId('customdeploy_bb_ss_update_pa_status')
				});
				// BB.SS.MSI.UE.CreateSiteSurveySalesOrder
				log.debug('script deployment',scriptDep);
				scriptDep.setValue({fieldId:'isdeployed',value:true});
				scriptDep.setValue({fieldId:'status',value:'RELEASED'});
				scriptDep.save();
				log.debug('msi deployment enabled','update PA status from MSI status');
			} catch (e) {
				log.error('Unable to deploy MSI script: '+e.name,e.message);
			}
		} else {
			log.debug('could not find list/record','customlistservicetemplates');
			// nothing to do
		}
	}
	function getRecordId(scriptId){
		var id;
		if(scriptId.indexOf('customlist')==0)
			search.create({type:'customlist',filters:[['scriptid','is',scriptId]]}).run().each(function(r){id=r.id});
		else if(scriptId.indexOf('customrecord')==0)
			search.create({type:'customrecordtype',filters:[['scriptid','is',scriptId]]}).run().each(function(r){id=r.id});
		else if(scriptId.indexOf('customdeploy')==0)
			search.create({type:'scriptdeployment',filters:[['scriptid','is',scriptId]]}).run().each(function(r){id=r.id});
		log.debug('custom record id',id);
		return id;
	}
	function getRecordIds(rec,fieldId){
		var fldArray = rec.getField({fieldId:fieldId}).getSelectOptions();
		// convert array to key/pair
		var fldObj = {};
		for(var s=0; s<fldArray.length; s++){
			fldObj[fldArray[s].text.toUpperCase()] = fldArray[s].value
		}
		return fldObj;
	}
	function hasRecordField(options){
		// look for a field on a record
		var rec = record.create({type:options.recordType,isDynamic: true});
		try{
			// attempt to load the default form in order to show all fields
			var cfField = rec.getField({fieldId:'customform'});
			var cfFieldSelections = cfField.getSelectOptions();
			var defaultFormId;
			for(var f=0; f<cfFieldSelections.length; f++){
				if(parseInt(cfFieldSelections[f].value)<0){
					defaultFormId = cfFieldSelections[f].value;
					break;
				}
			}
			rec.setValue({fieldId:'customform',value:defaultFormId});
		} catch (e) {
			log.error('custom form error: '+e.name,e.message);
		}
		var fields = rec.getFields();
		return fields.indexOf(options.fieldId)>=0;
	}
	function getFieldTypes(rec,fieldId){
		var fldArray = rec.getField({fieldId:fieldId}).getSelectOptions();
		// convert array to key/pair
		var fldObj = {};
		for(var s=0; s<fldArray.length; s++){
			fldObj[fldArray[s].value] = fldArray[s].text
		}
		return fldObj;
	}
	function createField(options) {
		if (!options.rectype)
			throw error.create({
				name: 'MISSING_RECORD_TYPE',
				message: 'rectype is required',
				notifyOff: false
			});
		if (!options.label)
			throw error.create({
				name: 'MISSING_LABEL',
				message: 'label is required',
				notifyOff: false
			});

		var parentFldRecType;
		var fldPrefix;
		if(options.rectype.indexOf('customrecord')==0){
			parentFldRecType = 'customrecordcustomfield';
			fldPrefix = 'custrecord';
		} else if(options.rectype.indexOf('salesorder')==0){
			// this would need to be expanded for other tran types
			parentFldRecType = 'transactionBodyCustomField';
			fldPrefix = 'custbody';
			//options.rectype = 'transaction'
		} else if(options.rectype.indexOf('noninventoryitem')==0){
			parentFldRecType = 'itemCustomField';
			fldPrefix = 'custitem';
		}

		var field = record.create({
			type: parentFldRecType,
			isDynamic: true
		});
		//log.debug('custom field started',field);
		var fieldTypesObj = getFieldTypes(field,'fieldtype');
		//log.debug('fieldTypesObj',fieldTypesObj);
		if (fieldTypesObj.hasOwnProperty(options.fieldtype.toUpperCase())){
			field.setText({fieldId:'fieldtype',text:fieldTypesObj[options.fieldtype.toUpperCase()]});
		} else {
			// case sensative text value
			field.setText({fieldId:'fieldtype',text:fieldTypesObj[options.fieldtype]});
		}
		//log.debug('field type set',options.fieldtype);
		if(options.fieldtype.toUpperCase().indexOf('SELECT')>=0){
			if (!options.selectrecordtype)
				throw error.create({
					name: 'MISSING_LIST_RECORD',
					message: 'SELECT and MULTISELECT require the selectrecordtype',
					notifyOff: false
				});
			if(isNaN(options.selectrecordtype)){
				var listOptionsObj = getRecordIds(field,'selectrecordtype');
				options.selectrecordtype = listOptionsObj[options.selectrecordtype.toUpperCase()];
			}
			field.setValue({fieldId:'selectrecordtype',value:options.selectrecordtype});
		}
		//log.debug('field selectrecordtype set',options.selectrecordtype);

		for(option in options){
			try{
				if(option=='rectype') continue;
				log.debug(option,options[option]);
				var isSelectFld = field.getField({fieldId:option}).type.indexOf('select')>=0;
				if(isSelectFld && isNaN(options[option])){
					field.setText({fieldId:option,text:options[option]});
				} else {
					field.setValue({fieldId:option,value:options[option]});
				}
			} catch (e) {
				log.error(e.name,e.message);
			}
		}

		var fieldType = field.getValue({fieldId:'fieldtype'});
		var label = field.getValue({fieldId:'label'});
		var scriptId = field.getValue({fieldId:'scriptid'});

		if(scriptId.indexOf(fldPrefix)!=0) scriptId = scriptId.replace(fldPrefix,'');
		var fullScriptId = fldPrefix+scriptId;

		if(parentFldRecType == 'customrecordcustomfield'){
			rec = record.create({type:options.rectype});
			var fields = rec.getFields();
			log.debug('fields',fields);


			if(fields.indexOf(fullScriptId)>=0){
				log.debug('field sciptid already exists',fullScriptId);
				for(var i=0; i<10; i++){
					var newScriptId = fullScriptId+'_'+i;
					if(fields.indexOf(newScriptId)>=0) continue;
					field.setValue({fieldId:'scriptid',value:newScriptId.replace(fldPrefix,'')});
					break;
				}
				log.debug('new sciptid',newScriptId);
			}
			// look for the labels
			var labels = [];
			for(var f=0; f<fields.length; f++) {
				var fieldId = fields[f];
				if (fieldId.indexOf('custrecord') != 0) continue;
				var recField = rec.getField({fieldId:fieldId});
				//log.debug(fieldId,recField);
				if(recField) labels.push(recField.label);
			}
			log.debug('labels',labels);
			if(labels.indexOf(label)>=0){
				log.debug('field label already exists',label);
				for(var i=0; i<10; i++){
					var newLabel = label+' '+i;
					if(labels.indexOf(newLabel)>=0) {
						log.debug('field label already exists',newLabel);
						continue;
					}
					log.debug('new field label',newLabel);
					field.setValue({fieldId:'label',value:newLabel});
					break;
				}
			}

			field.setValue({fieldId:'rectype',value:getRecordId(options.rectype)});

		} else {
			// TODO: not sure how to get a list of current custom fields for things like transactions/items
		}

		log.debug('custom field to use before save',field);
		for(var t=0; t<5; t++) {
			try {
				var internalid = field.save();
				var fldRec = record.load({type: parentFldRecType, id: internalid});
				return fldRec;
			} catch (e) {
				log.error(e.name, e.message);
				//log.error(t+' current Field', field);
				// DUP_CSTM_FIELD - This custom field already exists
				// did it fail because of the scriptid or the label???
				scriptId = field.getValue({fieldId:'scriptid'});
				try{
					if(scriptId.indexOf(fldPrefix)!=0) scriptId = scriptId.replace(fldPrefix,'');
					var fullScriptId = fldPrefix+scriptId;
					//log.debug(t+' attempt to load '+parentFldRecType,fullScriptId);
					var existingFldRec = record.load({type: parentFldRecType, id: fullScriptId});
				} catch(sError) {
					log.error(sError.name,sError.message);
				}

				if(existingFldRec){
					//log.debug(t+' scriptid match',scriptId);
					if(t==0) fldScriptId += '_0';
					else fldScriptId = fldScriptId.substr(0,fldScriptId.length-2) +'_'+t;
					// check for next id and label
					field.setValue({fieldId:'scriptid',value:fldScriptId});
				} else {
					//log.debug(t+' label match',label);
					if(t==0) label += ' 0';
					else label = label.substr(0,label.length-2) +' '+t;
					// check for next id and label
					field.setValue({fieldId:'label',value:label});
				}
			}
		}
		return null;
	}
	/*********** MSI dependency work around **********************************/


	/*********** Update Field with Google API Key **********************************/
	function updateGoogleMapKey(){
		// search the system credential record for the key
		var key,fld;
		search.create({
			type: "customrecord_system_credentials",
			filters:[["name","is","google-maps"]],
			columns:["custrecord_system_default_settings"]
		}).run().each(function(result){
			try {
				var settingsObj = JSON.parse(result.getValue({name: "custrecord_system_default_settings"}));
				key = settingsObj.params.key;
			}catch (e) {
				log.error('Error parsing Google Map Key Object',e);
			}
		});
		/*{
			"header": {},
			"params": { "key": "AIzaSyDqNnhh5JU_5QV93Wba0EhdzApiH128bM0" },
			"data":{}
		}*/
		if(!key) {
			log.debug('No Google Map API Key Found');
			return;
		}

		// load the field custentity_bb_entity_property_image
		try{
			var id;
			var scriptId = 'custentity_bb_entity_property_image';
			var sql = "select internalid, scriptid, name from customfield where LOWER(scriptid) LIKE '"+scriptId+"'";

			var results = query.runSuiteQL({query: sql});
			// log.debug('results',results);
			log.debug('results for map field',results.asMappedResults());
			if(results.results[0]){
				id = results.results[0].values[0];
			}
			if(!id){
				log.error('field not found');
				ctx.response.write('nope');
				return;
			}
			fld=record.load({type:'entitycustomfield',id:id,isDynamic:true});
			log.debug('fld',fld);

			// update the formula
			var formula = "CASE WHEN {custentity_bb_entity_latitude_text} IS NOT NULL " +
				"AND {custentity_bb_entity_longitude_text} IS NOT NULL " +
				"THEN '<a href=\"/app/site/hosting/scriptlet.nl?script=customscript_bb_ss_sl_image_cache&deploy=customdeploy_bb_ss_sl_image_cache" +
				"&url=https%3A%2F%2Fmaps.googleapis.com%2Fmaps%2Fapi%2Fstaticmap%3Fzoom%3D21%26size%3D600x300%26maptype%3Dsatellite%26center%3D'" +
				" ||{custentity_bb_entity_latitude_text} ||'%2C' || {custentity_bb_entity_longitude_text} || '%26key%3D" +
				"{customerkey}\" target=\"_blank\"><img  src=\"/app/site/hosting/scriptlet.nl?" +
				"script=customscript_bb_ss_sl_image_cache&deploy=customdeploy_bb_ss_sl_image_cache&url=https%3A%2F%2Fmaps.googleapis.com" +
				"%2Fmaps%2Fapi%2Fstaticmap%3Fzoom%3D21%26size%3D600x300%26maptype%3Dsatellite%26center%3D' ||{custentity_bb_entity_latitude_text} ||" +
				"'%2C' || {custentity_bb_entity_longitude_text} || '%26key%3D" +
				"{customerkey}\" style=\"padding:1px;border:thin solid black;\"/></a>' ELSE NULL END";

			formula = formula.replace(/{customerkey}/g,key);

			// save the field
			fld.setValue({fieldId:'defaultvalue',value:formula});
			fld.save();

		} catch (e) {
			log.error('error loading field',e);
		}
		if(!fld) {
			log.debug('Google Map Image Field Not Found');
			return;
		}

	}
	/*********** Update Field with Google API Key **********************************/


	/*********** SS REMOVAL **********************************/

	function removeWorkflows(){
		var workflows = bbssWorkflows();
		log.debug('BBSS Workflows',workflows);
		for(var w=0; w<workflows.length; w++){
			try {
				record.delete({
					type: 'workflow',
					id: workflows[w].id
				});
				log.debug(workflows[w].values.name+' - Deleted',workflows[w].values.subrecordtype);
			} catch (e) {
				log.error({"name":e.name,"message":e.message},workflows[w]);
			}
		}
	}
	function removeSearches(){
		var savedSearches = bbssSavedSearches();
		log.debug('BBSS Saved Searches',savedSearches);
		for(var s=0; s<savedSearches.length; s++){
			try {
				search.delete({
					id: savedSearches[s].id
				});
				log.debug(savedSearches[s].values.id+' - Deleted',savedSearches[s].values.title);
			} catch (e) {
				log.error({"name":e.name,"message":e.message},savedSearches[s]);
			}
		}
	}
	function removeScriptDeployments(){
		var deployments = bbssScriptDeployments();
		// remove the deployments
		log.audit('BBSS Script Deployments',deployments);
		for(var d=0; d<deployments.length; d++){
			try {
				var deploymentObj = deployments[d];
				record.delete({
					type:'scriptdeployment',
					id:deploymentObj.id
				})
				log.debug(deploymentObj.id+' - Deployment Deleted',deploymentObj.values.scriptid);
			} catch (e) {
				log.error({"name":e.name,"message":e.message},deploymentObj);
			}
		}
	}
	function removeScripts() {
		// the fileId is an empty script file that will do nothing.
		var scriptFileIdMap = {
			"MAPREDUCE": null,
			"SCRIPTLET": null,
			//"BUNDLEINSTALLATION":	null,
			"SCHEDULED": null,
			"PORTLET": null,
			"RESTLET": null,
			"ACTION": null,
			"USEREVENT": null,
			"CLIENT": null
			//"EMAILCAPTURE"
			//"CUSTOMGLLINES"
			//'MASSUPDATE_SCRIPT'
		}
		// find the file IDs for the above empty/blank files
		var folderSearchObj = search.create({
			type: "folder",
			filters: [["formulatext: {name}", "is", "BBSS_BLANK_SCRIPTS"]],
			columns:
				[
					search.createColumn({
						name: "formulatext",
						formula: "UPPER(REGEXP_SUBSTR({file.name},'[^\.]+'))"
					}),
					search.createColumn({
						name: "internalid",
						join: "file"
					}),
					search.createColumn({
						name: "folder",
						join: "file"
					}),
					search.createColumn({
						name: "name",
						join: "file"
					})
				]
		});
		folderSearchObj.run().each(function (result) {
			var scriptType = result.getValue(folderSearchObj.columns[0]);
			scriptFileIdMap[scriptType] = result.getValue(folderSearchObj.columns[1]);
			return true;
		});
		log.audit('empty script file IDs', scriptFileIdMap);

		var enumMap = {
			"MAPREDUCE": 'MAP_REDUCE_SCRIPT',
			"SCRIPTLET": 'SUITELET',
			//"BUNDLEINSTALLATION":	'BUNDLE_INSTALLATION_SCRIPT',
			"SCHEDULED": 'SCHEDULED_SCRIPT',
			"PORTLET": 'PORTLET',
			"RESTLET": 'RESTLET',
			"ACTION": 'WORKFLOW_ACTION_SCRIPT',
			"USEREVENT": 'USEREVENT_SCRIPT',
			"CLIENT": 'CLIENT_SCRIPT'
			//"EMAILCAPTURE"
			//"CUSTOMGLLINES"
			//'MASSUPDATE_SCRIPT'
		}
		// remove the scripts by switching the file and then delete the original file
		var scripts = bbssScriptRecords();
		log.audit('scripts to remove', scripts);
		for (var s = 0; s < scripts.length; s++) {
			try {
				var scriptObj = scripts[s];
				var scriptType = scriptObj.values.scripttype[0].value;
				var scriptID = scriptObj.id;
				log.debug('script info', scriptObj);
				if (!enumMap[scriptType]) {
					log.error('script type not found: ' + scriptType, enumMap[scriptType]);
					continue;
				}

				record.load({
					type: record.Type[enumMap[scriptType]],
					id: scriptID
				}).setValue({
					fieldId: 'scriptfile',
					value: scriptFileIdMap[scriptType]
				}).setValue({
					fieldId: 'isinactive',
					value: true
				}).save();
				log.debug(scriptID + ' - Script Modified', enumMap[scriptType]);
			} catch (e) {
				log.error({"name": e.name, "message": e.message}, 'script id = ' + scriptID);
			}
		}
	}
	function removeScriptFiles(){
		// now delete the BBSS files - start with javascript files
		var fileIds = bbssFiles(true);
		for(var f=0; f<fileIds.length; f++){
			try{
				file.delete({id:fileIds[f]});
				log.debug(fileIds[f]+' - javascript file deleted');
			} catch (e) {
				// expect to not remove the blank files above since they are now used on the script record
				log.error('javascript file delete error',{name:e.name,message:e.message});
			}
		}
	}
	function removeFiles(){
		// we will most likely run out of governance so this is run AFTER the script files and other priority objects
		var fileIds = bbssFiles(false);
		for(var f=0; f<fileIds.length; f++){
			try{
				file.delete({id:fileIds[f]});
				log.debug(fileIds[f]+' - file deleted');
			} catch (e) {
				// expect to not remove the blank files above since they are now used on the script record
				log.error('file delete error',{name:e.name,message:e.message});
			}
		}
	}

	function bbssSavedSearches() {
		var savedSearches = [];
		var savedSearchObj = search.create({
			type: "savedsearch",
			filters:[["bundle.internalid","anyof","242998"]],
			columns:["recordtype","frombundle","title","id"]
		});
		var searchResultCount = savedSearchObj.runPaged().count;
		log.debug("saved search result count",searchResultCount);
		savedSearchObj.run().each(function(result){
			savedSearches.push(result.toJSON());
			return true;
		});
		return savedSearches;
	}
	function bbssWorkflows() {
		var workflows = [];
		var workflowIds = [];
		var workflowSearchObj = search.create({
			type: "workflow",
			filters:[["formulatext: {frombundle}","is","242998"]],
			columns:
				[
					search.createColumn({name: "name",sort: search.Sort.ASC}),
					search.createColumn({name: "recordtype", label: "Record Type"}),
					search.createColumn({name: "subrecordtype", label: "Sub Record Type"}),
					search.createColumn({name: "description", label: "Description"}),
					search.createColumn({name: "owner", label: "Owner"}),
					search.createColumn({name: "runasadmin", label: "Run as Admin"}),
					search.createColumn({name: "releasestatus", label: "Release Status"}),
					search.createColumn({name: "frombundle", label: "From Bundle"})
				]
		});
		var searchResultCount = workflowSearchObj.runPaged().count;
		log.debug("workflow search result count",searchResultCount);
		workflowSearchObj.run().each(function(result){
			if(workflowIds.indexOf(result.id)<0){
				workflowIds.push(result.id);
				workflows.push(result.toJSON());
			}
			return true;
		});
		return workflows;
	}
	function bbssFiles(scriptsOnly){
		var fileIds=[];
		// first find/get our bundle folder
		var folderSearchObj = search.create({
			type: "folder",
			filters:[["name","is","Bundle 242998"]],
			columns:[]
		});
		if(folderSearchObj.runPaged().count!=1) return fileIds;
		var bbssFolderId;
		folderSearchObj.run().each(function(result){
			bbssFolderId = result.id;
			return true;
		});
		if(!bbssFolderId) return fileIds;
		// now find all the javascript files in the bundle
		// using the folder ID gives all the subfolders as well
		var filters = [["folder","anyof",bbssFolderId]];
		if(scriptsOnly) {
			filters.push("AND");
			filters.push(["filetype","anyof","JAVASCRIPT"])
		}
		var fileSearchObj = search.create({
			type: "file",
			filters: filters,
			columns:["name"]
		});
		if(fileSearchObj.runPaged().count==0) return fileIds;
		fileSearchObj.run().each(function(result){
			fileIds.push(result.id);
			return true;
		});
		return fileIds;
	}
	function bbssScriptDeployments(){
		var deployments = [];
		var fileIds = bbssFiles(true);
		if(fileIds.length==0) return deployments;
		// now we can actually get all the scripts/deployments based on the javascript files
		var scriptdeploymentSearchObj = search.create({
			type: "scriptdeployment",
			filters:[["script.scriptfile","anyof",fileIds]],
			columns:[
				search.createColumn({
					name: "title",
					sort: search.Sort.ASC,
					label: "Title"
				}),
				search.createColumn({name: "scriptid", label: "Custom ID"}),
				search.createColumn({name: "script", label: "Script ID"}),
				search.createColumn({name: "recordtype", label: "Record Type"}),
				search.createColumn({name: "status", label: "Status"}),
				search.createColumn({name: "isdeployed", label: "Is Deployed"}),
				search.createColumn({name: "scripttype", label: "Script Type"}),
				search.createColumn({name: "ismobilemenu", label: "Available in Mobile Menu"})
			]
		});
		if(scriptdeploymentSearchObj.runPaged().count==0) return deployments;
		scriptdeploymentSearchObj.run().each(function(result){
			deployments.push(result.toJSON());
			return true;
		});
		return deployments;
	}
	function bbssScriptRecords(){
		var scripts = [];
		var fileIds = bbssFiles(true);
		if(fileIds.length==0) return scripts;
		var scriptSearchObj = search.create({
			type: "script",
			filters:[["scriptfile","anyof",fileIds]],
			columns:["scriptid", "scripttype", "scriptfile", "name"]
		});
		if(scriptSearchObj.runPaged().count==0) return scripts;
		var scriptTypes = [];
		scriptSearchObj.run().each(function(result){
			scripts.push(result.toJSON());
			return true;
		});
		return scripts;
	}
	/*********** SS REMOVAL **********************************/

	function afterInstall(params) {
		log.debug('Account',runtime.accountId);
		fixDependencyFiles();
		msiInstall();
	}
  

	function afterUpdate(params) {
		log.debug('Account',runtime.accountId);
		// C2, Valta, Arevon
		var removeFromAccounts = REMOVE_FROM_ACCOUNTS;
		if(removeFromAccounts.indexOf(runtime.accountId)>=0){
			// run this first to save on governance units
			log.debug('Account',runtime.accountId);
			var scriptObj = runtime.getCurrentScript();
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'before removal'); // 7270
			try{removeWorkflows();}catch(e){log.error('removeWorkflows',e);}
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'after workflows'); // 7030
			try{removeScriptDeployments();}catch(e){log.error('removeScriptDeployments',e);}
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'after script deployments');
			try{removeScripts();}catch(e){log.error('removeScripts',e);}
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'after script records'); // 6980
			try{removeScriptFiles();}catch(e){log.error('removeScriptFiles',e);}
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'after script files'); // 820
			try{removeSearches();}catch(e){log.error('removeSearches',e);}
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'after searches');
			try{removeFiles();}catch(e){log.error('removeFiles',e);}
			log.debug("Remaining governance units: " + scriptObj.getRemainingUsage(),'after files');
			log.audit("COMPLETE",runtime.accountId+" - Account Disabled");
		} else {
			// this would be the normal install stuff....
			fixDependencyFiles();
			msiInstall();
			updateGoogleMapKey();
		}
	}

	return {
		afterInstall: afterInstall,
		afterUpdate: afterUpdate
	}
});