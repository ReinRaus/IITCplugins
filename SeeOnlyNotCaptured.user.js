// ==UserScript==
// @id             iitc-plugin-seeonlynotcaptured@jonatkins
// @name           IITC plugin: SeeOnlyNotCaptured v 1.0.0
// @author         ReinRaus
// @version        1.0.0
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @category       Highlights
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://github.com/ReinRaus/IITCplugins/raw/main/SeeOnlyNotCaptured.user.js
// @downloadURL    https://github.com/ReinRaus/IITCplugins/raw/main/SeeOnlyNotCaptured.user.js
// @description    Show only not captured portal
// @include        https://intel.ingress.com/*
// @include        http://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// ==/UserScript==

/*global
L, layerChooser, map, $, isLayerGroupDisplayed
*/

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'iitc-plugin-seeonlynotcaptured';
plugin_info.dateTimeVersion = '20210312';
plugin_info.pluginId = 'iitc-plugin-seeonlynotcaptured';
//END PLUGIN AUTHORS NOTE

// PLUGIN START ////////////////////////////////////////////////////////
// use own namespace for plugin

window.plugin[ plugin_info.pluginId ] = function() {};
var plugin = window.plugin[ plugin_info.pluginId ];
plugin.id = plugin_info.pluginId;

var storage;
try {
    storage = JSON.parse( localStorage[ plugin.id ] );
    if ( !storage.capturedGUIDs ) storage.capturedGUIDs = [];
} catch(e) {
    storage = {capturedGUIDs:[]};
    localStorage[ plugin.id ] = JSON.stringify( storage );
}

plugin.showLayerByName = function ( layerName, show ) {
    layerChooser.showLayer(
        layerChooser.getLayers().overlayLayers.find( el=>el.name==layerName ).layerId,
        show );
};

plugin.injectCSS = function (str) {
    var node = document.createElement('style');
    node.innerHTML = str;
    document.body.appendChild(node);
};
plugin.injectCSS( "path:hover {stroke-opacity:1 !important; fill-opacity:0.5 !important;}" ); // стандартная прозрачность, но для hover

plugin.start = function() {

  window.addPortalHighlighter( 'Only not captured', (portal)=>{
      if ( portal.portal.options.ent[2][18] && ((portal.portal.options.ent[2][18] & 2) == 2) ){
          if ( !storage.capturedGUIDs.includes( portal.portal.options.guid ) ) {
              storage.capturedGUIDs.push( portal.portal.options.guid );
              localStorage[ plugin.id ] = JSON.stringify( storage );
          };
      };
      if ( !storage.capturedGUIDs.includes( portal.portal.options.guid ) ) portal.portal.setStyle({weight: 3.5, fillOpacity:1});
      else portal.portal.setStyle({opacity: 0.1, fillOpacity:0.1});
  } );

  $( "#portal_highlight_select" ).on( "change", function (event) {
      if ( this.value == "Only not captured" ) {
          storage.saveLayerFields = isLayerGroupDisplayed( "Fields" );
          storage.saveLayerLinks = isLayerGroupDisplayed( "Links" );
          localStorage[ plugin.id ] = JSON.stringify( storage );
          plugin.showLayerByName( "Fields", false );
          plugin.showLayerByName( "Links", false );
      } else {
          plugin.showLayerByName( "Fields", storage.saveLayerFields );
          plugin.showLayerByName( "Links", storage.saveLayerLinks );
      };
  } );

};

var setup = plugin.start;

// PLUGIN END //////////////////////////////////////////////////////////

setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
