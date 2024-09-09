/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record', 'N/search', 'N/file', 'N/render', 'N/ui/serverWidget', 'N/url', 'N/runtime', '../BB SS/SS Lib/bb_framework_all'],

  function (recordModule, searchModule, fileModule, renderModule, serverWidget, urlModule, runtimeModule, bbFrameworkModule) {

    function getData(_searchId) {
      var
        _data = []
        , _search = searchModule.load({id: _searchId})
        , _columns = {}
      ;

      _search.columns.forEach(function (column) {
        if(column.label) {
          _columns[column.label] = column;
        }
      });


      _search.run().each(function(row){
        var
          _lat = row.getValue(_columns['lat'])
          , _long = row.getValue(_columns['long'])
          , _content = row.getValue(_columns['content'])
          , _title = row.getValue(_columns['title'])
          , _url = urlModule.resolveRecord({
            recordType: row.recordType
          , recordId: row.id
          })
        ;

        _content = [_content, '</br>', '<a target="_blank" href="', _url, '">View</a>'].join('');

        _data.push({
          position: {lat: Number(_lat), lng: Number(_long)}
          , content: _content
          , title: _title
        });

        return true;
      });


      return _data;
    }

    function render(context){
      const
        _request = context.request
        , _params = _request.parameters
        , _searchId = _params.searchId
        , _executingScript = runtimeModule.getCurrentScript()
        , _credentialsId = _executingScript.getParameter({name: 'custscript_bb_ss_credentials'})
        , _credentials = _credentialsId ? searchModule.lookupFields({
          type: 'customrecord_system_credentials'
          , id: _credentialsId
          , columns: ['name']
        }) : undefined
        , _credentialsName = typeof _credentials.name === 'string'  && _credentials.name.trim().length > 0
        ? _credentials.name
        : undefined
        , _credentialsData = typeof _credentialsName === 'string' ? new APICredentialsSs2().init(_credentialsName) : undefined
        , _apiKey = _credentialsData ? _credentialsData.getToken() : undefined
      ;

      var
        _htmlFile = fileModule.load({id:'./template.html'})
        , _html = _htmlFile.getContents()
        , _templateRender
        //, _currentScript = runtimeModule.getCurrentScript()
        //, _searchId = _currentScript.getParameter({name: 'custscript_calendar_control_search'})
        , _markers = getData(_searchId)
      ;

      _templateRender = renderModule.create();
      _templateRender.templateContent = _html;
      _templateRender.addCustomDataSource({
        format: renderModule.DataSource.OBJECT,
        alias: 'data',
        data: {
          markers: JSON.stringify(_markers)
          // , apiKey: 'AIzaSyDdli_8EmmKLwWiVn_9BfAXk9Q34teMdFk'
          , apiKey: _apiKey ? _apiKey : ''
        }
      });
      return _templateRender.renderAsString();
    }

    function onRequest(context) {

      context.response.write(render(context));
    }

    return {
      onRequest: onRequest
    };

})