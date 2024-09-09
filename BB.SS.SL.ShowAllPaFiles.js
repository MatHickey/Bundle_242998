/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @author Michael Golichenko
 */

define(['N/search', 'SuiteBundles/Bundle 207067/BB/S3/Lib/BB.S3', 'N/https', 'N/render', 'N/file', 'N/xml', 'N/url', 'N/runtime']
  , function (searchModule, s3, httpsModule, renderModule, fileModule, xmlModule, urlModule, runtimeModule) {

  function getProjectActions(projectId){
    var
      _projectActions = []
      , _projectActionsMap = []
    ;

    searchModule.create({
      type: 'customrecord_bb_project_action'
      , filters: [
        ['custrecord_bb_project', searchModule.Operator.ANYOF, projectId]
        , 'AND'
        , ['isinactive', searchModule.Operator.IS, 'F']
      ]
      , columns: [
        searchModule.createColumn({name: "entityid", join: "CUSTRECORD_BB_PROJECT"}),
        searchModule.createColumn({name: "custrecord_bb_package"}),
        searchModule.createColumn({name: "custrecord_bb_project_package_action"}),
        searchModule.createColumn({name: "custrecord_bb_package_step_number"}),
        searchModule.createColumn({name: "custrecord_bb_proj_task_dm_folder_text"}),
        searchModule.createColumn({
          name: "custrecord_bb_package_sequence_num",
          join: "CUSTRECORD_BB_PACKAGE",
          sort: searchModule.Sort.ASC
        }),
        searchModule.createColumn({
          name: "custrecord_bb_doc_package_step_number",
          join: "CUSTRECORD_BB_PROJECT_PACKAGE_ACTION",
          sort: searchModule.Sort.ASC
        })
      ]
    }).run().each(function(r){
      _projectActions.push({
        id: r.id
        , projectId: projectId
        , projectUid: r.getValue({name: "entityid", join: "CUSTRECORD_BB_PROJECT"})
        , packageId: r.getValue('custrecord_bb_package')
        , packageName: r.getText('custrecord_bb_package')
        , packageActionId: r.getValue('custrecord_bb_project_package_action')
        , packageActionName: r.getText('custrecord_bb_project_package_action')
        , packageActionPath: r.getValue('custrecord_bb_proj_task_dm_folder_text').replace(/[^a-zA-Z0-9 _\/]/g,'')
      });
      return true;
    });

    _projectActions.forEach(function(pa){
      var _found = _projectActionsMap.filter(function(pam){ return pam.packageId === pa.packageId; })[0];
      if(!_found){
        _projectActionsMap.push({
          projectId: pa.projectId
          , projectUid: pa.projectUid
          , packageId: pa.packageId
          , packageName: pa.packageName
          , packageActions: _projectActions.filter(function(paf){ return paf.packageId === pa.packageId; })
        });
      }
    });
    return _projectActionsMap;
  }

  function getPrefix(projectId){
    var
      _prefix = ['projects']
      , _projectUid = searchModule.lookupFields({
      type: searchModule.Type.JOB
      , id: projectId
      , columns: ['entityid']
    }).entityid
    ;
    _prefix.push(_projectUid);
    return _prefix.join('/');
  }

  function onRequest(context) {
    var
      _request = context.request
      , _response = context.response
      , _params = _request.parameters
      , _projectId = _params.project
      , _load = _params.load ? true : false
      , _s3service
      , _prefix
      , _templateFile
      , _renderer
      , _projectActionsMap
      , _presignedUrl
      , _expirationSec = 60
      , _xmlFilesDocument
      , _files
      , _fileResponse
      , _currentScript = runtimeModule.getCurrentScript()
      , _useAcctNum = _currentScript.getParameter({name:'custscript_bbss_use_acct_num'})
      ;
    if (_request.method === 'GET') {
      if (!_projectId) {
        throw "Missing project parameter.";
      }

      if(_load){
        _prefix = getPrefix(_projectId);

        if(_useAcctNum){
          _prefix = runtimeModule.accountId + '/' + _prefix;
        }
        _prefix = _prefix.replace(/[^a-zA-Z0-9 _\/]/g,'');
        //log.debug('prefix',_prefix);

        _s3service = new s3.Service();
        _s3service.loadCredentials();
        _s3service._service = 's3';

        _presignedUrl = _s3service.getPresignedListUrl(_prefix, _expirationSec);
        _fileResponse  = httpsModule.get({ url: _presignedUrl });
        
        if (_fileResponse.code / 100 !== 2) {
          throw ["Error occurred calling Amazon (", _fileResponse.code, ").", "\n", _fileResponse.body].join('');
        }

        _xmlFilesDocument = xmlModule.Parser.fromString({ text : _fileResponse.body.replace('xmlns="http://s3.amazonaws.com/doc/2006-03-01/"', '') });
        _files = xmlModule.XPath
          .select({ node : _xmlFilesDocument, xpath: '/ListBucketResult/Contents/Key' })
          .map(function(node){
            return node.textContent;
          });
        _projectActionsMap = getProjectActions(_projectId);

        _projectActionsMap.forEach(function(pam){
          pam.packageActions.forEach(function(pa){
            pa.files = _files.filter(function(f){
              return typeof f === 'string' && f.indexOf(pa.packageActionPath) > -1;
            });
            pa.files = pa.files.map(function(f){
              var
                  _fileName = f.substr(f.lastIndexOf('/')+1)
                  , _path = (_useAcctNum ? runtimeModule.accountId+'/':'') +  [pa.packageActionPath.replace(runtimeModule.accountId+'/',''), encodeURIComponent(_fileName)].join('/')
                  , _thumbpath = (_useAcctNum ? runtimeModule.accountId+'-thumbnails/':'') +  [pa.packageActionPath.replace(runtimeModule.accountId+'/',''), encodeURIComponent(_fileName)].join('/')
              ;
              return {
                key: f
                , path: _path
                , thumbpath: _thumbpath
                , filename: _fileName
              };
            });
          })
        });

        _projectActionsMap = _projectActionsMap.filter(function(pam){
          pam.packageActions = pam.packageActions.filter(function(pa){
            return pa.files instanceof Array && pa.files.length > 0;
          });
          return pam.packageActions instanceof Array && pam.packageActions.length > 0;
        });
      }

      _templateFile = fileModule.load({ id: './BB.ShowAllPaFiles.ftl'});

      _renderer = renderModule.create();

      _renderer.templateContent = _templateFile.getContents();

      _renderer.addCustomDataSource({
        format: renderModule.DataSource.OBJECT,
        alias: 'data',
        data: {
          load: _load
          , loadUrl: urlModule.resolveScript({
              scriptId: _currentScript.id
              , deploymentId: _currentScript.deploymentId
              , params: {
                project: _projectId
                , load: true
              }
            })
          , packages: _projectActionsMap || []
        }
      });

      _response.write({output: _renderer.renderAsString() || 'No files found.'});
    }
  }

  return {
    onRequest: onRequest
  };
});