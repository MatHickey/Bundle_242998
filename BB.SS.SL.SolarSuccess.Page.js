/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(
[
  'N/url',
  'N/runtime',
  'N/ui/serverWidget',
  'N/search'
], 
(
  nUrl,
  nRuntime,
  serverWidget,
  nSearch
) => {
    
  const getFileUrl = (filename) => {
    let results = nSearch.create({
      type: 'file',
      filters: [
        ['name', 'is', filename]
      ],
      columns: [
        'url'
      ]
    }).run().getRange({ start: 0, end: 1 });

    if (Array.isArray(results) && results.length > 0) {
      return results[0].getValue('url');
    }
  }

  const onRequest = (context) => {
    let script = nRuntime.getCurrentScript();
    let page = script.getParameter('custscript_bb_ss_sl_page'); 
    let title = script.getParameter('custscript_bb_ss_sl_title'); 
    let response = context.response;

    let form = serverWidget.createForm({
      title: title || 'Solar Success'
    });

    let field = form.addField({
      id: 'custpage_bb_ss',
      type: serverWidget.FieldType.INLINEHTML,
      label: ' '
    });

    let apiEndpoint = nUrl.resolveScript({
      scriptId: 'customscript_bb_ss_sl_solarsuccess_serv',
      deploymentId: 'customdeploy_bb_ss_sl_solarsuccess_serv'
    });

    let html = '<!doctype html>\n' +
      '   <html lang="en">' +
      '       <head>\n' +
      '           <meta charset="utf-8">\n' +
      '           <script type="text/javascript">window.apiEndpoint = "' + apiEndpoint + '";</script>';

    if (page) 
      html += '           <script type="text/javascript">window.bbss_page = "' + page + '";</script>';

    html += '           <link type="text/css" rel="stylesheet" href="' + getFileUrl('bb_ss_solarsuccess_main.css') + '"/>\n' +
      '           <title>SolarSuccess</title>\n' +
      '       </head>\n' +
      '       <body>\n' +
      '           <div id="root"></div>\n' +
      '       </body>\n' +
      '       <script type="text/javascript" src="' + getFileUrl('bb_ss_solarsuccess_main.js') + '"></script>\n' +
      '   </html>\n';

    field.defaultValue = html;

    response.writePage(form);
  }

  return {
    onRequest: onRequest
  };
});