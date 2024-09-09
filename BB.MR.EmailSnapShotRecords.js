/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/email','N/render', 'N/runtime', 'N/file', 'N/record'],

function(email, render, runtime, file, record) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        var arr = runtime.getCurrentScript().getParameter({
            name: 'custscript_bb_email_array'
        });
        log.debug('email array values', arr);
        var array = JSON.parse(arr);
        return array;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        var obj = JSON.parse(context.value);
        log.debug('Map Stage Object', obj);
        var emailAddress = obj.salesRepEmail;
        var salesRepId = obj.salesRep;
        var salesRepName = obj.salesRepName;
        var payrollPeriod = obj.payrollPeriod;
        var projectArr = obj.projectArr;
        var emailType = obj.sendType; // true = detail null = summary
        log.debug('email type', emailType);

        var markSummaryEmail = [];
        var markDetailEmail = [];

        var commTotal = parseFloat(0.00);

        var messageType = (emailType) ? 'detailed' : 'summary';
        var body = '\n';
        body += '\n';
        body += '<p> Good afternoon, ' + salesRepName +  '</p>\n';
        body += '\n';
        body += '<p>This is your ' + messageType + ' email report for commissions payable.</p>\n';
        body += '\n';
        body += ' <p>Below is a list of your commissions payable for Payroll Period - ' + payrollPeriod + '.</p>';
        body += '\n';
        body += '\n';
        body += '<table>';
        body += '   <tr>';

        if (!emailType) {
            body += '   <th style="text-align: left">Project</th>';
        } else {
            body += '   <th style="text-align: left">Project</th>';
            body += '   <th style="text-align: left">Details</th>';
        }
        body += '   </tr>';

        
        if (projectArr.length > 0) {
            
            for (var x = 0; x < projectArr.length; x++) {
                commTotal = commTotal + parseFloat(projectArr[x].commAmtOwed);
                body += '   <tr>';
                if (!emailType) {
                    body += '<td>' + projectArr[x].projectName + '</td>';
                    markSummaryEmail.push(projectArr[x].snapShotId);
                } else {
                    body += '<td>' + projectArr[x].projectName + '</td>';
                    body += '<td>';
                    body += '<table>';
                    body += '<tr><td><b>Commission Paid Amount  </b></td><td style="text-align: right">$ ' + projectArr[x].commAmtOwed + '</td></tr>';
                    body += '<tr><td><b>Contract Amount  </b></td><td style="text-align: right">$ ' + projectArr[x].totalContractAmt + '</td></tr>';
                    body += '</table>';
                    body += '</td>';

                    markDetailEmail.push(projectArr[x].snapShotId);
                }
                body += '   </tr>';
            }
            
        } else {
            // do nothing
        }
        if (commTotal > 0 && emailType) {
            body += '<tr>';
            body += '<td style="text-align: right"><b>Total</b></td>';
            body += '<td style="text-align: left">$ ' + parseFloat(commTotal) + '</td></tr>';
        }
        body += '</table>';
        log.debug('body', body);

        var templateId = '2768'; // pdf template id for email summary/detail report // add field id for summary commission snap shot file id

        var templateFile = file.load({
            id: templateId
        });
        log.debug('file loaded');
        var pdfRender = render.create();

        pdfRender.templateContent = templateFile.getContents();

        // add passed object into render resource
        pdfRender.addCustomDataSource({
            alias: 'snapshot',
            format: render.DataSource.OBJECT,
            data: obj
        });
        log.debug('content added');
        var snapShotSummaryPDF = pdfRender.renderAsPdf();
        snapShotSummaryPDF.name = salesRepName + ' - ' + payrollPeriod;

        log.debug('snapshot pdf', snapShotSummaryPDF);
        var user = runtime.getCurrentUser();
        var author = user.id;

        email.send({
            author: author,
            entityId: salesRepId,
            recipients: emailAddress,
            subject: 'Commissions Payable for Payroll Period - ' + payrollPeriod,
            body: body,
            attachments: [
                snapShotSummaryPDF
            ]
        });

        log.debug('email successfully sent');

        // clear off summary emails sent from suitelet list check box on snap shot record
        log.debug('summary email array length', markSummaryEmail.length);
        log.debug('detail email array length', markDetailEmail.length);

        // Add Check Box field to Snap Shot Record to remove from Suitelet list???????

        // if (markSummaryEmail.length > 0) {
        //     for (var s = 0; s < markSummaryEmail.length; s++) {
        //         var id = markSummaryEmail[s];
        //         log.debug('snap shot id', id);
        //         if (id) {
        //             record.submitFields({
        //                 type: 'customrecord_bb_commission_snap_shot',
        //                 id: id,
        //                 values: {
        //                     'custrecord_pro_snap_shot_summ_email_bool': true //////////////////////////////////////////////////
        //                 },
        //                 options: {
        //                     ignoreMandatoryFields: true
        //                 }
        //             });
        //         }
        //     }
        // }
        // // clear off detail emails sent from suitelet list check box on snap shot record
        // if (markDetailEmail.length > 0) {
        //     for (var d = 0; d < markDetailEmail.length; d++) {
        //         var id = markDetailEmail[d];
        //         if (id) {
        //             record.submitFields({
        //                 type: 'customrecord_bb_commission_snap_shot',
        //                 id: id,
        //                 values: {
        //                     'custrecord_pro_snap_shot_deta_email_bool': true ////////////////////////////////////////////////////
        //                 },
        //                 options: {
        //                     ignoreMandatoryFields: true
        //                 }
        //             });
        //         }
        //     }
        // }
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {

    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {

    }



    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});
