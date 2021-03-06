/**
  This is a wrapper for `ember-debug.js`
  Wraps the script in a function,
  and ensures that the script is executed
  only after the dom is ready
  and the application has initialized.

  Also responsible for sending the first tree.
**/

/* globals Ember, adapter, requireModule */

var currentAdapter = 'basic';
if (typeof adapter !== 'undefined') {
  currentAdapter = adapter;
}

(function(adapter) {
  onEmberReady(function() {
    // global to prevent injection
    if (window.NO_EMBER_DEBUG) {
      return;
    }
    // prevent from injecting twice
    if (!Ember.Debug) {
      window.EmberInspector = Ember.Debug = requireModule('ember-debug/main')['default'];
      Ember.Debug.Adapter = requireModule('ember-debug/adapters/' + adapter)['default'];

      onApplicationStart(function appStarted(app) {
        app.__inspector__booted = true;
        Ember.Debug.set('application', app);
        Ember.Debug.start(true);
        // Watch for app reset
        app.reopen({
          reset: function() {
            this.__inspector__booted = false;
            this._super.apply(this, arguments);
          },
          willDestroy: function() {
            Ember.Debug.destroyContainer();
            Ember.Debug.set('application', null);
            this._super.apply(this, arguments);
          }
        });
      });
    }
  });

  function onEmberReady(callback) {
    var triggered = false;
    var triggerOnce = function() {
      if (triggered) { return; }
      if (!window.Ember) { return; }
      // `Ember.Application` load hook triggers before all of Ember is ready.
      // In this case we ignore and wait for the `Ember` load hook.
      if (!window.Ember.RSVP) { return; }
      triggered = true;
      callback();
    };
    // Newest Ember versions >= 1.10
    window.addEventListener('Ember', triggerOnce, false);
    // Old Ember versions
    window.addEventListener('Ember.Application', triggerOnce, false);
    // Oldest Ember versions or if this was injected after Ember has loaded.
    onReady(triggerOnce);
  }

  function onReady(callback) {
    if (document.readyState === 'complete') {
      setTimeout(completed);
    } else {
      document.addEventListener( "DOMContentLoaded", completed, false);
      // For some reason DOMContentLoaded doesn't always work
      window.addEventListener( "load", completed, false );
    }

    function completed() {
      document.removeEventListener( "DOMContentLoaded", completed, false );
      window.removeEventListener( "load", completed, false );
      callback();
    }
  }

  // There's probably a better way
  // to determine when the application starts
  // but this definitely works
  function onApplicationStart(callback) {
    if (typeof Ember === 'undefined') {
      return;
    }
    var apps = getApplications();
    var app;
    for (var i = 0, l = apps.length; i < l; i++) {
      app = apps[i];
      if (app._readinessDeferrals === 0) {
        // App started
        callback(app);
        break;
      }
    }
    Ember.Application.initializer({
      name: 'ember-inspector-booted',
      initialize: function(container, app) {
        app.reopen({
          didBecomeReady: function() {
            callback(app);
            return this._super.apply(this, arguments);
          }
        });
      }
    });
  }

  function getApplications() {
    var namespaces = Ember.A(Ember.Namespace.NAMESPACES);

    return namespaces.filter(function(namespace) {
      return namespace instanceof Ember.Application;
    });
  }

}(currentAdapter));
