/*
 * pixnet-snippet v0.3.0
 * https://github.com/emn178/pixnet-snippet
 *
 * Copyright 2015, emn178@gmail.com
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */
;(function($, window, document, undefined) {
  'use strict';

  var localStorage = window.localStorage || {};
  var tmpData = {};

  var user = $.query.get('pix.user') || 'guest';
  var proxy_url = $.query.get('proxy_url') + '?addon_id=' + $.query.get('addon_id') + '&pToken=' + $.query.get('pToken');
  var windowProxy = new Porthole.WindowProxy( proxy_url );
  var loaded = false, firebaseLoaded = false;

  Array.prototype.indexOfObject = function(obj, property) {
    var value = obj[property];
    for(var i = 0;i < this.length;++i) {
      if(this[i][property] == value) {
        return i;
      }
    }
    return -1;
  }

  function response(html) {
    var ret = $.query.get('addon_id') + "||PIXNET||" + html;
    windowProxy.postMessage(ret);
  }


  angular.module('pixnet-snippet', ['ngRoute', 'ngResource', 'firebase'])
  .value('fbURL', 'https://pixnet-snippet.firebaseIO.com/')
  .service('fbRef', function(fbURL) {
    return new Firebase(fbURL);
  })
  .service('Snippets', function($firebaseArray, fbRef) {
    var self = this, snippets;
    var fetchFromFireBase = function(load) {
      var ref = fbRef.child(user + '/snippets');
      ref.on('value', load);
      return $firebaseArray(ref);
    };
    var fetchFromLocal = function() {
      if(!localStorage.snippets) {
        return null;
      }
      var cacheTime = new Date(localStorage.cacheTime || 0)
      if(new Date().getTime() - cacheTime > 6000 * 5) {
        return null;
      }
      return angular.fromJson(localStorage.snippets);
    };
    var saveToLocal = function() {
      localStorage.cacheTime = new Date().getTime();
      localStorage.snippets = angular.toJson(snippets);
    };
    this.fetch = function (load) {
      if (snippets) {
        return snippets;
      }
      var ref = fbRef.child(user + '/snippets');
      ref.on('value', function(a) {
        if(load) {
          load.call(self, snippets);
        }
      });
      snippets = $firebaseArray(ref);
      snippets.$loaded(saveToLocal);
      var cache = fetchFromLocal();
      if (cache) {
        if(load) {
          load.call(self, cache);
        }
        return cache;
      }
      return snippets;
    };
    this.add = function(snippet) {
      return snippets.$add(snippet).then(saveToLocal);
    };
    this.get = function(id) {
      var index = snippets.$indexFor(id);
      return snippets[index];
    };
    this.remove = function(snippet, callback) {
      snippets.$remove(snippet).then(callback).then(saveToLocal);
    };
    this.save = function(snippet, callback) {
      snippets.$save(snippet).then(callback).then(saveToLocal);
    }
  })
   
  .config(function($routeProvider) {
    $routeProvider
      .when('/', {
        controller:'SnippetListController',
        templateUrl:'list.html'
      })
      .when('/edit/:snippetId', {
        controller:'EditSnippetController',
        templateUrl:'detail.html'
      })
      .when('/new', {
        controller:'NewSnippetController',
        templateUrl:'detail.html'
      })
      .when('/preview', {
        controller:'SnippetPreviewController',
        templateUrl:'preview.html'
      })
      .otherwise({
        redirectTo:'/'
      });
  })
   
  .controller('SnippetListController', function($scope, $location, Snippets) {
    $scope.loaded = loaded;
    $scope.firebaseLoaded = firebaseLoaded;

    $scope.snippets = Snippets.fetch(function(snippets) {
      loaded = $scope.loaded = true;
      if(snippets && snippets.$add) {
        firebaseLoaded = $scope.firebaseLoaded = true;
      }
    });

    $scope.choose = function(snippet) {
      if(snippet.variables && snippet.variables.length > 0) {
        tmpData.snippet = snippet;
        $location.path('/preview');
      } else {
        response(snippet.html);
      }
    };
  })
   
  .controller('SnippetPreviewController', function($scope) {
    $scope.snippet = tmpData.snippet;
    $scope.variables = [];
    $scope.preview = function() {
      var html = $scope.snippet.html;
      $scope.snippet.variables.forEach(function(variable, index) {
        var name = variable.name.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        var reg = new RegExp(name, 'g');
        var value = $scope.variables[index] || '';
        if(variable.plain) {
          value = htmlEncode(value);
        }
        html = html.replace(reg, value);
      });
      return html;
    };

    $scope.submit = function() {
      response($scope.preview());
    };
  })
   
  .controller('NewSnippetController', function($scope, $location, Snippets) {
    $scope.snippet = {variables: []};
    $scope.save = function() {
      Snippets.add($scope.snippet).then(function(data) {
        $location.path('/');
      });
    };
  })
   
  .controller('EditSnippetController', function($scope, $location, $routeParams, Snippets) {
    var id = $routeParams.snippetId;
    $scope.snippet = Snippets.get(id);
    $scope.snippet.variables = $scope.snippet.variables || [];

    $scope.destroy = function() {
      if(confirm('確定刪除？')) {
        Snippets.remove($scope.snippet, function(data) {
          $location.path('/');
        });
      }
    };
 
    $scope.save = function() {
      Snippets.save($scope.snippet, function(data) {
        $location.path('/');
      });
    };
  })

  .controller('VariableController', function($scope) {
    var seq = 1;
    $scope.addVariable = function() {
      var variable = {name: '$VAR' + (seq++)};
      var index = $scope.snippet.variables.indexOfObject(variable, 'name');
      while(index != -1) {
        variable.name = '$VAR' + (seq++);
        index = $scope.snippet.variables.indexOfObject(variable, 'name');
      }
      $scope.snippet.variables.push(variable);
    };
    $scope.removeVariable = function(index) {
      $scope.snippet.variables.splice(index, 1);
    };
  });
})(jQuery, window, document);
