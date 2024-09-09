/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType Suitelet
 */
define([
  'N/file', 
  'N/search', 
  'N/url', 
  'N/config'
], (
  nFile, 
  nSearch, 
  nUrl, 
  nConfig
) => {
  
  const getFileUrl = (filename) => {
    var results = nSearch.create({
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

  return {
    onRequest: (context) => {
      let apiEndpoint = nUrl.resolveScript({
        scriptId: 'customscript_bb_ss_sl_solarsuccess_serv',
        deploymentId: 'customdeploy_bb_ss_sl_solarsuccess_serv'
      });
 
      let html = '<!doctype html>\n' + 
        '   <html lang="en">' +
        '       <head>\n' +
        '           <meta charset="utf-8">\n' +
        '           <script type="text/javascript">window.apiEndpoint = "' + apiEndpoint + '";</script>' + 
        '           <link type="text/css" rel="stylesheet" href="' + getFileUrl('bb_ss_solarsuccess_main.css') + '"/>\n' +
        '           <title>SolarSuccess</title>\n' +
        '       </head>\n' +
        '       <body>\n' +
        '           <div id="root"></div>\n' +
        '       </body>\n' +
        '       <script type="text/javascript" src="' + getFileUrl('bb_ss_solarsuccess_main.js') + '"></script>\n' +
        '   </html>\n';

      context.response.write(html);
    }
  };
});